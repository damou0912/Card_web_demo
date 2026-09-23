'use strict';
let session, busy = false;
let activeReveal = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'status error' : 'status'; }
function cardData(id) { return session.cards.find(c => c.id === id); }
function groupFor(id) { return session.config.groups.find(g => g.cardIds.includes(id)); }
function qualityBadge(rarity, text) {
  const quality = GachaReveal.quality(rarity), badge = element('span', text || quality.label, 'quality-chip');
  badge.dataset.quality = quality.key; return badge;
}
function rewardCaption(reward, preview = false) {
  return preview ? '效果预览 · 不获得卡牌' : reward.guarantee ? '保底补发 · 拥有 1 张' : reward.isNew ? '新卡 · 拥有 1 张' : '重复卡 · 拥有 1 张';
}
function showCard(id) {
  if (busy) return;
  const card = cardData(id), owned = session.state.owned.find(c => c.cardId === id), group = groupFor(id);
  const root = $('detail-content'); root.replaceChildren();
  root.append(element('p', `${card.camp} / ${card.rarity} / ID ${id}`, 'eyebrow'), element('h2', card.name),
    element('p', `基础战力 ${card.baseAttack}　技能：${card.skill}`, 'detail-meta'), element('p', card.effect, 'detail-effect'),
    element('p', `完整卡数量：${owned ? 1 : 0} 张\n单卡基础概率 ${(group.weight / 100 / group.cardIds.length).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}%\n重复卡自动转为碎片，顶部查看碎片总数。技能在此仅展示，不接入对局。`));
  $('detail').showModal();
}
function tile(card, caption, owned = true, reward = null) {
  const button = element('button', undefined, `card${owned ? '' : ' unowned'}`);
  button.type = 'button'; button.dataset.rarity = card.rarity;
  button.dataset.quality = GachaReveal.quality(card.rarity).key;
  button.disabled = busy;
  button.setAttribute('aria-label', `${card.name}，${card.rarity}，${caption}，查看技能`);
  button.append(qualityBadge(card.rarity));
  if (reward?.guarantee) button.append(element('span', '保底补发', 'guarantee'));
  button.append(element('h3', card.name), element('span', card.skill, 'skill'), element('span', caption, `tag${reward?.isNew ? ' new' : ''}`));
  button.addEventListener('click', () => showCard(card.id)); return button;
}
function beginReveal(preview = false) {
  const dialog = $('reveal-dialog');
  let rewardCount = 0;
  const animation = new GachaReveal({
    open() {
      dialog.classList.remove('dealt', 'has-legendary');
      delete dialog.dataset.currentQuality;
      $('quality-focus').hidden = true; $('quality-focus').replaceChildren();
      $('reveal-cards').replaceChildren(); $('skip-reveal').disabled = false;
      $('reveal-title').textContent = '墨起 · 群英将至';
      $('reveal-note').textContent = preview ? '品质效果预览 · 不抽卡、不扣额度、不获得奖励' : '正在招募，请稍候…';
      dialog.querySelector('.reveal-footer').textContent = preview ? '仅预览五种品质效果 · 不抽卡、不扣额度、不获得奖励' : '动画只展示已保存结果 · 跳过不会改变卡牌或碎片';
      dialog.showModal();
    },
    waiting() {
      $('skip-reveal').disabled = true;
      $('reveal-note').textContent = '正在显示结果；若请求尚未完成，请稍候…';
    },
    deal(count, bonusCount) {
      rewardCount = count;
      dialog.classList.add('dealt');
      $('reveal-title').textContent = '展卷 · 与君相逢';
      $('reveal-note').textContent = preview ? '五种品质依次预览 · 展示卡牌不会入藏' : `结果已保存，正在揭晓${bonusCount ? `（含 ${bonusCount} 张保底补发）` : ''}…`;
      const slots = Array.from({length:count}, (_, i) => {
        const slot = element('div', undefined, 'reveal-card'); slot.setAttribute('role', 'group');
        slot.setAttribute('aria-label', `第 ${i + 1} 张，待揭晓`);
        const inner = element('div', undefined, 'reveal-inner');
        const back = element('div', undefined, 'reveal-back'); back.setAttribute('aria-hidden', 'true');
        back.append(element('span', '三 国', 'back-caption'), element('strong', '将', 'back-sigil'), element('span', '群英录', 'back-caption'));
        inner.append(back, element('div', undefined, 'reveal-front')); slot.append(inner); return slot;
      });
      $('reveal-cards').replaceChildren(...slots);
    },
    prepare(reward, card, index, instant) {
      const quality = GachaReveal.quality(card.rarity), slot = $('reveal-cards').children[index];
      $('quality-focus').hidden = true; $('quality-focus').replaceChildren();
      dialog.classList.remove('has-legendary');
      dialog.dataset.currentQuality = quality.key;
      for (const other of $('reveal-cards').children) other.classList.remove('current');
      slot.dataset.quality = quality.key; slot.classList.add('charging', 'current');
      slot.querySelector('.reveal-back .back-caption:last-child').textContent = quality.label;
      slot.setAttribute('aria-label', `第 ${index + 1} 张，${quality.label}，即将揭晓`);
      $('reveal-title').textContent = quality.featured ? `${card.rarity}将至` : `${quality.label} · 即将揭晓`;
      if (instant) slot.classList.add('instant');
      else slot.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    },
    reveal(reward, card, index, instant) {
      const slot = $('reveal-cards').children[index], front = slot.querySelector('.reveal-front');
      const quality = GachaReveal.quality(card.rarity), caption = rewardCaption(reward, preview);
      front.replaceChildren(qualityBadge(card.rarity),
        element('h3', card.name), element('span', card.skill, 'skill'), element('span', caption, reward.isNew ? 'reward-badge new' : 'reward-badge'));
      slot.dataset.rarity = card.rarity; slot.classList.remove('charging'); slot.classList.add('revealed');
      if (instant) slot.classList.add('instant');
      slot.setAttribute('aria-label', `第 ${index + 1} 张，${card.name}，${card.rarity}，${caption}`);
      $('reveal-title').textContent = `${quality.label} · ${card.name}`;
      if (quality.featured && !instant) {
        const focus = $('quality-focus'); focus.dataset.quality = quality.key;
        const hero = element('div', undefined, 'quality-hero');
        hero.append(qualityBadge(card.rarity), element('h3', card.name), element('p', card.skill, 'hero-skill'), element('p', caption, 'hero-reward'));
        focus.replaceChildren(element('p', preview ? '品质预览 · 不获得奖励' : `第 ${index + 1} 张 · ${reward.guarantee ? '保底补发' : '抽取结果'}`, 'focus-kicker'),
          element('strong', card.rarity, 'focus-rarity'), hero);
        focus.hidden = false;
        if (card.rarity === '传说') dialog.classList.add('has-legendary');
      }
      $('reveal-note').textContent = `${index + 1}/${rewardCount} · ${card.rarity} · ${card.name} · ${caption}`;
    },
    complete(rewards) {
      $('quality-focus').hidden = true;
      delete dialog.dataset.currentQuality; dialog.classList.remove('has-legendary');
      $('reveal-title').textContent = preview ? '五种品质 · 预览结束' : '本次招募完成';
      const newCards = rewards.filter(r => r.isNew).length, shards = rewards.reduce((sum, r) => sum + r.shards, 0);
      $('reveal-note').textContent = preview ? '预览不改变卡牌、碎片或测试额度' : `${newCards} 张新卡入藏 · 获得 ${shards} 枚同名碎片`;
    },
    close() {
      if (dialog.open) dialog.close();
      dialog.classList.remove('dealt', 'has-legendary'); $('reveal-cards').replaceChildren();
      delete dialog.dataset.currentQuality; $('quality-focus').hidden = true; $('quality-focus').replaceChildren();
    }
  }, {reducedMotion: reducedMotion.matches});
  activeReveal = animation;
  try { animation.open(); } catch (error) { activeReveal = null; throw error; }
  return animation;
}
function revealFinished() {
  activeReveal = null;
  $('result-heading').focus({preventScroll:true});
  $('result-heading').scrollIntoView({behavior:reducedMotion.matches ? 'auto' : 'smooth',block:'start'});
}
function render() {
  const { config, state } = session, spent = state.bundles * config.bundlePrice, complete = state.owned.length === 10;
  $('pool-title').textContent = config.title; $('balance').textContent = `${config.testCredit - spent} 元`;
  $('spent').textContent = `${spent} 元`; $('collected').textContent = `${state.owned.length} / 10`; $('bundles').textContent = `${state.bundles} 次`;
  $('shard-total').textContent = `${state.owned.reduce((sum, card) => sum + card.shards, 0)} 枚`;
  $('milestones').replaceChildren(...config.milestones.map(m => {
    const node = element('div', undefined, `milestone${spent >= m.spent ? ' done' : ''}`);
    node.append(element('strong', `${m.spent} 元 · ${m.uniqueCards}/10`), element('span', spent >= m.spent ? '　已达成' : `　${m.uniqueCards === 10 ? '集齐保底' : '最低收集'}`)); return node;
  }));
  $('draw').disabled = busy || complete || !!session.loadError;
  $('draw').replaceChildren(element('span', busy ? '招募中…' : complete ? '本期已集齐' : '招募五张'));
  $('draw').firstChild.className = 'draw-label';
  $('draw').append(element('span', complete ? '可查看图鉴或重置测试' : `${config.bundlePrice} 测试元 / ${config.bundleSize} 张`));
  $('draw-hint').textContent = complete ? `本次集齐花费 ${spent} 测试元。不会继续消耗额度。` : `还剩 ${25 - state.bundles} 次五连到整套保底；额外补发不占五张抽取。`;
  $('rules-button').disabled = busy; $('reset').disabled = busy;
  $('replay').disabled = busy || !!session.loadError || !state.lastRewards.length;
  $('quality-preview').disabled = busy;
  $('collection').replaceChildren(...config.groups.flatMap(g => g.cardIds.map(id => {
    const owned = state.owned.find(c => c.cardId === id);
    return tile(cardData(id), `拥有 ${owned ? 1 : 0} 张`, !!owned);
  })));
  const missing = config.groups.flatMap(g => g.cardIds).filter(id => !state.owned.some(c => c.cardId === id));
  $('exchange-cards').replaceChildren(...(missing.length ? missing.map(id => {
    const item = element('div', undefined, 'exchange-item');
    item.append(tile(cardData(id), '拥有 0 张', false));
    const button = element('button', '兑换价格待确认', 'exchange-disabled'); button.type='button'; button.disabled=true;
    item.append(button); return item;
  }) : [element('p', '已拥有全部 10 张卡牌，没有待兑换卡牌。', 'empty')]));
  const rewards = state.lastRewards;
  $('quality-summary').replaceChildren(...config.groups.map(g => ({...g, count:rewards.filter(r => cardData(r.cardId).rarity === g.rarity).length})).filter(g => g.count).map(g => qualityBadge(g.rarity, `${GachaReveal.quality(g.rarity).label} × ${g.count}`)));
  $('reward-caption').textContent = rewards.length ? `第 ${state.bundles} 次 · ${rewards.filter(r => !r.guarantee).length} 抽取 + ${rewards.filter(r => r.guarantee).length} 补发` : '等待招募';
  $('results').replaceChildren(...(rewards.length ? rewards.map(r => tile(cardData(r.cardId), rewardCaption(r), true, r)) : [element('p', '五张卡牌将在此揭晓。点击卡牌可查看完整技能。', 'empty')]));
  if (session.loadError) status(session.loadError, true);
}
async function load() {
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法读取本地 Demo，请确认服务已启动。');
  session = await response.json(); render();
}
async function mutate(action) {
  if (busy || !session) return;
  busy = true; render(); $('confirm-reset').disabled = true;
  let animation = null, committed = false;
  try {
    if (action === 'draw') animation = beginReveal();
    const response = await fetch(`/api/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Token': session.token },
      body: JSON.stringify({ revision: session.state.revision, confirm: action === 'reset' }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '操作失败。');
    session = payload;
    committed = true;
    if (animation) await animation.play(payload.state.lastRewards, cardData);
    status(action === 'reset' ? '已重置此 Demo，恢复 500 测试元。' : session.state.owned.length === 10 ? `十将已齐！本次共花费 ${session.state.bundles * session.config.bundlePrice} 测试元。` : '招募完成，卡牌与碎片已保存。');
  } catch (error) {
    if (animation) animation.close();
    // A response can be lost after the save succeeds. Refresh, never retry a draw automatically.
    try { await load(); } catch (_) { /* Keep last visible snapshot. */ }
    status((committed ? '结果已保存，动画未完成。' : error.message + ' 若网络中断，请确认当前进度后再操作。'), true);
  } finally {
    if (animation) animation.close();
    activeReveal = null; busy = false; $('confirm-reset').disabled = false; render();
    if (committed && action === 'draw') revealFinished();
  }
}
async function replay() {
  if (busy || !session || !session.state.lastRewards.length) return;
  busy = true; render(); let animation;
  try { animation = beginReveal(); await animation.play(session.state.lastRewards, cardData); status('已重播本次结果，未消耗测试额度。'); }
  catch (_) { status('重播未完成，已保存的结果不受影响。', true); }
  finally { if (animation) animation.close(); activeReveal = null; busy = false; render(); revealFinished(); }
}
async function previewQualities() {
  if (busy || !session) return;
  busy = true; render(); let animation;
  try {
    // A showcase of existing catalog data, never a call to the draw API or a saved reward.
    const examples = ['普通','稀有','特殊','史诗','传说'].map(rarity => ({cardId:session.config.groups.find(g=>g.rarity===rarity).cardIds[0],isNew:false,shards:0,guarantee:false}));
    animation = beginReveal(true); await animation.play(examples,cardData);
    status('品质效果预览结束：未抽卡、未扣额度、未获得奖励。');
  } catch (_) { status('品质预览未完成，测试进度不受影响。',true); }
  finally { if(animation) animation.close(); activeReveal=null; busy=false; render(); $('quality-preview').focus({preventScroll:true}); }
}
$('quality-preview').addEventListener('click', previewQualities);
$('replay').addEventListener('click', replay);
$('skip-reveal').addEventListener('click', () => activeReveal?.skip());
$('reveal-dialog').addEventListener('cancel', event => { event.preventDefault(); activeReveal?.skip(); });
reducedMotion.addEventListener('change', event => { if (event.matches) activeReveal?.skip(); });
$('draw').addEventListener('click', () => mutate('draw'));
$('reset').addEventListener('click', () => $('reset-dialog').showModal());
$('confirm-reset').addEventListener('click', () => { $('reset-dialog').close(); mutate('reset'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('rules-button').addEventListener('click', () => {
  const root = $('rules-content'); root.replaceChildren();
  const table = element('table'), head = element('tr');
  for (const title of ['品质', '数量', '品质概率', '重复碎片']) head.append(element('th', title));
  const thead = element('thead'); thead.append(head); table.append(thead); const body = element('tbody');
  for (const g of session.config.groups) { const row = element('tr'); [g.rarity, `${g.cardIds.length} 张`, `${g.weight / 100}%`, `${g.duplicateShards} / 同名卡`].forEach(v => row.append(element('td', v))); body.append(row); }
  table.append(body); root.append(table, element('p', '先按品质权重抽取，再在该品质中等概率选一张。每张独立，可出现同名卡。橙卡即传说：单卡 0.82%，首次五连也可能获得。'),
    element('p', '第 15 / 20 / 25 次五连后，分别至少拥有 8 / 9 / 10 张独有卡。五张正常结果结算后，按未拥有卡的原始相对概率额外补发至目标；最后一次补齐所有缺卡，包括橙卡。'),
    element('p', '首次集齐即停止本期测试。350 元为长期平均目标，不是每人的固定花费；最迟 500 测试元集齐。重复卡转为对应卡牌碎片，仅预留升级用途，不可兑换未拥有卡。'),
    element('p', '本页和 Unity 使用相同 C# 核心。浏览器与 Unity 的本地存档独立，无账号绑定、充值、真实支付和云同步。'));
  $('rules').showModal();
});
load().then(() => { if (!session.loadError) status(session.state.bundles ? '已恢复上次的本地进度。' : '已领取 500 测试元，可以开始招募。'); }).catch(error => status(error.message, true));
