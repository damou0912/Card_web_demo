'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('./model.js');
const sampleGraph = () => M.sample().cards[0].graphs[0];

test('sample compiles into exact Unity skills and descriptions', () => {
  const library = M.compileProject(M.sample());
  assert.equal(library.cards[0].demoEffect, 'None');
  assert.deepEqual(library.cards[0].abilities[0].steps.map(s => s.operation), ['ModifyPower', 'GrantShield']);
  assert.match(library.cards[0].effect, /护盾/);
  assert.deepEqual(M.compileProject(M.importLibrary(library)), library);
});
test('shipped Unity library roundtrip preserves IDs, decks and executable abilities', () => {
  const original = JSON.parse(fs.readFileSync(path.join(__dirname, '../UnityCard_demo/Assets/Resources/Data/workshop-library.json'), 'utf8'));
  const result = M.compileProject(M.parseProject(original));
  assert.deepEqual(result.decks, original.decks);
  result.cards.forEach((card, i) => { assert.equal(card.id, original.cards[i].id); assert.deepEqual(card.abilities, original.cards[i].abilities); });
});
test('graph JSON survives save/import with layout intact', () => {
  const project = M.sample(); project.cards[0].graphs[0].nodes[0].x = -90;
  assert.deepEqual(M.parseProject(JSON.parse(JSON.stringify(project))), project);
});
test('edge order, not layout or array order, determines effects', () => {
  const graph = sampleGraph(), order = M.topology(graph);
  graph.nodes.reverse(); graph.nodes.forEach(n => { n.x *= -1; });
  graph.edges = graph.edges.filter(e => ![order.condition.id, ...order.steps.map(n => n.id)].includes(e.from) || e.port === 'no');
  graph.edges.push({ from: order.condition.id, to: order.steps[1].id, port: 'yes' }, { from: order.steps[1].id, to: order.steps[0].id, port: 'next' }, { from: order.steps[0].id, to: order.end.id, port: 'next' });
  assert.deepEqual(M.compileGraph(graph).steps.map(s => s.operation), ['GrantShield', 'ModifyPower']);
});
test('adding and deleting effects keeps complete chain', () => {
  const graph = sampleGraph(); const added = M.addEffect(graph, 'DrawCards');
  assert.equal(M.compileGraph(graph).steps.length, 3);
  M.removeEffect(graph, added.id); assert.equal(M.compileGraph(graph).steps.length, 2);
  assert.throws(() => M.removeEffect(graph, graph.nodes[0].id), /不能删除/);
});
test('effect limits and retained last effect', () => {
  const graph = sampleGraph(); for (let i = 0; i < 6; i++) M.addEffect(graph, 'Destroy');
  assert.equal(M.compileGraph(graph).steps.length, 8); assert.throws(() => M.addEffect(graph, 'GrantShield'), /最多/);
  while (graph.nodes.filter(n => n.type === 'effect').length > 1) M.removeEffect(graph, graph.nodes.find(n => n.type === 'effect').id);
  assert.throws(() => M.removeEffect(graph, graph.nodes.find(n => n.type === 'effect').id), /至少保留/);
});
test('disconnected drafts can be saved but never exported or previewed', () => {
  const project = M.sample(), graph = project.cards[0].graphs[0]; graph.edges.pop();
  assert.doesNotThrow(() => M.parseProject(project)); assert.throws(() => M.compileProject(project), /条件不满足/); assert.throws(() => M.preview(graph), /条件不满足/);
});
test('reconnection replaces one output and supports repairing a broken chain', () => {
  const graph = sampleGraph(), order = M.topology(graph), first = order.steps[0], second = order.steps[1];
  graph.edges = graph.edges.filter(e => e.from !== first.id);
  M.connect(graph, first.id, 'next', second.id); assert.equal(M.compileGraph(graph).steps.length, 2);
  M.connect(graph, first.id, 'next', order.end.id); assert.throws(() => M.compileGraph(graph), /入口|未接入/);
});
test('cycles, invalid direction and illegal false branches rejected atomically', () => {
  const graph = sampleGraph(), order = M.topology(graph), original = M.clone(graph);
  assert.throws(() => M.connect(graph, order.steps[1].id, 'next', order.steps[0].id), /循环/);
  assert.deepEqual(graph, original);
  assert.throws(() => M.connect(graph, order.end.id, 'next', order.steps[0].id), /方向/);
  assert.throws(() => M.connect(graph, order.condition.id, 'no', order.steps[0].id), /只能结束/);
  assert.throws(() => M.connect(graph, order.trigger.id, 'next', order.end.id), /条件/);
});
test('import rejects duplicate IDs, unsupported enum, malformed nodes and invalid deck references', () => {
  for (const modify of [
    p => p.cards.push(M.clone(p.cards[0])),
    p => { p.cards[0].graphs[0].nodes[0].data.trigger = 'Never'; },
    p => { p.cards[0].graphs[0].nodes[0].x = '100'; },
    p => { p.cards[0].graphs[0].nodes[0].id = '<script>'; },
    p => { p.decks.push({ id: 'deck', name: 'test', cardIds: ['workshop_missing'] }); },
    p => { p.cards[0].graphs[0].edges.push({ from: 'missing', to: 'missing', port: 'next' }); }
  ]) { const p = M.sample(); modify(p); assert.throws(() => M.parseProject(p)); }
});
test('each operation validates its own amount, target and duration', () => {
  for (const operation of Object.keys(M.OPTIONS.operation)) assert.doesNotThrow(() => M.validateStep(M.step(operation)));
  for (const amount of [0, -21, 21, 1.5, NaN]) assert.throws(() => M.validateStep({ ...M.step(), amount }));
  for (const amount of [-20, -1, 1, 20]) assert.doesNotThrow(() => M.validateStep({ ...M.step(), amount }));
  assert.throws(() => M.validateStep({ ...M.step('DrawCards'), amount: 6 }));
  assert.throws(() => M.validateStep({ ...M.step('DrawCards'), target: 'AllEnemies' }));
  assert.throws(() => M.validateStep({ ...M.step('AddActions'), selection: 'RandomOne' }));
  assert.throws(() => M.validateStep({ ...M.step('Destroy'), duration: 'CurrentTurn' }));
  assert.throws(() => M.validateStep({ ...M.step('GrantShield'), amount: 2 }));
});
test('condition previews choose the correct path and strict hand threshold', () => {
  const graph = sampleGraph(), condition = graph.nodes.find(n => n.type === 'condition');
  assert.equal(M.preview(graph, { adjacent: false }).length, 3);
  assert.equal(M.preview(graph, { adjacent: true }).length, 5);
  condition.data.condition = 'HandBelow'; condition.data.conditionValue = 3;
  assert.equal(M.preview(graph, { hand: 3 }).length, 3); assert.equal(M.preview(graph, { hand: 2 }).length, 5);
  condition.data.condition = 'BehindOnScore';
  assert.equal(M.preview(graph, { own: 2, opponent: 2 }).length, 3); assert.equal(M.preview(graph, { own: 1, opponent: 2 }).length, 5);
  condition.data.condition = 'Always'; assert.equal(M.preview(graph, {}).length, 5);
});
test('no-skill cards, all trigger and target combinations are compatible', () => {
  const project = M.sample(); project.cards[0].graphs = [];
  assert.equal(M.compileProject(project).cards[0].skill, '无');
  for (const trigger of Object.keys(M.OPTIONS.trigger)) for (const target of Object.keys(M.OPTIONS.target)) for (const selection of Object.keys(M.OPTIONS.selection)) {
    const graph = M.graphFromSkill({ name: '组合', trigger, condition: 'Always', conditionValue: 0, steps: [{ ...M.step(), target, selection }] });
    assert.equal(M.compileGraph(graph).trigger, trigger);
  }
});
test('arrange preserves the executable flow', () => {
  const graph = sampleGraph(), original = M.compileGraph(graph); M.arrange(graph);
  assert.deepEqual(M.compileGraph(graph), original); assert.ok(graph.nodes[3].y > graph.nodes[0].y);
});
