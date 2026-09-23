import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const dll = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'bin/Release/net8.0/GachaDemo.dll');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'card-gacha-test-'));
const save = path.join(temp, 'save.json');
const liveConfig = path.join(project, 'Assets/Resources/Config/gacha-demo.json');
const previousConfig = path.join(here, 'fixtures/shu-demo-v1.json');
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let server;
async function start(configPath = previousConfig) {
  let stderr = '';
  server = spawn('dotnet', [dll, 'serve', String(port), save, ...(configPath ? [configPath] : [])], { cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', bytes => { stderr += bytes; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 15000);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${stderr}`)); });
    server.stdout.on('data', bytes => { if (bytes.toString().includes('Gacha Demo:')) { clearTimeout(timeout); resolve(); } });
  });
}
async function stop() {
  const running = server; server = null;
  if (!running || running.exitCode !== null || running.signalCode !== null) return;
  const exited = new Promise(resolve => running.once('exit', resolve)); running.kill(); await exited;
}
async function snapshot() { const r = await fetch(origin + '/api/session'); assert.equal(r.status, 200); return r.json(); }
async function post(action, state, extra = {}, headers = {}) {
  return fetch(origin + '/api/' + action, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Demo-Token': state.token, ...headers }, body: JSON.stringify({ revision: state.state.revision, profileRevision: state.profileRevision, poolId: state.config.poolId, confirmedUniversal: 0, ...extra }) });
}
try {
  await start(liveConfig);
  let s = await snapshot();
  assert.equal(s.state.bundles, 0); assert.equal(s.config.groups.reduce((sum,g) => sum + g.cardIds.length,0), 30);
  assert.equal(s.config.poolId, 'three-kingdoms-extra-v1');
  assert.equal(s.state.poolCardCount, 30); assert.equal(s.state.schemaVersion, 5);
  assert.equal(s.config.testCredit, 3000); assert.equal(s.config.targetAverageCost, 1500);
  for (const camp of ['三国~魏', '三国~蜀', '三国~吴']) assert.equal(s.cards.filter(c => c.camp === camp).length, 10);
  assert.equal(s.config.groups.find(g => g.rarity === '传说').weight, 48);
  assert.equal(s.config.groups.find(g => g.rarity === '传说').exchangeCost, 1800);
  for (const url of ['/', '/style.css', '/app.js', '/reveal.js']) assert.equal((await fetch(origin + url)).status, 200);
  assert.equal((await fetch(origin + '/Assets/Resources/Config/gacha-demo.json')).status, 404);
  assert.equal((await post('draw', s, {}, { Origin: 'https://elsewhere.test' })).status, 403);
  assert.equal((await post('draw', s, {}, { 'X-Demo-Token': 'wrong' })).status, 403);
  assert.equal((await post('draw', s, { poolId: 'shu-demo-v2' })).status, 409);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 400);
  const duplicate = await Promise.all([post('draw', s), post('draw', s)]);
  assert.deepEqual(duplicate.map(r => r.status).sort(), [200, 409]);
  s = await snapshot(); assert.equal(s.state.bundles, 1); assert.equal(s.state.lastRewards.length, 5);
  const saved = await fs.readFile(save, 'utf8');
  await stop(); await start(liveConfig); s = await snapshot();
  assert.deepEqual(s.state, JSON.parse(saved).pools[0]);
  assert.equal((await post('reset', s)).status, 400);
  while (s.state.owned.length < 30) {
    const result = await post('draw', s); assert.equal(result.status, 200); s = await result.json();
    assert.ok(s.state.bundles <= s.config.testCredit / s.config.bundlePrice);
    assert.equal(s.state.lastRewards.length, 5);
    assert.ok(s.state.lastRewards.every(r => !r.guarantee));
    assert.equal(s.state.shardGrants.length, s.config.milestones.filter(m => m.spent <= s.state.bundles * s.config.bundlePrice).length);
    if (s.state.bundles === s.config.testCredit / s.config.bundlePrice) {
      const missing = s.config.groups.flatMap(g => g.cardIds.filter(id => !s.state.owned.some(c => c.cardId === id)).map(cardId => ({cardId, cost:g.exchangeCost})));
      assert.ok(s.shardBalance >= missing.reduce((sum, c) => sum + c.cost, 0));
      for (const {cardId} of missing) {
        const result = await post('exchange', s, {confirm:true, cardId}); assert.equal(result.status, 200); s = await result.json();
        if (s.state.owned.length < 30) assert.equal(s.state.conversion, null);
      }
    }
  }
  assert.equal((await post('draw', s)).status, 400);
  const conversion = s.state.conversion;
  assert.equal(s.shardBalance, 0); assert.equal(s.universalBalance, Math.floor(conversion.sourceShards / 10));
  const completedUniversal = s.universalBalance;
  await stop(); await start(liveConfig); s = await snapshot();
  assert.equal(s.universalBalance, completedUniversal); assert.deepEqual(s.state.conversion, conversion);
  assert.equal((await post('reset', s, { confirm: true })).status, 200);
  s = await snapshot(); assert.equal(s.state.bundles, 0); assert.equal(s.state.owned.length, 0); assert.equal(s.universalBalance, completedUniversal);
  // Keep a valid in-memory session while forcing replacement to fail.
  await fs.rename(save, save + '.parked'); await fs.mkdir(save);
  assert.equal((await post('draw', s)).status, 500);
  assert.equal((await snapshot()).state.bundles, 0);
  await fs.rmdir(save); await fs.rename(save + '.parked', save);
  // Legacy fixture lives only in this test-owned temporary directory. Loading must never rewrite it.
  await stop();
  await start(); s = await snapshot(); await stop();
  const fixture = {
    schemaVersion: 1, poolId: s.config.poolId, revision: 5, bundles: 5,
    owned: [{ cardId: '01121', shards: 120 }],
    lastRewards: Array.from({ length: 5 }, () => ({ cardId: '01121', isNew: false, shards: 5, guarantee: false }))
  };
  await fs.writeFile(save, JSON.stringify(fixture));
  const legacyBytes = await fs.readFile(save, 'utf8');
  await start(); s = await snapshot();
  assert.equal(s.state.schemaVersion, 5); assert.equal(s.state.poolCardCount, 10); assert.equal(s.shardBalance, 120); assert.equal(s.universalBalance, 0);
  assert.deepEqual(s.state.exchanges, []); assert.equal(await fs.readFile(save, 'utf8'), legacyBytes);
  assert.equal((await post('exchange', s, { cardId: '01122' })).status, 400);
  assert.equal((await post('exchange', s, { confirm: true, cardId: 'unknown' })).status, 400);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01121' })).status, 400);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01225', cost: 0 })).status, 400);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122', poolId: 'shu-demo-v2' })).status, 409);
  assert.equal((await post('reset', s, { confirm: true, poolId: 'shu-demo-v2' })).status, 409);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' }, { Origin: 'https://elsewhere.test' })).status, 403);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' }, { 'X-Demo-Token': 'wrong' })).status, 403);
  assert.deepEqual((await snapshot()).state, s.state);
  await fs.rename(save, save + '.exchange-parked'); await fs.mkdir(save);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 500);
  assert.deepEqual((await snapshot()).state, s.state); assert.equal((await snapshot()).shardBalance, 120);
  await fs.rmdir(save); await fs.rename(save + '.exchange-parked', save);
  const exchangeResults = await Promise.all([
    post('exchange', s, { confirm: true, cardId: '01122', cost: 0 }),
    post('exchange', s, { confirm: true, cardId: '01122', cost: 0 })
  ]);
  assert.deepEqual(exchangeResults.map(r => r.status).sort(), [200, 409]);
  s = await snapshot();
  assert.equal(s.shardBalance, 20); assert.equal(s.state.owned.length, 2);
  assert.equal(s.state.bundles, 5); assert.equal(s.state.revision, 6);
  assert.deepEqual(s.state.exchanges, [{ cardId: '01122', cost: 100, universalUsed: 0 }]);
  assert.deepEqual(s.state.lastRewards, fixture.lastRewards);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 400);
  const afterExchange = s;
  await stop(); await start(); s = await snapshot();
  assert.deepEqual(s.state, afterExchange.state); assert.equal(s.shardBalance, 20);
  assert.equal((await post('draw', s)).status, 200); s = await snapshot();
  assert.equal(s.state.bundles, 6); assert.deepEqual(s.state.exchanges, afterExchange.state.exchanges);
  assert.equal(s.shardBalance, s.state.owned.reduce((sum, c) => sum + c.shards, 0) - 100);
  assert.equal((await post('reset', s, { confirm: true })).status, 200); s = await snapshot();
  assert.equal(s.shardBalance, 0); assert.deepEqual(s.state.exchanges, []);
  await stop();
  await fs.writeFile(save, JSON.stringify({ ...fixture, poolId: 'shu-demo-v2' }));
  const foreignBytes = await fs.readFile(save, 'utf8');
  await start(); s = await snapshot();
  assert.ok(s.loadError); assert.equal(s.shardBalance, 0);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 409);
  assert.equal((await post('draw', s)).status, 409); assert.equal(await fs.readFile(save, 'utf8'), foreignBytes);
  assert.equal((await post('reset', s, { confirm: true })).status, 409);
  await stop();
  const ids = s.config.groups.flatMap(g => g.cardIds);
  const completedLegacy = {
    ...fixture, schemaVersion: 2, bundles: 25, revision: 25, exchanges: [],
    owned: ids.map(cardId => ({ cardId, shards: cardId === '01225' ? 1505 : 0 })),
    lastRewards: Array.from({ length: 5 }, () => ({ cardId: '01225', isNew: false, shards: 15, guarantee: false }))
  };
  await fs.writeFile(save, JSON.stringify(completedLegacy));
  await start(); s = await snapshot();
  assert.equal(s.shardBalance, 0); assert.equal(s.universalBalance, 150);
  assert.deepEqual(s.state.conversion, { sourceShards: 1505, universalShards: 150 });
  assert.equal(JSON.parse(await fs.readFile(save, 'utf8')).pools.length, 1);
  const convertedProfile = await fs.readFile(save, 'utf8');
  await stop(); await start(); s = await snapshot();
  assert.equal(s.universalBalance, 150); assert.equal(await fs.readFile(save, 'utf8'), convertedProfile);
  await stop();
  // A new period opens the same profile with separate cards but the shared universal wallet.
  const secondConfigPath = path.join(temp, 'second-config.json');
  await fs.writeFile(secondConfigPath, JSON.stringify({ ...s.config, poolId: 'shu-demo-v2', shardName: '蜀汉·第二期碎片' }));
  await start(secondConfigPath); s = await snapshot();
  assert.equal(s.state.owned.length, 0); assert.equal(s.state.bundles, 0); assert.equal(s.universalBalance, 150);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 400); // Universal use must be confirmed.
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 100, profileRevision: s.profileRevision + 1 })).status, 409);
  await fs.rename(save, save + '.universal-parked'); await fs.mkdir(save);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 100 })).status, 500);
  assert.equal((await snapshot()).universalBalance, 150); assert.equal((await snapshot()).state.owned.length, 0);
  await fs.rmdir(save); await fs.rename(save + '.universal-parked', save);
  const universalDouble = await Promise.all([
    post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 100 }),
    post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 100 })
  ]);
  assert.deepEqual(universalDouble.map(r => r.status).sort(), [200, 409]);
  s = await snapshot(); assert.equal(s.universalBalance, 50); assert.equal(s.shardBalance, 0); assert.equal(s.state.bundles, 0);
  assert.equal(s.state.lastRewards.length, 0); assert.equal(s.state.exchanges[0].universalUsed, 100);
  await stop(); await start(); s = await snapshot();
  assert.equal(s.state.owned.length, 10); assert.equal(s.universalBalance, 50); // Returning to first period cannot recredit.
  await stop(); await start(secondConfigPath); s = await snapshot();
  assert.equal(s.state.owned.length, 1); assert.equal(s.universalBalance, 50);
  assert.equal((await post('reset', s, { confirm: true })).status, 200); s = await snapshot();
  assert.equal(s.state.owned.length, 0); assert.equal(s.universalBalance, 50);
  await stop();
  // Mixed payment with only the last common missing: 95 local + 5 universal, then settle zero remainder.
  const wallet = JSON.parse(await fs.readFile(save, 'utf8'));
  wallet.pools[1] = { ...fixture, schemaVersion: 3, poolId: 'shu-demo-v2', bundles: 20, revision: 20, exchanges: [], conversion: null,
    owned: ids.filter(id => id !== '01122').map(cardId => ({ cardId, shards: cardId === '01121' ? 95 : 0 })) };
  await fs.writeFile(save, JSON.stringify(wallet)); await start(secondConfigPath); s = await snapshot();
  assert.equal(s.shardBalance, 95); assert.equal(s.universalBalance, 50);
  const beforeMixedReplay = s.state.lastRewards;
  await fs.rename(save, save + '.settlement-parked'); await fs.mkdir(save);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 5 })).status, 500);
  const failedSettlement = await snapshot();
  assert.equal(failedSettlement.shardBalance, 95); assert.equal(failedSettlement.universalBalance, 50);
  assert.equal(failedSettlement.state.owned.length, 9); assert.equal(failedSettlement.state.conversion, null);
  await fs.rmdir(save); await fs.rename(save + '.settlement-parked', save);
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122', confirmedUniversal: 5 })).status, 200);
  s = await snapshot(); assert.equal(s.universalBalance, 45); assert.equal(s.shardBalance, 0); assert.equal(s.state.owned.length, 10);
  assert.deepEqual(s.state.lastRewards, beforeMixedReplay); assert.equal(s.state.bundles, 20);
  assert.deepEqual(s.state.conversion, { sourceShards: 0, universalShards: 0 });
  await stop(); await start(secondConfigPath); s = await snapshot(); assert.equal(s.universalBalance, 45);
  // A funded legacy completed pool with a nonzero remainder must settle during final exchange too.
  await stop();
  const localFinish = { ...fixture, schemaVersion: 2, bundles: 20, revision: 20, exchanges: [],
    owned: ids.filter(id => id !== '01122').map(cardId => ({ cardId, shards: cardId === '01121' ? 215 : 0 })) };
  await fs.writeFile(save, JSON.stringify(localFinish)); await start(); s = await snapshot();
  assert.equal((await post('exchange', s, { confirm: true, cardId: '01122' })).status, 200); s = await snapshot();
  assert.deepEqual(s.state.conversion, { sourceShards: 115, universalShards: 11 }); assert.equal(s.universalBalance, 11);
  await stop();
  // The former 500 ceiling must not lock a real migrated profile or claw back its earned grants.
  const oldAt500 = { ...fixture, schemaVersion:4, bundles:25, revision:25, exchanges:[],
    owned:[{cardId:'01121',shards:620}], conversionDone:false, conversion:null,
    shardGrants:[{bundles:15,amount:1630},{bundles:20,amount:875},{bundles:25,amount:1175}] };
  await fs.writeFile(save, JSON.stringify(oldAt500)); await start(); s = await snapshot();
  assert.equal(s.loadError,null); assert.equal(s.shardBalance,4300);
  assert.equal((await post('draw',s)).status,200); s=await snapshot();
  assert.equal(s.state.bundles,26); assert.deepEqual(s.state.shardGrants,oldAt500.shardGrants);
  const newOrangeQuote = s.config.groups.find(g=>g.rarity==='传说').exchangeCost;
  if (!s.state.owned.some(c=>c.cardId==='01429')) {
    const balance = s.shardBalance;
    assert.equal((await post('exchange',s,{confirm:true,cardId:'01429'})).status,200); s=await snapshot();
    assert.equal(s.shardBalance,balance-newOrangeQuote); assert.equal(s.state.bundles,26);
  }
  await stop();
  // The new shared pool lives beside (not inside) the former ten-card period.
  const preserved = JSON.parse(await fs.readFile(save, 'utf8')).pools[0];
  await start(liveConfig); s = await snapshot();
  assert.equal(s.loadError, null); assert.equal(s.state.owned.length, 0);
  assert.equal(s.state.poolCardCount, 30); assert.equal(s.shardBalance, 0);
  assert.equal((await post('draw', s)).status, 200); s = await snapshot();
  const bothPools = JSON.parse(await fs.readFile(save, 'utf8')).pools;
  assert.equal(bothPools.length, 2); assert.deepEqual(bothPools.find(p => p.poolId === preserved.poolId), preserved);
  await stop(); await start(); s = await snapshot();
  assert.deepEqual(s.state, preserved); // Same legacy balance, cards, paid prices and grants.
  await stop();
  assert.equal((await fs.readdir(temp)).some(name => name.endsWith('.tmp')), false);
  console.log('PASS HTTP: auth, revisions, draw/exchange double-clicks, legacy migrations, completion conversion once, floor/remainder, universal confirmation, cross-period shared wallet, mixed/full payments, restart, reset no refund, atomic failure rollback.');
} finally {
  await stop();
  // Only the verified, test-owned temporary directory is removed.
  assert.ok(temp.startsWith(path.join(os.tmpdir(), 'card-gacha-test-')) && path.dirname(save) === temp);
  await fs.rm(temp, { recursive: true, force: true });
}
