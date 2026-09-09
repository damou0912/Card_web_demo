/* Run with the bundled Node runtime: node core-v2.regression.test.js */
/* The runner loads core-v2.test-suite.js separately; production code has no test cases. */
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
  currentScript: null,
  writtenScripts: [],
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, createElement());
    return elements.get(id);
  },
  querySelector() { return createElement(); },
  querySelectorAll() { return []; },
  createElement,
  write(value) { this.writtenScripts.push(String(value)); }
};
const context = {
  console, document, Math, Set, Map, Date, JSON, Promise, URL, URLSearchParams,
  setTimeout() { return 0; }, clearTimeout() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, confirm() { return true; },
  location: { search: "" }, window: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

const effectSources = {};
["shu-card-effects.js", "wei-card-effects.js", "wu-card-effects.js"].forEach((file) => {
  effectSources[file] = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInContext(effectSources[file], context, { filename: file });
});
[
  "elite-ai-info.js",
  "elite-ai-effects.js"
].forEach((file) => vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file }));
const effectSourceViolations = Object.entries(effectSources).flatMap(([file, source]) => {
  const matches = source.match(/CARD_INFO|CARD_LIBRARY|\.(?:name|skill|effect|camp|rarity)\b/g) || [];
  return matches.map((match) => `${file}:${match}`);
});
const effectGroups = ["shu", "wei", "wu"];
const effectIds = new Set(effectGroups.flatMap((group) => Object.keys(context.CARD_EFFECTS_V2[group] || {})));
const effectCountBeforeDisplayData = effectIds.size;
vm.runInContext(fs.readFileSync(path.join(__dirname, "card-info.js"), "utf8"), context, { filename: "card-info.js" });
context.CARD_LIBRARY = { version: "legacy", cardSlots: [{ id: "old-card" }], campNamePool: { old: true } };
vm.runInContext(fs.readFileSync(path.join(__dirname, "v2-card-data.js"), "utf8"), context, { filename: "v2-card-data.js" });
const legacyLibraryReplaced = context.CARD_LIBRARY.version === "card-info-v2-display-effect-isolation-20260908"
  && context.CARD_LIBRARY.cardSlots.length === 60
  && !("campNamePool" in context.CARD_LIBRARY);
const originalLibrary = context.CARD_LIBRARY;
["script.js", "core-v2.js", "core-v2.test-suite.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
});
const legacyContext = { window: null, CARD_INFO_SCHEMA_VERSION: "legacy", CARD_INFO: [{ id: "old-card", attack: 99 }] };
legacyContext.window = legacyContext;
vm.createContext(legacyContext);
let legacySchemaRejected = false;
try {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "v2-card-data.js"), "utf8"), legacyContext, { filename: "v2-card-data.js" });
} catch (_error) {
  legacySchemaRejected = true;
}
const runtimeDisplayFields = ["name", "camp", "rarity", "quality", "skill", "effect"];
const displayTemplate = originalLibrary.cardSlots.find((card) => card.id === "02101");
const forgedRuntimeCard = context.__CARD_DEMO_DEBUG__.cloneCard({
  ...displayTemplate,
  name: "旧卡名",
  skill: "旧技能名",
  effect: "旧技能描述",
  camp: "旧势力",
  rarity: "旧品质"
});
const runtimeDisplayFieldsAbsent = runtimeDisplayFields.every((field) => !(field in forgedRuntimeCard));
const resolvedDisplay = context.__CARD_DEMO_DEBUG__.getCardDisplay(forgedRuntimeCard);
const displayUsesTableById = resolvedDisplay === displayTemplate
  && resolvedDisplay.name !== "旧卡名"
  && resolvedDisplay.skill !== "旧技能名"
  && resolvedDisplay.effect !== "旧技能描述";
const legacyRuntimeGame = {
  boardCards: [{ id: "02101", name: "旧卡名", skill: "旧技能", effect: "旧描述", camp: "旧势力", rarity: "旧品质" }],
  players: [{ hand: [{ id: "01101", name: "旧手牌" }], drawPile: [], deckCatalog: [] }]
};
context.__CARD_DEMO_CORE_V2_TEST_API__.coreStripRuntimeDisplayData(legacyRuntimeGame);
const legacyRuntimeDisplayRemoved = [legacyRuntimeGame.boardCards[0], legacyRuntimeGame.players[0].hand[0]]
  .every((card) => runtimeDisplayFields.every((field) => !(field in card)));
const onlineRuntimeProbe = {
  ruleset: "core-v2",
  cardDataVersion: originalLibrary.version,
  runtimeSchemaVersion: "runtime-display-effect-isolation-20260909",
  boardCards: [{ id: "02101", name: "旧卡名", skill: "旧技能", effect: "旧描述", camp: "旧势力", rarity: "旧品质" }],
  players: []
};
const serializedRuntime = context.__CARD_DEMO_CORE_V2_TEST_API__.coreSerializeOnlineGame(onlineRuntimeProbe);
const restoredRuntime = context.__CARD_DEMO_CORE_V2_TEST_API__.coreDeserializeOnlineGame(serializedRuntime);
const onlineRuntimeDisplayRemoved = runtimeDisplayFields.every((field) => !(field in restoredRuntime.boardCards[0]));
let staleOnlineRuntimeRejected = false;
try {
  context.__CARD_DEMO_CORE_V2_TEST_API__.coreDeserializeOnlineGame(JSON.stringify({
    ruleset: "core-v2",
    cardDataVersion: "legacy",
    runtimeSchemaVersion: "legacy"
  }));
} catch (_error) {
  staleOnlineRuntimeRejected = true;
}

context.CARD_LIBRARY = {
  version: originalLibrary.version,
  cardSlots: originalLibrary.cardSlots.filter((card) => card.id !== "02101").map((card) => ({ id: card.id, attack: card.attack }))
};
const effectsSurviveDisplayDeletion = Boolean(context.CARD_EFFECTS_V2.wei?.["02101"] && context.CARD_EFFECTS_V2.wu?.["03101"]);
context.CARD_LIBRARY = {
  version: originalLibrary.version,
  cardSlots: originalLibrary.cardSlots.map((card) => ({ id: card.id, attack: card.attack }))
};
const boundaryWithoutDisplayFields = context.runCoreV2CardBoundaryTests();
context.CARD_LIBRARY = originalLibrary;

const validation = context.validateCoreV2CardData();
const result = context.runCoreV2RegressionTests();
const boundary = context.runCoreV2CardBoundaryTests();
const coreSource = fs.readFileSync(path.join(__dirname, "core-v2.js"), "utf8");
const hardcodedTraitIds = [...coreSource.matchAll(/["']((?:100[1-9]|101[01]|200[1-8]|300[1-8]))["']/g)].map((match) => match[1]);
const cardIds = new Set(context.CARD_LIBRARY.cardSlots.map((card) => card.id));
const missingIndependentEffects = [...cardIds].filter((id) => {
  const prefix = String(id).slice(0, 2);
  const group = prefix === "01" ? "shu" : prefix === "02" ? "wei" : prefix === "03" ? "wu" : "";
  return !group || !context.CARD_EFFECTS_V2[group]?.[String(id)];
});
const testedCardIds = new Set(boundary.results.map((test) => test.id));
const missingBoundaryTests = [...cardIds].filter((id) => !testedCardIds.has(id));
const unexpectedBoundaryTests = [...testedCardIds].filter((id) => !cardIds.has(id));
const coverage = { testedCards: testedCardIds.size, missingBoundaryTests, unexpectedBoundaryTests };
if (validation.cardDataVersion !== "card-info-v2-display-effect-isolation-20260908" || validation.cardCount !== 60 || validation.duplicateIds.length || validation.invalidCards.length || validation.missingEffectIds.length || result.failed || boundary.failed || boundaryWithoutDisplayFields.failed || missingBoundaryTests.length || unexpectedBoundaryTests.length || missingIndependentEffects.length || effectIds.size !== cardIds.size || effectCountBeforeDisplayData !== 60 || document.writtenScripts.length !== 0 || effectSourceViolations.length || hardcodedTraitIds.length || !effectsSurviveDisplayDeletion || !runtimeDisplayFieldsAbsent || !displayUsesTableById || !legacyRuntimeDisplayRemoved || !onlineRuntimeDisplayRemoved || !staleOnlineRuntimeRejected || !legacyLibraryReplaced || !legacySchemaRejected) {
  console.error(JSON.stringify({ validation, missingIndependentEffects, effectCountBeforeDisplayData, effectSourceViolations, hardcodedTraitIds, writtenScripts: document.writtenScripts, effectsSurviveDisplayDeletion, runtimeDisplayFieldsAbsent, displayUsesTableById, legacyRuntimeDisplayRemoved, onlineRuntimeDisplayRemoved, staleOnlineRuntimeRejected, legacyLibraryReplaced, legacySchemaRejected, result, boundary, boundaryWithoutDisplayFields, coverage }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`V2 regression tests passed: ${result.passed}/${result.results.length}`);
  console.log(`V2 card boundary tests passed: ${boundary.passed}/${boundary.results.length}`);
  console.log(`V2 card test coverage: ${coverage.testedCards}/${cardIds.size}`);
  console.log(`Independent card effects loaded: ${effectIds.size}/${cardIds.size}`);
  console.log("Trait runtime isolation: passed");
  console.log(`Display deletion isolation: ${effectsSurviveDisplayDeletion ? "passed" : "failed"}`);
  console.log(`Display-free effect execution: ${boundaryWithoutDisplayFields.passed}/${boundaryWithoutDisplayFields.results.length}`);
  console.log(`Runtime/display boundary: ${runtimeDisplayFieldsAbsent && displayUsesTableById && legacyRuntimeDisplayRemoved && onlineRuntimeDisplayRemoved ? "passed" : "failed"}`);
  console.log(`Stale online runtime rejection: ${staleOnlineRuntimeRejected ? "passed" : "failed"}`);
  console.log(`Legacy data isolation: ${legacyLibraryReplaced && legacySchemaRejected ? "passed" : "failed"}`);
}
