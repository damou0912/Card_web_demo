const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    MockWebSocket.instances.push(this);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  emit(type, event = {}) {
    if (type === "open") this.readyState = 1;
    if (type === "close") this.readyState = 3;
    (this.listeners.get(type) || []).forEach((listener) => listener(event));
  }

  send(payload) {
    this.sent.push(JSON.parse(payload));
  }

  close() {
    this.emit("close");
  }
}

let nextTimerId = 1;
const timers = new Map();
const window = {
  location: { protocol: "https:", host: "game.example" },
  setTimeout(callback, delay) {
    const id = nextTimerId++;
    timers.set(id, { callback, delay });
    return id;
  },
  clearTimeout(id) {
    timers.delete(id);
  }
};
const context = { window, WebSocket: MockWebSocket, console, JSON, Set };
window.window = window;
window.WebSocket = MockWebSocket;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, "online-client.js"), "utf8"), context, { filename: "online-client.js" });

const events = [];
window.CardOnline.on((message) => {
  events.push(message);
  if (message.type === "connected") window.CardOnline.resumeRoom("ABC123", "Player", "session-token");
});

window.CardOnline.connect();
assert.equal(MockWebSocket.instances.length, 1);
const firstSocket = MockWebSocket.instances[0];
firstSocket.emit("open");
assert.deepEqual(firstSocket.sent[0], { type: "resume-room", roomCode: "ABC123", playerName: "Player", sessionToken: "session-token" });

firstSocket.emit("close");
assert.equal(events.at(-2).type, "disconnected");
assert.deepEqual(events.at(-1), { type: "reconnecting", attempt: 1, delay: 500 });
assert.equal(timers.size, 1);

const firstRetry = [...timers.values()][0];
timers.clear();
firstRetry.callback();
assert.equal(MockWebSocket.instances.length, 2);
const secondSocket = MockWebSocket.instances[1];
secondSocket.emit("open");
assert.deepEqual(secondSocket.sent[0], { type: "resume-room", roomCode: "ABC123", playerName: "Player", sessionToken: "session-token" });

window.CardOnline.disconnect();
assert.equal(timers.size, 0);
assert.equal(window.CardOnline.connected, false);

window.CardOnline.connect();
const thirdSocket = MockWebSocket.instances[2];
thirdSocket.emit("open");
window.CardOnline.leaveRoom();
assert.deepEqual(thirdSocket.sent.at(-1), { type: "leave-room" });
assert.equal(timers.size, 0);

console.log("Online client reconnect test passed");
