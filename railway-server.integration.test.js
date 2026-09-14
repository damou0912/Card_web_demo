const assert = require("assert");
const fs = require("fs");
const http = require("http");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

function makeDefaultDeckIds(campPrefix) {
  return [
    ["1", 1, 7], ["2", 8, 12], ["3", 13, 15], ["4", 16, 16], ["5", 17, 20]
  ].flatMap(([rarity, start, end]) => Array.from(
    { length: end - start + 1 },
    (_, index) => `${campPrefix}${rarity}${String(start + index).padStart(2, "0")}`
  ));
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function requestJson(port, method, requestPath, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : JSON.stringify(body);
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path: requestPath,
      method,
      headers: payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}
    }, (response) => {
      let raw = "";
      response.on("data", (chunk) => { raw += chunk; });
      response.on("end", () => {
        try {
          resolve({ status: response.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.once("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

class TestClient {
  constructor(url) {
    this.messages = [];
    this.waiters = [];
    this.socket = new WebSocket(url);
    this.socket.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      const waiterIndex = this.waiters.findIndex((waiter) => waiter.predicate(message));
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(message);
      } else {
        this.messages.push(message);
      }
    });
  }

  open() {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.once("open", resolve);
      this.socket.once("error", reject);
    });
  }

  send(message) {
    this.socket.send(JSON.stringify(message));
  }

  waitFor(predicate, timeoutMs = 3000) {
    const queuedIndex = this.messages.findIndex(predicate);
    if (queuedIndex >= 0) return Promise.resolve(this.messages.splice(queuedIndex, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve, reject, timer: null };
      waiter.timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(new Error("Timed out waiting for WebSocket message"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  waitForType(type, timeoutMs) {
    return this.waitFor((message) => message.type === type, timeoutMs);
  }

  waitForClose(timeoutMs = 3000) {
    if (this.socket.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out waiting for socket close")), timeoutMs);
      this.socket.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  close() {
    if (this.socket.readyState < WebSocket.CLOSING) this.socket.close();
  }
}

function waitForServer(child, port) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out starting Railway server")), 5000);
    const onData = (chunk) => {
      if (!String(chunk).includes(`:${port}`)) return;
      clearTimeout(timer);
      child.stdout.off("data", onData);
      resolve();
    };
    child.stdout.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Railway server exited early with code ${code}`));
    });
  });
}

(async () => {
  const port = await reservePort();
  const testDataFile = path.join(os.tmpdir(), `card-demo-integration-${process.pid}-${Date.now()}.json`);
  const child = spawn(process.execPath, [path.join(__dirname, "railway-server.js")], {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: "", GAME_DATA_FILE: testDataFile, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const clients = [];
  try {
    await waitForServer(child, port);
    const initialProfile = await requestJson(port, "GET", "/api/profile/player1");
    assert.equal(initialProfile.status, 200);
    assert.equal(initialProfile.body.challengeHighestLevel, 0);
    assert.equal(initialProfile.body.challengeClearCount, 0);

    assert.equal((await requestJson(port, "GET", "/api/challenge/progress/player1")).body.level, 0);
    assert.equal((await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 5 })).status, 200);
    let challengeProfile = (await requestJson(port, "GET", "/api/profile/player1")).body;
    assert.equal(challengeProfile.challengeHighestLevel, 5);
    assert.equal(challengeProfile.challengeClearCount, 0);

    await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 3 });
    challengeProfile = (await requestJson(port, "GET", "/api/profile/player1")).body;
    assert.equal(challengeProfile.challengeHighestLevel, 5);

    await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 12 });
    await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 12 });
    challengeProfile = (await requestJson(port, "GET", "/api/profile/player1")).body;
    assert.equal(challengeProfile.challengeHighestLevel, 12);
    assert.equal(challengeProfile.challengeClearCount, 1);

    await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 1 });
    await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 12 });
    assert.equal((await requestJson(port, "GET", "/api/profile/player1")).body.challengeClearCount, 2);
    assert.equal((await requestJson(port, "POST", "/api/challenge/clear", { username: "player1" })).status, 200);
    assert.equal((await requestJson(port, "GET", "/api/challenge/progress/player1")).body.level, 0);
    challengeProfile = (await requestJson(port, "GET", "/api/profile/player1")).body;
    assert.equal(challengeProfile.challengeHighestLevel, 12);
    assert.equal(challengeProfile.challengeClearCount, 2);
    assert.equal((await requestJson(port, "POST", "/api/challenge/progress", { username: "player1", level: 13 })).status, 400);

    const defaultShuDeck = makeDefaultDeckIds("01");
    const customShuDeck = [...defaultShuDeck];
    customShuDeck[0] = "01121";
    const initialDecks = await requestJson(port, "GET", "/api/custom-decks/player1");
    assert.equal(initialDecks.status, 200);
    assert.deepEqual(initialDecks.body.decks, {});
    const initializedData = JSON.parse(fs.readFileSync(testDataFile, "utf8"));
    assert.deepEqual(Object.keys(initializedData.cards.player1), ["owned"]);
    assert.equal("deckSlots" in initializedData.cards.player1, false);
    const saveDeck = await requestJson(port, "POST", "/api/save-custom-deck", {
      username: "player1", camp: "三国~蜀", deckData: { version: 2, cardIds: customShuDeck }
    });
    assert.equal(saveDeck.status, 200);
    const savedDecks = await requestJson(port, "GET", "/api/custom-decks/player1");
    assert.deepEqual(savedDecks.body.decks["三国~蜀"].cardIds, customShuDeck);
    const replacementShuDeck = [...defaultShuDeck];
    replacementShuDeck[0] = "01122";
    const overwriteDeck = await requestJson(port, "POST", "/api/save-custom-deck", {
      username: "player1", camp: "三国~蜀", deckData: { version: 2, cardIds: replacementShuDeck }
    });
    assert.equal(overwriteDeck.status, 200);
    const overwrittenDecks = await requestJson(port, "GET", "/api/custom-decks/player1");
    assert.deepEqual(Object.keys(overwrittenDecks.body.decks), ["三国~蜀"]);
    assert.deepEqual(overwrittenDecks.body.decks["三国~蜀"].cardIds, replacementShuDeck);
    const invalidDeck = await requestJson(port, "POST", "/api/save-custom-deck", {
      username: "player1", camp: "三国~蜀", deckData: { version: 2, cardIds: makeDefaultDeckIds("02") }
    });
    assert.equal(invalidDeck.status, 400);
    const resetDeck = await requestJson(port, "POST", "/api/reset-custom-deck", { username: "player1", camp: "三国~蜀" });
    assert.equal(resetDeck.status, 200);
    assert.deepEqual((await requestJson(port, "GET", "/api/custom-decks/player1")).body.decks, {});
    const makeClient = async () => {
      const client = new TestClient(`ws://127.0.0.1:${port}`);
      clients.push(client);
      await client.open();
      await client.waitForType("room-list");
      return client;
    };

    const reconnectObserver = await makeClient();
    const originalWaitingHost = await makeClient();
    originalWaitingHost.send({ type: "create-room", playerName: "ReHost", boardSize: 4 });
    const waitingCreated = await originalWaitingHost.waitForType("room-created");
    const takeoverClient = await makeClient();
    takeoverClient.send({ type: "resume-room", roomCode: waitingCreated.roomCode, playerName: "DifferentName", sessionToken: waitingCreated.sessionToken });
    const waitingTakeover = await takeoverClient.waitForType("room-resumed");
    assert.equal((await originalWaitingHost.waitForType("session-replaced")).type, "session-replaced");
    await originalWaitingHost.waitForClose();
    assert.equal(waitingTakeover.started, false);
    assert.equal(waitingTakeover.playerName, "ReHost");
    assert.notEqual(waitingTakeover.sessionToken, waitingCreated.sessionToken);
    assert.equal(waitingTakeover.roomState.connectedPlayers[1], true);

    const staleTokenClient = await makeClient();
    staleTokenClient.send({ type: "resume-room", roomCode: waitingCreated.roomCode, playerName: "ReconnectHost", sessionToken: waitingCreated.sessionToken });
    assert.equal((await staleTokenClient.waitForType("resume-failed")).type, "resume-failed");

    takeoverClient.close();
    await takeoverClient.waitForClose();
    await reconnectObserver.waitFor((message) => message.type === "room-list"
      && message.rooms.some((room) => room.roomCode === waitingCreated.roomCode && room.playerCount === 1 && room.connectedPlayerCount === 0));
    const waitingResumeClient = await makeClient();
    waitingResumeClient.send({ type: "resume-room", roomCode: waitingCreated.roomCode, playerName: "ReHost", sessionToken: waitingTakeover.sessionToken });
    const waitingResumed = await waitingResumeClient.waitForType("room-resumed");
    assert.equal(waitingResumed.started, false);
    assert.equal(waitingResumed.roomState.hasPlayers[1], true);
    assert.equal(waitingResumed.roomState.connectedPlayers[1], true);
    assert.notEqual(waitingResumed.sessionToken, waitingTakeover.sessionToken);
    waitingResumeClient.send({ type: "leave-room" });
    await waitingResumeClient.waitForClose();
    await reconnectObserver.waitFor((message) => message.type === "room-list"
      && !message.rooms.some((room) => room.roomCode === waitingCreated.roomCode));

    const host = await makeClient();
    const playerTwo = await makeClient();
    const spectatorOne = await makeClient();
    const spectatorTwo = await makeClient();
    const spectatorThree = await makeClient();

    host.send({ type: "create-room", playerName: "Host", boardSize: 5 });
    const created = await host.waitForType("room-created");
    const roomCode = created.roomCode;
    assert.match(roomCode, /^[A-F0-9]{6}$/);

    const listedWaitingRoom = await spectatorOne.waitFor((message) => message.type === "room-list"
      && message.rooms.some((room) => room.roomCode === roomCode && room.playerCount === 1 && room.canJoin));
    assert.equal(listedWaitingRoom.rooms.find((room) => room.roomCode === roomCode).spectatorCapacity, 2);

    playerTwo.send({ type: "join-room", roomCode, playerName: "Guest" });
    const playerTwoJoined = await playerTwo.waitForType("room-joined");
    spectatorOne.send({ type: "join-spectator", roomCode, spectatorName: "WatchA" });
    spectatorTwo.send({ type: "join-spectator", roomCode, spectatorName: "WatchB" });
    assert.equal((await spectatorOne.waitForType("spectator-joined")).spectatorId, 1);
    assert.equal((await spectatorTwo.waitForType("spectator-joined")).spectatorId, 2);

    spectatorThree.send({ type: "join-spectator", roomCode, spectatorName: "WatchC" });
    const fullError = await spectatorThree.waitForType("error");
    assert.match(fullError.message, /观战席/);

    const hostDeckCardIds = makeDefaultDeckIds("01");
    const playerTwoDeckCardIds = makeDefaultDeckIds("02");
    host.send({ type: "set-deck", deckKey: "三国~蜀", deckCardIds: hostDeckCardIds });
    host.send({ type: "set-ready", ready: true });
    playerTwo.send({ type: "set-deck", deckKey: "三国~魏", deckCardIds: playerTwoDeckCardIds });
    playerTwo.send({ type: "set-ready", ready: true });
    const matchStart = await host.waitForType("match-start");
    assert.deepEqual(matchStart.deckCardIds[1], hostDeckCardIds);
    assert.deepEqual(matchStart.deckCardIds[2], playerTwoDeckCardIds);
    await spectatorOne.waitForType("match-start");

    const gameState = JSON.stringify({
      ruleset: "core-v2",
      cardDataVersion: "card-info-v2-display-effect-isolation-20260908",
      runtimeSchemaVersion: "runtime-display-effect-isolation-20260909",
      activePlayerId: 1,
      turn: 1,
      winner: null,
      boardCards: [],
      players: [
        { id: 1, hand: [{ uid: "p1-card", id: "01101" }], drawPile: [{ uid: "p1-deck" }] },
        { id: 2, hand: [{ uid: "p2-card", id: "02101" }], drawPile: [{ uid: "p2-deck" }] }
      ]
    });
    host.send({ type: "state-sync", state: gameState });
    const spectatorState = JSON.parse((await spectatorOne.waitForType("state-sync")).state);
    assert.deepEqual(spectatorState.players.map((player) => player.hand[0]), [
      { uid: "p1-card", hidden: true },
      { uid: "p2-card", hidden: true }
    ]);

    spectatorOne.send({ type: "action-request", action: { type: "place" } });
    const readOnly = await spectatorOne.waitForType("spectator-read-only");
    assert.match(readOnly.message, /只读/);

    const freeMoveState = JSON.stringify({
      ...JSON.parse(gameState),
      actionsUsed: 1,
      boardCards: [{ uid: "03416-card", id: "03416", ownerId: 1, row: 1, col: 1, restedTurn: null, lastMovedTurn: null, freeMove: true }],
    });
    host.send({ type: "state-sync", state: freeMoveState });
    host.send({ type: "action-request", action: {
      type: "move", cardUid: "03416-card", source: { row: 1, col: 1 }, target: { row: 1, col: 2 }
    } });
    const freeMoveForwarded = await host.waitFor((message) => message.type === "action-request" && message.action?.cardUid === "03416-card");
    assert.equal(freeMoveForwarded.action.target.col, 2);

    playerTwo.close();
    await playerTwo.waitForClose();
    const peerLeft = await host.waitForType("peer-left");
    assert.equal(peerLeft.playerId, 2);
    assert.ok(peerLeft.reconnectDeadline > Date.now());
    const resumedPlayerTwo = await makeClient();
    resumedPlayerTwo.send({ type: "resume-room", roomCode, playerName: "ChangedName", sessionToken: playerTwoJoined.sessionToken });
    const activeResume = await resumedPlayerTwo.waitForType("room-resumed");
    assert.equal(activeResume.started, true);
    assert.equal(activeResume.playerName, "Guest");
    assert.notEqual(activeResume.sessionToken, playerTwoJoined.sessionToken);
    const resumedState = JSON.parse(activeResume.state);
    assert.deepEqual(resumedState.players[0].hand[0], { uid: "p1-card", hidden: true });
    assert.equal(resumedState.players[1].hand[0].uid, "p2-card");
    assert.equal((await host.waitForType("peer-reconnected")).playerId, 2);

    spectatorOne.send({ type: "leave-room" });
    await spectatorOne.waitForClose();
    host.send({ type: "list-rooms" });
    const afterLeave = await host.waitFor((message) => message.type === "room-list"
      && message.rooms.some((room) => room.roomCode === roomCode && room.spectatorCount === 1));
    assert.equal(afterLeave.rooms.find((room) => room.roomCode === roomCode).playerCount, 2);
    assert.equal(host.socket.readyState, WebSocket.OPEN);
    assert.equal(resumedPlayerTwo.socket.readyState, WebSocket.OPEN);

    console.log("Railway custom deck, room, spectator, and reconnect integration test passed");
  } finally {
    clients.forEach((client) => client.close());
    child.kill();
    fs.rmSync(testDataFile, { force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
