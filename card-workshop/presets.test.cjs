'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('./model.js');
const P = require('./presets.js');
const { build, render } = require('./build-presets.cjs');
const project = cards => ({ format: 'card-workshop-project', version: 1, cards: M.clone(cards || P.cards), decks: [] });
const byId = id => P.cards.find(e => e.source.id === id);

test('all 90 production cards and 135 workflows are deterministic and up to date', () => {
  assert.equal(fs.readFileSync(path.join(__dirname, 'presets.js'), 'utf8'), render(build()));
  assert.equal(P.cards.length, 90);
  assert.equal(P.cards.reduce((n, c) => n + c.graphs.length, 0), 135);
  for (const camp of ['魏', '蜀', '吴']) assert.equal(P.cards.filter(c => c.card.camp.endsWith(camp)).length, 30);
  assert.equal(P.cards.filter(c => c.source.pool === 'base').length, 60);
  assert.equal(P.cards.filter(c => c.source.pool === 'extra').length, 30);
  assert.equal(P.cards.filter(c => c.source.execution === 'vocabulary').length, 13);
  assert.deepEqual(M.parseProject(project()), project());
});

test('metadata and original text exactly match production display data', () => {
  const s = { window: {} }; vm.createContext(s);
  for (const file of ['card-info.js', 'replacement-cards.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), s);
  for (const card of [...s.window.CARD_INFO, ...s.window.REPLACEMENT_CARDS]) {
    const preset = byId(card.id); assert.ok(preset);
    for (const key of ['name', 'camp', 'rarity', 'baseAttack', 'skill', 'effect']) assert.equal(preset.card[key], card[key]);
    assert.equal(preset.source.effect, card.effect); assert.equal(preset.card.id, 'workshop_web_' + card.id);
  }
});

test('Web documentation graphs stay distinct from executable Unity graphs', () => {
  const maintained = P.cards.filter(c => c.source.execution === 'web'); assert.equal(maintained.length, 77);
  for (const card of maintained) {
    for (const graph of card.graphs) {
      assert.doesNotThrow(() => M.validateReference(graph));
      assert.throws(() => M.compileGraph(graph), /参考流程/);
      assert.throws(() => M.preview(graph), /参考流程/);
      assert.throws(() => M.addEffect(graph, 'DrawCards'), /参考流程/);
      assert.throws(() => M.removeEffect(graph, graph.nodes[1].id), /参考流程/);
      assert.throws(() => M.connect(graph, graph.nodes[0].id, 'next', graph.nodes[1].id), /参考流程/);
    }
    assert.throws(() => M.compileProject(project([card])), /参考/);
    const copy = M.clone(card); copy.graphs = [];
    assert.throws(() => M.compileProject(project([copy])), /Web 实际技能/);
  }
  assert.throws(() => M.compileProject(project()), /参考/);
});

test('manual reference traversal waits for conditions and supports both branches', () => {
  const graph = byId('01211').graphs[0];
  const before = M.referencePreview(graph);
  assert.equal(before.at(-1).choiceRequired, true);
  const id = before.at(-1).nodeId;
  const yes = M.referencePreview(graph, { [id]: true }).map(l => l.text).join('\n');
  const no = M.referencePreview(graph, { [id]: false }).map(l => l.text).join('\n');
  assert.match(yes, /自身本回合战力 \+2/); assert.doesNotMatch(yes, /其他己方卡牌本回合战力 \+1/);
  assert.match(no, /其他己方卡牌本回合战力 \+1/); assert.doesNotMatch(no, /自身本回合战力 \+2/);
  assert.equal(M.referencePreview(graph, { [id]: true }).at(-1).nodeId, graph.nodes.find(n => n.type === 'end').id);
});

test('malformed reference graphs, cycles and duplicate ports rejected', () => {
  for (const mutate of [
    g => { g.nodes[0].data.text = ''; },
    g => { g.edges.push(M.clone(g.edges[0])); },
    g => { g.edges[0].to = 'missing'; },
    g => { g.nodes[0].x = Infinity; },
    g => { g.edges.pop(); },
    g => { g.mode = 'magic'; }
  ]) { const p = project([byId('01211')]); mutate(p.cards[0].graphs[0]); assert.throws(() => M.parseProject(p)); }
});

test('preset merging preserves user cards, renamed originals, decks, and repeated reloads', () => {
  const old = M.sample(), copy = M.clone(byId('01102')); copy.card.name = '用户改名'; copy.card.id = 'workshop_user_renamed'; copy.graphs[0].nodes[2].data.amount = 7;
  old.cards.push(copy); old.decks.push({ id: 'd', name: '原测试卡组', cardIds: ['workshop_user_renamed'] });
  const merged = M.mergePresets(old, P); assert.equal(merged.added, 89); assert.equal(merged.project.cards.length, 91);
  assert.deepEqual(merged.project.cards[0], old.cards[0]); assert.deepEqual(merged.project.cards[1], copy); assert.deepEqual(merged.project.decks, old.decks);
  assert.equal(M.mergePresets(merged.project, P).added, 0);
  const duplicateOnly = project([copy]); duplicateOnly.cards[0].source.isCopy = true;
  assert.equal(M.mergePresets(duplicateOnly, P).added, 90);
  const snapshot = JSON.stringify(old); M.mergePresets(old, P); assert.equal(JSON.stringify(old), snapshot);
});

test('executable mappings preserve actual hook target, amount and duration semantics', () => {
  const sandbox = { window: {} }; vm.createContext(sandbox);
  for (const camp of ['shu', 'wei', 'wu']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', camp + '-card-effects.js'), 'utf8'), sandbox);
  const definitions = Object.assign({}, ...Object.values(sandbox.window.CARD_EFFECTS_V2));
  const hooks = { OnPlace: 'onPlace', OnOwnTurnStart: 'onTurnStart', OnDestroyed: 'onDestroy' };
  for (const entry of P.cards.filter(c => c.source.execution === 'vocabulary')) {
    M.compileProject(project([entry]));
    for (const graph of entry.graphs) for (const hand of [0, 2, 3, 5]) for (const noTargets of [false, true]) {
      const skill = M.compileGraph(graph), source = { uid: 'self', ownerId: 1, currentAttack: 3, row: 1, col: 1 };
      const ally = { uid: 'ally', ownerId: 1, currentAttack: 1, row: 1, col: 2 };
      const distant = { uid: 'distant', ownerId: 1, currentAttack: 5, row: 3, col: 3 };
      const enemy = { uid: 'enemy', ownerId: 2, currentAttack: 2, row: 1, col: 0 };
      const guard = { uid: 'guard', ownerId: 0, currentAttack: 4, row: 1, col: 3 };
      const board = noTargets ? [] : [ally, distant, enemy, guard];
      if (skill.trigger !== 'OnDestroyed') board.unshift(source);
      const log = [], expected = [];
      const context = { card: source, player: { hand: Array(hand).fill({}) }, board, log: () => {},
        allies: () => noTargets ? [] : [ally], enemies: () => noTargets ? [] : [enemy], otherAllies: () => board.filter(c => c.ownerId === 1 && c !== source), pickRandom: a => a[0],
        adjust: (target, amount, temporary = false) => log.push([target.uid, amount, temporary]), draw: () => log.push(['draw', 1]) };
      definitions[entry.source.id][hooks[skill.trigger]](context);
      const met = skill.condition === 'Always' || (skill.condition === 'HasAdjacentEnemy' && !noTargets) || (skill.condition === 'HandBelow' && hand < skill.conditionValue);
      if (met) for (const step of skill.steps) {
        if (step.operation === 'DrawCards') { expected.push(['draw', step.amount]); continue; }
        let targets = step.target === 'Self' ? [source] : step.target === 'AdjacentAllies' ? context.allies() : step.target === 'AdjacentEnemies' ? context.enemies() : step.target === 'AllAllies' ? context.otherAllies() : board.filter(c => c.ownerId !== 1 && (c.row === source.row || c.col === source.col));
        if (step.selection === 'HighestPower') targets = targets.filter(t => t.currentAttack === Math.max(...targets.map(t => t.currentAttack)));
        if (step.selection === 'LowestPower') targets = targets.filter(t => t.currentAttack === Math.min(...targets.map(t => t.currentAttack)));
        if (step.selection !== 'All') targets = targets.slice(0, 1);
        targets.forEach(t => expected.push([t.uid, step.amount, step.duration === 'CurrentTurn']));
      }
      assert.deepEqual(log, expected, `${entry.source.id}/${skill.trigger}, hand=${hand}, empty=${noTargets}`);
    }
  }
});
