'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const GachaReveal = require('./wwwroot/reveal.js');
const fs = require('node:fs');
const vm = require('node:vm');

const cards = [{id:'a',rarity:'普通'}, {id:'b',rarity:'传说'}, {id:'c',rarity:'史诗'}];
const rewards = Object.freeze([
  {cardId:'a',isNew:true,shards:0,guarantee:false},
  {cardId:'a',isNew:false,shards:5,guarantee:false},
  {cardId:'a',isNew:false,shards:5,guarantee:false},
  {cardId:'b',isNew:true,shards:0,guarantee:false},
  {cardId:'b',isNew:false,shards:100,guarantee:false},
  {cardId:'c',isNew:true,shards:0,guarantee:true}
].map(Object.freeze));
const cardFor = id => cards.find(c => c.id === id);
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(options = {}) {
  const events = [], timers = new Map(), durations = [];
  let id = 0;
  const view = Object.fromEntries(['open','waiting','deal','prepare','reveal','complete','close'].map(name => [name, (...args) => events.push({name,args})]));
  const animation = new GachaReveal(view, {
    setTimer(fn,ms) { const key = ++id; timers.set(key,fn); durations.push(ms); return key; },
    clearTimer(key) { timers.delete(key); }, ...options
  });
  return { animation,events,timers,durations,view,
    async tick() { await flush(); const first = timers.entries().next().value; if(first) { timers.delete(first[0]); first[1](); } await flush(); },
    async drain() { for(let n=0;n<40;n++) { await this.tick(); if(!timers.size) return; } assert.fail('Animation timers never completed'); }
  };
}
test('reveals all five draws plus bonus in exact order; legendary gets a longer pause', async () => {
  const h = harness(); h.animation.open(); const run = h.animation.play(rewards,cardFor);
  await h.drain(); await run;
  assert.deepEqual(h.events.find(e=>e.name==='deal').args,[6,1]);
  assert.deepEqual(h.events.filter(e=>e.name==='reveal').map(e=>e.args),rewards.map((r,i)=>[r,cardFor(r.cardId),i,false]));
  assert.deepEqual(h.durations,[650,450,420,420,420,700,2400,700,2400,380,1500,650]);
  assert.deepEqual(h.events.filter(e=>e.name==='prepare').map(e=>e.args),rewards.map((r,i)=>[r,cardFor(r.cardId),i,false]));
  assert.equal(h.events.at(-1).name,'close'); assert.equal(h.timers.size,0);
});
test('skip while waiting on the server reveals the later committed payload immediately', async () => {
  const h = harness(); h.animation.open(); h.animation.skip();
  assert.equal(h.events.filter(e=>e.name==='reveal').length,0);
  await h.animation.play(rewards,cardFor);
  assert.equal(h.durations.length,0);
  assert.ok(h.events.filter(e=>e.name==='reveal').every(e=>e.args[3]===true));
  assert.equal(h.events.filter(e=>e.name==='reveal').length,6);
});
test('skip during a flip flushes the remaining cards exactly once and clears pending timers', async () => {
  const h = harness(); const run = h.animation.play(rewards,cardFor);
  await h.tick(); await h.tick();
  assert.equal(h.events.filter(e=>e.name==='reveal').length,1);
  h.animation.skip(); h.animation.skip(); await run;
  assert.equal(h.events.filter(e=>e.name==='reveal').length,6);
  assert.equal(h.events.filter(e=>e.name==='close').length,1); assert.equal(h.timers.size,0);
});
test('reduced motion avoids opening an animated dialog or scheduling timers', async () => {
  const h = harness({reducedMotion:true}); h.animation.open(); await h.animation.play(rewards,cardFor);
  assert.equal(h.events.filter(e=>e.name==='open').length,0); assert.equal(h.durations.length,0);
  assert.equal(h.events.filter(e=>e.name==='complete').length,1);
});
test('replay is read-only and preserves duplicate shards and guarantee flags', async () => {
  const before = JSON.stringify(rewards);
  for(let i=0;i<2;i++) { const h=harness({reducedMotion:true}); await h.animation.play(rewards,cardFor); }
  assert.equal(JSON.stringify(rewards),before);
});
test('view exceptions still close the animation and release timers', async () => {
  const h = harness({reducedMotion:true}); h.view.reveal = () => { throw new Error('test renderer failure'); };
  await assert.rejects(h.animation.play(rewards,cardFor),/test renderer failure/);
  assert.equal(h.events.filter(e=>e.name==='close').length,1); assert.equal(h.timers.size,0);
});
test('close during pending animation prevents later visual callbacks; close is idempotent', async () => {
  const h = harness(); const run = h.animation.play(rewards,cardFor); h.animation.close(); h.animation.close(); await run;
  assert.deepEqual(h.events.map(e=>e.name),['close']); assert.equal(h.timers.size,0);
});
test('empty saved results close cleanly', async () => {
  const h=harness({reducedMotion:true}); await h.animation.play([],cardFor);
  assert.deepEqual(h.events.map(e=>e.name),['deal','complete','close']);
});
test('default browser timers are not invoked with the controller as their receiver', async () => {
  const scope = { module: {exports:{}},
    setTimeout: function(callback) { 'use strict'; assert.equal(this,undefined); return setTimeout(callback,0); },
    clearTimeout: function(timer) { 'use strict'; assert.equal(this,undefined); clearTimeout(timer); }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('./wwwroot/reveal.js'),'utf8'),scope);
  const h=harness(); const browserAnimation=new scope.module.exports(h.view);
  await browserAnimation.play([],cardFor);
  assert.equal(h.events.at(-1).name,'close');
});
test('each quality has explicit identity; epic and legendary get distinct closeups', () => {
  const profiles=['普通','稀有','史诗','传说','特殊'].map(GachaReveal.quality);
  assert.equal(new Set(profiles.map(p=>p.key)).size,5);
  assert.equal(new Set(profiles.map(p=>p.label)).size,5);
  assert.ok(profiles[3].hold > profiles[2].hold && profiles[2].hold > profiles[1].hold);
  assert.deepEqual(profiles.map(p=>p.featured),[false,false,true,true,false]);
});
test('skip during orange buildup still reveals all rewards and closes the focus', async () => {
  const h=harness(); const run=h.animation.play([rewards[3],rewards[5]],cardFor);
  await h.tick(); await h.tick();
  assert.equal(h.events.filter(e=>e.name==='prepare').length,1);
  assert.equal(h.events.filter(e=>e.name==='reveal').length,0);
  h.animation.skip(); await run;
  assert.deepEqual(h.events.filter(e=>e.name==='reveal').map(e=>e.args[0]),[rewards[3],rewards[5]]);
  assert.equal(h.events.at(-1).name,'close'); assert.equal(h.timers.size,0);
});
test('guaranteed orange retains its orange timing instead of the old short bonus pause', async () => {
  const h=harness(); const run=h.animation.play([{...rewards[3],guarantee:true}],cardFor);
  await h.drain(); await run;
  assert.deepEqual(h.durations,[650,450,700,2400,650]);
});
