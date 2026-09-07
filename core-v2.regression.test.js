/* Run with the bundled Node runtime: node core-v2.regression.test.js */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createElement() {
  return {
    className: "",
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    style: {}, dataset: {}, children: [], value: "", textContent: "", innerHTML: "", disabled: false,
    appendChild(child) { this.children.push(child); return child; },
    removeChild() {}, replaceChildren() {}, addEventListener() {}, removeEventListener() {},
    querySelector() { return createElement(); }, querySelectorAll() { return []; }, closest() { return null; },
    setAttribute() {}, removeAttribute() {}, focus() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 400 }; }
  };
}

const elements = new Map();
const document = {
  body: createElement(),
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  },
  querySelector() { return createElement(); },
  querySelectorAll() { return []; },
  createElement
};
const context = {
  console, document, Math, Set, Map, Date, JSON, Promise, URLSearchParams,
  setTimeout() { return 0; }, clearTimeout() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, confirm() { return true; },
  location: { search: "" }, window: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

["v2-card-data.js", "script.js", "core-v2.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
});

const validation = context.validateCoreV2CardData();
const result = context.runCoreV2RegressionTests();
const boundary = context.runCoreV2CardBoundaryTests();
const cardIds = new Set(context.CARD_LIBRARY.cardSlots.map((card) => card.id));
const invalidEffectTags = context.CARD_LIBRARY.cardSlots
  .flatMap((card) => (Array.isArray(card.effectTags) ? card.effectTags : (card.effectTag ? [card.effectTag] : []))
    .filter((tag) => [...String(tag)].length !== 2)
    .map(() => card.id));
const testedCardIds = new Set(boundary.results.map((test) => test.id));
const missingBoundaryTests = [...cardIds].filter((id) => !testedCardIds.has(id));
const unexpectedBoundaryTests = [...testedCardIds].filter((id) => !cardIds.has(id));
const coverage = { testedCards: testedCardIds.size, missingBoundaryTests, unexpectedBoundaryTests };
if (validation.duplicateIds.length || validation.invalidCards.length || invalidEffectTags.length || result.failed || boundary.failed || missingBoundaryTests.length || unexpectedBoundaryTests.length) {
  console.error(JSON.stringify({ validation, invalidEffectTags, result, boundary, coverage }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`V2 regression tests passed: ${result.passed}/${result.results.length}`);
  console.log(`V2 card boundary tests passed: ${boundary.passed}/${boundary.results.length}`);
  console.log(`V2 card test coverage: ${coverage.testedCards}/${cardIds.size}`);
}
