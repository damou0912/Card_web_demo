'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const gacha = require('./gacha-service');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
function tokenFrom(request) {
  return /(?:^|;\s*)card_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1] || '';
}
function reply(response, code, value, headers = {}) {
  response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(value));
}
async function readBody(request) {
  let data = '';
  for await (const chunk of request) {
    data += chunk;
    if (data.length > 8192) throw new Error('请求过大');
  }
  return JSON.parse(data);
}
module.exports = function accountRoutes(db, sanitizeCustomDeck, camps) {
  async function identity(request) {
    const token = tokenFrom(request);
    if (!token) return null;
    const record = await db.getAccountSession(hash(token));
    return record && record.expiresAt > Date.now() ? { username: record.username, token } : null;
  }
  async function handle(request, response, pathname) {
    const gachaPage = /^\/gacha(?:\/|$)/.test(pathname);
    const routed = gachaPage || pathname.startsWith('/api/gacha/') || pathname.startsWith('/api/custom-decks/')
      || ['/api/auth/login', '/api/auth/session', '/api/auth/logout', '/api/save-custom-deck', '/api/reset-custom-deck'].includes(pathname);
    if (!routed) return false;
    try {
      if (gachaPage) {
        if (pathname === '/gacha') { response.writeHead(302, { Location: '/gacha/' }); response.end(); return true; }
        const names = { '/gacha': 'index.html', '/gacha/': 'index.html', '/gacha/style.css': 'style.css', '/gacha/app.js': 'app.js', '/gacha/reveal.js': 'reveal.js' };
        const filename = names[pathname];
        if (request.method !== 'GET' || !filename) { reply(response, 404, { error: 'Not found' }); return true; }
        const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
        response.writeHead(200, { 'Content-Type': types[path.extname(filename)] + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
        response.end(fs.readFileSync(path.join(__dirname, 'UnityCard_demo/Tools/GachaDemo/wwwroot', filename)));
        return true;
      }
      if (request.method === 'POST' && request.headers.origin && new URL(request.headers.origin).host !== request.headers.host)
        { reply(response, 403, { error: '请从游戏页面操作。' }); return true; }
      if (pathname === '/api/auth/login' && request.method === 'POST') {
        const { username, password } = await readBody(request);
        if (typeof username !== 'string' || !/^(player(?:[1-9]|10)|admin)$/.test(username) || typeof password !== 'string' || password.length > 200)
          { reply(response, 401, { error: '用户名或密码错误' }); return true; }
        const result = await db.loginUser(username, password);
        if (!result?.success) { reply(response, 401, { error: '用户名或密码错误' }); return true; }
        const token = crypto.randomBytes(32).toString('hex');
        await db.putAccountSession(hash(token), username, Date.now() + 7 * 86400000);
        const secure = request.socket.encrypted || request.headers['x-forwarded-proto'] === 'https';
        reply(response, 200, { success: true, username }, { 'Set-Cookie': `card_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure ? '; Secure' : ''}` });
        return true;
      }
      const user = await identity(request);
      if (!user) { reply(response, 401, { error: '请返回主界面重新登录，再进入招募或修改卡组。' }); return true; }
      if (pathname === '/api/auth/session' && request.method === 'GET') { reply(response, 200, { username: user.username }); return true; }
      if (pathname === '/api/auth/logout' && request.method === 'POST') {
        await db.deleteAccountSession(hash(user.token));
        reply(response, 200, { success: true }, { 'Set-Cookie': 'card_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' }); return true;
      }
      if (pathname.startsWith('/api/gacha/')) {
        const action = pathname.slice('/api/gacha/'.length);
        if (!((request.method === 'GET' && action === 'session') || (request.method === 'POST' && ['draw', 'exchange'].includes(action))))
          { reply(response, 405, { error: '账号招募不支持重置。' }); return true; }
        if (request.method === 'POST' && request.headers['x-demo-token'] !== user.token)
          { reply(response, 403, { error: '验证已过期，请刷新。' }); return true; }
        const body = action === 'session' ? {} : await readBody(request);
        const previous = await db.getGachaProfile(user.username);
        const result = await gacha.run(previous, action, body);
        // Compare-and-swap saves the whole ledger and ownership in ONE database operation.
        if (JSON.stringify(previous) !== JSON.stringify(result.profile)
            && !await db.saveGachaProfile(user.username, previous?.revision ?? null, result.profile))
          { reply(response, 409, { error: '另一页面已更新进度，请刷新后重试。' }); return true; }
        reply(response, 200, { ...result.snapshot, username: user.username, token: user.token }); return true;
      }
      if (pathname.startsWith('/api/custom-decks/') && request.method === 'GET') {
        if (pathname.slice('/api/custom-decks/'.length) !== user.username) { reply(response, 403, { error: '账号不匹配' }); return true; }
        const [decks, profile] = await Promise.all([db.getCustomDecks(user.username), db.getGachaProfile(user.username)]);
        reply(response, 200, { success: true, decks, ownedExtraCardIds: [...gacha.ownedExtraIds(profile)] }); return true;
      }
      if (request.method === 'POST' && ['/api/save-custom-deck', '/api/reset-custom-deck'].includes(pathname)) {
        const body = await readBody(request);
        if (body.username !== user.username || !camps.has(body.camp)) { reply(response, 403, { error: '账号或势力不匹配' }); return true; }
        if (pathname === '/api/reset-custom-deck') { reply(response, 200, await db.resetCustomDeck(user.username, body.camp)); return true; }
        const deck = sanitizeCustomDeck(body.camp, body.deckData);
        if (!deck || !gacha.canUseDeck(deck.cardIds, await db.getGachaProfile(user.username)))
          { reply(response, 400, { error: '卡组包含未获得的额外卡，请先招募或兑换。' }); return true; }
        reply(response, 200, await db.saveCustomDeck(user.username, body.camp, deck)); return true;
      }
      reply(response, 405, { error: '不支持的请求' });
    } catch (error) { reply(response, 400, { error: error.message || '服务暂不可用，数据未变更。' }); }
    return true;
  }
  return { handle, identity };
};
