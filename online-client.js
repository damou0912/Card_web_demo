(() => {
  let socket = null;
  let connected = false;
  const listeners = new Set();

  function notify(message) {
    listeners.forEach((listener) => listener(message));
  }

  function connect() {
    if (socket && socket.readyState <= 1) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const nextSocket = new WebSocket(`${protocol}//${window.location.host}`);
    socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket) return;
      connected = true;
      notify({ type: "connected" });
    });
    nextSocket.addEventListener("close", () => {
      if (socket !== nextSocket) return;
      connected = false;
      notify({ type: "disconnected" });
    });
    nextSocket.addEventListener("error", () => {
      if (socket === nextSocket) notify({ type: "error", message: "无法连接联网服务。" });
    });
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;
      try { notify(JSON.parse(event.data)); } catch (_error) { notify({ type: "error", message: "服务器消息格式无效。" }); }
    });
  }

  function disconnect() {
    if (socket) socket.close();
    socket = null;
    connected = false;
  }

  function send(message) {
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function leaveRoom() {
    const sent = send({ type: "leave-room" });
    disconnect();
    return sent;
  }

  window.CardOnline = {
    connect,
    disconnect,
    createRoom: (playerName, boardSize) => send({ type: "create-room", playerName, boardSize }),
    joinRoom: (roomCode, playerName) => send({ type: "join-room", roomCode, playerName }),
    joinSpectator: (roomCode, spectatorName) => send({ type: "join-spectator", roomCode, spectatorName }),
    resumeRoom: (roomCode, playerName, sessionToken) => send({ type: "resume-room", roomCode, playerName, sessionToken }),
    listRooms: () => send({ type: "list-rooms" }),
    leaveRoom,
    send,
    on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get connected() { return connected; }
  };
})();
