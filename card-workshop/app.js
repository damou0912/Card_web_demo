(() => {
  'use strict';
  const M = window.CardWorkshop;
  const W = window.CardWorkshopWeb;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'card-workshop.project.v1';
  const PRESETS = window.CardWorkshopPresets;
  const TYPE_NAMES = { trigger: '触发', condition: '条件', effect: '效果', end: '结束' };
  const SYMBOLS = { ModifyPower: '±', GrantShield: '◇', DrawCards: '▤', Destroy: '×', AddActions: '↗' };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let project = PRESETS ? M.parseProject({ format: 'card-workshop-project', version: 1, cards: M.clone(PRESETS.cards), decks: [], presetCatalogVersion: PRESETS.version }) : M.sample(), cardIndex = 0, skillIndex = 0, selected = null;
  let history = [], future = [], pending = null, drag = null, trace = [], traceIndex = -1;
  let view = { x: 20, y: 20, scale: .85 }, toastTimer, hasStoredError = false;
  let referenceChoices = {};
  const entry = () => project.cards[cardIndex];
  const graph = () => entry()?.graphs[skillIndex];
  const node = () => graph()?.nodes.find(item => item.id === selected);
  const reference = () => graph()?.mode === 'reference';
  const displayCamp = camp => camp.replace('三国~', '三国-');
  const singleCardProject = () => ({ format: 'card-workshop-project', version: 1, cards: [M.clone(entry())], decks: [] });
  const optionHtml = (items, value) => Object.entries(items).map(([key, name]) => `<option value="${escape(key)}"${key === value ? ' selected' : ''}>${escape(name)}</option>`).join('');
  const webEditor = window.createWebWorkshopEditor({ entry, project: () => project, snapshot, record, persist, mutate, render, notify, downloadScript });

  function notify(message) {
    $('toast').textContent = message; $('toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      project = M.parseProject(JSON.parse(saved));
      if (PRESETS && project.presetCatalogVersion !== PRESETS.version) {
        // Preserve the exact original draft before adding any missing preset entries.
        const backupKey = STORAGE_KEY + '.before-production-presets';
        if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, saved);
        if (project.cards.some(e => e.source?.execution === 'reference' && !e.web)) localStorage.setItem(STORAGE_KEY + '.before-web-maintenance-v1', saved);
        const merged = M.mergePresets(project, PRESETS); project = merged.project;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        if (merged.added || merged.upgraded) setTimeout(() => notify(`已补入 ${merged.added} 张预存卡，接入 ${merged.upgraded} 张原参考卡的实际技能。原草稿及已有修改保留，迁移前草稿已备份。`), 300);
      }
    }
  } catch (_) {
    hasStoredError = true;
    $('save-state').textContent = '旧草稿读取失败；未覆盖';
    setTimeout(() => notify('旧草稿读取或迁移失败，未覆盖旧数据。请先保存工程备份，必要时从工程 JSON 恢复。'), 300);
  }

  function persist() {
    if (hasStoredError) { $('save-state').textContent = '旧草稿受保护，请保存工程'; return; }
    try {
      M.parseProject(project);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      $('save-state').textContent = '已保存到此浏览器';
    } catch (_) { $('save-state').textContent = '未自动保存，请保存工程备份'; }
  }

  function snapshot() { return JSON.stringify(project); }
  function record(before) {
    if (before === snapshot()) return;
    history.push(before); if (history.length > 60) history.shift(); future = [];
    resetTrace(); pending = null; persist();
  }
  function mutate(action, message) {
    const before = snapshot();
    try { action(); M.parseProject(project); record(before); render(); if (message) notify(message); return true; }
    catch (error) { project = JSON.parse(before); render(); notify(error.message); return false; }
  }
  function historyMove(from, to) {
    if (!from.length) return;
    to.push(snapshot()); project = JSON.parse(from.pop()); selected = null; pending = null;
    cardIndex = Math.min(cardIndex, project.cards.length - 1); skillIndex = 0;
    resetTrace(); persist(); render(); fit();
  }
  function resetTrace() { trace = []; traceIndex = -1; referenceChoices = {}; }

  function renderCardSelect() {
    const query = $('card-search').value.trim().toLowerCase(), camp = $('camp-filter').value;
    const matches = project.cards.map((item, index) => ({ item, index })).filter(({ item }) => {
      const nameMatches = `${item.card.name} ${item.card.id} ${item.card.skill} ${item.source?.id || ''} ${item.graphs.map(g => g.name).join(' ')}`.toLowerCase().includes(query);
      const campMatches = !camp || (camp === 'custom' ? !['魏', '蜀', '吴'].some(c => item.card.camp.endsWith(c)) : item.card.camp.endsWith(camp));
      return nameMatches && campMatches;
    });
    const groups = new Map();
    for (const { item, index } of matches) {
      const title = displayCamp(item.card.camp);
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(`<option value="${index}">${escape(item.card.name)} · ${item.source?.pool === 'extra' ? '额外' : item.source ? '基础' : '自制'}${item.web ? ' · Web 技能' : item.source?.execution === 'reference' ? ' · 参考' : ''}</option>`);
    }
    $('card-select').innerHTML = (matches.some(m => m.index === cardIndex) ? '' : '<option value="" disabled selected>请选择筛选结果</option>') + [...groups].map(([title, options]) => `<optgroup label="${escape(title)}">${options.join('')}</optgroup>`).join('');
    if (matches.some(m => m.index === cardIndex)) $('card-select').value = cardIndex;
    $('filter-count').textContent = `找到 ${matches.length} / ${project.cards.length} 张 · 当前：${entry().card.name}`;
  }

  function render() {
    cardIndex = Math.min(cardIndex, project.cards.length - 1);
    skillIndex = Math.min(skillIndex, Math.max(0, entry().graphs.length - 1));
    const card = entry().card;
    document.querySelector('.node-library').hidden = !!entry().web;
    document.querySelector('.card-preview-section .section-heading .muted').textContent = entry().web ? '当前维护说明' : '自动生成说明';
    renderCardSelect();
    const source = entry().source, allSources = new Set(project.cards.filter(e => e.source && !e.source.isCopy).map(e => e.source.id));
    $('catalog-summary').textContent = `预存 ${allSources.size} / 90 张 · 制作库共 ${project.cards.length} 张`;
    $('source-info').hidden = !source;
    $('source-info').innerHTML = source ? `<strong>原卡 ${escape(source.id)} · ${source.pool === 'extra' ? '额外卡' : '基础卡'}</strong><p>${entry().web ? '实际 Web 技能 · 参数 / 脚本 / 被动可维护' : source.execution === 'reference' ? '旧参考流程 · 可补齐实际技能' : 'Unity 工坊节点映射'}</p><details><summary>原卡技能说明</summary><p>${escape(source.effect)}</p>${source.note ? `<p>实现备注：${escape(source.note)}</p>` : ''}<p>来源：${escape(source.module)}</p></details>` : '';
    $('card-name').value = card.name; $('card-id').value = card.id; $('card-camp').value = card.camp;
    $('card-rarity').innerHTML = optionHtml(Object.fromEntries(M.RARITIES.map(v => [v, v])), card.rarity);
    $('card-power').value = card.baseAttack;
    $('delete-card').disabled = project.cards.length === 1;
    $('duplicate-card').disabled = project.cards.length >= 200; $('new-card').disabled = project.cards.length >= 200;
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
    $('skill-tabs').innerHTML = entry().graphs.map((skill, index) => `<button class="skill-tab" type="button" role="tab" aria-selected="${index === skillIndex}" data-skill="${index}">${escape(skill.name)}</button>`).join('');
    $('add-skill').disabled = !!entry().web || entry().graphs.length >= 8;
    $('node-palette').innerHTML = Object.entries(M.OPTIONS.operation).map(([key, title]) => `<button class="palette-button" data-operation="${key}"${!graph() || reference() || graph().nodes.filter(n => n.type === 'effect').length >= 8 ? ' disabled' : ''}><span class="symbol" aria-hidden="true">${SYMBOLS[key]}</span>${title}<span class="add" aria-hidden="true">＋</span></button>`).join('');
    $('preview-start').textContent = reference() ? '逐步查看流程说明' : '开始预演';
    document.querySelector('.canvas-caption').textContent = reference() ? '流程对照说明 · 点击节点维护说明 · 实际执行使用上方脚本' : '拖动标题移动 · 空白处平移 · 出口 → 入口连线';
    document.querySelectorAll('.preview-controls input').forEach(input => { input.disabled = reference(); });
    renderGraph(); renderInspector(); renderCardPreview(); renderValidation(); renderTrace(); webEditor.render();
  }

  function nodeSummary(item) {
    const data = item.data;
    if (reference()) return `<span class="reference-node-badge">${entry().web ? '实现对照 · 说明节点' : '参考 · 不执行'}</span><span class="reference-node-text">${escape(data.text)}</span>`;
    if (item.type === 'trigger') return `<span class="main-value">${escape(M.label('trigger', data.trigger))}</span>当对应游戏事件发生时进入流程`;
    if (item.type === 'condition') return `<span class="main-value">${escape(M.label('condition', data.condition))}</span>${data.condition === 'HandBelow' ? '阈值：' + escape(data.conditionValue) : '满足继续，不满足结束'}`;
    if (item.type === 'end') return '<span class="main-value">本技能结束</span>后续连锁由游戏引擎处理';
    const playerEffect = ['DrawCards', 'AddActions'].includes(data.operation);
    const main = data.operation === 'ModifyPower' ? `战力 ${data.amount > 0 ? '+' : ''}${data.amount}` : data.operation === 'DrawCards' ? `抽取 ${data.amount} 张卡牌` : data.operation === 'AddActions' ? `增加 ${data.amount} 次行动` : M.label('operation', data.operation);
    return `<span class="main-value">${escape(main)}</span>${escape(playerEffect ? '所属玩家' : M.label('target', data.target))}<br>${escape(playerEffect ? '实际数量按引擎限制结算' : M.label('selection', data.selection))}${data.operation === 'ModifyPower' ? '<br>' + escape(M.label('duration', data.duration)) : ''}`;
  }

  function renderGraph() {
    const current = graph();
    $('empty-graph').hidden = !!current;
    for (const id of ['arrange', 'fit', 'preview-start']) $(id).disabled = !current;
    $('nodes').innerHTML = current ? current.nodes.map(item => {
      const type = item.type, title = reference() ? item.data.title : type === 'effect' ? M.label('operation', item.data.operation) : TYPE_NAMES[type];
      const port = type === 'condition' ? 'yes' : 'next';
      const locked = reference() ? ' disabled' : '';
      return `<div class="graph-node${reference() ? ' reference-node' : ''}${item.id === selected ? ' selected' : ''}" data-node="${item.id}" data-type="${type}" style="left:${item.x}px;top:${item.y}px"><button type="button" class="node-header" data-select="${item.id}" aria-label="编辑${escape(title)}节点"><span class="node-symbol" aria-hidden="true">${type === 'effect' ? (SYMBOLS[item.data.operation] || '≡') : type === 'trigger' ? '↳' : type === 'condition' ? '⋈' : '◉'}</span><strong>${escape(title)}</strong></button><div class="node-body">${nodeSummary(item)}</div>${type !== 'trigger' ? `<button class="node-port input" data-input="${item.id}" aria-label="${escape(title)}入口"${locked}>●</button>` : ''}${type !== 'end' ? `<button class="node-port output${pending?.from === item.id && pending.port === port ? ' pending' : ''}" data-output="${item.id}" data-port="${port}" aria-label="${escape(title)}${type === 'condition' ? '满足' : ''}出口"${locked}>●</button>` : ''}${type === 'condition' ? `<span class="node-port-label">满足</span><span class="node-port-label no">不满足</span><button class="node-port output${pending?.from === item.id && pending.port === 'no' ? ' pending' : ''}" data-output="${item.id}" data-port="no" aria-label="条件不满足出口"${locked}>●</button>` : ''}</div>`;
    }).join('') : '';
    updateView(); drawEdges(); highlightTrace();
  }
  function position(item, output, port) { return { x: item.x + (output ? 230 : 0), y: item.y + (port === 'no' ? 122 : 72) }; }
  function edgePath(a, b, lower = false) {
    if (b.x >= a.x + 20 && !lower) { const bend = Math.max(45, (b.x - a.x) * .5); return `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`; }
    const floor = Math.max(a.y, b.y) + (lower ? 125 : 100);
    return `M${a.x},${a.y} C${a.x + 60},${a.y} ${a.x + 60},${floor} ${a.x + 25},${floor} L${b.x - 30},${floor} C${b.x - 65},${floor} ${b.x - 65},${b.y} ${b.x},${b.y}`;
  }
  function drawEdges(pointer) {
    const current = graph();
    if (!current) { $('edges').innerHTML = ''; return; }
    const defs = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#87a490"/></marker></defs>';
    $('edges').innerHTML = defs + current.edges.map((edge, index) => {
      const from = current.nodes.find(n => n.id === edge.from), to = current.nodes.find(n => n.id === edge.to);
      if (!from || !to) return '';
      const path = edgePath(position(from, true, edge.port), position(to, false), edge.port === 'no');
      return `<path class="edge-hit" data-edge="${index}" d="${path}"><title>${reference() ? '原卡参考连线（不可删除）' : '双击删除此连线'}</title></path><path class="edge-path${edge.port === 'no' ? ' no' : ''}" d="${path}" marker-end="url(#arrow)"/>`;
    }).join('');
    if (pending && pointer) {
      const from = current.nodes.find(n => n.id === pending.from);
      if (from) $('edges').innerHTML += `<path class="edge-preview" d="${edgePath(position(from, true, pending.port), pointer)}"/>`;
    }
  }
  function updateView() {
    $('stage').style.transform = `translate(${view.x}px,${view.y}px) scale(${view.scale})`;
    $('zoom-label').textContent = Math.round(view.scale * 100) + '%';
  }
  function fit() {
    if (!graph()) return;
    const nodes = graph().nodes, width = $('viewport').clientWidth, height = $('viewport').clientHeight;
    const minX = Math.min(...nodes.map(n => n.x)) - 35, maxX = Math.max(...nodes.map(n => n.x)) + 290;
    const minY = Math.min(...nodes.map(n => n.y)) - 40, maxY = Math.max(...nodes.map(n => n.y)) + 300;
    view.scale = Math.max(reference() ? .55 : .25, Math.min(1, width / (maxX - minX), height / (maxY - minY)));
    view.x = (width - (maxX - minX) * view.scale) / 2 - minX * view.scale;
    view.y = (height - (maxY - minY) * view.scale) / 2 - minY * view.scale;
    if (reference() && (maxX - minX) * view.scale > width) view.x = 18 - minX * view.scale;
    updateView();
  }
  function zoom(factor) {
    const width = $('viewport').clientWidth, height = $('viewport').clientHeight;
    const old = view.scale, next = Math.min(1.6, Math.max(.25, old * factor));
    view.x = width / 2 - (width / 2 - view.x) * next / old; view.y = height / 2 - (height / 2 - view.y) * next / old; view.scale = next; updateView();
  }

  function selectField(title, field, group, value) { return `<label class="field">${title}<select data-field="${field}">${optionHtml(M.OPTIONS[group], value)}</select></label>`; }
  function numericField(title, field, value, min, max) { return `<label class="field">${title}<input data-field="${field}" type="number" min="${min}" max="${max}" step="1" value="${escape(value)}" required></label>`; }
  function renderInspector() {
    const current = graph(), item = node();
    $('node-kind').textContent = item ? TYPE_NAMES[item.type] : '未选择';
    if (!current) { $('inspector').innerHTML = '<p>这张卡没有技能。点击「＋ 技能」创建一个。</p>'; return; }
    if (reference()) {
      if (entry().web) {
        $('node-kind').textContent = '流程说明';
        $('inspector').innerHTML = `<h3>${escape(current.name)}</h3><p class="inspector-note">实际执行逻辑在上方 Web 技能编辑区维护。这里编辑对照说明，便于记录条件、目标与顺序。</p>${item ? `<label class="field">节点标题<input data-field="referenceTitle" value="${escape(item.data.title)}" maxlength="500"></label><label class="field">处理说明<textarea data-field="referenceText" rows="6" maxlength="500">${escape(item.data.text)}</textarea></label>` : '<p>点击节点维护对应的处理说明。</p>'}<p class="field-hint">原实现对应：${escape(current.hook)}</p>`;
        return;
      }
      $('node-kind').textContent = '参考流程';
      $('inspector').innerHTML = `<h3>${escape(current.name)}</h3><p class="inspector-note">原卡逻辑参考，尚未接入执行。可拖动节点查看，不可修改规则或导出为可运行技能。</p>${item ? `<h4>${escape(item.data.title)}</h4><p class="reference-detail">${escape(item.data.text)}</p>` : '<p>点击节点查看完整处理说明。</p>'}<p class="field-hint">对应：${escape(current.hook)}</p>${entry().source?.note ? `<p class="inspector-note">${escape(entry().source.note)}</p>` : ''}`;
      return;
    }
    let html = `<label class="field">技能名称<input data-field="skillName" value="${escape(current.name)}" maxlength="80" required></label>`;
    if (!item) html += '<p>选中画布中的节点，编辑触发、条件、目标与效果。</p>';
    else if (item.type === 'trigger') html += selectField('触发时机', 'trigger', 'trigger', item.data.trigger) + '<p class="inspector-note">每次对应事件发生时，先检查条件，再按连线顺序执行。</p>';
    else if (item.type === 'condition') {
      html += selectField('执行条件', 'condition', 'condition', item.data.condition);
      if (item.data.condition === 'HandBelow') html += numericField('手牌数严格小于此值', 'conditionValue', item.data.conditionValue, 0, 10);
      html += '<p class="inspector-note">满足：继续执行效果。<br>不满足：跳过整个技能。<br>含守军在内的非我方卡也属于敌方目标。</p>';
    } else if (item.type === 'effect') {
      const data = item.data, playerEffect = ['DrawCards', 'AddActions'].includes(data.operation);
      html += selectField('效果类型', 'operation', 'operation', data.operation);
      if (!playerEffect) html += selectField('目标范围', 'target', 'target', data.target) + selectField('选择方式', 'selection', 'selection', data.selection);
      else html += '<p class="inspector-note">作用于技能所属玩家，不选择场上的卡牌。</p>';
      if (data.operation === 'ModifyPower') html += numericField('战力变化（不可为 0）', 'amount', data.amount, -20, 20) + selectField('持续时间', 'duration', 'duration', data.duration);
      else if (playerEffect) html += numericField(data.operation === 'DrawCards' ? '抽牌数量' : '额外行动数', 'amount', data.amount, 1, 5);
      else html += `<p class="inspector-note">${data.operation === 'GrantShield' ? '赋予一次护盾。已有护盾只刷新，不叠加。' : '尝试摧毁目标；目标有护盾时会被抵挡。'}</p>`;
      html += '<p class="field-hint">每一步单独选择目标；两次“随机 1 张”不保证是同一张卡。</p>';
      html += '<div class="inspector-actions"><button data-action="disconnect" class="small">断开出口</button><button data-action="delete-node" class="small danger">删除效果</button></div>';
    } else html += '<p class="inspector-note">结束本次技能流程。实际游戏还会检查胜负与其他技能触发。</p>';
    html += '<div class="inspector-actions"><button data-action="delete-skill" class="small danger">删除整个技能</button></div>';
    $('inspector').innerHTML = html;
  }

  function renderCardPreview() {
    const card = entry().card;
    $('preview-name').textContent = card.name; $('preview-camp').textContent = displayCamp(card.camp); $('preview-rarity').textContent = card.rarity; $('preview-power').textContent = card.baseAttack;
    $('preview-camp').style.color = { 魏: '#3e70a0', 蜀: '#c47b31', 吴: '#47875d' }[card.camp.slice(-1)] || '#576958';
    $('card-preview').style.setProperty('--rarity', { 普通: '#737e73', 稀有: '#457f9f', 史诗: '#8d65aa', 传说: '#b77824', 特殊: '#b95b69' }[card.rarity]);
    const original = entry().source ? `<div class="preview-skill"><strong>${escape(entry().web ? card.skill : entry().source.skill)} · ${entry().web ? '当前说明' : '原卡说明'}</strong><p>${escape(entry().web ? card.effect : entry().source.effect)}</p></div>` : '';
    $('preview-skills').innerHTML = original + entry().graphs.map(skillGraph => {
      if (skillGraph.mode === 'reference') return `<div class="preview-skill"><strong>${escape(skillGraph.name)}</strong><p>${entry().web ? 'Web 实现对照' : '参考流程'} · ${skillGraph.nodes.length} 个说明节点</p></div>`;
      try {
        const skill = M.compileGraph(skillGraph);
        return `<div class="preview-skill"><strong>${escape(skill.name)}</strong><p>${escape(M.label('trigger', skill.trigger))} · ${escape(M.label('condition', skill.condition))}${skill.condition === 'HandBelow' ? ' ' + skill.conditionValue : ''}\n${skill.steps.map(M.describeStep).map(escape).join('\n')}</p></div>`;
      } catch (_) { return `<div class="preview-skill"><strong>${escape(skillGraph.name)}</strong><p>流程尚未连接完整，完成后自动生成说明。</p></div>`; }
    }).join('') || '<p class="muted">无技能</p>';
  }
  function renderValidation() {
    let error = '', allError = '';
    try { M.compileProject(singleCardProject()); } catch (e) { error = e.message; }
    try { M.compileProject(project); } catch (e) { allError = e.message; }
    const isReferenceCard = entry().source?.execution === 'reference' || entry().graphs.some(g => g.mode === 'reference');
    $('validation').textContent = isReferenceCard ? '参考流程已预存 · 尚未接入执行，可保存工程；不能导出 Unity 可执行卡牌' : error || '✓ 当前卡牌校验通过 · 可单独导出 Unity 工坊配置';
    $('validation').className = isReferenceCard ? 'reference-status' : error ? 'error' : '';
    $('export-library').disabled = !!allError;
    $('export-library').title = allError ? '制作库含参考流程或无效配置。请保存工程，或选择可执行卡单独导出。' : '';
    $('export-card').disabled = !!error;
    $('export-card').textContent = entry().web ? '导出当前 Web 卡' : '导出当前 Unity 卡';
    if (entry().web) {
      try { W.validate(entry().web); $('export-card').disabled = false; $('validation').textContent = '✓ 当前 Web 技能可导出 · 流程图仅作说明，脚本决定实际效果'; $('validation').className = ''; }
      catch (e) { $('validation').textContent = 'Web 草稿待修正：' + e.message; $('validation').className = 'error'; }
    }
    $('node-count').textContent = reference() ? `${graph().nodes.length} 个${entry().web ? '说明' : '参考'}节点` : graph() ? `${graph().nodes.filter(n => n.type === 'effect').length} / 8 效果` : '无技能';
    $('preview-start').disabled = !graph();
  }

  function renderTrace() {
    $('preview-next').disabled = !trace.length || traceIndex >= trace.length - 1 || !!trace[traceIndex]?.choiceRequired;
    $('reference-choices').hidden = !trace[traceIndex]?.choiceRequired;
    $('trace').innerHTML = trace.length ? trace.slice(0, traceIndex + 1).map((line, index) => `<li class="${index === traceIndex ? 'current' : ''}">${escape(line.text)}</li>`).join('') : `<li class="muted">${reference() ? '参考图只逐步展示原规则；遇到条件请手动选择路径，不自动判断。' : '选择预设场面条件，观察技能将按什么顺序执行。'}</li>`;
    $('trace').scrollTop = $('trace').scrollHeight; highlightTrace();
  }
  function highlightTrace() {
    document.querySelectorAll('.graph-node').forEach(el => el.classList.toggle('running', el.dataset.node === trace[traceIndex]?.nodeId));
  }
  function focusNode(id) {
    const item = graph()?.nodes.find(n => n.id === id); if (!item) return;
    const x = view.x + item.x * view.scale, y = view.y + item.y * view.scale;
    if (x < 12 || y < 12 || x + 230 * view.scale > $('viewport').clientWidth - 12 || y + 180 * view.scale > $('viewport').clientHeight - 20) {
      view.x = $('viewport').clientWidth / 2 - (item.x + 115) * view.scale;
      view.y = $('viewport').clientHeight / 2 - (item.y + 90) * view.scale; updateView();
    }
  }

  $('card-form').addEventListener('submit', e => e.preventDefault());
  $('card-form').addEventListener('change', event => {
    const input = event.target, field = input.name;
    if (!field) return;
    mutate(() => {
      const card = entry().card, oldId = card.id;
      card[field] = field === 'baseAttack' ? (input.value.trim() === '' ? NaN : Number(input.value)) : input.value.trim();
      if (field === 'id') project.decks.forEach(deck => { deck.cardIds = deck.cardIds.map(id => id === oldId ? card.id : id); });
    });
  });
  $('card-select').addEventListener('change', e => { cardIndex = Number(e.target.value); skillIndex = 0; selected = null; pending = null; resetTrace(); render(); fit(); });
  $('card-search').addEventListener('input', renderCardSelect);
  $('camp-filter').addEventListener('change', renderCardSelect);
  $('restore-presets').disabled = !PRESETS;
  $('restore-presets').addEventListener('click', () => {
    mutate(() => { const result = M.mergePresets(project, PRESETS); project = result.project; }, '已补齐预存卡及缺失的 Web 技能实现，已有修改保持不变。');
  });
  $('skill-tabs').addEventListener('click', e => {
    const button = e.target.closest('[data-skill]'); if (!button) return;
    skillIndex = Number(button.dataset.skill); selected = null; pending = null; resetTrace(); render(); fit();
  });
  $('node-palette').addEventListener('click', e => {
    const button = e.target.closest('[data-operation]'); if (!button || !graph()) return;
    if (mutate(() => { selected = M.addEffect(graph(), button.dataset.operation).id; })) focusNode(selected);
  });
  $('new-card').addEventListener('click', () => {
    $('card-search').value = ''; $('camp-filter').value = '';
    mutate(() => { const item = M.sample().cards[0]; item.card.id = 'workshop_' + M.uid(); item.card.name = '未命名卡牌'; item.graphs = []; project.cards.push(item); cardIndex = project.cards.length - 1; skillIndex = 0; selected = null; });
  });
  $('duplicate-card').addEventListener('click', () => {
    $('card-search').value = ''; $('camp-filter').value = '';
    mutate(() => { const item = M.clone(entry()); item.card.id = 'workshop_' + M.uid(); item.card.name += '·副本'; if (item.source) item.source.isCopy = true; project.cards.push(item); cardIndex = project.cards.length - 1; skillIndex = 0; selected = null; }); fit();
  });
  $('delete-card').addEventListener('click', () => {
    if (project.cards.length <= 1) return;
    if (project.decks.some(deck => deck.cardIds.includes(entry().card.id))) { notify('测试卡组仍在引用这张卡，不能删除。请先在 Unity 工坊移除对应卡组引用后重新导入。'); return; }
    if (!confirm(`删除「${entry().card.name}」及其全部技能？可以撤销。`)) return;
    mutate(() => { project.cards.splice(cardIndex, 1); cardIndex = Math.max(0, cardIndex - 1); skillIndex = 0; selected = null; }); fit();
  });
  $('add-skill').addEventListener('click', () => {
    mutate(() => { const next = M.graphFromSkill({ name: '新技能', trigger: 'OnPlace', condition: 'Always', conditionValue: 3, steps: [M.step()] }); M.arrange(next); entry().graphs.push(next); skillIndex = entry().graphs.length - 1; selected = next.nodes[0].id; }); fit();
  });
  $('inspector').addEventListener('change', e => {
    const field = e.target.dataset.field; if (!field || !graph()) return;
    const value = e.target.type === 'number' ? (e.target.value.trim() === '' ? NaN : Number(e.target.value)) : e.target.value.trim();
    mutate(() => {
      if (field === 'skillName') graph().name = value;
      else if (field === 'referenceTitle' && reference() && entry().web && node()) node().data.title = value;
      else if (field === 'referenceText' && reference() && entry().web && node()) node().data.text = value;
      else if (node()) {
        const data = node().data; data[field] = value;
        if (field === 'operation') {
          if (data.operation !== 'ModifyPower') data.duration = 'Permanent';
          if (['DrawCards', 'AddActions'].includes(data.operation)) { data.target = 'Self'; data.selection = 'All'; data.amount = 1; }
          if (['Destroy', 'GrantShield'].includes(data.operation)) data.amount = 1;
        }
      }
    });
  });
  $('inspector').addEventListener('click', e => {
    const action = e.target.dataset.action; if (!action || !graph()) return;
    if (action === 'delete-node') mutate(() => { M.removeEffect(graph(), selected); selected = null; });
    if (action === 'disconnect') mutate(() => { graph().edges = graph().edges.filter(edge => edge.from !== selected); }, '出口已断开。点击出口，再点击下一个节点的入口重新连接。');
    if (action === 'delete-skill' && confirm(`删除技能「${graph().name}」？可以撤销。`)) mutate(() => { entry().graphs.splice(skillIndex, 1); skillIndex = Math.max(0, skillIndex - 1); selected = null; });
  });
  $('arrange').addEventListener('click', () => { if (graph() && mutate(() => M.arrange(graph()))) fit(); });
  $('fit').addEventListener('click', fit); $('zoom-in').addEventListener('click', () => zoom(1.2)); $('zoom-out').addEventListener('click', () => zoom(1 / 1.2));
  $('undo').addEventListener('click', () => historyMove(history, future)); $('redo').addEventListener('click', () => historyMove(future, history));

  const viewport = $('viewport');
  function screenPoint(event) { const rect = viewport.getBoundingClientRect(); return { x: (event.clientX - rect.left - view.x) / view.scale, y: (event.clientY - rect.top - view.y) / view.scale }; }
  viewport.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const output = event.target.closest('[data-output]'), input = event.target.closest('[data-input]'), element = event.target.closest('[data-node]');
    if (reference() && (output || input)) return;
    if (output) {
      pending = { from: output.dataset.output, port: output.dataset.port };
      drag = { type: 'wire', x: event.clientX, y: event.clientY, moved: false };
      renderGraph(); viewport.setPointerCapture(event.pointerId); return;
    }
    if (input) {
      if (pending) mutate(() => M.connect(graph(), pending.from, pending.port, input.dataset.input));
      else notify('先点击上一个节点右侧的出口，再点击此入口。');
      return;
    }
    if (element) {
      selected = element.dataset.node; renderInspector();
      document.querySelectorAll('.graph-node').forEach(el => el.classList.toggle('selected', el.dataset.node === selected));
      if (event.target.closest('.node-header')) drag = { type: 'node', before: snapshot(), x: event.clientX, y: event.clientY, originX: node().x, originY: node().y, id: selected };
      else return;
    } else if (!event.target.closest('[data-edge]')) {
      selected = null; pending = null; renderInspector(); renderGraph();
      drag = { type: 'pan', x: event.clientX, y: event.clientY, originX: view.x, originY: view.y };
    } else return;
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', event => {
    if (pending) drawEdges(screenPoint(event));
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (drag.type === 'wire') { drag.moved ||= Math.abs(dx) + Math.abs(dy) > 5; return; }
    if (drag.type === 'pan') { view.x = drag.originX + dx; view.y = drag.originY + dy; updateView(); }
    if (drag.type === 'node') {
      const item = graph().nodes.find(n => n.id === drag.id);
      item.x = Math.max(-5000, Math.min(10000, drag.originX + dx / view.scale)); item.y = Math.max(-5000, Math.min(10000, drag.originY + dy / view.scale));
      const element = document.querySelector(`[data-node="${item.id}"]`); element.style.left = item.x + 'px'; element.style.top = item.y + 'px'; drawEdges();
    }
  });
  window.addEventListener('pointerup', event => {
    if (!drag) return;
    if (drag.type === 'wire' && drag.moved) {
      const input = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-input]');
      if (input && pending) mutate(() => M.connect(graph(), pending.from, pending.port, input.dataset.input));
      else { pending = null; renderGraph(); }
    }
    if (drag.type === 'node') { record(drag.before); renderGraph(); renderTrace(); $('undo').disabled = !history.length; $('redo').disabled = !future.length; }
    drag = null; viewport.classList.remove('is-dragging');
  });
  window.addEventListener('pointercancel', () => {
    if (drag?.type === 'node') { project = JSON.parse(drag.before); }
    drag = null; pending = null; viewport.classList.remove('is-dragging'); renderGraph();
  });
  $('nodes').addEventListener('click', event => {
    // Keyboard-generated clicks do not emit pointerdown.
    if (event.detail !== 0) return;
    const output = event.target.closest('[data-output]'), input = event.target.closest('[data-input]');
    if (reference() && (output || input)) return;
    const select = event.target.closest('[data-select]');
    if (select) {
      selected = select.dataset.select; renderInspector(); focusNode(selected);
      document.querySelectorAll('.graph-node').forEach(el => el.classList.toggle('selected', el.dataset.node === selected));
    }
    if (output) { pending = { from: output.dataset.output, port: output.dataset.port }; document.querySelectorAll('.node-port').forEach(el => el.classList.toggle('pending', el === output)); }
    if (input && pending) mutate(() => M.connect(graph(), pending.from, pending.port, input.dataset.input));
  });
  $('edges').addEventListener('dblclick', e => {
    if (reference()) return;
    const path = e.target.closest('[data-edge]'); if (path) mutate(() => { graph().edges.splice(Number(path.dataset.edge), 1); }, '连线已删除，可撤销。');
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { pending = null; renderGraph(); }
    if (event.target.closest('input,textarea,select') || $('help-dialog').open) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? historyMove(future, history) : historyMove(history, future); }
    if (event.key === 'Delete' && !reference() && node()?.type === 'effect') mutate(() => { M.removeEffect(graph(), selected); selected = null; });
  });

  $('preview-start').addEventListener('click', () => {
    try {
      if (reference()) {
        referenceChoices = {}; trace = M.referencePreview(graph()); traceIndex = 0; renderTrace(); focusNode(trace[0].nodeId); return;
      }
      if (['sim-hand', 'sim-own', 'sim-opponent'].some(id => !$(id).value.trim())) throw new Error('请填写预演数值，不能留空。');
      trace = M.preview(graph(), { hand: Number($('sim-hand').value), own: Number($('sim-own').value), opponent: Number($('sim-opponent').value), adjacent: $('sim-adjacent').checked }); traceIndex = 0; renderTrace(); focusNode(trace[0].nodeId);
    } catch (e) { notify(e.message); }
  });
  $('preview-next').addEventListener('click', () => { if (traceIndex < trace.length - 1) { traceIndex++; renderTrace(); focusNode(trace[traceIndex].nodeId); } });
  for (const [id, value] of [['reference-yes', true], ['reference-no', false]]) $(id).addEventListener('click', () => {
    const line = trace[traceIndex]; if (!reference() || !line?.choiceRequired) return;
    referenceChoices[line.nodeId] = value; trace = M.referencePreview(graph(), referenceChoices); renderTrace();
  });
  document.querySelectorAll('.preview-controls input').forEach(input => input.addEventListener('change', () => { resetTrace(); renderTrace(); }));
  $('toggle-preview').addEventListener('click', () => { const content = $('preview-content'); content.hidden = !content.hidden; $('toggle-preview').textContent = content.hidden ? '展开' : '收起'; $('toggle-preview').setAttribute('aria-expanded', !content.hidden); });

  function download(name, value) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function downloadScript(name, source) {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  $('save-project').addEventListener('click', () => { download('card-workshop-project.json', project); notify('已下载工程 JSON，包含卡牌、连线、位置和原有测试卡组。'); });
  $('export-library').addEventListener('click', () => {
    try { download('workshop-library.json', M.compileProject(project)); notify('已导出 Unity 工坊制作库。请在 Unity 的卡牌与技能工坊中导入；不会自动替换正式卡牌。'); } catch (e) { notify(e.message); }
  });
  $('export-card').addEventListener('click', () => {
    if (entry().web) {
      try { downloadScript(entry().card.id + '.js', W.exportScript([entry()])); notify('已导出当前卡的实际 Web 技能，使用原卡 ID；未修改正式游戏。'); } catch (e) { notify(e.message); }
      return;
    }
    try { download(entry().card.id + '.json', M.compileProject(singleCardProject())); notify('已导出当前卡牌的 Unity 制作库文件（不包含其他卡牌或测试卡组）。'); } catch (e) { notify(e.message); }
  });
  $('import-button').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('文件过大，请使用不超过 2 MB 的制作库 JSON');
      const imported = M.parseProject(JSON.parse((await file.text()).replace(/^\uFEFF/, '')));
      const upgraded = PRESETS ? W.upgrade(imported, PRESETS) : 0;
      if (!confirm(`导入 ${imported.cards.length} 张卡牌，将替换当前浏览器中的制作库。建议先保存工程；导入后可以撤销。继续？`)) return;
      const before = snapshot(); project = imported; if (PRESETS) project.presetCatalogVersion = PRESETS.version; cardIndex = 0; skillIndex = 0; selected = null;
      $('card-search').value = ''; $('camp-filter').value = '';
      record(before); render(); fit(); notify(`导入成功。${upgraded ? `已为 ${upgraded} 张旧参考卡补入实际 Web 技能。` : ''}测试卡组引用已保留；请检查后再导出。`);
    } catch (e) { notify('导入失败，当前内容未改变：' + e.message); }
    finally { event.target.value = ''; }
  });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal()); $('close-help').addEventListener('click', () => $('help-dialog').close());
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) { hasStoredError = true; $('save-state').textContent = '另一窗口修改了草稿；自动保存已暂停'; notify('检测到另一窗口修改了同一草稿，已暂停自动覆盖。请先保存工程，再刷新页面读取最新版本。'); }
  });
  render(); requestAnimationFrame(fit);
})();
