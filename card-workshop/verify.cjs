'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function engine(patch) {
  const s = { console: { log() {}, warn() {}, error() {} }, URL, URLSearchParams };
  vm.createContext(s);
  const load = file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), s, { filename: file, timeout: 5000 });
  load('card-workshop/engine-harness.js'); vm.runInContext('installWorkshopEngineHarness(globalThis)', s);
  for (const file of ['shu-card-effects.js', 'wei-card-effects.js', 'wu-card-effects.js', 'elite-ai-info.js', 'elite-ai-effects.js', 'card-info.js', 'replacement-cards.js', 'v2-card-data.js']) load(file);
  if (patch) vm.runInContext(patch, s, { timeout: 5000 });
  for (const file of ['script.js', 'core-v2.js', 'core-v2.test-suite.js']) load(file);
  return s;
}
function regression(s) {
  return JSON.parse(JSON.stringify(vm.runInContext('[runCoreV2RegressionTests(), runCoreV2CardBoundaryTests()]', s, { timeout: 10000 })));
}
module.exports = { engine, regression };
