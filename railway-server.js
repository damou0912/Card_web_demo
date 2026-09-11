const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

// 自动检测数据库驱动
let db;
if (process.env.DATABASE_URL) {
  console.log("🗄️  使用 PostgreSQL 数据库");
  db = require("./db-postgres");
} else {
  console.log("📁 使用 JSON 文件存储");
  db = require("./db");
}

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const rooms = new Map();
const SPECTATOR_CAPACITY = 2;
const RECONNECT_GRACE_MS = Math.max(100, Number(process.env.RECONNECT_GRACE_MS) || 5 * 60 * 1000);
const PLAYER_ID_ALLOWED = /^[A-Za-z0-9_\-\.\!\?@#\+=\u3400-\u9fff]+$/;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml"
};
const publicExtensions = new Set(Object.keys(contentTypes));

function normalizePlayerName(value) {
  return String(value || "").trim().replace(/[<>]/g, "").slice(0, 12);
}

function isValidPlayerName(value) {
  const name = normalizePlayerName(value);
  const units = [...name].reduce((total, character) => total + (/^[\u3400-\u9fff]$/.test(character) ? 2 : 1), 0);
  return Boolean(name) && PLAYER_ID_ALLOWED.test(name) && units <= 12;
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function makeRoomCode() {
  let code;
  do code = crypto.randomBytes(3).toString("hex").toUpperCase(); while (rooms.has(code));
  return code;
}

function makeSessionToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function sessionTokenMatches(providedValue, expectedValue) {
  const provided = typeof providedValue === "string" ? Buffer.from(providedValue) : Buffer.alloc(0);
  const expected = typeof expectedValue === "string" ? Buffer.from(expectedValue) : Buffer.alloc(0);
  return provided.length === expected.length && provided.length > 0 && crypto.timingSafeEqual(provided, expected);
}

function playerIdForSessionToken(room, sessionToken) {
  if (!room) return null;
  return [1, 2].find((playerId) => sessionTokenMatches(sessionToken, room.tokens[playerId])) || null;
}

function roomSockets(room) {
  return [room.players[1], room.players[2], ...Object.values(room.spectators || {})].filter(Boolean);
}

function broadcast(room, message, except = null) {
  roomSockets(room).forEach((socket) => {
    if (socket && socket !== except) send(socket, message);
  });
}

function connectedPlayerCount(room) {
  return [room.players[1], room.players[2]].filter(Boolean).length;
}

function occupiedPlayerCount(room) {
  return [1, 2].filter((playerId) => Boolean(room.tokens[playerId])).length;
}

function availablePlayerId(room) {
  return [1, 2].find((playerId) => !room.tokens[playerId]) || null;
}

function spectatorCount(room) {
  return Object.values(room.spectators || {}).filter(Boolean).length;
}

function publicRoomState(room) {
  const playerCount = occupiedPlayerCount(room);
  const connectedPlayers = connectedPlayerCount(room);
  const watchers = spectatorCount(room);
  return {
    roomCode: room.code,
    boardSize: room.boardSize,
    names: room.names,
    playerCount,
    connectedPlayerCount: connectedPlayers,
    playerCapacity: 2,
    spectatorCount: watchers,
    spectatorCapacity: SPECTATOR_CAPACITY,
    started: room.started,
    ended: Boolean(room.ended),
    createdAt: room.createdAt,
    canJoin: !room.started && Boolean(availablePlayerId(room)),
    canSpectate: !room.ended && (room.started || connectedPlayers === 2) && watchers < SPECTATOR_CAPACITY
  };
}

function publicRoomList() {
  return [...rooms.values()]
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(publicRoomState);
}

function sendRoomList(socket) {
  send(socket, { type: "room-list", rooms: publicRoomList() });
}

function broadcastRoomList() {
  const message = { type: "room-list", rooms: publicRoomList() };
  websocket.clients.forEach((socket) => send(socket, message));
}

function clearDisconnectTimer(room, playerId) {
  if (room.disconnectTimers?.[playerId]) clearTimeout(room.disconnectTimers[playerId]);
  if (room.disconnectTimers) room.disconnectTimers[playerId] = null;
}

function releasePlayerSeat(room, playerId) {
  clearDisconnectTimer(room, playerId);
  room.players[playerId] = null;
  room.names[playerId] = null;
  room.tokens[playerId] = null;
  room.decks[playerId] = null;
  room.ready[playerId] = false;
  room.disconnectedAt[playerId] = null;
}

function deleteRoomIfEmpty(room) {
  if (occupiedPlayerCount(room) > 0 || room.started) return false;
  Object.values(room.spectators || {}).forEach((watcher) => {
    if (watcher) send(watcher, { type: "spectator-session-ended", message: "玩家已离开，房间已关闭。" });
    watcher?.close();
  });
  rooms.delete(room.code);
  return true;
}

function expireDisconnectedPlayer(room, playerId) {
  if (!rooms.has(room.code) || room.players[playerId] || !room.disconnectedAt[playerId]) return;
  clearDisconnectTimer(room, playerId);
  if (!room.started) {
    releasePlayerSeat(room, playerId);
    broadcast(room, { type: "room-state", state: roomState(room) });
    deleteRoomIfEmpty(room);
    broadcastRoomList();
    return;
  }
  const winnerId = playerId === 1 ? 2 : 1;
  const winner = room.players[winnerId];
  if (winner) send(winner, { type: "auto-surrender", loserId: playerId, message: "对方断线超过 5 分钟，视为自动认输。" });
  Object.values(room.spectators || {}).forEach((watcher) => {
    if (watcher) send(watcher, { type: "spectator-session-ended", winnerId, message: "有玩家断线超时，本次观战已结束。" });
  });
  roomSockets(room).forEach((peer) => peer?.close());
  rooms.delete(room.code);
  broadcastRoomList();
}

function scheduleDisconnectExpiry(room, playerId) {
  clearDisconnectTimer(room, playerId);
  room.disconnectTimers[playerId] = setTimeout(() => expireDisconnectedPlayer(room, playerId), RECONNECT_GRACE_MS);
}

function removeSocket(socket) {
  if (socket.roomRemovalHandled) return;
  socket.roomRemovalHandled = true;
  const room = rooms.get(socket.roomCode);
  if (!room) return;
  if (socket.role === "spectator") {
    if (room.spectators?.[socket.spectatorId] === socket) {
      room.spectators[socket.spectatorId] = null;
      room.spectatorNames[socket.spectatorId] = null;
    }
    broadcast(room, { type: "room-state", state: roomState(room) }, socket);
    broadcastRoomList();
    return;
  }
  const playerId = Number(socket.playerId);
  if (![1, 2].includes(playerId) || room.players[playerId] !== socket) return;
  room.players[playerId] = null;
  if (socket.voluntaryLeave && !room.started) {
    releasePlayerSeat(room, playerId);
  } else {
    room.disconnectedAt[playerId] = Date.now();
    scheduleDisconnectExpiry(room, playerId);
  }
  broadcast(room, { type: "peer-left", playerId, reconnectDeadline: room.disconnectedAt[playerId] ? room.disconnectedAt[playerId] + RECONNECT_GRACE_MS : null }, socket);
  broadcast(room, { type: "room-state", state: roomState(room) }, socket);
  deleteRoomIfEmpty(room);
  broadcastRoomList();
}

function roomState(room) {
  return {
    roomCode: room.code,
    boardSize: room.boardSize,
    names: room.names,
    ready: room.ready,
    hasPlayers: { 1: Boolean(room.tokens[1]), 2: Boolean(room.tokens[2]) },
    connectedPlayers: { 1: Boolean(room.players[1]), 2: Boolean(room.players[2]) },
    spectatorNames: room.spectatorNames,
    spectatorCount: spectatorCount(room),
    spectatorCapacity: SPECTATOR_CAPACITY,
    started: room.started,
    ended: Boolean(room.ended),
    disconnectedAt: room.disconnectedAt
  };
}

function parseRoomGame(room) {
  if (!room?.state) return null;
  try {
    const game = typeof room.state === "string" ? JSON.parse(room.state) : room.state;
    return game && typeof game === "object" ? game : null;
  } catch (_error) {
    return null;
  }
}

function stateForViewer(state, viewerId) {
  if (!state) return state;
  // Player 1 is the browser-side rules host and must retain both hands to resolve player 2 actions.
  if (Number(viewerId) === 1) return state;
  try {
    const game = typeof state === "string" ? JSON.parse(state) : JSON.parse(JSON.stringify(state));
    game.players = (game.players || []).map((player) => {
      if (Number(player.id) === Number(viewerId)) return player;
      return {
        ...player,
        hand: Array.isArray(player.hand) ? player.hand.map((card) => ({ uid: card.uid, hidden: true })) : [],
        drawPile: Array.isArray(player.drawPile) ? player.drawPile.map(() => ({ hidden: true })) : []
      };
    });
    return JSON.stringify(game);
  } catch (_error) {
    return state;
  }
}

function sendGameState(socket, state) {
  const viewerId = socket.role === "spectator" ? null : socket.playerId;
  send(socket, { type: "state-sync", roomCode: socket.roomCode, state: stateForViewer(state, viewerId) });
}

function validCell(cell, size) {
  return Number.isInteger(cell?.row) && Number.isInteger(cell?.col)
    && cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
}

function validateActionRequest(room, playerId, action) {
  const game = parseRoomGame(room);
  if (!game || game.winner || game.activePlayerId !== playerId) return "当前不是你的行动回合。";
  if (game.turnDeadlineAt !== null && game.turnDeadlineAt !== undefined
    && Number.isFinite(Number(game.turnDeadlineAt)) && Date.now() >= Number(game.turnDeadlineAt)) return "本回合行动时间已结束。";
  const actionLimit = (Number(game.turn) === 1 ? 1 : 2) + (Number(game.extraActions) || 0);
  if (!action || !["place", "move"].includes(action.type) || action.playerId !== playerId) return "行动数据无效。";
  const size = [3, 4, 5].includes(Number(room.boardSize)) ? Number(room.boardSize) : 4;
  const cards = Array.isArray(game.boardCards) ? game.boardCards : [];
  const players = Array.isArray(game.players) ? game.players : [];
  const player = players.find((entry) => Number(entry.id) === playerId);
  if (!player) return "玩家状态无效。";
  if (action.type === "place") {
    if (Number(game.actionsUsed) >= actionLimit) return "本回合行动次数已用尽。";
    const inHand = Array.isArray(player.hand) && player.hand.some((card) => card.uid === action.cardUid);
    if (!inHand || !validCell(action.target, size)) return "放置位置或卡牌无效。";
    const broken = new Set((game.brokenCells || []).map((cell) => `${cell.row},${cell.col}`));
    if (broken.has(`${action.target.row},${action.target.col}`)) return "不能放置在破坏格。";
    if (cards.some((card) => card.row === action.target.row && card.col === action.target.col)) return "目标格已有卡牌。";
    return null;
  }
  const card = cards.find((entry) => entry.uid === action.cardUid && Number(entry.ownerId) === playerId);
  if (!card || !validCell(action.source, size) || !validCell(action.target, size)
    || card.row !== action.source.row || card.col !== action.source.col) return "移动卡牌或位置无效。";
  if (Number(game.actionsUsed) >= actionLimit
    && Number(card.freeActionTurn) !== Number(game.turn)
    && card.freeMove !== true) return "本回合行动次数已用尽。";
  if (action.source.row === action.target.row && action.source.col === action.target.col) return "移动目标必须不同于原位置。";
  const targetCard = cards.find((entry) => entry.row === action.target.row && entry.col === action.target.col);
  if (targetCard?.uid === card.uid) return "不能与自身交战。";
  if (card.restedTurn === game.turn || card.lastMovedTurn === game.turn) return "该卡牌本回合不能再次主动移动。";
  return null;
}

const server = http.createServer((request, response) => {
  let requestedPath = decodeURIComponent((request.url || "/").split("?")[0]);
  if (requestedPath === "/") requestedPath = "/index.html";
  if (requestedPath === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  // === API 端点 ===
  if (request.method === "GET" && requestedPath.startsWith("/api/challenge/progress/")) {
    const username = decodeURIComponent(requestedPath.slice("/api/challenge/progress/".length));
    const progress = db.getChallengeProgress(username);
    response.writeHead(progress ? 200 : 404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(progress || { error: "用户不存在" }));
    return;
  }

  if (request.method === "POST" && requestedPath === "/api/challenge/progress") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        response.writeHead(413);
        response.end("Payload too large");
      }
    });
    request.on("end", () => {
      try {
        const { username, level } = JSON.parse(body);
        const result = db.saveChallengeProgress(username, level);
        response.writeHead(result.error ? 400 : 200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      } catch (e) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "请求格式无效" }));
      }
    });
    return;
  }

  if (request.method === "POST" && requestedPath === "/api/challenge/clear") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) {
        response.writeHead(413);
        response.end("Payload too large");
      }
    });
    request.on("end", () => {
      try {
        const { username } = JSON.parse(body);
        const result = db.clearChallengeProgress(username);
        response.writeHead(result.error ? 400 : 200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify(result));
      } catch (e) {
        response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "请求格式无效" }));
      }
    });
    return;
  }

  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(root) || !publicExtensions.has(path.extname(filePath).toLowerCase()) || !fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(500);
      response.end("Internal server error");
      return;
    }
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "no-cache, must-revalidate"
    });
    response.end(data);
  });
});

const websocket = new WebSocketServer({ server });
websocket.on("connection", (socket) => {
  sendRoomList(socket);
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(String(raw)); } catch (_error) { return send(socket, { type: "error", message: "消息格式无效。" }); }
    if (message.type === "list-rooms") {
      sendRoomList(socket);
      return;
    }
    if (message.type === "create-room") {
      if (socket.roomCode) return;
      if (!isValidPlayerName(message.playerName)) return send(socket, { type: "error", message: "玩家 ID 格式无效或超过 12 个字符单位。" });
      const playerName = normalizePlayerName(message.playerName);
      const roomCode = makeRoomCode();
      const boardSize = [3, 4, 5].includes(Number(message.boardSize)) ? Number(message.boardSize) : 4;
      const sessionToken = makeSessionToken();
      const room = { code: roomCode, createdAt: Date.now(), boardSize, names: { 1: playerName, 2: null }, tokens: { 1: sessionToken, 2: null }, decks: { 1: null, 2: null }, ready: { 1: false, 2: false }, started: false, ended: false, state: null, disconnectedAt: { 1: null, 2: null }, disconnectTimers: { 1: null, 2: null }, players: { 1: socket, 2: null }, spectators: { 1: null, 2: null }, spectatorNames: { 1: null, 2: null } };
      rooms.set(roomCode, room);
      socket.roomCode = roomCode;
      socket.playerId = 1;
      socket.role = "player";
      socket.sessionToken = sessionToken;
      send(socket, { type: "room-created", roomCode, playerId: 1, playerName, boardSize, sessionToken });
      send(socket, { type: "room-state", state: roomState(room) });
      broadcastRoomList();
      return;
    }
    if (message.type === "join-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      const joinId = room && availablePlayerId(room);
      if (!room || room.started || !joinId) return send(socket, { type: "error", message: "房间不存在、已开始或玩家席已满。" });
      if (socket.roomCode) return;
      if (!isValidPlayerName(message.playerName)) return send(socket, { type: "error", message: "玩家 ID 格式无效或超过 12 个字符单位。" });
      const playerName = normalizePlayerName(message.playerName);
      const sessionToken = makeSessionToken();
      room.players[joinId] = socket;
      room.names[joinId] = playerName;
      room.tokens[joinId] = sessionToken;
      socket.roomCode = roomCode;
      socket.playerId = joinId;
      socket.role = "player";
      socket.sessionToken = sessionToken;
      send(socket, { type: "room-joined", roomCode, playerId: joinId, playerName, opponentName: room.names[joinId === 1 ? 2 : 1], boardSize: room.boardSize, sessionToken });
      if (room.state) sendGameState(socket, room.state);
      broadcast(room, { type: "peer-joined", playerId: joinId, playerName }, socket);
      broadcast(room, { type: "room-state", state: roomState(room) });
      broadcastRoomList();
      return;
    }
    if (message.type === "join-spectator") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) return send(socket, { type: "error", message: "房间不存在。" });
      if (socket.roomCode) return;
      if (!room.started && connectedPlayerCount(room) < 2) return send(socket, { type: "error", message: "玩家席满员后才能进入观战席。" });
      if (room.ended) return send(socket, { type: "error", message: "本房间的对局已经结束。" });
      const spectatorId = [1, 2].find((id) => !room.spectators[id]);
      if (!spectatorId) return send(socket, { type: "error", message: "本房间的 2 个观战席均已占用。" });
      if (!isValidPlayerName(message.spectatorName)) return send(socket, { type: "error", message: "玩家 ID 格式无效或超过 12 个字符单位。" });
      const spectatorName = normalizePlayerName(message.spectatorName);
      room.spectators[spectatorId] = socket;
      room.spectatorNames[spectatorId] = spectatorName;
      socket.roomCode = roomCode;
      socket.role = "spectator";
      socket.playerId = null;
      socket.spectatorId = spectatorId;
      send(socket, { type: "spectator-joined", roomCode, spectatorId, spectatorName, boardSize: room.boardSize, roomState: roomState(room) });
      broadcast(room, { type: "room-state", state: roomState(room) });
      if (room.state) sendGameState(socket, room.state);
      broadcastRoomList();
      return;
    }
    if (message.type === "resume-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      const playerId = playerIdForSessionToken(room, message.sessionToken);
      if (!room || !playerId || room.ended) return send(socket, { type: "resume-failed", message: "原房间不存在、会话已失效或已超过重连时间。" });
      if (!room.players[playerId] && room.disconnectedAt[playerId] && Date.now() - room.disconnectedAt[playerId] > RECONNECT_GRACE_MS) {
        expireDisconnectedPlayer(room, playerId);
        return send(socket, { type: "resume-failed", message: "原房间不存在、会话已失效或已超过重连时间。" });
      }
      const previousSocket = room.players[playerId];
      if (previousSocket && previousSocket !== socket) {
        previousSocket.roomRemovalHandled = true;
        send(previousSocket, { type: "session-replaced", message: "本房间已在另一个页面恢复。" });
        previousSocket.close();
      }
      clearDisconnectTimer(room, playerId);
      room.players[playerId] = socket;
      room.disconnectedAt[playerId] = null;
      room.tokens[playerId] = makeSessionToken();
      socket.roomCode = roomCode;
      socket.playerId = playerId;
      socket.role = "player";
      socket.sessionToken = room.tokens[playerId];
      send(socket, { type: "room-resumed", roomCode, playerId, playerName: room.names[playerId], boardSize: room.boardSize, deckKey: room.decks[playerId], started: room.started, state: stateForViewer(room.state, playerId), roomState: roomState(room), sessionToken: room.tokens[playerId] });
      broadcast(room, { type: "peer-reconnected", playerId }, socket);
      broadcast(room, { type: "room-state", state: roomState(room) }, socket);
      broadcastRoomList();
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room) return send(socket, { type: "error", message: "请先创建或加入房间。" });
    if (socket.role === "spectator") {
      if (message.type === "leave-room") socket.close();
      else send(socket, { type: "spectator-read-only", message: "观战席为只读状态，不能执行对局操作。" });
      return;
    }
    if (message.type === "state-sync" || message.type === "action" || message.type === "game-event") {
      if (message.type === "state-sync") {
        if (socket.playerId !== 1) return;
        room.state = message.state || null;
        room.ended = Boolean(parseRoomGame(room)?.winner);
        roomSockets(room).forEach((peer) => {
          if (peer && peer !== socket) sendGameState(peer, room.state);
        });
        if (room.ended) broadcastRoomList();
        return;
      }
      broadcast(room, { ...message, playerId: socket.playerId }, socket);
      return;
    }
    if (["action-request", "end-turn-request", "surrender-request"].includes(message.type)) {
      if (!room.started || !socket.playerId) return;
      const playerId = socket.playerId;
      if (message.type === "action-request") {
        const validationError = validateActionRequest(room, playerId, message.action && { ...message.action, playerId });
        if (validationError) return send(socket, { type: "action-rejected", message: validationError });
      } else if (message.type === "end-turn-request") {
        const game = parseRoomGame(room);
        if (game && game.activePlayerId !== playerId) return send(socket, { type: "action-rejected", message: "当前不是你的行动回合。" });
      }
      // The host remains the rules engine for now; route every request through
      // the server so both clients use the same ordered action stream.
      broadcast(room, { ...message, playerId: socket.playerId });
      return;
    }
    if (message.type === "set-deck" && !room.started) {
      room.decks[socket.playerId] = String(message.deckKey || "");
      room.ready[socket.playerId] = false;
      broadcast(room, { type: "room-state", state: roomState(room) });
      return;
    }
    if (message.type === "set-ready" && !room.started) {
      room.ready[socket.playerId] = Boolean(message.ready) && Boolean(room.decks[socket.playerId]);
      broadcast(room, { type: "room-state", state: roomState(room) });
      if (room.players[1] && room.players[2] && room.ready[1] && room.ready[2]) {
        room.started = true;
        const firstPlayerId = Math.random() < 0.5 ? 1 : 2;
        broadcast(room, { type: "match-start", roomCode: room.code, boardSize: room.boardSize, names: room.names, decks: room.decks, firstPlayerId });
        broadcastRoomList();
      }
      return;
    }
    if (message.type === "leave-room") {
      socket.voluntaryLeave = true;
      socket.close();
    }
  });
  socket.on("close", () => removeSocket(socket));
  socket.on("error", () => removeSocket(socket));
});

server.listen(port, host, () => console.log(`Card Demo online server: http://${host}:${port}`));

function shutdown() {
  for (const room of rooms.values()) {
    broadcast(room, { type: "server-shutdown", message: "服务器重启，本局平局。" });
    roomSockets(room).forEach((socket) => socket?.close());
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
