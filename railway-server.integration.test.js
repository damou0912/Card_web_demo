const assert = require("assert");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");

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
  const child = spawn(process.execPath, [path.join(__dirname, "railway-server.js")], {
    cwd: __dirname,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const clients = [];
  try {
    await waitForServer(child, port);
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

    host.send({ type: "set-deck", deckKey: "三国~蜀" });
    host.send({ type: "set-ready", ready: true });
    playerTwo.send({ type: "set-deck", deckKey: "三国~魏" });
    playerTwo.send({ type: "set-ready", ready: true });
    await host.waitForType("match-start");
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

    console.log("Railway room, spectator, and reconnect integration test passed");
  } finally {
    clients.forEach((client) => client.close());
    child.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
