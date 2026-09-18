/* Run: node tutorial.test.js. Exercises the tutorial against the real core, with animations omitted. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function element() {
  const classes = new Set(), handlers = new Map();
  return {
    style: {}, dataset: {}, children: [], textContent: "", innerHTML: "", value: "", hidden: false, disabled: false,
    classList: {
      add(...values) { values.forEach((value) => classes.add(value)); },
      remove(...values) { values.forEach((value) => classes.delete(value)); },
      contains(value) { return classes.has(value); },
      toggle(value, force) { const yes = force ?? !classes.has(value); if (yes) classes.add(value); else classes.delete(value); return yes; }
    },
    addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, []); handlers.get(type).push(handler); },
    async click() { if (!this.disabled) for (const handler of handlers.get("click") || []) await handler({ target: this }); },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren() { this.children = []; }, removeChild() {}, removeEventListener() {},
    setAttribute() {}, removeAttribute() {}, focus() {}, scrollIntoView() {},
    querySelector() { return element(); }, querySelectorAll() { return []; }, closest() { return null; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  };
}

const elements = new Map(), storage = new Map();
const document = {
  body: element(),
  getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
  querySelector: element, querySelectorAll() { return []; }, createElement: element
};
const context = {
  document, console, Math: Object.create(Math), Set, Map, Date, JSON, Promise, URL, URLSearchParams,
  location: { search: "" },
  setTimeout() { return 0; }, clearTimeout() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); }, removeItem(key) { storage.delete(key); } },
  authClient: { loadUser() { return null; }, clearUser() {} }, confirm() { return true; }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
for (const file of ["card-info.js", "replacement-cards.js", "v2-card-data.js", "shu-card-effects.js", "wei-card-effects.js", "wu-card-effects.js", "elite-ai-info.js", "elite-ai-effects.js", "script.js", "core-v2.js", "tutorial.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
}
vm.runInContext(`
  playActionAnimations = async () => {};
  playCombatClashAnimation = async () => null;
  finishCombatAnimation = async () => {};
  flushPendingAnimations = async (game) => { game.pendingAnimations = []; };
`, context);
const api = context.__CARD_DEMO_CORE_V2__;
const rules = context.__CARD_DEMO_CORE_V2_TEST_API__;
const state = context.__CARD_DEMO_DEBUG__.state;
const tutorial = context.CardTutorial;
const el = (id) => document.getElementById(id);
const title = () => el("tutorial-title").textContent;
const next = () => el("tutorial-next-btn").click();
const find = (id) => [...state.game.players[0].hand, ...state.game.boardCards].find((card) => card.id === id);
async function act(type, id, row, col) {
  const card = find(id);
  assert.ok(card, `card ${id} exists`);
  return api.coreResolveAction(state.game, {
    type, playerId: 1, cardUid: card.uid, source: type === "move" ? { row: card.row, col: card.col } : null, target: { row, col }
  });
}

async function run() {
  state.selectedMode = "pve-challenge";
  state.selectedBoardSize = 5;
  const customDecks = state.customDecks;
  const customBefore = JSON.stringify(customDecks);
  assert.equal(tutorial.start(), true);
  assert.equal(state.game.mode, "tutorial");
  assert.equal(state.game.players[0].hand.length, 3);
  const reinforcement = find("tutorial-reinforcement-3");
  const debug = context.__CARD_DEMO_DEBUG__;
  assert.equal(debug.getCardDisplay(reinforcement).name, "援军");
  assert.equal(debug.getCardDisplay(reinforcement.id).name, "援军", "animation lookups by ID use the same name");
  assert.equal(debug.getCardDisplay(reinforcement).skill, "无");
  assert.equal(debug.getCardBaseAttack(reinforcement), 3);
  assert.equal(reinforcement.currentAttack, 3);
  assert.equal(reinforcement.isGuard, undefined, "player reinforcements are not neutral guards");
  assert.equal(context.CARD_LIBRARY.cardSlots.some((card) => card.id.startsWith("tutorial-")), false, "training units stay out of normal decks");
  assert.equal(vm.runInContext('getCardRuntimeDefinition("tutorial-reinforcement-3")', context), null, "reinforcements have no skill implementation");
  assert.ok(state.game.players.every((player) => player.deckCatalog.length === 20));
  assert.ok(state.game.players.every((player) => player.deckCatalog.every((card) => card.id.startsWith("tutorial-reinforcement-"))), "basic lessons draw only skill-free cards");
  assert.equal(new Set(state.game.players.flatMap((player) => player.deckCatalog.map((card) => card.uid))).size, 40, "duplicate reinforcement types have independent instances");
  assert.ok(state.game.boardCards.every((card) => card.isGuard && card.ownerId === null));
  assert.equal(rules.coreControlMap(state.game).counts[1], 0, "neutral guards do not count for either player");
  assert.equal(rules.coreControlMap(state.game).counts[2], 0);
  assert.equal(state.game.turnDeadlineAt, null);
  assert.equal(rules.coreTurnSecondsRemaining(state.game, Date.now() + 600000), null);
  assert.equal(await act("place", "tutorial-reinforcement-3", 3, 1), false, "cannot skip intro");
  await next();
  assert.equal(await act("place", "tutorial-reinforcement-3", 3, 2), false, "wrong square cannot advance");
  assert.equal(await act("place", "tutorial-reinforcement-2", 3, 1), false, "wrong power reinforcement cannot advance");
  await api.coreEndTurn();
  assert.equal(state.game.turn, 1, "premature end turn rejected");
  const placement = act("place", "tutorial-reinforcement-3", 3, 1);
  assert.equal(tutorial.restartLesson(), false, "cannot restart during animation");
  assert.equal(await act("place", "tutorial-reinforcement-3", 3, 1), false, "duplicate input cannot double place");
  assert.equal(await placement, true);
  assert.equal(find("tutorial-reinforcement-3").restedTurn, 1);
  const ending = api.coreEndTurn();
  assert.equal(tutorial.restartLesson(), false, "cannot restart during turn settlement");
  await api.coreEndTurn();
  await ending;
  assert.equal(state.game.turn, 3, "one player turn and one scripted opponent pass");
  assert.equal(state.game.activePlayerId, 1);
  assert.equal(find("tutorial-reinforcement-3").restedTurn, null);
  assert.equal(find("tutorial-reinforcement-3").currentAttack, 3, "skill-free card retains power across turns");
  assert.equal(state.game.players[0].hand.length, 3);
  assert.equal(await act("move", "tutorial-reinforcement-3", 2, 1), true);
  assert.equal(rules.coreControlMap(state.game).counts[1], 1);
  await next();
  assert.match(title(), /进入敌方格/);
  await next();
  await act("move", "tutorial-reinforcement-3", 1, 1);
  assert.equal(state.game.boardCards.filter((card) => card.isGuard).length, 1);
  assert.equal(find("tutorial-reinforcement-3").row, 1);
  await act("move", "tutorial-reinforcement-2", 1, 3);
  assert.equal(state.game.boardCards.filter((card) => card.isGuard).length, 0);
  assert.equal(state.game.boardCards.some((card) => card.id === "tutorial-reinforcement-2"), false);
  await next();
  await next();
  await act("place", "01102", 2, 2);
  await act("place", "01101", 1, 1);
  assert.equal(find("tutorial-reinforcement-3").currentAttack, 3, "start skills do not fire on placement");
  await api.coreEndTurn();
  assert.equal(find("tutorial-reinforcement-3").currentAttack, 4);
  assert.equal(find("01101").currentAttack, 3);
  await next();
  await act("place", "01208", 1, 2);
  assert.equal(find("tutorial-reinforcement-3").currentAttack, 5, "Wei Yan retriggers Wang Ping");
  assert.equal(find("01101").currentAttack, 5, "Liao Hua counts both neighbors");
  await next();
  assert.equal(rules.coreControlMap(state.game).counts[1], 7);
  assert.ok(state.game.boardCards.filter((card) => card.ownerId === 1).every((card) => card.id.startsWith("tutorial-reinforcement-")));
  assert.equal(rules.coreVictoryTarget(state.game), 9);
  await next();
  await act("place", "tutorial-reinforcement-3", 1, 3);
  assert.equal(state.game.winner, null, "exactly half is not victory");
  await act("place", "tutorial-reinforcement-2", 2, 0);
  assert.equal(state.game.winner.playerId, 1);
  assert.match(title(), /教程完成/);
  assert.equal(storage.get("card-demo-tutorial-v1-completed"), "1");
  assert.equal(el("end-turn-btn").disabled, true);
  assert.equal(tutorial.restartLesson(), true, "completed lesson can be retried");
  assert.equal(rules.coreControlMap(state.game).counts[1], 7);
  await el("tutorial-exit-btn").click();
  assert.equal(state.game, null);
  assert.equal(el("tutorial-panel").hidden, true);
  assert.equal(state.selectedBoardSize, 5);
  assert.equal(state.selectedMode, "pve-challenge");
  assert.equal(state.customDecks, customDecks);
  assert.equal(JSON.stringify(customDecks), customBefore);
  assert.equal(el("restart-btn").textContent, "重新开始");
  assert.equal(tutorial.start(), true, "can replay after exit");
  context.resetToMenu();
  const normal = api.coreCreateGame("pve", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1);
  state.game = normal;
  api.coreStartTurn(normal);
  assert.ok(normal.turnDeadlineAt > Date.now(), "normal matches retain timer");
  state.game = null;
  state.online = { roomCode: "123456", role: "player" };
  assert.equal(tutorial.start(), false, "online sessions cannot be overwritten");
  console.log("Tutorial integration passed: four lessons, real combat/skills/victory, input guards, replay, exit, completion and normal-match isolation.");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
