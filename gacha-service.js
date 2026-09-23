'use strict';
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const config = require('./UnityCard_demo/Assets/Resources/Config/gacha-demo.json');
const catalog = require('./UnityCard_demo/Assets/Resources/Data/web-card-catalog.json').cards;
const extraIds = new Set(config.groups.flatMap(group => group.cardIds));
const cardIds = new Set(catalog.map(card => card.id));
let worker, pending = [], queue = Promise.resolve();
function startWorker() {
  const root = path.join(__dirname, 'UnityCard_demo');
  const dll = process.env.GACHA_SERVICE_DLL || path.join(root, 'Tools/GachaService/bin/Release/net8.0/GachaService.dll');
  if (!fs.existsSync(dll)) throw new Error('招募服务尚未构建，请运行 dotnet build UnityCard_demo/Tools/GachaService -c Release。');
  worker = spawn('dotnet', [dll, root], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const child = worker;
  child.stderr.on('data', () => {});
  const fail = () => {
    if (worker !== child) return;
    worker = null;
    pending.splice(0).forEach(item => item.reject(new Error('招募服务暂时不可用，数据未变更。')));
  };
  child.on('error', fail); child.on('exit', fail);
  child.stdin.on('error', fail);
  readline.createInterface({ input: child.stdout }).on('line', line => {
    const item = pending.shift();
    if (!item) return;
    try { const result = JSON.parse(line); result.error ? item.reject(new Error(result.error)) : item.resolve(result); }
    catch (error) { item.reject(error); }
  });
}
function run(profile, action = 'session', body = {}) {
  const result = queue.then(() => new Promise((resolve, reject) => {
    if (!worker) startWorker();
    const timer = setTimeout(() => { worker?.kill(); }, 15000);
    pending.push({ resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    worker.stdin.write(JSON.stringify({ profile, action, body }) + '\n');
  }));
  queue = result.catch(() => {}); return result;
}
function ownedExtraIds(profile) {
  return new Set([...(profile?.pools || []), ...(profile?.archivedRuns || [])]
    .flatMap(pool => pool.owned || []).map(card => card.cardId).filter(id => extraIds.has(id)));
}
function canUseDeck(ids, profile) {
  const owned = ownedExtraIds(profile);
  return ids.every(id => cardIds.has(id) && (!extraIds.has(id) || owned.has(id)));
}
process.on('exit', () => worker?.kill());
module.exports = { run, ownedExtraIds, canUseDeck, cardIds, extraIds };
