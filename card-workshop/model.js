(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardWorkshop = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = typeof module === 'object' && module.exports ? require('./web-effects.js') : globalThis.CardWorkshopWeb;

  const OPTIONS = {
    trigger: { OnPlace: '入场后', OnOwnTurnStart: '我方回合开始', OnOwnTurnEnd: '我方回合结束', OnMove: '主动移至空格后', OnDestroyed: '被摧毁离场后', AfterCombat: '交战后（自身存活）' },
    condition: { Always: '无条件', HandBelow: '我方手牌数小于', BehindOnScore: '我方占领数少于对方', HasAdjacentEnemy: '四方相邻有非我方卡' },
    target: { Self: '自身', AdjacentAllies: '四方相邻其他己方卡', AdjacentEnemies: '四方相邻非我方卡（含守军）', AllAllies: '全部其他己方卡', AllEnemies: '全场非我方卡（含守军）', RowColumnEnemies: '同行或同列非我方卡（含守军）' },
    selection: { All: '全部目标', RandomOne: '随机 1 张', HighestPower: '战力最高 1 张（并列随机）', LowestPower: '战力最低 1 张（并列随机）' },
    operation: { ModifyPower: '调整战力', GrantShield: '赋予护盾', DrawCards: '抽取卡牌', Destroy: '摧毁目标', AddActions: '增加行动数' },
    duration: { Permanent: '永久', CurrentTurn: '当前全局回合结束时清除' }
  };
  const RARITIES = ['普通', '稀有', '史诗', '传说', '特殊'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => 'n_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const validInt = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
  const label = (group, key) => OPTIONS[group][key] || '未知配置';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;

  function step(operation = 'ModifyPower') {
    return { operation, target: 'Self', selection: 'All', amount: 1, duration: 'Permanent' };
  }

  function describeStep(data) {
    if (data.operation === 'DrawCards') return `所属玩家抽 ${data.amount} 张牌（按牌库及手牌上限结算）`;
    if (data.operation === 'AddActions') return `本行动回合增加 ${data.amount} 次行动（上限 10，非所属行动阶段不结转）`;
    const target = `${label('target', data.target)} · ${label('selection', data.selection)}`;
    if (data.operation === 'ModifyPower') return `${target}：战力 ${data.amount > 0 ? '+' : ''}${data.amount}，${label('duration', data.duration)}`;
    if (data.operation === 'GrantShield') return `${target}：获得一次护盾，已有护盾则刷新，不叠加`;
    return `${target}：尝试摧毁，可被护盾抵挡`;
  }

  function validateStep(data) {
    assert(data && typeof data === 'object', '效果步骤不能为空');
    for (const key of ['operation', 'target', 'selection', 'duration']) {
      assert(Object.hasOwn(OPTIONS[key], data[key]), `不支持的${key}：${String(data[key]).slice(0, 50)}`);
    }
    if (data.operation === 'ModifyPower') assert(validInt(data.amount, -20, 20) && data.amount !== 0, '战力变化应为 -20～20 的非零整数');
    else {
      assert(data.duration === 'Permanent', '只有调整战力支持本回合持续时间');
      if (['DrawCards', 'AddActions'].includes(data.operation)) {
        assert(validInt(data.amount, 1, 5), '抽牌 / 行动数必须为 1～5 的整数');
        assert(data.target === 'Self' && data.selection === 'All', '抽牌 / 行动数只作用于所属玩家，请选择自身、全部目标');
      } else assert(data.amount === 1, '护盾 / 摧毁的数值必须为 1');
    }
  }

  function validateLibrary(library) {
    assert(library && library.schemaVersion === 1, '只支持 schemaVersion 为 1 的 Unity 工坊制作库');
    assert(Array.isArray(library.cards) && library.cards.length > 0 && library.cards.length <= 200, '制作库需要 1～200 张卡牌');
    const ids = new Set();
    for (const card of library.cards) {
      assert(card && /^workshop_[a-zA-Z0-9_]+$/.test(card.id) && !ids.has(card.id), '卡牌 ID 必须唯一，使用 workshop_ 前缀和字母、数字、下划线');
      ids.add(card.id);
      assert(text(card.name) && text(card.camp) && RARITIES.includes(card.rarity), `${card.id}：名称、势力或品质不正确`);
      assert(validInt(card.baseAttack, 0, 99), `${card.name}：基础战力应为 0～99 的整数`);
      assert(card.demoEffect === 'None', `${card.name}：旧演示技能必须为 None，不能混用`);
      assert(Array.isArray(card.abilities) && card.abilities.length <= 8, `${card.name}：最多 8 个技能`);
      for (const skill of card.abilities) {
        assert(skill && text(skill.name), `${card.name}：技能名称不能为空`);
        assert(Object.hasOwn(OPTIONS.trigger, skill.trigger), `${card.name}：不支持的触发时机`);
        assert(Object.hasOwn(OPTIONS.condition, skill.condition), `${card.name}：不支持的条件`);
        assert(validInt(skill.conditionValue, 0, 10), `${card.name}：条件阈值应为 0～10 的整数`);
        assert(Array.isArray(skill.steps) && skill.steps.length >= 1 && skill.steps.length <= 8, `${card.name}：每个技能需要 1～8 个效果`);
        skill.steps.forEach(validateStep);
      }
    }
    assert(Array.isArray(library.decks) && library.decks.length <= 200, '缺少 decks 测试卡组数组或数量过多');
    const deckIds = new Set();
    for (const deck of library.decks) {
      assert(deck && typeof deck.id === 'string' && /^[a-zA-Z0-9_]+$/.test(deck.id) && !deckIds.has(deck.id) && text(deck.name), '测试卡组 ID / 名称无效或重复');
      deckIds.add(deck.id);
      assert(Array.isArray(deck.cardIds) && deck.cardIds.length <= 100 && deck.cardIds.every(id => ids.has(id)), `${deck.name}：测试卡组引用了不存在的卡牌，或超过 100 张`);
    }
    return library;
  }

  function graphFromSkill(skill) {
    const nodes = [
      { id: uid(), type: 'trigger', x: 60, y: 100, data: { trigger: skill.trigger } },
      { id: uid(), type: 'condition', x: 350, y: 100, data: { condition: skill.condition, conditionValue: skill.conditionValue } },
      ...skill.steps.map((data, index) => ({ id: uid(), type: 'effect', x: 640 + index * 290, y: 100, data: clone(data) })),
      { id: uid(), type: 'end', x: 640 + skill.steps.length * 290, y: 100, data: {} }
    ];
    const edges = nodes.slice(0, -1).map((node, index) => ({ from: node.id, to: nodes[index + 1].id, port: node.type === 'condition' ? 'yes' : 'next' }));
    edges.push({ from: nodes[1].id, to: nodes[nodes.length - 1].id, port: 'no' });
    const graph = { name: skill.name, nodes, edges };
    arrange(graph);
    return graph;
  }

  function topology(graph) {
    assert(graph && text(graph.name), '技能名称不能为空');
    assert(Array.isArray(graph.nodes) && graph.nodes.length >= 4 && graph.nodes.length <= 11, '每个流程需要 1 个触发、1 个条件、1～8 个效果和 1 个结束节点');
    assert(Array.isArray(graph.edges) && graph.edges.length <= 12, '连线格式错误');
    const byId = new Map();
    for (const node of graph.nodes) {
      assert(node && typeof node.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(node.id) && !byId.has(node.id), '节点 ID 无效或重复');
      assert(['trigger', 'condition', 'effect', 'end'].includes(node.type), '未知节点类型');
      assert(node.data && Number.isFinite(node.x) && Number.isFinite(node.y) && Math.abs(node.x) <= 100000 && Math.abs(node.y) <= 100000, '节点参数或位置无效');
      byId.set(node.id, node);
    }
    const one = type => {
      const found = graph.nodes.filter(node => node.type === type);
      assert(found.length === 1, `必须且只能有一个 ${type} 节点`);
      return found[0];
    };
    const trigger = one('trigger'), condition = one('condition'), end = one('end');
    const outgoing = new Map(), incoming = new Map();
    for (const edge of graph.edges) {
      assert(edge && byId.has(edge.from) && byId.has(edge.to) && edge.from !== edge.to, '连线引用不存在的节点或连接了自身');
      const from = byId.get(edge.from), to = byId.get(edge.to);
      assert(from.type !== 'end' && to.type !== 'trigger', '结束节点不能连出，触发节点不能连入');
      assert(from.type === 'condition' ? ['yes', 'no'].includes(edge.port) : edge.port === 'next', '连线端口不正确');
      const key = edge.from + ':' + edge.port;
      assert(!outgoing.has(key), '同一个出口不能连向多个节点');
      outgoing.set(key, edge.to);
      incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    }
    assert(outgoing.get(trigger.id + ':next') === condition.id, '触发节点必须连接到条件节点');
    assert(outgoing.get(condition.id + ':no') === end.id, '条件不满足时必须连接到结束');
    for (const node of graph.nodes) {
      if (!['trigger', 'end'].includes(node.type)) assert(incoming.get(node.id) === 1, '有未连接的节点或多个入口，请检查连线');
    }
    const steps = [], visited = new Set([trigger.id, condition.id]);
    let current = outgoing.get(condition.id + ':yes');
    while (current !== end.id) {
      assert(current && byId.has(current), '流程连线未完成，请连接到结束节点');
      assert(!visited.has(current), '不支持循环连线');
      visited.add(current);
      const node = byId.get(current);
      assert(node.type === 'effect', '条件满足后只能连接效果节点');
      steps.push(node);
      current = outgoing.get(current + ':next');
    }
    assert(steps.length >= 1 && steps.length <= 8, '每个技能必须有 1～8 个效果步骤');
    assert(visited.size + 1 === graph.nodes.length, '存在未接入主流程的节点，请连接或删除');
    assert(graph.edges.length === graph.nodes.length, '连线数量不正确');
    return { trigger, condition, end, steps };
  }

  function compileGraph(graph) {
    assert(graph?.mode !== 'reference', '这是原卡参考流程，尚未接入 Unity 节点执行，不能导出为可执行技能');
    const { trigger, condition, steps } = topology(graph);
    const result = { name: graph.name, trigger: trigger.data.trigger, condition: condition.data.condition, conditionValue: condition.data.conditionValue, steps: steps.map(node => clone(node.data)) };
    validateLibrary({ schemaVersion: 1, cards: [{ id: 'workshop_check', name: '流程', camp: '测试', rarity: '普通', baseAttack: 1, demoEffect: 'None', abilities: [result] }], decks: [] });
    return result;
  }

  function importLibrary(library) {
    // Unity permits null / missing abilities for cards with no skills.
    const normalized = clone(library);
    if (normalized && Array.isArray(normalized.cards)) for (const card of normalized.cards) if (card && card.abilities == null) card.abilities = [];
    validateLibrary(normalized);
    return { format: 'card-workshop-project', version: 1, cards: normalized.cards.map(card => {
      const result = clone(card); delete result.abilities;
      return { card: result, graphs: card.abilities.map(graphFromSkill) };
    }), decks: clone(normalized.decks) };
  }

  function compileProject(project) {
    const errors = [];
    const cards = project.cards.map((entry, index) => {
      const card = clone(entry.card);
      if (entry.web) errors.push(`卡牌 ${index + 1}「${card.name}」：Web 实际技能不能导出至 Unity，请使用 Web 技能包`);
      if (entry.source?.execution === 'reference') errors.push(`卡牌 ${index + 1}「${card.name}」：原卡含未接入执行的规则，只能保存参考工程`);
      card.abilities = entry.graphs.map((graph, i) => {
        try { return compileGraph(graph); } catch (error) { errors.push(`卡牌 ${index + 1}「${card.name}」 / 技能 ${i + 1}：${error.message}`); return null; }
      });
      card.skill = card.abilities.map(skill => skill ? skill.name : '').join(' / ') || '无';
      card.effect = card.abilities.filter(Boolean).map(skill => `「${skill.name}」${label('trigger', skill.trigger)}；${label('condition', skill.condition)}${skill.condition === 'HandBelow' ? ' ' + skill.conditionValue : ''}：\n${skill.steps.map((s, i) => `${i + 1}. ${describeStep(s)}`).join('\n')}`).join('\n') || '无技能。';
      return card;
    });
    if (errors.length) throw new Error(errors.join('\n'));
    return validateLibrary({ schemaVersion: 1, cards, decks: clone(project.decks) });
  }

  function parseProject(value) {
    if (value && value.schemaVersion === 1) return importLibrary(value);
    assert(value && value.format === 'card-workshop-project' && value.version === 1, '请选择浏览器工程 JSON 或 Unity 工坊制作库 JSON');
    assert(Array.isArray(value.cards) && value.cards.length >= 1 && value.cards.length <= 200 && Array.isArray(value.decks), '工程卡牌列表或卡组格式错误');
    // Drafts may have disconnected nodes, but their shapes and parameters must be safe to render.
    const skeleton = { schemaVersion: 1, cards: [], decks: value.decks };
    for (const entry of value.cards) {
      assert(entry && entry.card && Array.isArray(entry.graphs) && entry.graphs.length <= 8, '工程技能列表格式错误');
      if (entry.source) {
        assert(entry.source.kind === 'production-card' && /^0[1-3][1-5]\d{2}$/.test(entry.source.id), '原卡来源标识无效');
        for (const key of ['name', 'skill', 'effect', 'module', 'catalogVersion']) assert(text(entry.source[key]), '原卡来源资料不完整');
        assert(['base', 'extra'].includes(entry.source.pool), '原卡卡池类型无效');
        assert(['reference', 'vocabulary', 'web'].includes(entry.source.execution), '原卡执行状态缺失');
        assert(entry.source.isCopy === undefined || typeof entry.source.isCopy === 'boolean', '原卡副本标记无效');
        assert(entry.source.note === undefined || text(entry.source.note), '原卡备注格式无效');
      }
      if (entry.web) {
        assert(entry.source?.execution === 'web', 'Web 实际技能缺少原卡来源');
        W.validate(entry.web, false);
      }
      if (entry.source?.execution === 'web') assert(entry.web, 'Web 实际技能实现缺失');
      const abilities = [];
      for (const graph of entry.graphs) {
        if (graph?.mode === 'reference') { validateReference(graph); continue; }
        assert(graph?.mode === undefined || graph.mode === 'executable', '未知流程模式');
        assert(graph && text(graph.name) && Array.isArray(graph.nodes) && graph.nodes.length >= 4 && graph.nodes.length <= 11 && Array.isArray(graph.edges) && graph.edges.length <= 12, '工程节点数量或连线格式不正确');
        const ids = new Set();
        for (const node of graph.nodes) {
          assert(node && typeof node.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(node.id) && !ids.has(node.id), '节点 ID 无效或重复'); ids.add(node.id);
          assert(node.data && ['trigger', 'condition', 'effect', 'end'].includes(node.type), '节点类型无效');
          assert(Number.isFinite(node.x) && Number.isFinite(node.y) && Math.abs(node.x) <= 100000 && Math.abs(node.y) <= 100000, '节点坐标无效');
          if (node.type === 'effect') validateStep(node.data);
        }
        for (const edge of graph.edges) assert(edge && ids.has(edge.from) && ids.has(edge.to) && ['next', 'yes', 'no'].includes(edge.port), '连线引用无效');
        const fixed = type => { const nodes = graph.nodes.filter(n => n.type === type); assert(nodes.length === 1, `缺少或重复的 ${type} 节点`); return nodes[0]; };
        const trigger = fixed('trigger'), condition = fixed('condition'); fixed('end');
        const effects = graph.nodes.filter(n => n.type === 'effect');
        abilities.push({ name: graph.name, trigger: trigger.data.trigger, condition: condition.data.condition, conditionValue: condition.data.conditionValue, steps: effects.map(n => n.data) });
      }
      skeleton.cards.push({ ...entry.card, abilities });
    }
    validateLibrary(skeleton);
    return clone(value);
  }

  function validateReference(graph) {
    assert(graph && graph.mode === 'reference' && text(graph.name) && text(graph.hook), '参考流程名称或来源钩子缺失');
    assert(Array.isArray(graph.nodes) && graph.nodes.length >= 3 && graph.nodes.length <= 64 && Array.isArray(graph.edges) && graph.edges.length <= 100, '参考流程节点 / 连线数量无效');
    const nodes = new Map();
    for (const node of graph.nodes) {
      assert(node && typeof node.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(node.id) && !nodes.has(node.id), '参考节点 ID 无效或重复');
      assert(['trigger', 'condition', 'effect', 'end'].includes(node.type) && node.data && text(node.data.title) && text(node.data.text), '参考节点内容无效');
      assert(Number.isFinite(node.x) && Number.isFinite(node.y) && Math.abs(node.x) <= 100000 && Math.abs(node.y) <= 100000, '参考节点坐标无效');
      nodes.set(node.id, node);
    }
    const starts = graph.nodes.filter(n => n.type === 'trigger'), ends = graph.nodes.filter(n => n.type === 'end');
    assert(starts.length === 1 && ends.length === 1, '参考流程必须有一个开始和一个结束');
    const ports = new Set(), children = new Map(graph.nodes.map(n => [n.id, []])), inputs = new Map();
    for (const edge of graph.edges) {
      assert(edge && nodes.has(edge.from) && nodes.has(edge.to) && edge.from !== edge.to, '参考连线引用无效');
      const source = nodes.get(edge.from), target = nodes.get(edge.to);
      assert(source.type !== 'end' && target.type !== 'trigger', '参考连线方向无效');
      assert(source.type === 'condition' ? ['yes', 'no'].includes(edge.port) : edge.port === 'next', '参考连线端口无效');
      const key = edge.from + ':' + edge.port;
      assert(!ports.has(key), '参考流程同一出口不能重复连接'); ports.add(key);
      children.get(edge.from).push(edge.to); inputs.set(edge.to, (inputs.get(edge.to) || 0) + 1);
    }
    for (const n of graph.nodes) {
      assert(children.get(n.id).length === (n.type === 'condition' ? 2 : n.type === 'end' ? 0 : 1), '参考流程出口未完整连接');
      assert(n.type === 'trigger' || inputs.has(n.id), '参考流程有孤立节点');
    }
    const visiting = new Set(), visited = new Set();
    function visit(id) {
      assert(!visiting.has(id), '参考流程不允许循环');
      if (visited.has(id)) return;
      visiting.add(id); children.get(id).forEach(visit); visiting.delete(id); visited.add(id);
    }
    visit(starts[0].id); assert(visited.size === nodes.size, '参考流程有不可达节点');
    return graph;
  }

  function referencePreview(graph, choices = {}) {
    validateReference(graph);
    const lines = [], nodes = new Map(graph.nodes.map(n => [n.id, n]));
    let current = graph.nodes.find(n => n.type === 'trigger');
    while (current) {
      if (current.type === 'condition' && typeof choices[current.id] !== 'boolean') {
        lines.push({ nodeId: current.id, text: `参考条件（未计算）：${current.data.text}`, choiceRequired: true }); break;
      }
      const port = current.type === 'condition' ? (choices[current.id] ? 'yes' : 'no') : 'next';
      lines.push({ nodeId: current.id, text: (current.type === 'condition' ? `手动选择${choices[current.id] ? '满足' : '不满足'}：` : '参考步骤（不执行）：') + current.data.text });
      const edge = graph.edges.find(e => e.from === current.id && e.port === port);
      current = edge ? nodes.get(edge.to) : null;
    }
    return lines;
  }

  function mergePresets(project, catalog) {
    assert(catalog && text(catalog.version) && Array.isArray(catalog.cards), '预存卡库不可用');
    const result = parseProject(project), known = new Set(result.cards.filter(e => e.source && !e.source.isCopy).map(e => e.source.id));
    const ids = new Set(result.cards.map(e => e.card.id)); let added = 0;
    for (const entry of catalog.cards) {
      if (known.has(entry.source.id) || ids.has(entry.card.id)) continue;
      assert(result.cards.length < 200, '当前制作库容量不足以补齐预存卡，请先保存工程并拆分制作库');
      result.cards.push(clone(entry)); known.add(entry.source.id); ids.add(entry.card.id); added++;
    }
    result.presetCatalogVersion = catalog.version;
    const upgraded = W.upgrade(result, catalog);
    return { project: parseProject(result), added, upgraded };
  }

  function addEffect(graph, operation) {
    assert(graph.mode !== 'reference', '参考流程不能插入可执行效果；请新增独立技能进行制作');
    assert(Object.hasOwn(OPTIONS.operation, operation), '不支持的效果类型');
    assert(graph.nodes.filter(n => n.type === 'effect').length < 8, '每个技能最多 8 个效果');
    let ordered;
    try { ordered = topology(graph); } catch (_) { /* A disconnected draft can still receive nodes. */ }
    const last = ordered ? ordered.steps[ordered.steps.length - 1] : graph.nodes[graph.nodes.length - 2];
    const node = { id: uid(), type: 'effect', x: last.x + 290, y: last.y, data: step(operation) };
    if (ordered) {
      graph.edges = graph.edges.filter(edge => !(edge.from === last.id && edge.port === 'next'));
      graph.edges.push({ from: last.id, to: node.id, port: 'next' }, { from: node.id, to: ordered.end.id, port: 'next' });
      ordered.end.x = node.x + 290; ordered.end.y = node.y;
    } else node.y += 200;
    graph.nodes.splice(graph.nodes.length - 1, 0, node);
    return node;
  }

  function connect(graph, fromId, port, toId) {
    assert(graph.mode !== 'reference', '参考流程保留原卡逻辑连线，不支持重接');
    const from = graph.nodes.find(n => n.id === fromId), to = graph.nodes.find(n => n.id === toId);
    assert(from && to && from !== to, '不能连接自身或不存在的节点');
    assert(from.type !== 'end' && to.type !== 'trigger', '此节点不支持该连接方向');
    assert(from.type === 'condition' ? ['yes', 'no'].includes(port) : port === 'next', '端口无效');
    assert(from.type !== 'trigger' || to.type === 'condition', '触发节点只能连接条件节点');
    assert(to.type !== 'condition' || from.type === 'trigger', '条件节点只能连接在触发节点后');
    assert(!(from.type === 'condition' && port === 'no') || to.type === 'end', '当前版本条件不满足时只能结束');
    const edges = graph.edges.filter(e => !(e.from === fromId && e.port === port) && !(to.type !== 'end' && e.to === toId));
    edges.push({ from: fromId, to: toId, port });
    const stack = [toId], visited = new Set();
    while (stack.length) {
      const id = stack.pop(); assert(id !== fromId, '不能创建循环，请使用顺序效果');
      if (visited.has(id)) continue; visited.add(id);
      edges.filter(e => e.from === id).forEach(e => stack.push(e.to));
    }
    graph.edges = edges;
  }

  function removeEffect(graph, id) {
    assert(graph.mode !== 'reference', '参考流程保留原卡逻辑，不能删除节点');
    const node = graph.nodes.find(n => n.id === id);
    assert(node && node.type === 'effect', '触发、条件和结束节点不能删除');
    assert(graph.nodes.filter(n => n.type === 'effect').length > 1, '至少保留一个效果；若不需要技能，请删除整个技能');
    const before = graph.edges.find(e => e.to === id), after = graph.edges.find(e => e.from === id);
    graph.edges = graph.edges.filter(e => e.from !== id && e.to !== id);
    graph.nodes = graph.nodes.filter(n => n.id !== id);
    if (before && after) graph.edges.push({ from: before.from, port: before.port, to: after.to });
  }

  function arrange(graph) {
    if (graph.mode === 'reference') {
      validateReference(graph);
      const depth = new Map(), children = new Map(graph.nodes.map(n => [n.id, []]));
      graph.edges.forEach(e => children.get(e.from).push(e.to));
      function visit(id, level) { if ((depth.get(id) ?? -1) >= level) return; depth.set(id, level); children.get(id).forEach(to => visit(to, level + 1)); }
      visit(graph.nodes.find(n => n.type === 'trigger').id, 0);
      const rows = new Map();
      graph.nodes.forEach(n => { const column = depth.get(n.id), row = rows.get(column) || 0; n.x = 50 + column * 290; n.y = 60 + row * 260; rows.set(column, row + 1); });
      return;
    }
    const order = topology(graph);
    [order.trigger, order.condition, ...order.steps, order.end].forEach((node, index) => {
      const row = Math.floor(index / 3), column = index % 3;
      node.x = 60 + (row % 2 ? 2 - column : column) * 290;
      node.y = 70 + row * 240;
    });
  }

  function preview(graph, context = {}) {
    const skill = compileGraph(graph), order = topology(graph);
    const lines = [{ nodeId: order.trigger.id, text: `假设发生「${label('trigger', skill.trigger)}」事件。` }];
    const hand = Number(context.hand ?? 3), own = Number(context.own ?? 2), opponent = Number(context.opponent ?? 3);
    assert(validInt(hand, 0, 100) && validInt(own, 0, 100) && validInt(opponent, 0, 100), '预演数值必须是 0～100 的整数');
    const met = skill.condition === 'Always' || (skill.condition === 'HandBelow' && hand < skill.conditionValue) || (skill.condition === 'BehindOnScore' && own < opponent) || (skill.condition === 'HasAdjacentEnemy' && context.adjacent === true);
    const details = skill.condition === 'HandBelow' ? `（手牌 ${hand}，阈值 ${skill.conditionValue}）` : skill.condition === 'BehindOnScore' ? `（占领 ${own} : ${opponent}）` : '';
    lines.push({ nodeId: order.condition.id, text: `条件${met ? '满足' : '不满足'}${details}：${label('condition', skill.condition)}。` });
    if (met) order.steps.forEach((node, index) => lines.push({ nodeId: node.id, text: `计划步骤 ${index + 1}：${describeStep(node.data)}。` }));
    lines.push({ nodeId: order.end.id, text: met ? '流程预演结束。实际目标、护盾抵挡、连锁技能和胜负需在战斗实验室验证。' : '跳过本技能全部效果，结束。' });
    return lines;
  }

  function sample() {
    return importLibrary({ schemaVersion: 1, cards: [{ id: 'workshop_support', name: '战旗卫士', camp: '蜀', rarity: '稀有', baseAttack: 3, demoEffect: 'None', skill: '', effect: '', abilities: [{ name: '入阵支援', trigger: 'OnPlace', condition: 'HasAdjacentEnemy', conditionValue: 3, steps: [{ ...step(), target: 'AdjacentAllies', amount: 2, duration: 'CurrentTurn' }, step('GrantShield')] }] }], decks: [] });
  }

  return { OPTIONS, RARITIES, clone, uid, label, step, describeStep, validateStep, validateLibrary, graphFromSkill, topology, compileGraph, importLibrary, compileProject, parseProject, validateReference, referencePreview, mergePresets, addEffect, connect, removeEffect, arrange, preview, sample };
});
