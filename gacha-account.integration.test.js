'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const WebSocket = require('ws');
const catalog = require('./UnityCard_demo/Assets/Resources/Data/web-card-catalog.json');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-account-test-'));
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const dataFile = path.join(temp, 'data.json');
  const child = spawn(process.execPath, ['railway-server.js'], { cwd: __dirname,
    env: { ...process.env, DATABASE_URL: '', PORT: String(port), HOST: '127.0.0.1', GAME_DATA_FILE: dataFile }, stdio: ['ignore','pipe','pipe'], windowsHide: true });
  const clients = [];
  const call = async (route, method = 'GET', body, cookie = '', token = '') => {
    const response = await fetch(base + route, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Demo-Token': token }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let value; try { value = JSON.parse(text); } catch (_) { value = text; }
    return { status: response.status, body: value, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  };
  const payload = session => ({ poolId: session.config.poolId, revision: session.state.revision, profileRevision: session.profileRevision });
  try {
    for (let tries = 0; ; tries++) {
      try { if ((await call('/health')).status === 200) break; } catch (_) {}
      if (tries > 100) throw new Error('Server did not start');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal((await call('/api/gacha/session')).status, 401);
    for (const route of ['/game-data.json', '/.env', '/db.js', '/output/faction-badge-config/catalog-before-consolidation.json', '/UnityCard_demo/Artifacts/GachaDemo/browser-profile.json'])
      assert.equal((await call(route)).status, 404);
    for (const route of ['/','/gacha/','/gacha/app.js','/gacha/style.css','/gacha/reveal.js']) assert.equal((await call(route)).status, 200);
    const login = await call('/api/auth/login', 'POST', { username: 'player1', password: 'password123' });
    assert.equal(login.status, 200); const cookie = login.cookie;
    const login2 = await call('/api/auth/login', 'POST', { username: 'player2', password: 'password123' });
    const read = async () => (await call('/api/gacha/session', 'GET', undefined, cookie)).body;
    let session = await read(); const token = session.token;
    assert.equal(session.state.owned.length, 0); assert.equal(session.universalBalance, 0);
    assert.equal(session.cards.length, 30); assert.equal(session.ownedCardIds.length, 0);
    const defaultIds = catalog.defaultCardIds.filter(id => id.startsWith('01'));
    const locked = [...defaultIds]; locked[0] = '01121';
    const deckBody = ids => ({ username: 'player1', camp: '三国~蜀', deckData: { version: 2, cardIds: ids } });
    assert.equal((await call('/api/save-custom-deck', 'POST', deckBody(locked), cookie)).status, 400);
    assert.equal((await call('/api/save-custom-deck', 'POST', deckBody(defaultIds), cookie)).status, 200);
    assert.equal((await call('/api/save-custom-deck', 'POST', deckBody(defaultIds), login2.cookie)).status, 403);
    assert.equal((await call('/api/gacha/draw', 'POST', payload(session), cookie)).status, 403);
    assert.equal((await call('/api/gacha/reset', 'POST', payload(session), cookie, token)).status, 405);
    const concurrent = await Promise.all([1,2].map(() => call('/api/gacha/draw', 'POST', payload(session), cookie, token)));
    assert.equal(concurrent.filter(result => result.status === 200).length, 1);
    session = await read(); assert.equal(session.state.bundles, 1);
    assert.equal((await call('/api/gacha/session', 'GET', undefined, login2.cookie)).body.state.owned.length, 0);
    // Acquire enough fragments through genuine draws, then exchange a still-missing card.
    for (let attempts = 0; attempts < 60; attempts++) {
      const affordable = session.cards.find(card => !session.state.owned.some(entry => entry.cardId === card.id)
        && session.config.groups.find(group => group.cardIds.includes(card.id)).exchangeCost <= session.shardBalance);
      if (affordable) {
        const result = await call('/api/gacha/exchange', 'POST', { ...payload(session), cardId: affordable.id, confirm: true, confirmedUniversal: 0 }, cookie, token);
        assert.equal(result.status, 200); session = result.body;
        assert.ok(session.ownedCardIds.includes(affordable.id)); break;
      }
      const result = await call('/api/gacha/draw', 'POST', payload(session), cookie, token);
      assert.equal(result.status, 200); session = result.body;
    }
    assert.ok(session.state.exchanges.length > 0);
    const won = session.cards.find(card => card.id === session.state.owned[0].cardId);
    const ids = catalog.defaultCardIds.filter(id => id.slice(0,2) === won.id.slice(0,2));
    ids[ids.findIndex(id => id[2] === won.id[2])] = won.id;
    const save = { username: 'player1', camp: won.camp, deckData: { version: 2, cardIds: ids } };
    assert.equal((await call('/api/save-custom-deck', 'POST', save, cookie)).status, 200);
    assert.ok((await call('/api/custom-decks/player1', 'GET', undefined, cookie)).body.ownedExtraCardIds.includes(won.id));
    // Online guest cannot submit an extra deck. The authenticated owner can.
    async function socketTest(accountCookie, shouldAccept) {
      const socket = new WebSocket(base.replace('http:', 'ws:'), { headers: { Cookie: accountCookie } }); clients.push(socket);
      const wait = type => new Promise((resolve, reject) => {
        const timer = setTimeout(() => { socket.off('message', on); reject(new Error('WS timeout: ' + type)); }, 4000);
        const on = raw => { const value = JSON.parse(raw); if (value.type === type) { clearTimeout(timer); socket.off('message', on); resolve(value); } };
        socket.on('message', on);
      });
      await once(socket, 'open');
      const created = wait('room-created'); socket.send(JSON.stringify({ type:'create-room', playerName:'Inventory', boardSize:4 })); await created;
      const answer = wait(shouldAccept ? 'room-state' : 'error');
      socket.send(JSON.stringify({ type:'set-deck', deckKey: won.camp, deckCardIds:ids }));
      await answer; socket.send(JSON.stringify({ type:'leave-room' })); socket.close();
    }
    await socketTest('', false); await socketTest(cookie, true);
    const before = JSON.parse(fs.readFileSync(dataFile)).gachaProfiles.player1;
    assert.equal(before.pools[0].bundles, session.state.bundles);
    const again = await read(); assert.equal(again.profileRevision, session.profileRevision);
    assert.equal((await call('/api/auth/logout', 'POST', {}, cookie)).status, 200);
    assert.equal((await call('/api/gacha/session', 'GET', undefined, cookie)).status, 401);
    console.log('PASS account recruitment: zero extras, account isolation, actual draw/exchange unlock, concurrent CAS, base decks, locked/owned online decks, private files, logout, persistence.');
  } finally {
    clients.forEach(client => client.terminate());
    child.kill(); await once(child, 'exit');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
