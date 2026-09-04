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
  }
  broadcast(room, { type: "peer-left", playerId: socket.playerId }, socket);
  if (!room.players[1] && !room.players[2]) rooms.delete(socket.roomCode);
}

function roomState(room) {
  return {
    roomCode: room.code,
    boardSize: room.boardSize,
    names: room.names,
    ready: room.ready,
    hasPlayers: { 1: Boolean(room.players[1]), 2: Boolean(room.players[2]) },
    started: room.started
  };
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
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
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
      const room = { code: roomCode, createdAt: Date.now(), boardSize, names: { 1: playerName, 2: null }, decks: { 1: null, 2: null }, ready: { 1: false, 2: false }, started: false, state: null, players: { 1: socket, 2: null } };
      rooms.set(roomCode, room);
      socket.roomCode = roomCode;
      socket.playerId = 1;
      send(socket, { type: "room-created", roomCode, playerId: 1, playerName, boardSize });
      send(socket, { type: "room-state", state: roomState(room) });
      return;
    }
    if (message.type === "join-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      if (!room || room.players[2]) return send(socket, { type: "error", message: "房间不存在或已满。" });
      if (socket.roomCode) return;
      if (!isValidPlayerName(message.playerName)) return send(socket, { type: "error", message: "玩家 ID 需为 1-6 个中文字符或 1-12 个英文字母。" });
      const playerName = normalizePlayerName(message.playerName);
      room.players[2] = socket;
      room.names[2] = playerName;
      socket.roomCode = roomCode;
      socket.playerId = 2;
      send(socket, { type: "room-joined", roomCode, playerId: 2, playerName, opponentName: room.names[1], boardSize: room.boardSize });
      if (room.state) send(socket, { type: "state-sync", state: room.state });
      broadcast(room, { type: "peer-joined", playerId: 2, playerName }, socket);
      broadcast(room, { type: "room-state", state: roomState(room) });
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room) return send(socket, { type: "error", message: "请先创建或加入房间。" });
    if (message.type === "state-sync" || message.type === "action" || message.type === "game-event") {
      if (message.type === "state-sync") {
        if (socket.playerId !== 1) return;
        room.state = message.state || null;
      }
      broadcast(room, { ...message, playerId: socket.playerId }, socket);
      return;
    }
    if (["action-request", "end-turn-request", "surrender-request"].includes(message.type)) {
      if (socket.playerId !== 2) return;
      send(room.players[1], { ...message, playerId: socket.playerId });
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
