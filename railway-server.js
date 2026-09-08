const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const root = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "0.0.0.0";
const rooms = new Map();
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
  const chineseCount = (name.match(/[\u3400-\u9fff]/g) || []).length;
  const latinCount = (name.match(/[A-Za-z]/g) || []).length;
  const otherCount = [...name].length - chineseCount - latinCount;
  return name.length > 0 && otherCount === 0 && (chineseCount === name.length ? chineseCount <= 6 : latinCount === name.length && latinCount <= 12);
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

function broadcast(room, message, except = null) {
  [room.players[1], room.players[2]].forEach((socket) => {
    if (socket && socket !== except) send(socket, message);
  });
}

function removeSocket(socket) {
  const room = rooms.get(socket.roomCode);
  if (!room) return;
  if (room.players[socket.playerId] === socket) room.players[socket.playerId] = null;
  if (!room.started) {
    room.ready[socket.playerId] = false;
    room.decks[socket.playerId] = null;
    broadcast(room, { type: "room-state", state: roomState(room) }, socket);
  } else {
    room.disconnectedAt[socket.playerId] = Date.now();
    if (!room.disconnectTimer) {
      room.disconnectTimer = setTimeout(() => {
        if (!rooms.has(room.code)) return;
        const firstDrop = Math.min(...Object.values(room.disconnectedAt).filter(Boolean));
        const loserId = room.disconnectedAt[1] === firstDrop ? 1 : 2;
        const winner = room.players[loserId === 1 ? 2 : 1];
        if (winner) send(winner, { type: "auto-surrender", loserId, message: "对方断线超过 5 分钟，视为自动认输。" });
        [room.players[1], room.players[2]].forEach((peer) => peer?.close());
        rooms.delete(room.code);
      }, 5 * 60 * 1000);
    }
  }
  broadcast(room, { type: "peer-left", playerId: socket.playerId }, socket);
  if (!room.players[1] && !room.players[2] && !room.started) rooms.delete(socket.roomCode);
}

function roomState(room) {
  return {
    roomCode: room.code,
    boardSize: room.boardSize,
    names: room.names,
    ready: room.ready,
    hasPlayers: { 1: Boolean(room.players[1]), 2: Boolean(room.players[2]) },
    started: room.started,
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
  send(socket, { type: "state-sync", state: stateForViewer(state, socket.playerId) });
}

function validCell(cell, size) {
  return Number.isInteger(cell?.row) && Number.isInteger(cell?.col)
    && cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
}

function validateActionRequest(room, playerId, action) {
  const game = parseRoomGame(room);
  if (!game || game.winner || game.activePlayerId !== playerId) return "当前不是你的行动回合。";
  const actionLimit = (Number(game.turn) === 1 ? 1 : 2) + (Number(game.extraActions) || 0);
  if (Number(game.actionsUsed) >= actionLimit) return "本回合行动次数已用尽。";
  if (!action || !["place", "move"].includes(action.type) || action.playerId !== playerId) return "行动数据无效。";
  const size = [3, 4, 5].includes(Number(room.boardSize)) ? Number(room.boardSize) : 4;
  const cards = Array.isArray(game.boardCards) ? game.boardCards : [];
  const players = Array.isArray(game.players) ? game.players : [];
  const player = players.find((entry) => Number(entry.id) === playerId);
  if (!player) return "玩家状态无效。";
  if (action.type === "place") {
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
  socket.on("message", (raw) => {
    let message;
    try { message = JSON.parse(String(raw)); } catch (_error) { return send(socket, { type: "error", message: "消息格式无效。" }); }
    if (message.type === "create-room") {
      if (socket.roomCode) return;
      if (!isValidPlayerName(message.playerName)) return send(socket, { type: "error", message: "玩家 ID 需为 1-6 个中文字符或 1-12 个英文字母。" });
      const playerName = normalizePlayerName(message.playerName);
      const roomCode = makeRoomCode();
      const boardSize = [3, 4, 5].includes(Number(message.boardSize)) ? Number(message.boardSize) : 4;
      const sessionToken = makeSessionToken();
      const room = { code: roomCode, createdAt: Date.now(), boardSize, names: { 1: playerName, 2: null }, tokens: { 1: sessionToken, 2: null }, decks: { 1: null, 2: null }, ready: { 1: false, 2: false }, started: false, state: null, disconnectedAt: { 1: null, 2: null }, disconnectTimer: null, players: { 1: socket, 2: null } };
      rooms.set(roomCode, room);
      socket.roomCode = roomCode;
      socket.playerId = 1;
      socket.sessionToken = sessionToken;
      send(socket, { type: "room-created", roomCode, playerId: 1, playerName, boardSize, sessionToken });
      send(socket, { type: "room-state", state: roomState(room) });
      return;
    }
    if (message.type === "join-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      const joinId = room && !room.players[1] ? 1 : 2;
      if (!room || room.players[joinId]) return send(socket, { type: "error", message: "房间不存在或已满。" });
      if (socket.roomCode) return;
      if (!isValidPlayerName(message.playerName)) return send(socket, { type: "error", message: "玩家 ID 需为 1-6 个中文字符或 1-12 个英文字母。" });
      const playerName = normalizePlayerName(message.playerName);
      const sessionToken = makeSessionToken();
      room.players[joinId] = socket;
      room.names[joinId] = playerName;
      room.tokens[joinId] = sessionToken;
      socket.roomCode = roomCode;
      socket.playerId = joinId;
      socket.sessionToken = sessionToken;
      send(socket, { type: "room-joined", roomCode, playerId: joinId, playerName, opponentName: room.names[joinId === 1 ? 2 : 1], boardSize: room.boardSize, sessionToken });
      if (room.state) sendGameState(socket, room.state);
      broadcast(room, { type: "peer-joined", playerId: joinId, playerName }, socket);
      broadcast(room, { type: "room-state", state: roomState(room) });
      return;
    }
    if (message.type === "resume-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      const playerName = normalizePlayerName(message.playerName);
      const playerId = room && room.names[1] === playerName ? 1 : room && room.names[2] === playerName ? 2 : null;
      const providedToken = typeof message.sessionToken === "string" ? Buffer.from(message.sessionToken) : Buffer.alloc(0);
      const expectedToken = Buffer.from((room && playerId && room.tokens[playerId]) || "");
      const tokenMatches = providedToken.length === expectedToken.length && providedToken.length > 0 && crypto.timingSafeEqual(providedToken, expectedToken);
      if (!room || !playerId || !tokenMatches || room.players[playerId] || !room.disconnectedAt[playerId] || Date.now() - room.disconnectedAt[playerId] > 5 * 60 * 1000) return send(socket, { type: "resume-failed", message: "原房间不存在、会话已失效或已超过重连时间。" });
      room.players[playerId] = socket;
      room.disconnectedAt[playerId] = null;
      socket.roomCode = roomCode;
      socket.playerId = playerId;
      socket.sessionToken = room.tokens[playerId];
      send(socket, { type: "room-resumed", roomCode, playerId, boardSize: room.boardSize, started: room.started, state: stateForViewer(room.state, playerId), sessionToken: room.tokens[playerId] });
      if (room.players[1] && room.players[2]) broadcast(room, { type: "peer-reconnected", playerId });
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room) return send(socket, { type: "error", message: "请先创建或加入房间。" });
    if (message.type === "state-sync" || message.type === "action" || message.type === "game-event") {
      if (message.type === "state-sync") {
        if (socket.playerId !== 1) return;
        room.state = message.state || null;
        [room.players[1], room.players[2]].forEach((peer) => {
          if (peer && peer !== socket) sendGameState(peer, room.state);
        });
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
      } else {
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
        broadcast(room, { type: "match-start", boardSize: room.boardSize, names: room.names, decks: room.decks, firstPlayerId });
      }
      return;
    }
    if (message.type === "leave-room") {
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
    [room.players[1], room.players[2]].forEach((socket) => socket?.close());
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
