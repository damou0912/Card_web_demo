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
  location: { search: "" }, window: null,
  authClient: { loadUser() { return null; }, clearUser() {} }
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
vm.runInContext(fs.readFileSync(path.join(__dirname, "replacement-cards.js"), "utf8"), context, { filename: "replacement-cards.js" });
const expectedCardCount = 60 + (Array.isArray(context.REPLACEMENT_CARDS) ? context.REPLACEMENT_CARDS.length : 0);
context.CARD_LIBRARY = { version: "legacy", cardSlots: [{ id: "old-card" }], campNamePool: { old: true } };
vm.runInContext(fs.readFileSync(path.join(__dirname, "v2-card-data.js"), "utf8"), context, { filename: "v2-card-data.js" });
const legacyLibraryReplaced = context.CARD_LIBRARY.version === "card-info-v2-display-effect-isolation-20260908"
  && context.CARD_LIBRARY.cardSlots.length === expectedCardCount
  && !("campNamePool" in context.CARD_LIBRARY);
const originalLibrary = context.CARD_LIBRARY;
["script.js", "core-v2.js", "core-v2.test-suite.js"].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), context, { filename: file });
});
const expectedChaosRarities = { "普通": 7, "稀有": 5, "史诗": 3, "传说": 1, "特殊": 4 };
const chaosDeck = context.__CARD_DEMO_DEBUG__.buildCampDeck("混沌");
const chaosRarityCounts = chaosDeck.reduce((counts, card) => {
  const rarity = context.__CARD_DEMO_DEBUG__.getCardDisplay(card).rarity;
  counts[rarity] = (counts[rarity] || 0) + 1;
  return counts;
}, {});
const chaosGame = context.__CARD_DEMO_CORE_V2__.coreCreateGame("card-test", { 1: "混沌", 2: "混沌" }, 5, 1);
const nextChaosGame = context.__CARD_DEMO_CORE_V2__.coreCreateGame("card-test", { 1: "混沌", 2: "混沌" }, 5, 1);
const firstChaosCatalog = chaosGame.players[0].deckCatalog;
const secondChaosCatalog = chaosGame.players[1].deckCatalog;
const firstGameCards = [...firstChaosCatalog, ...secondChaosCatalog];
const nextGameCards = nextChaosGame.players.flatMap((player) => player.deckCatalog);
const originalRandom = context.Math.random;
let aiDeckAtUpperRandomBound = null;
try {
  context.Math.random = () => 0.999999;
  aiDeckAtUpperRandomBound = context.__CARD_DEMO_DEBUG__.getRandomDeckKey();
} finally {
  context.Math.random = originalRandom;
}
const chaosDeckValidation = {
  availableAsDeckOption: context.__CARD_DEMO_DEBUG__.getAvailableDeckKeys().includes("混沌"),
  excludedFromAiRandomPool: aiDeckAtUpperRandomBound === "三国~吴",
  hasTwentyCards: chaosDeck.length === 20,
  hasExactRarityCounts: Object.entries(expectedChaosRarities).every(([rarity, count]) => chaosRarityCounts[rarity] === count),
  usesOnlyCatalogCards: chaosDeck.every((card) => originalLibrary.cardSlots.some((slot) => String(slot.id) === String(card.id))),
  samplesWithoutReplacement: new Set(chaosDeck.map((card) => card.id)).size === chaosDeck.length,
  playersHaveSeparateCatalogs: firstChaosCatalog !== secondChaosCatalog
    && firstChaosCatalog.every((card) => !secondChaosCatalog.includes(card)),
  playersHaveIndependentUids: new Set(firstGameCards.map((card) => card.uid)).size === firstGameCards.length,
  recreatingGameBuildsNewCards: firstGameCards.every((card) => !nextGameCards.includes(card))
};
const chaosDeckPassed = Object.values(chaosDeckValidation).every(Boolean);
const deckDebug = context.__CARD_DEMO_DEBUG__;
const defaultShuIds = context.CARD_INFO.filter((card) => card.camp === "三国~蜀").map((card) => String(card.id));
const defaultWeiIds = context.CARD_INFO.filter((card) => card.camp === "三国~魏").map((card) => String(card.id));
const replacementCommon = context.REPLACEMENT_CARDS.find((card) => card.camp === "三国~蜀" && card.rarity === "普通");
const replacementRare = context.REPLACEMENT_CARDS.find((card) => card.camp === "三国~蜀" && card.rarity === "稀有");
const customShuIds = [...defaultShuIds];
customShuIds[0] = replacementCommon.id;
const rareModifications = { "稀有": { 0: { id: replacementRare.id, attack: replacementRare.attack } } };
const rareModifiedIds = deckDebug.buildCustomDeckCardIds("三国~蜀", rareModifications);
const previousCustomDecks = deckDebug.state.customDecks;
deckDebug.state.customDecks = { "三国~蜀": { version: 2, cardIds: customShuIds } };
const configuredShuIds = deckDebug.getConfiguredDeckCardIds("三国~蜀");
const pveCustomGame = context.__CARD_DEMO_CORE_V2__.coreCreateGame("pve", { 1: "三国~蜀", 2: "三国~蜀" }, 5, 1);
const onlineCustomGame = context.__CARD_DEMO_CORE_V2__.coreCreateGame(
  "online", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, null, null,
  { 1: customShuIds, 2: defaultWeiIds }
);
deckDebug.state.customDecks = previousCustomDecks;
const crossCampIds = [...defaultShuIds];
crossCampIds[0] = defaultWeiIds[0];
const wrongRarityIds = [...defaultShuIds];
wrongRarityIds[0] = replacementRare.id;
const replacementCommonDetails = deckDebug.getModifyDeckCardDetails(replacementCommon);
const previousModifyDeck = deckDebug.state.modifyDeck;
deckDebug.state.modifyDeck = {
  selectedCamp: "三国~蜀",
  selectedRarity: "普通",
  currentCards: [],
  candidateCards: [],
  modifications: {},
  originalDeck: deckDebug.buildCampDeck("三国~蜀")
};
const initialCommonCandidates = deckDebug.getAvailableModifyDeckCandidates("普通");
deckDebug.state.modifyDeck = previousModifyDeck;
const customDeckValidation = {
  savedDeckIsResolved: configuredShuIds[0] === replacementCommon.id,
  pvePlayerUsesCustomDeck: pveCustomGame.players[0].deckCatalog.some((card) => card.id === replacementCommon.id),
  pveAiKeepsDefaultDeck: !pveCustomGame.players[1].deckCatalog.some((card) => card.id === replacementCommon.id),
  onlineUsesEachResolvedDeck: onlineCustomGame.players[0].deckCatalog.some((card) => card.id === replacementCommon.id)
    && onlineCustomGame.players[1].deckCatalog.every((card) => defaultWeiIds.includes(card.id)),
  nonCommonRarityUsesCorrectSlot: rareModifiedIds?.[7] === replacementRare.id && rareModifiedIds?.[0] === defaultShuIds[0],
  crossCampRejected: deckDebug.normalizeCustomDeckData("三国~蜀", { version: 2, cardIds: crossCampIds }) === null,
  rarityChangeRejected: deckDebug.normalizeCustomDeckData("三国~蜀", { version: 2, cardIds: wrongRarityIds }) === null,
  legacyFormatMigrates: deckDebug.normalizeCustomDeckData("三国~蜀", { "普通": { 0: replacementCommon } })?.cardIds[0] === replacementCommon.id,
  modifyDeckPreviewUsesFullCardDetails: replacementCommonDetails.name === replacementCommon.name
    && replacementCommonDetails.skill === replacementCommon.skill
    && replacementCommonDetails.effect === replacementCommon.effect
    && replacementCommonDetails.baseAttack === replacementCommon.baseAttack,
  candidatesVisibleBeforeTargetSelection: initialCommonCandidates.length > 0
    && initialCommonCandidates.every((card) => card.camp === "三国~蜀" && card.rarity === "普通")
    && initialCommonCandidates.every((card) => !defaultShuIds.includes(String(card.id)))
};
const customDeckPassed = Object.values(customDeckValidation).every(Boolean);
const loginPromptPolicyValid = deckDebug.shouldAutoOpenLogin(null)
  && deckDebug.shouldAutoOpenLogin("")
  && !deckDebug.shouldAutoOpenLogin("player1");
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
const originalReplacementCards = context.REPLACEMENT_CARDS;
context.REPLACEMENT_CARDS = originalReplacementCards.map((card) => ({ id: card.id, attack: card.attack }));
const boundaryWithoutDisplayFields = context.runCoreV2CardBoundaryTests();
context.REPLACEMENT_CARDS = originalReplacementCards;
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
if (validation.cardDataVersion !== "card-info-v2-display-effect-isolation-20260908" || validation.cardCount !== expectedCardCount || validation.duplicateIds.length || validation.invalidCards.length || validation.missingEffectIds.length || result.failed || boundary.failed || boundaryWithoutDisplayFields.failed || missingBoundaryTests.length || unexpectedBoundaryTests.length || missingIndependentEffects.length || effectIds.size !== cardIds.size || effectCountBeforeDisplayData !== expectedCardCount || document.writtenScripts.length !== 0 || effectSourceViolations.length || hardcodedTraitIds.length || !effectsSurviveDisplayDeletion || !runtimeDisplayFieldsAbsent || !displayUsesTableById || !legacyRuntimeDisplayRemoved || !onlineRuntimeDisplayRemoved || !staleOnlineRuntimeRejected || !legacyLibraryReplaced || !legacySchemaRejected || !chaosDeckPassed || !customDeckPassed || !loginPromptPolicyValid) {
  console.error(JSON.stringify({ validation, missingIndependentEffects, effectCountBeforeDisplayData, effectSourceViolations, hardcodedTraitIds, writtenScripts: document.writtenScripts, effectsSurviveDisplayDeletion, runtimeDisplayFieldsAbsent, displayUsesTableById, legacyRuntimeDisplayRemoved, onlineRuntimeDisplayRemoved, staleOnlineRuntimeRejected, legacyLibraryReplaced, legacySchemaRejected, chaosDeckValidation, customDeckValidation, loginPromptPolicyValid, result, boundary, boundaryWithoutDisplayFields, coverage }, null, 2));
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
  console.log(`Chaos deck generation: ${Object.keys(chaosDeckValidation).length}/${Object.keys(chaosDeckValidation).length}`);
  console.log(`Custom deck integration: ${Object.keys(customDeckValidation).length}/${Object.keys(customDeckValidation).length}`);
  console.log(`Guest login prompt policy: ${loginPromptPolicyValid ? "passed" : "failed"}`);
}
