/* UI for maintained production effects; scripts only execute in the disposable test worker. */
window.createWebWorkshopEditor = function (api) {
  'use strict';
  const W = window.CardWorkshopWeb, $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let sectionKey = '', currentId = '', typingBefore = null, running = false;
  const current = () => W.sections(api.entry().web).find(s => s.key === sectionKey);
  const dirty = () => { api.entry().web.reviewed = false; };
  function status() {
    const entry = api.entry(); if (!entry.web) return;
    try {
      W.validate(entry.web);
      $('web-status').textContent = '✓ 脚本语法与标记格式通过' + (entry.web.reviewed === false ? ' · 实现已修改，请同步核对技能文案和流程说明。' : ' · 可保存工程与导出 Web 技能包。');
      $('web-status').className = 'web-status';
    } catch (e) { $('web-status').textContent = '草稿已保留；导出前需修正：' + e.message; $('web-status').className = 'web-status error'; }
  }
  function render() {
    const entry = api.entry(), active = !!entry.web;
    $('web-editor').hidden = !active;
    const count = api.project().cards.filter(e => e.web).length;
    $('export-web').disabled = count === 0; $('export-web').textContent = `导出 Web 技能包（${count}）`;
    if (!active) { currentId = ''; sectionKey = ''; return; }
    if (currentId !== entry.card.id) { currentId = entry.card.id; sectionKey = ''; $('web-verification').textContent = ''; }
    const sections = W.sections(entry.web);
    if (!sections.some(s => s.key === sectionKey)) sectionKey = sections[0]?.key || '';
    $('web-hook').innerHTML = sections.map(s => `<option value="${escape(s.key)}">${escape(s.label)} · ${escape(s.key)}</option>`).join('');
    $('web-hook').value = sectionKey; $('web-hook').disabled = !sections.length;
    const available = Object.entries(W.HOOKS).filter(([key]) => !Object.hasOwn(entry.web.hooks, key));
    $('web-add-hook').innerHTML = available.map(([key, name]) => `<option value="${key}">${name}</option>`).join('');
    $('web-add').disabled = !available.length;
    $('web-remove').disabled = !sectionKey || sectionKey.startsWith('helper:');
    const selected = current(); $('web-code').value = selected?.body || ''; $('web-code-label').hidden = !selected;
    $('web-parameters').innerHTML = selected ? W.parameters(selected.body).map((p, i) => `<label class="field">${escape(p.label)} · 第 ${p.line} 行<input type="number" data-web-param="${i}" value="${p.value}" min="-100" max="100" step="1"></label>`).join('') : '<p class="field-hint">此卡由被动标记驱动，可在上方编辑标记，或添加事件。</p>';
    $('web-flags').innerHTML = `<details${Object.keys(entry.web.flags).length ? ' open' : ''}><summary>被动标记（${Object.keys(entry.web.flags).length}）</summary>${Object.entries(W.FLAGS).map(([key, name]) => `<label><input type="checkbox" data-web-flag="${key}"${entry.web.flags[key] ? ' checked' : ''}>${escape(name)} <small>${key}</small></label>`).join('')}</details>`;
    $('web-constants').innerHTML = Object.entries(entry.web.constants).map(([key, value]) => `<label class="field">引擎常量 ${key}<input type="number" data-web-constant="${key}" value="${value}" min="0" max="99"></label>`).join('');
    $('web-skill-name').value = entry.card.skill; $('web-description').value = entry.card.effect;
    $('web-verify').disabled = running;
    status();
  }
  $('web-hook').addEventListener('change', e => { sectionKey = e.target.value; render(); });
  $('web-code').addEventListener('input', e => {
    if (!sectionKey) return;
    typingBefore ??= api.snapshot();
    W.setBody(api.entry().web, sectionKey, e.target.value); dirty(); api.persist();
    $('web-status').textContent = '正在编辑 · 草稿已保存，离开输入框后校验';
  });
  $('web-code').addEventListener('change', () => {
    if (typingBefore !== null) { api.record(typingBefore); typingBefore = null; }
    api.render();
  });
  $('web-parameters').addEventListener('change', e => {
    if (!e.target.hasAttribute('data-web-param')) return;
    api.mutate(() => { W.setBody(api.entry().web, sectionKey, W.setParameter(current().body, Number(e.target.dataset.webParam), e.target.value.trim() ? Number(e.target.value) : NaN)); dirty(); });
  });
  $('web-flags').addEventListener('change', e => {
    const flag = e.target.dataset.webFlag; if (!flag) return;
    api.mutate(() => { api.entry().web.flags[flag] = e.target.checked; dirty(); });
  });
  $('web-constants').addEventListener('change', e => {
    const key = e.target.dataset.webConstant; if (!key) return;
    api.mutate(() => { api.entry().web.constants[key] = e.target.value.trim() ? Number(e.target.value) : NaN; dirty(); });
  });
  $('web-add').addEventListener('click', () => {
    const key = $('web-add-hook').value;
    api.mutate(() => { W.setBody(api.entry().web, key, '// 在这里通过 ctx 编写此事件的实际效果。'); sectionKey = key; dirty(); });
  });
  $('web-remove').addEventListener('click', () => {
    if (!sectionKey || sectionKey.startsWith('helper:') || !confirm(`删除 ${W.HOOKS[sectionKey]} 的实际效果？可撤销。`)) return;
    api.mutate(() => { delete api.entry().web.hooks[sectionKey]; sectionKey = ''; dirty(); });
  });
  $('web-check').addEventListener('click', status);
  $('web-review').addEventListener('click', () => api.mutate(() => { api.entry().web.reviewed = true; }, '已标记流程说明核对完成。'));
  for (const [id, field] of [['web-skill-name', 'skill'], ['web-description', 'effect']]) $(id).addEventListener('change', e => api.mutate(() => { api.entry().card[field] = e.target.value; }));
  $('export-web').addEventListener('click', () => {
    try { api.downloadScript('workshop-web-effects.js', W.exportScript(api.project().cards)); api.notify('已导出 Web 技能包。正式页面需在三国技能脚本之后、core-v2.js 之前加载；未修改正式文件。'); }
    catch (e) { api.notify('导出失败：' + e.message); }
  });
  $('web-verify').addEventListener('click', () => {
    if (running) return;
    let script;
    try { script = W.exportScript(api.project().cards); } catch (e) { api.notify(e.message); return; }
    const snapshot = api.snapshot();
    const worker = new Worker('./verify-worker.js'); running = true; $('web-verify').disabled = true;
    $('web-verification').textContent = '正在独立测试环境中加载正式规则，检查当前 Web 技能包…';
    const finish = message => {
      clearTimeout(timer); worker.terminate(); running = false; $('web-verify').disabled = false;
      $('web-verification').textContent = message + (api.snapshot() !== snapshot ? '\n检查期间工程已变化，此结果对应检查开始时的版本，请重新检查。' : '');
    };
    const timer = setTimeout(() => finish('检查超时，测试进程已停止。草稿仍保留；请检查脚本是否存在无限循环。'), 15000);
    worker.onerror = e => { e.preventDefault(); finish('检查失败：' + e.message); };
    worker.onmessage = ({ data }) => {
      if (data.error) { finish('检查失败：' + data.error); return; }
      finish(`原版规则回归：${data.passed} 项通过，${data.failed} 项有差异。\n` + data.results.filter(r => !r.passed).map(r => `${r.id || ''} ${r.name}${r.error ? '：' + r.error : ''}`).join('\n') + (data.failed ? '\n修改数值后，原版断言可能不再满足；请逐项核对是否符合预期。' : '已在正式 Web 规则引擎执行，包含卡牌边界与连锁测试。'));
    };
    worker.postMessage({ script });
  });
  return { render };
};
