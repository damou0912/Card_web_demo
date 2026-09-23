import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../..');
const dll = path.join(here, 'bin/Release/net8.0/GachaDemo.dll');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'card-gacha-test-'));
const save = path.join(temp, 'save.json');
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let server;
async function start() {
  let stderr = '';
  server = spawn('dotnet', [dll, 'serve', String(port), save], { cwd: project, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', bytes => { stderr += bytes; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${stderr}`)), 15000);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${stderr}`)); });
    server.stdout.on('data', bytes => { if (bytes.toString().includes('Gacha Demo:')) { clearTimeout(timeout); resolve(); } });
  });
}
async function stop() { if (!server || server.exitCode !== null) return; const exited = new Promise(resolve => server.once('exit', resolve)); server.kill(); await exited; }
async function snapshot() { const r = await fetch(origin + '/api/session'); assert.equal(r.status, 200); return r.json(); }
async function post(action, state, extra = {}, headers = {}) {
  return fetch(origin + '/api/' + action, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Demo-Token': state.token, ...headers }, body: JSON.stringify({ revision: state.state.revision, ...extra }) });
}
try {
  await start();
  let s = await snapshot();
  assert.equal(s.state.bundles, 0); assert.equal(s.config.groups.reduce((sum,g) => sum + g.cardIds.length,0), 10);
  for (const url of ['/', '/style.css', '/app.js', '/reveal.js']) assert.equal((await fetch(origin + url)).status, 200);
  assert.equal((await fetch(origin + '/Assets/Resources/Config/gacha-demo.json')).status, 404);
  assert.equal((await post('draw', s, {}, { Origin: 'https://elsewhere.test' })).status, 403);
  assert.equal((await post('draw', s, {}, { 'X-Demo-Token': 'wrong' })).status, 403);
  const duplicate = await Promise.all([post('draw', s), post('draw', s)]);
  assert.deepEqual(duplicate.map(r => r.status).sort(), [200, 409]);
  s = await snapshot(); assert.equal(s.state.bundles, 1); assert.equal(s.state.lastRewards.length, 5);
  const saved = await fs.readFile(save, 'utf8');
  await stop(); await start(); s = await snapshot();
  assert.deepEqual(s.state, JSON.parse(saved));
  assert.equal((await post('reset', s)).status, 400);
  while (s.state.owned.length < 10) {
    const result = await post('draw', s); assert.equal(result.status, 200); s = await result.json();
    assert.ok(s.state.bundles <= 25);
    if (s.state.bundles >= 15) assert.ok(s.state.owned.length >= 8);
    if (s.state.bundles >= 20) assert.ok(s.state.owned.length >= 9);
  }
  assert.equal((await post('draw', s)).status, 400);
  assert.equal((await post('reset', s, { confirm: true })).status, 200);
  s = await snapshot(); assert.equal(s.state.bundles, 0); assert.equal(s.state.owned.length, 0);
  // Keep a valid in-memory session while forcing replacement to fail.
  await fs.rename(save, save + '.parked'); await fs.mkdir(save);
  assert.equal((await post('draw', s)).status, 500);
  assert.equal((await snapshot()).state.bundles, 0);
  await fs.rmdir(save); await fs.rename(save + '.parked', save);
  console.log('PASS HTTP: same C# core, auth/origin checks, stale/double clicks, persisted restart, milestone progression, completion stop, reset, failed save rollback.');
} finally {
  await stop();
  // Only the verified, test-owned temporary directory is removed.
  assert.ok(temp.startsWith(path.join(os.tmpdir(), 'card-gacha-test-')) && path.dirname(save) === temp);
  await fs.rm(temp, { recursive: true, force: true });
}
