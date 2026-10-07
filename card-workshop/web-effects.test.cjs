'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const W = require('./web-effects.js');
const { engine, regression } = require('./verify.cjs');
const M = require('./model.js');
const P = require('./presets.js');
const root = path.join(__dirname, '..');
const project = cards => ({ format: 'card-workshop-project', version: 1, cards: M.clone(cards || P.cards), decks: [] });
const bodyOf = fn => fn.toString().slice(fn.toString().indexOf('{') + 1, fn.toString().lastIndexOf('}')).trim();

test('each of the 77 formerly reference cards retains EVERY actual hook, flag, and constant', () => {
  const source = { window: {} }; vm.createContext(source);
  for (const camp of ['shu', 'wei', 'wu']) vm.runInContext(fs.readFileSync(path.join(root, camp + '-card-effects.js'), 'utf8'), source);
  const webCards = P.cards.filter(e => e.web); assert.equal(webCards.length, 77);
  for (const entry of webCards) {
    const original = source.window.CARD_EFFECTS_V2[entry.source.module.split('-')[0]][entry.source.id];
    const rebuilt = vm.runInNewContext(W.factoryCode(entry.web), {}, { timeout: 2000 });
    assert.equal(entry.source.execution, 'web');
    assert.deepEqual(Object.keys(rebuilt).sort(), Object.keys(original).sort(), entry.source.id);
    for (const [key, value] of Object.entries(original)) {
      if (typeof value === 'function') assert.equal(bodyOf(rebuilt[key]), bodyOf(value), entry.source.id + '/' + key);
      else assert.equal(JSON.stringify(rebuilt[key]), JSON.stringify(value), entry.source.id + '/' + key);
    }
    assert.deepEqual(M.parseProject(project([entry])), project([entry]));
    assert.throws(() => M.compileProject(project([entry])), /Web 实际技能/);
  }
});

test('exported 77-card package passes real engine regressions and all 90 card boundary checks', () => {
  const baseline = regression(engine());
  const actual = regression(engine(W.exportScript(P.cards)));
  assert.deepEqual(actual, baseline);
  for (const group of actual) assert.equal(group.failed, 0, JSON.stringify(group.results.filter(r => !r.passed)));
  const covered = new Set(actual[1].results.map(r => r.id));
  assert.equal(covered.size, 90);
  for (const entry of P.cards) assert.ok(covered.has(entry.source.id), 'missing boundary coverage for ' + entry.source.id);
  console.log('Production engine: ' + actual.reduce((n, g) => n + g.passed, 0) + ' assertions passed; 90 cards covered.');
});

test('changing a maintained amount changes real battle behavior and catches a baseline deviation', () => {
  const entry = M.clone(P.cards.find(e => e.source.id === '01211'));
  const key = 'onTurnStart', params = W.parameters(entry.web.hooks[key]);
  const amount = params.findIndex(p => p.value === 2); assert.ok(amount >= 0);
  entry.web.hooks[key] = W.setParameter(entry.web.hooks[key], amount, 7);
  const s = engine(W.exportScript([entry]));
  const result = vm.runInContext(`(() => {
    const api = __CARD_DEMO_CORE_V2_TEST_API__;
    const template = CARD_LIBRARY.cardSlots.find(c => c.id === '01211');
    const card = api.cloneCard(template); Object.assign(card, { ownerId: 1, row: 1, col: 1, currentAttack: card.attack, v2TempBonus: 0, v2PermanentBonus: 0 });
    const game = { turn: 1, activePlayerId: 1, boardCards: [card], brokenCells: [], v2PlacementLocks: [], pendingAnimations: [], moveLocks: {}, players: [{id:1,hand:[],drawPile:[]},{id:2,hand:[],drawPile:[]}], v2ControlCells: [{row:0,col:0,ownerId:2,sourceUid:'a',untilTurn:Infinity},{row:0,col:1,ownerId:2,sourceUid:'b',untilTurn:Infinity}] };
    api.state.game = game; api.coreRunV2StartSkill(game, game.players[0], card); return card.v2TempBonus;
  })()`, s, { timeout: 3000 });
  assert.equal(result, 7);
  assert.ok(regression(s)[1].results.some(r => r.id === '01211' && !r.passed));
});

test('helper dependencies and passive-only cards can be maintained without replacing semantics', () => {
  for (const [id, helper] of [['01328', 'attackRandomAdjacentEnemy'], ['03103', 'destroyLowerAdjacent'], ['03429', 'randomDestroyEffectTarget'], ['03530', 'randomDestroyEffectTarget']]) {
    const entry = P.cards.find(e => e.source.id === id); assert.ok(entry.web.helpers[helper]); assert.ok(W.sections(entry.web).some(s => s.key === 'helper:' + helper));
  }
  const entry = M.clone(P.cards.find(e => e.source.id === '01518'));
  assert.deepEqual(entry.web.hooks, {}); assert.equal(entry.web.flags.substituteAdjacent, true);
  entry.web.flags.substituteAdjacent = false;
  assert.equal(vm.runInNewContext(W.factoryCode(entry.web)).flags.substituteAdjacent, false);
});

test('drafts preserve incomplete code without executing it; export rejects invalid syntax', () => {
  const entry = M.clone(P.cards.find(e => e.source.id === '01211'));
  entry.web.hooks.onTurnStart = 'if (';
  assert.doesNotThrow(() => M.parseProject(project([entry])));
  assert.throws(() => W.exportScript([entry]), /onTurnStart/);
  entry.web.hooks.onTurnStart = 'globalThis.__workshopInjection = true;';
  W.validate(entry.web); W.exportScript([entry]); assert.equal(globalThis.__workshopInjection, undefined);
  entry.web.flags.unknown = true; assert.throws(() => W.validate(entry.web), /标记/);
  delete entry.web.flags.unknown; entry.web.hooks.unknown = ''; assert.throws(() => W.validate(entry.web), /事件/);
});

test('legacy upgrade keeps exact edits, card IDs, diagram positions and deck references, and never overwrites Web work', () => {
  const entry = M.clone(P.cards.find(e => e.source.id === '01211'));
  delete entry.web; entry.source.execution = 'reference'; entry.card.name = '用户改名'; entry.card.id = 'workshop_renamed'; entry.graphs[0].nodes[1].x = 991;
  const legacy = project([entry]); legacy.decks = [{ id: 'test', name: '测试', cardIds: ['workshop_renamed'] }];
  const merged = M.mergePresets(legacy, P); assert.equal(merged.upgraded, 1);
  const maintained = merged.project.cards[0]; assert.deepEqual(maintained.card, entry.card); assert.deepEqual(maintained.graphs, entry.graphs); assert.deepEqual(merged.project.decks, legacy.decks);
  maintained.web.hooks.onTurnStart = 'ctx.addActions(3);';
  assert.equal(M.mergePresets(merged.project, P).upgraded, 0);
  assert.equal(M.mergePresets(merged.project, P).project.cards[0].web.hooks.onTurnStart, 'ctx.addActions(3);');
  assert.equal(legacy.cards[0].web, undefined);
});

test('export rejects multiple copies of the same original ID and validates every card before installing any patch', () => {
  const entry = P.cards.find(e => e.web);
  assert.throws(() => W.exportScript([entry, M.clone(entry)]), /多个维护副本/);
  const invalid = M.clone(entry); invalid.source.id = 'escape'; assert.throws(() => W.exportScript([invalid]), /原始卡牌 ID/);
  const original = vm.createContext({ window: { CARD_EFFECTS_V2: { shu: {}, wei: {}, wu: {} } } });
  vm.runInContext(W.exportScript(P.cards), original);
  assert.equal(Object.values(original.window.CARD_EFFECTS_V2).reduce((n, camp) => n + Object.keys(camp).length, 0), 77);
});

test('quick parameters edit actual calls without touching logs, comments or dynamic target expressions', () => {
  const body = 'ctx.adjust(ctx.card, -2, true); // ctx.adjust(ctx.card, 9)\nctx.log("ctx.addActions(7)");\nctx.addActions(1);\nctx.adjust(ctx.card, ctx.allies().length, true);';
  assert.deepEqual(W.parameters(body).map(p => p.value), [-2, 1]);
  const changed = W.setParameter(body, 0, -4); assert.match(changed, /ctx\.card, -4, true/); assert.match(changed, /ctx\.addActions\(7\)/);
  assert.throws(() => W.setParameter(body, 0, NaN));
  assert.deepEqual(W.parameters('const re = /ctx.addActions(7)/;'), []);
});

module.exports = { engine, regression };
