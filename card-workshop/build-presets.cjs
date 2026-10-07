'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const M = require('./model.js');
const W = require('./web-effects.js');
const { definitions } = require('./preset-definitions.cjs');
const root = path.resolve(__dirname, '..');
const outputPath = path.join(__dirname, 'presets.js');

function build() {
  const sandbox = { window: {} }; vm.createContext(sandbox);
  const helpersByCamp = {};
  for (const file of ['card-info.js', 'replacement-cards.js', 'shu-card-effects.js', 'wei-card-effects.js', 'wu-card-effects.js']) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    const names = [...source.matchAll(/^  function (\w+)\(/gm)].map(m => m[1]);
    if (file.endsWith('-card-effects.js')) {
      source = source.replace('  window.CARD_EFFECTS_V2 =', `  window.__workshopHelpers = { ${names.join(', ')} };\n  window.CARD_EFFECTS_V2 =`);
    }
    vm.runInContext(source, sandbox, { timeout: 2000 });
    if (file.endsWith('-card-effects.js')) helpersByCamp[file.split('-')[0]] = sandbox.window.__workshopHelpers;
  }
  const cards = JSON.parse(JSON.stringify([...sandbox.window.CARD_INFO, ...sandbox.window.REPLACEMENT_CARDS]));
  const base = new Set(sandbox.window.CARD_INFO.map(c => c.id));
  const effects = sandbox.window.CARD_EFFECTS_V2;
  assert.equal(cards.length, 90); assert.equal(base.size, 60);
  assert.equal(new Set(cards.map(c => c.id)).size, 90);
  assert.deepEqual(Object.keys(definitions).sort(), cards.map(c => c.id).sort(), 'Every production card needs an explicit reviewed definition');
  const sourceBytes = ['card-info.js', 'replacement-cards.js', 'shu-card-effects.js', 'wei-card-effects.js', 'wu-card-effects.js', 'core-v2.js', 'card-workshop/preset-definitions.cjs', 'card-workshop/build-presets.cjs', 'card-workshop/model.js', 'card-workshop/web-effects.js'].map(file => fs.readFileSync(path.join(root, file)));
  const version = 'production-' + crypto.createHash('sha256').update(Buffer.concat(sourceBytes)).digest('hex').slice(0, 12);
  const result = cards.sort((a, b) => a.id.localeCompare(b.id)).map(card => {
    const definition = definitions[card.id], camp = { '01': 'shu', '02': 'wei', '03': 'wu' }[card.id.slice(0, 2)];
    const runtime = effects[camp][card.id]; assert.ok(runtime, card.id + ': missing runtime');
    let graphs;
    if (definition.executable) {
      assert.equal(runtime.flags, undefined, card.id + ': cannot drop engine flags');
      const hooks = { OnPlace: 'onPlace', OnOwnTurnStart: 'onTurnStart', OnOwnTurnEnd: 'onTurnEnd', OnDestroyed: 'onDestroy', OnMove: 'onMove', AfterCombat: 'onCombatResolved' };
      assert.deepEqual(Object.keys(runtime).filter(k => typeof runtime[k] === 'function').sort(), definition.executable.map(s => hooks[s.trigger]).sort(), card.id + ': not all hooks mapped');
      graphs = definition.executable.map((skill, i) => {
        const graph = M.graphFromSkill({ ...skill, name: card.skill + (definition.executable.length > 1 ? ' · ' + M.label('trigger', skill.trigger) : '') });
        const ids = new Map(graph.nodes.map((n, j) => [n.id, `p_${card.id}_${i}_${j}`]));
        graph.nodes.forEach(n => { n.id = ids.get(n.id); }); graph.edges.forEach(e => { e.from = ids.get(e.from); e.to = ids.get(e.to); });
        return graph;
      });
    } else {
      assert.ok(definition.flows?.length, card.id + ': missing flow');
      const described = new Set(definition.flows.map(f => f.hook));
      for (const [key, value] of Object.entries(runtime)) {
        if (typeof value === 'function') assert.ok(described.has(key), `${card.id}: undescribed hook ${key}`);
        if (key === 'flags') for (const flag of Object.keys(value)) assert.ok(described.has('flags.' + flag), `${card.id}: undescribed flag ${flag}`);
      }
      graphs = definition.flows.map((flow, i) => {
        let count = 0;
        const graph = { name: `${card.skill} · ${flow.title}`, mode: 'reference', hook: flow.hook, nodes: [], edges: [] };
        function node(type, title, text) { const n = { id: `p_${card.id}_${i}_${count++}`, type, x: 0, y: 0, data: { title, text } }; graph.nodes.push(n); return n.id; }
        const start = node('trigger', flow.title, `触发时机：${flow.title}；对应 ${flow.hook}`);
        function chain(items, ends) {
          for (const item of items) {
            const id = typeof item === 'string' ? node('effect', '处理步骤', item) : node('condition', '条件分支', item.question);
            for (const end of ends) graph.edges.push({ from: end.from, port: end.port, to: id });
            ends = typeof item === 'string' ? [{ from: id, port: 'next' }] : [...chain(item.yes, [{ from: id, port: 'yes' }]), ...chain(item.no, [{ from: id, port: 'no' }])];
          }
          return ends;
        }
        const ends = chain(flow.steps, [{ from: start, port: 'next' }]);
        const end = node('end', '结束本次处理', '参考流程结束；未执行任何游戏操作，后续交战、保护与连锁仍由正式 Web 引擎负责。');
        ends.forEach(tail => graph.edges.push({ ...tail, to: end })); M.arrange(graph); return graph;
      });
    }
    let web;
    if (!definition.executable) {
      web = { engine: 'web-v2', version: 1, hooks: {}, helpers: {}, flags: {}, constants: {} };
      const bodyOf = fn => fn.toString().slice(fn.toString().indexOf('{') + 1, fn.toString().lastIndexOf('}')).trim();
      for (const [key, value] of Object.entries(runtime)) {
        if (typeof value === 'function') web.hooks[key] = bodyOf(value);
        else if (key === 'flags') web.flags = JSON.parse(JSON.stringify(value));
        else web.constants[key] = value;
      }
      // Preserve helper closures, including transitive dependencies, per card.
      let changed;
      do {
        changed = false;
        const bodies = [...Object.values(web.hooks), ...Object.values(web.helpers).map(h => h.body)].join('\n');
        for (const [name, fn] of Object.entries(helpersByCamp[camp])) {
          if (web.helpers[name] || !new RegExp('\\b' + name + '\\s*\\(').test(bodies)) continue;
          const args = fn.toString().match(/^[^(]+\(([^)]*)\)/)[1].split(',').map(s => s.trim()).filter(Boolean);
          web.helpers[name] = { args, body: bodyOf(fn) }; changed = true;
        }
      } while (changed);
      W.validate(web);
      const rebuilt = vm.runInNewContext(W.factoryCode(web), {}, { timeout: 2000 });
      assert.deepEqual(Object.keys(rebuilt).sort(), Object.keys(runtime).sort(), card.id + ': runtime members lost');
    }
    return {
      card: { id: 'workshop_web_' + card.id, name: card.name, camp: card.camp, rarity: card.rarity, baseAttack: card.baseAttack, skill: card.skill, effect: card.effect, demoEffect: 'None' },
      source: { kind: 'production-card', id: card.id, name: card.name, skill: card.skill, effect: card.effect, module: `${camp}-card-effects.js`, pool: base.has(card.id) ? 'base' : 'extra', execution: definition.executable ? 'vocabulary' : 'web', catalogVersion: version, ...(definition.note ? { note: definition.note } : {}) },
      graphs, ...(web ? { web } : {})
    };
  });
  const catalog = { version, cards: result };
  M.parseProject({ format: 'card-workshop-project', version: 1, cards: result, decks: [], presetCatalogVersion: version });
  return catalog;
}
function render(catalog) {
  return '/* Generated by node card-workshop/build-presets.cjs. Do not edit. */\n(function(root) {\n  const catalog = ' + JSON.stringify(catalog) + ';\n  if (typeof module === "object" && module.exports) module.exports = catalog;\n  else root.CardWorkshopPresets = catalog;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n';
}
if (require.main === module) {
  const catalog = build(), output = render(catalog);
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(outputPath, 'utf8'), output, 'Presets are stale. Run npm run generate:workshop-presets');
  else fs.writeFileSync(outputPath, output, 'utf8');
  const executable = catalog.cards.filter(c => !c.graphs.some(g => g.mode === 'reference')).length;
  console.log(`${catalog.cards.length} production cards: ${executable} Unity vocabulary mappings; ${catalog.cards.length - executable} maintainable Web implementations; ${catalog.cards.reduce((n,c) => n + c.graphs.length, 0)} flow diagrams. ${catalog.version}`);
}
module.exports = { build, render };
