(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardWorkshopWeb = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const HOOKS = {
    onPlace: '入阵', onTurnStart: '我方回合开始', onTurnEnd: '回合结束', onEnemyTurnEnd: '敌方回合结束',
    onDestroy: '遗志（离场后）', onBeforeDestroy: '自身摧毁前', onBeforeAllyDestroy: '友军摧毁前',
    onBeforeAdjacentAllyDestroy: '相邻友军摧毁前', onBeforeAttack: '攻击前', onUnderAttack: '被攻击时',
    onCombatResolved: '交战结束', onMove: '移动后', onOtherMoved: '其他卡移动后', onOtherPlaced: '其他友军放置后',
    onOtherDestroyed: '其他友军摧毁后', onOtherDrawn: '成功抽牌后', onDrawFailed: '抽牌失败', onOwnCardAttackIncreased: '己方战力增加'
  };
  const FLAGS = {
    cannotMove: '禁止主动移动', chargeMove: '冲锋移动', longMove: '直线远距移动', diagonalMove: '斜向移动',
    avoidCombatWhenBehind: '占领落后时限制交战', repeatFriendlyTurnStart: '重复友军起势', freeAction: '免费行动资格',
    substituteAdjacent: '相邻友军替身保护', firstFriendlyPlacementFree: '首张友军免费放置', preventReduction: '阻止战力降低'
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const plain = value => value && typeof value === 'object' && !Array.isArray(value);
  const validName = name => /^[a-zA-Z_$][\w$]*$/.test(name) && !['__proto__', 'constructor', 'prototype', 'ctx', 'window'].includes(name);
  function checkBody(body) {
    assert(typeof body === 'string' && body.length <= 30000, '技能脚本需为不超过 30000 字符的文本');
  }
  // Shape validation deliberately accepts unfinished JavaScript drafts; export validates syntax.
  function validate(web, syntax = true) {
    assert(plain(web) && web.version === 1 && web.engine === 'web-v2', '不支持的 Web 技能格式');
    assert(plain(web.hooks) && plain(web.helpers) && plain(web.flags) && plain(web.constants), 'Web 技能缺少钩子、辅助函数、标记或常量');
    assert(Object.keys(web.hooks).length <= 18 && Object.keys(web.helpers).length <= 12, '技能或辅助函数过多');
    for (const [hook, body] of Object.entries(web.hooks)) {
      assert(Object.hasOwn(HOOKS, hook), '未知技能事件：' + hook); checkBody(body);
      if (syntax) { try { new Function('ctx', '"use strict";\n' + body); } catch (e) { throw new Error(hook + '：' + e.message); } }
    }
    for (const [name, helper] of Object.entries(web.helpers)) {
      assert(validName(name) && plain(helper) && Array.isArray(helper.args) && helper.args.length <= 8 && helper.args.every(arg => arg === 'ctx' || validName(arg)) && new Set(helper.args).size === helper.args.length, '辅助函数名称或参数无效');
      // ctx is a permitted parameter, but never a helper function name.
      checkBody(helper.body);
      if (syntax) new Function(...helper.args, '"use strict";\n' + helper.body);
    }
    for (const [key, value] of Object.entries(web.flags)) assert(Object.hasOwn(FLAGS, key) && typeof value === 'boolean', '未知被动标记或非布尔值：' + key);
    for (const [key, value] of Object.entries(web.constants)) assert(key === 'baseAttack' && Number.isInteger(value) && value >= 0 && value <= 99, '不支持的运行时常量：' + key);
    return web;
  }
  function helperCode(web) {
    return Object.entries(web.helpers).map(([name, h]) => `function ${name}(${h.args.join(', ')}) {\n${h.body}\n}`).join('\n');
  }
  function factoryCode(web) {
    validate(web);
    const fields = Object.entries(web.hooks).map(([hook, body]) => `${JSON.stringify(hook)}: function(ctx) {\n${body}\n}`);
    if (Object.keys(web.flags).length) fields.push('flags: ' + JSON.stringify(web.flags));
    for (const [key, value] of Object.entries(web.constants)) fields.push(JSON.stringify(key) + ': ' + JSON.stringify(value));
    // Every card gets its own helper closure, including after copy / import.
    return `(function() {\n"use strict";\n${helperCode(web)}\nreturn {\n${fields.join(',\n')}\n};\n})()`;
  }
  function exportScript(entries) {
    const cards = entries.filter(e => e.web);
    assert(cards.length > 0, '没有 Web 实际技能可导出');
    const ids = new Set();
    const assignments = cards.map(entry => {
      const id = entry.source?.id;
      assert(/^0[1-3][1-5]\d{2}$/.test(id), 'Web 技能必须保留原始卡牌 ID');
      assert(!ids.has(id), `原卡 ${id} 有多个维护副本，请单独导出所需副本，避免覆盖冲突`); ids.add(id);
      const camp = { '01': 'shu', '02': 'wei', '03': 'wu' }[id.slice(0, 2)];
      return `patches.${camp}[${JSON.stringify(id)}] = ${factoryCode(entry.web)};`;
    });
    return `/* Card Workshop Web V2 effects: ${cards.length} cards. Load AFTER faction scripts, BEFORE core-v2.js.\n   Original card IDs are used. This file changes skills only, not display tables or accounts. */\n(function(root) {\n"use strict";\nconst registry = root.CARD_EFFECTS_V2;\nif (!registry || !registry.shu || !registry.wei || !registry.wu) throw new Error("Load production faction scripts before workshop effects");\nconst patches = { shu: {}, wei: {}, wu: {} };\n${assignments.join('\n')}\nfor (const camp of ["shu", "wei", "wu"]) Object.assign(registry[camp], patches[camp]);\n})(typeof window !== "undefined" ? window : globalThis);\n`;
  }
  function sections(web) {
    return [...Object.keys(web.hooks).map(key => ({ key, label: HOOKS[key], body: web.hooks[key] })),
      ...Object.entries(web.helpers).map(([key, h]) => ({ key: 'helper:' + key, label: '辅助函数 · ' + key, body: h.body }))];
  }
  function setBody(web, key, body) {
    checkBody(body);
    if (key.startsWith('helper:')) { assert(Object.hasOwn(web.helpers, key.slice(7)), '辅助函数不存在'); web.helpers[key.slice(7)].body = body; }
    else { assert(Object.hasOwn(HOOKS, key), '未知技能事件'); web.hooks[key] = body; }
  }
  // Mask quoted text and comments without changing offsets. Quick controls cover direct
  // numeric operation arguments; arbitrary expressions remain editable in the script.
  function codeMask(source) {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, value => ' '.repeat(value.length));
  }
  function parameters(body) {
    const mask = codeMask(body), result = [];
    // Conservatively leave bodies containing slash operators / regex literals to
    // the script editor; never mistake text inside a regular expression for a call.
    if (mask.includes('/')) return result;
    const names = { adjust: '战力变化', setAttack: '设置战力', setPermanentAttack: '设置永久战力', discard: '弃牌数量', spawnNeutralGuard: '守军战力', addActions: '额外行动', grantExtraMoves: '额外移动', grantNextPlacementExtra: '额外入阵次数', drawFromEnemyDeck: '抽敌方牌库数量' };
    const re = /ctx\.(adjust|setAttack|setPermanentAttack|discard|spawnNeutralGuard|addActions|grantExtraMoves|grantNextPlacementExtra|drawFromEnemyDeck)\(\s*(?:(?:ctx\.)?[\w.]+\s*,\s*)?(-?\d+(?:\.\d+)?)(?=\s*[,\)])/g;
    for (const match of mask.matchAll(re)) {
      const start = match.index + match[0].lastIndexOf(match[2]);
      result.push({ start, end: start + match[2].length, value: Number(match[2]), label: names[match[1]], line: body.slice(0, start).split('\n').length });
    }
    return result;
  }
  function setParameter(body, index, value) {
    const p = parameters(body)[index];
    assert(p && Number.isFinite(value) && Number.isInteger(value) && Math.abs(value) <= 100, '参数需为 -100～100 的整数');
    return body.slice(0, p.start) + String(value) + body.slice(p.end);
  }
  function upgrade(project, catalog) {
    let upgraded = 0;
    for (const entry of project.cards) {
      if (entry.web || entry.source?.execution !== 'reference') continue;
      const preset = catalog.cards.find(p => p.source.id === entry.source.id && p.web);
      if (!preset) continue;
      entry.web = clone(preset.web); entry.source.execution = 'web'; upgraded++;
      // Existing names, IDs, diagrams, deck references and annotations are never replaced.
    }
    return upgraded;
  }
  return { HOOKS, FLAGS, validate, factoryCode, exportScript, sections, setBody, parameters, setParameter, upgrade };
});
