'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const GachaReveal = require('./wwwroot/reveal.js');

// Exercise the real detail renderer without a browser, random draws or writable saves.
class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.className = ''; this.value = ''; this.open = false; }
  set textContent(value) { this.value = String(value); this.children = []; }
  get textContent() { return this.value + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.value = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener() {}
  querySelectorAll() { return []; }
  showModal() { this.open = true; }
}
function setup() {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node('div')); return nodes.get(id); };
  const card = { id: '03530', camp: '三国~吴', rarity: '特殊', name: '传国玉玺', baseAttack: 0, skill: '传国', effect: '1、第一段效果。\r\n2、第二段效果。' };
  const input = { cards: [card], state: { owned: [] }, config: { groups: [] } };
  const scope = vm.createContext({
    GachaReveal, input, window: { matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { getElementById: get, createElement: tag => new Node(tag), querySelectorAll: () => [] },
    fetch: () => new Promise(() => {})
  });
  vm.runInContext(fs.readFileSync(require.resolve('./wwwroot/app.js'), 'utf8'), scope);
  vm.runInContext('session = input;', scope);
  return { scope, get, input, card, show: () => vm.runInContext('showCard(input.cards[0].id)', scope) };
}
function find(node, className) {
  if (node.className.split(' ').includes(className)) return node;
  for (const child of node.children) { const result = find(child, className); if (result) return result; }
}
test('detail hides ID/probability, frames ownership, and separates zero power from skill', () => {
  const h = setup(); const before = JSON.stringify(h.input); h.show();
  const root = h.get('detail-content');
  assert.doesNotMatch(root.textContent, /03530|ID|概率/);
  assert.ok(root.textContent.includes('三国-吴'));
  assert.equal(find(root, 'detail-ownership').textContent, '未拥有');
  assert.equal(find(root, 'detail-ownership').dataset.owned, 'false');
  assert.equal(find(root, 'detail-power-value').textContent, '0');
  assert.equal(find(root, 'detail-skill-name').textContent, h.card.skill);
  assert.equal(find(root, 'detail-effect').textContent, h.card.effect);
  assert.equal(find(root, 'detail-stats').children.length, 2);
  assert.equal(h.get('detail').dataset.quality, 'special');
  assert.equal(h.get('detail').open, true);
  assert.equal(h.get('detail').scrollTop, 0);
  assert.equal(JSON.stringify(h.input), before);
});
test('reopening updates owned state/quality without duplicating content or awarding cards', () => {
  const h = setup(); h.show(); const count = h.get('detail-content').children.length;
  h.input.state.owned.push({ cardId: h.card.id }); h.card.rarity = '传说';
  const before = JSON.stringify(h.input); h.show();
  assert.equal(find(h.get('detail-content'), 'detail-ownership').textContent, '已拥有');
  assert.equal(find(h.get('detail-content'), 'detail-ownership').dataset.owned, 'true');
  assert.equal(h.get('detail').dataset.quality, 'legendary');
  assert.equal(h.get('detail-content').children.length, count);
  assert.equal(JSON.stringify(h.input), before);
});
test('detail stays closed during an active reveal', () => {
  const h = setup(); vm.runInContext('busy = true;', h.scope); h.show();
  assert.equal(h.get('detail').open, false);
  assert.equal(h.get('detail-content').children.length, 0);
});
