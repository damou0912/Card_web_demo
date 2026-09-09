(() => {
  let socket = null;
  let connected = false;
  let reconnectEnabled = false;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  const listeners = new Set();
  const RECONNECT_DELAYS_MS = [500, 1000, 2000, 5000];

  function notify(message) {
    listeners.forEach((listener) => listener(message));
  }

  function clearReconnectTimer() {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function scheduleReconnect() {
    if (!reconnectEnabled || reconnectTimer !== null) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    reconnectAttempt += 1;
    notify({ type: "reconnecting", attempt: reconnectAttempt, delay });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    reconnectEnabled = true;
    if (socket && socket.readyState <= 1) return;
    clearReconnectTimer();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const nextSocket = new WebSocket(`${protocol}//${window.location.host}`);
    socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket) return;
      connected = true;
      reconnectAttempt = 0;
      notify({ type: "connected" });
    });
    nextSocket.addEventListener("close", () => {
      if (socket !== nextSocket) return;
      socket = null;
      connected = false;
      notify({ type: "disconnected" });
      scheduleReconnect();
    });
    nextSocket.addEventListener("error", () => {
      if (socket === nextSocket && reconnectAttempt === 0) notify({ type: "error", message: "无法连接联网服务，正在自动重试。" });
    });
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket) return;
      try { notify(JSON.parse(event.data)); } catch (_error) { notify({ type: "error", message: "服务器消息格式无效。" }); }
    });
  }

  function disconnect() {
    reconnectEnabled = false;
    reconnectAttempt = 0;
    clearReconnectTimer();
    const currentSocket = socket;
    socket = null;
    connected = false;
    if (currentSocket) currentSocket.close();
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
