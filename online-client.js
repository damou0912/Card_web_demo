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
    socket = new WebSocket(`${protocol}//${window.location.host}`);
    socket.addEventListener("open", () => { connected = true; notify({ type: "connected" }); });
    socket.addEventListener("close", () => { connected = false; notify({ type: "disconnected" }); });
    socket.addEventListener("error", () => notify({ type: "error", message: "无法连接联网服务。" }));
    socket.addEventListener("message", (event) => {
      try { notify(JSON.parse(event.data)); } catch (_error) { notify({ type: "error", message: "服务器消息格式无效。" }); }
    });
  }

  function send(message) {
    if (!socket || socket.readyState !== 1) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  window.CardOnline = {
    connect,
    createRoom: () => send({ type: "create-room" }),
    joinRoom: (roomCode) => send({ type: "join-room", roomCode }),
    send,
    on(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    get connected() { return connected; }
  };
})();
