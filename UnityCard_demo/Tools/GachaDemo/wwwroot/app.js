'use strict';
const accountPage = !!window.location?.pathname?.startsWith('/gacha');
const apiPrefix = accountPage ? '/api/gacha' : '/api';
let session, busy = false;
let activeReveal = null;
let pendingExchange = null;
let collectionCamp = '魏';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
function status(text, error = false) { $('status').textContent = text; $('status').title = text; $('status').className = error ? 'status error' : 'status'; }
function lastGrant() { return session?.state.shardGrants?.find(g => g.bundles === session.state.bundles)?.amount || 0; }
function cardData(id) { return session.cards.find(c => c.id === id); }
function poolCardCount() { return session.config.groups.reduce((count, g) => count + g.cardIds.length, 0); }
function campName(card) { return card.camp.split(/[~·-]/).at(-1); }
function displayAmount(id, value, unit) { $(id).replaceChildren(document.createTextNode(value), element('small', unit)); }
function groupFor(id) { return session.config.groups.find(g => g.cardIds.includes(id)); }
function exchangeQuote(id) {
  const cost = groupFor(id).exchangeCost, poolUsed = Math.min(cost, session.shardBalance);
  return {cost, poolUsed, universalUsed:cost - poolUsed, canAfford:cost <= session.shardBalance + session.universalBalance};
}
function paymentText(cost, universalUsed) { return `${cost - universalUsed} 枚本期碎片${universalUsed ? ` + ${universalUsed} 枚通用碎片` : ''}`; }
function conversionText() {
  const c = session.state.conversion;
  return c ? `本期已集齐：剩余 ${c.sourceShards} 枚本期碎片已转为 ${c.universalShards} 枚通用碎片（10:1，向下取整${c.sourceShards % 10 ? `，舍去余数 ${c.sourceShards % 10} 枚` : ''}）。` : '';
}
function qualityBadge(rarity, text) {
  const quality = GachaReveal.quality(rarity), badge = element('span', text || quality.label, 'quality-chip');
  badge.dataset.quality = quality.key; return badge;
}
function rewardCaption(reward, preview = false) {
  return GachaReveal.rewardCaption(reward, preview);
}
function showCard(id) {
  if (busy) return;
  const card = cardData(id), owned = session.state.owned.some(c => c.cardId === id);
  const dialog = $('detail'); dialog.dataset.quality = GachaReveal.quality(card.rarity).key;
  const root = $('detail-content'); root.replaceChildren();
  const meta = element('div', undefined, 'detail-badges');
  meta.append(element('span', `三国-${campName(card)}`, 'detail-camp'), qualityBadge(card.rarity));
  const heading = element('div', undefined, 'detail-heading'), title = element('h2', card.name);
  title.id = 'detail-title';
  const ownership = element('span', owned ? '已拥有' : '未拥有', 'detail-ownership');
  ownership.dataset.owned = String(owned);
  heading.append(title, ownership);
  const stats = element('div', undefined, 'detail-stats');
  const power = element('section', undefined, 'detail-power'); power.setAttribute('aria-label', '基础战力');
  power.append(element('span', '基础战力', 'detail-label'), element('strong', String(card.baseAttack), 'detail-power-value'));
  const skill = element('section', undefined, 'detail-skill'); skill.setAttribute('aria-label', '卡牌技能');
  skill.append(element('span', '卡牌技能', 'detail-label'), element('h3', card.skill, 'detail-skill-name'));
  stats.append(power, skill);
  const effects = element('section', undefined, 'detail-effects'), effectsTitle = element('h3', '技能效果');
  effectsTitle.id = 'detail-effects-title'; effects.setAttribute('aria-labelledby', effectsTitle.id);
  effects.append(effectsTitle, element('p', card.effect, 'detail-effect'));
  root.append(meta, heading, stats, effects, element('p', '卡牌技能仅作展示，暂不接入对局。', 'detail-note'));
  dialog.showModal();
  dialog.scrollTop = 0;
}
function tile(card, caption, owned = true, reward = null) {
  const button = element('button', undefined, `card${owned ? '' : ' unowned'}`);
  button.type = 'button'; button.dataset.rarity = card.rarity;
  button.dataset.quality = GachaReveal.quality(card.rarity).key;
  button.disabled = busy;
  button.setAttribute('aria-label', `${card.name}，${card.rarity}，${caption}，查看技能`);
  button.append(qualityBadge(card.rarity, `${campName(card)} · ${card.rarity}`));
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
      $('skip-reveal').textContent = '跳过动画';
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
      dialog.dataset.rewardCount = String(count);
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
      else if (rewardCount > 5) slot.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    },
    reveal(reward, card, index, instant) {
      const slot = $('reveal-cards').children[index], front = slot.querySelector('.reveal-front');
      const quality = GachaReveal.quality(card.rarity), caption = rewardCaption(reward, preview);
      front.replaceChildren(qualityBadge(card.rarity, `${campName(card)} · ${card.rarity}`),
        element('h3', card.name), element('span', card.skill, 'skill'), element('span', caption, reward.isNew ? 'reward-badge new' : 'reward-badge'));
      slot.dataset.rarity = card.rarity; slot.classList.remove('charging'); slot.classList.add('revealed');
      if (instant) slot.classList.add('instant');
      slot.setAttribute('aria-label', `第 ${index + 1} 张，${card.name}，${card.rarity}，${caption}`);
      $('reveal-title').textContent = `${quality.label} · ${card.name}`;
      if (quality.featured && !instant) {
        const focus = $('quality-focus'); focus.dataset.quality = quality.key;
        const hero = element('div', undefined, 'quality-hero');
        hero.append(qualityBadge(card.rarity, `${campName(card)} · ${card.rarity}`), element('h3', card.name), element('p', card.skill, 'hero-skill'), element('p', caption, 'hero-reward'));
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
      $('reveal-note').textContent = preview ? '预览不改变卡牌、碎片或测试额度' : `${newCards} 张新卡入藏 · 重复转 ${shards} 碎片${lastGrant() ? ` · 保底补足 ${lastGrant()} 碎片` : ''}`;
    },
    review() {
      $('skip-reveal').textContent = preview ? '关闭预览' : '收下卡牌';
      $('skip-reveal').disabled = false;
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
}
function render() {
  const { config, state } = session, spent = state.bundles * config.bundlePrice, totalCards = poolCardCount(), complete = state.owned.length === totalCards;
  $('pool-title').textContent = config.title; displayAmount('balance', config.testCredit - spent, '元');
  $('collected').textContent = `${state.owned.length}/${totalCards}`;
  $('shard-name').textContent = config.shardName;
  displayAmount('shard-total', session.shardBalance, '枚');
  displayAmount('universal-total', session.universalBalance, '枚');
  const exhausted = spent >= config.testCredit;
  $('draw').disabled = busy || complete || exhausted || !!session.loadError;
  $('draw').replaceChildren(element('span', busy ? '处理中…' : complete ? '本期已集齐' : exhausted ? '请兑换缺卡' : '招募五张'));
  $('draw').firstChild.className = 'draw-label';
  $('draw').append(element('span', complete ? '剩余碎片已转通用' : exhausted ? '本期碎片足够补齐' : `${config.bundlePrice} 测试元 / ${config.bundleSize} 张`));
  const missingCost = config.groups.reduce((sum, g) => sum + g.cardIds.filter(id => !state.owned.some(c => c.cardId === id)).length * g.exchangeCost, 0);
  $('draw-hint').textContent = complete ? '本期卡牌已齐，剩余本期碎片已转通用。' : session.shardBalance + session.universalBalance >= missingCost ? '碎片已足够兑换全部缺卡。' : `补齐缺卡还需 ${missingCost - session.shardBalance - session.universalBalance} 碎片`;
  $('rules-button').disabled = busy; $('reset').disabled = busy || !!session.loadError;
  $('replay').disabled = busy || !!session.loadError || !state.lastRewards.length;
  $('quality-preview').disabled = busy;
  $('reset-description').textContent = `归档本轮记录，清空本期卡牌和本期碎片，恢复 ${config.testCredit} 测试元。通用碎片及其他期进度保留；已花费的通用碎片不退还。不影响游戏账号、卡组或对局。`;
  const ids = config.groups.flatMap(g => g.cardIds).sort();
  const camps = new Set(ids.map(id => campName(cardData(id))));
  if (!camps.has(collectionCamp)) collectionCamp = ['魏', '蜀', '吴'].find(camp => camps.has(camp));
  for (const tab of $('collection-tabs').querySelectorAll('[role="tab"]')) {
    const selected = tab.dataset.camp === collectionCamp;
    tab.hidden = !camps.has(tab.dataset.camp);
    tab.disabled = busy || tab.hidden;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected) $('collection').setAttribute('aria-labelledby', tab.id);
  }
  // Country tabs filter display only. The draw request still targets the complete configured pool.
  $('collection').replaceChildren(...ids.filter(id => campName(cardData(id)) === collectionCamp).map(id => {
    const owned = state.owned.find(c => c.cardId === id);
    const item = element('div', undefined, 'exchange-item');
    item.append(tile(cardData(id), owned ? '已拥有' : '未拥有', !!owned));
    if (owned) { item.append(element('span', '已拥有', 'owned-label')); return item; }
    const quote = exchangeQuote(id), {cost, canAfford:enough} = quote;
    const button = element('button', `${cost} · ${enough ? '兑换' : '不足'}`, 'exchange-button'); button.type='button';
    button.disabled = busy || !!session.loadError || !enough;
    button.setAttribute('aria-label', `${cardData(id).name}，${cost} 枚碎片，${enough ? (quote.universalUsed ? `含 ${quote.universalUsed} 枚通用碎片，兑换` : '兑换') : '碎片不足'}`);
    button.addEventListener('click', () => askExchange(id));
    button.title = `${cost} 碎片${quote.universalUsed && enough ? `，含 ${quote.universalUsed} 通用碎片` : ''}${!enough ? `；还差 ${cost - session.shardBalance - session.universalBalance}` : ''}`;
    item.append(button); return item;
  }));
  const rewards = state.lastRewards;
  $('reward-caption').textContent = rewards.length ? `第 ${state.bundles} 次${lastGrant() ? ` · 保底 +${lastGrant()} 碎片` : ''}${rewards.length > 5 ? ` · 另有旧保底卡，重播查看` : ''}` : '等待招募';
  // Old saves may contain extra guaranteed cards; all remain available in replay and the collection.
  $('results').replaceChildren(...(rewards.length ? rewards.slice(0,5).map(r => tile(cardData(r.cardId), GachaReveal.rewardCaption(r, false, true), true, r)) : [element('p', '五张卡牌将在此揭晓 · 点击卡牌查看技能', 'empty')]));
  if (session.loadError) status(session.loadError, true);
}
async function load() {
  if (accountPage) {
    $('reset').hidden = true; $('back-game').hidden = false;
    $('save-mode').textContent = '免费测试 · 账号自动保存 · 获得后可组卡';
  }
  const response = await fetch(`${apiPrefix}/session`, { cache: 'no-store' });
  if (!response.ok) throw new Error(accountPage ? '请返回游戏主界面，重新登录后进入招募。' : '无法读取本地 Demo，请确认服务已启动。');
  session = await response.json(); render();
  if (accountPage) $('save-mode').textContent = `${session.username} · 免费测试 · 获得后可组卡`;
}
function askExchange(cardId) {
  if (busy || session.loadError) return;
  const quote = exchangeQuote(cardId);
  if (!quote.canAfford || session.state.owned.some(c => c.cardId === cardId)) return;
  pendingExchange = { cardId, poolId: session.config.poolId, revision: session.state.revision, profileRevision:session.profileRevision, confirmedUniversal:quote.universalUsed };
  const completing = session.state.owned.length === poolCardCount() - 1, left = session.shardBalance - quote.poolUsed;
  $('exchange-confirmation').textContent = `兑换「${cardData(cardId).name}」需要 ${quote.cost} 枚碎片。\n可用共 ${session.shardBalance + session.universalBalance} 枚：${session.config.shardName} ${session.shardBalance} 枚 + 通用碎片 ${session.universalBalance} 枚。\n本次将消耗：${paymentText(quote.cost, quote.universalUsed)}。\n兑换后本期剩余 ${left} 枚，通用剩余 ${session.universalBalance - quote.universalUsed} 枚。${completing ? `\n本次将集齐全套，剩余 ${left} 枚本期碎片会自动转为 ${Math.floor(left / 10)} 枚通用碎片（余数舍去）。` : ''}\n优先使用本期碎片；1 枚通用碎片抵 1 枚本期碎片。不扣测试额度，不推进消费保底。`;
  $('exchange-dialog').showModal();
}
async function mutate(action, exchange = null) {
  if (busy || !session) return;
  busy = true; render(); $('confirm-reset').disabled = true; $('confirm-exchange').disabled = true;
  let animation = null, committed = false;
  try {
    if (action === 'draw') animation = beginReveal();
    const response = await fetch(`${apiPrefix}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Token': session.token },
      body: JSON.stringify({ revision: session.state.revision, profileRevision:session.profileRevision, poolId: session.config.poolId, confirm: action !== 'draw', ...(exchange || {}) }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '操作失败。');
    session = payload;
    committed = true;
    if (animation) await animation.play(payload.state.lastRewards, cardData);
    status((action === 'exchange' ? `兑换成功：${cardData(exchange.cardId).name} · 已拥有。消耗 ${paymentText(groupFor(exchange.cardId).exchangeCost, exchange.confirmedUniversal)}。` : action === 'reset' ? '已重置本期测试进度，通用碎片余额不变。' : lastGrant() ? `保底补足 ${lastGrant()} 枚本期碎片，请选择缺卡兑换。` : '招募完成，卡牌与碎片已保存。') + (session.state.conversion ? ` ${conversionText()}` : ''));
  } catch (error) {
    if (animation) animation.close();
    // A response can be lost after the save succeeds. Refresh, never retry a draw automatically.
    try { await load(); } catch (_) { /* Keep last visible snapshot. */ }
    status((committed ? '结果已保存，动画未完成。' : error.message + ' 若网络中断，请确认当前进度后再操作。'), true);
  } finally {
    if (animation) animation.close();
    activeReveal = null; busy = false; $('confirm-reset').disabled = false; $('confirm-exchange').disabled = false; render();
    if (committed && action === 'draw') revealFinished();
    if (action === 'exchange') $('exchange-heading').focus({preventScroll:true});
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
for (const tab of $('collection-tabs').querySelectorAll('[role="tab"]')) {
  tab.addEventListener('click', () => {
    if (busy || !session) return;
    collectionCamp = tab.dataset.camp; render();
    tab.focus({preventScroll:true});
  });
  tab.addEventListener('keydown', event => {
    if (busy || !session || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...$('collection-tabs').querySelectorAll('[role="tab"]')].filter(item => !item.hidden && !item.disabled);
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.click();
  });
}
$('notice-details').addEventListener('click', () => {
  const lastExchange = session?.state.exchanges?.at(-1);
  $('notice-content').textContent = [$('status').textContent, session && conversionText(), lastGrant() ? `最近五连保底补足：${lastGrant()} 枚本期碎片（已入账，重播不重复发放）。` : '', lastExchange ? `最近兑换：${cardData(lastExchange.cardId).name}，消耗 ${paymentText(lastExchange.cost, lastExchange.universalUsed)}。` : ''].filter(Boolean).join('\n\n');
  $('notice-dialog').showModal();
});
$('replay').addEventListener('click', replay);
$('skip-reveal').addEventListener('click', () => activeReveal?.skip());
$('reveal-dialog').addEventListener('cancel', event => { event.preventDefault(); activeReveal?.skip(); });
reducedMotion.addEventListener('change', event => { if (event.matches) activeReveal?.skip(); });
$('draw').addEventListener('click', () => mutate('draw'));
$('reset').addEventListener('click', () => $('reset-dialog').showModal());
$('confirm-reset').addEventListener('click', () => { $('reset-dialog').close(); mutate('reset'); });
$('confirm-exchange').addEventListener('click', () => {
  if (busy || !pendingExchange) return;
  const exchange = pendingExchange; pendingExchange = null; $('exchange-dialog').close(); mutate('exchange', exchange);
});
$('exchange-dialog').addEventListener('close', () => { pendingExchange = null; });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('rules-button').addEventListener('click', () => {
  const root = $('rules-content'); root.replaceChildren();
  const table = element('table'), head = element('tr');
  for (const title of ['品质', '数量', '品质概率', '重复所得', '兑换消耗']) head.append(element('th', title));
  const thead = element('thead'); thead.append(head); table.append(thead); const body = element('tbody');
  for (const g of session.config.groups) { const row = element('tr'); [g.rarity, `${g.cardIds.length} 张`, `${g.weight / 100}%`, `${g.duplicateShards} 碎片`, `${g.exchangeCost} 碎片`].forEach(v => row.append(element('td', v))); body.append(row); }
  table.append(body); root.append(table, element('p', `先按品质权重抽取，再在该品质中等概率选一张。每张独立，可出现同名卡。橙卡即传说：品质概率 ${session.config.groups.find(g => g.rarity === '传说').weight / 100}%，首次五连也可能获得。重复卡显示的是本次实际获得的“+X 碎片”，不是库存。`),
    element('p', `保底只补本期碎片，不直接送卡、不占正常五张。${session.config.milestones.map(m => `第 ${m.spent / session.config.bundlePrice} 次五连：补足可兑换至 ${m.uniqueCards} 张所差的本期碎片`).join('；')}。按最便宜缺卡计算，每节点只结算一次，已有足额碎片则补 0。可自行选择兑换目标。`),
    element('p', `本期共 ${poolCardCount()} 张卡牌，所有国度共用同一奖池和本期碎片；国度页签只切换收集区展示，不改变抽取范围，也不按国度分别保底或结算。整套收集目标平均约 ${session.config.targetAverageCost} 测试元，允许超过均价。保留 ${session.config.testCredit} 测试元的兜底，届时本期碎片足够兑换全部缺卡，需手动确认兑换。兑换本身不花钱；集齐后停止抽取。平均成本随策略和通用碎片结余变化，不保证个人固定花费。`),
    element('p', `重复卡转为${session.config.shardName}，未集齐前仅本期可用。集齐全部卡牌（含兑换）后，整次奖励结算完再将剩余本期碎片按 10:1 转为通用碎片，向下取整、余数舍去。只转化一次，刷新或重播不重复赠送。通用碎片跨期保留，兑换时 1:1 抵任意期碎片，优先扣本期、再用通用补足，并确认两种消耗数量。兑换不增加累计消费、不推进消费保底。`),
    element('p', accountPage ? '本页与 Unity 使用相同 C# 核心。本页按 Web 测试账号保存，卡牌获得后可组卡；不提供重置，不接充值或真实支付。Unity 本机存档暂不与 Web 互通。' : '本页和 Unity 使用相同 C# 核心。浏览器与 Unity 的本地存档独立，无账号绑定、充值、真实支付和云同步。'));
  $('rules').showModal();
});
load().then(() => { if (!session.loadError) status(session.state.bundles ? `已恢复上次进度。${conversionText()}` : `已领取 ${session.config.testCredit} 测试元，可以开始招募。`); }).catch(error => status(error.message, true));
