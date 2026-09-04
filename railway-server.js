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

function send(socket, message) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
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
  broadcast(room, { type: "peer-left", playerId: socket.playerId }, socket);
  if (!room.players[1] && !room.players[2]) rooms.delete(socket.roomCode);
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
      const roomCode = makeRoomCode();
      const room = { code: roomCode, createdAt: Date.now(), players: { 1: socket, 2: null } };
      rooms.set(roomCode, room);
      socket.roomCode = roomCode;
      socket.playerId = 1;
      send(socket, { type: "room-created", roomCode, playerId: 1 });
      return;
    }
    if (message.type === "join-room") {
      const roomCode = String(message.roomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);
      if (!room || room.players[2]) return send(socket, { type: "error", message: "房间不存在或已满。" });
      if (socket.roomCode) return;
      room.players[2] = socket;
      socket.roomCode = roomCode;
      socket.playerId = 2;
      send(socket, { type: "room-joined", roomCode, playerId: 2 });
      broadcast(room, { type: "peer-joined", playerId: 2 }, socket);
      return;
    }
    const room = rooms.get(socket.roomCode);
    if (!room) return send(socket, { type: "error", message: "请先创建或加入房间。" });
    if (message.type === "state-sync" || message.type === "action" || message.type === "game-event") {
      broadcast(room, { ...message, playerId: socket.playerId }, socket);
    }
  });
  socket.on("close", () => removeSocket(socket));
  socket.on("error", () => removeSocket(socket));
});

server.listen(port, host, () => console.log(`Card Demo online server: http://${host}:${port}`));
