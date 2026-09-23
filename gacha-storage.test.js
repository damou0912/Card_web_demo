'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test('JSON account save: stale writes rejected, atomic failure keeps old ledger, restart retains state', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gacha-storage-'));
  const previousPath = process.env.GAME_DATA_FILE;
  process.env.GAME_DATA_FILE = path.join(directory, 'data.json');
  const dbPath = require.resolve('./db');
  delete require.cache[dbPath];
  const db = require('./db');
  const rename = fs.renameSync;
  try {
    const first = { revision: 0, pools: [], archivedRuns: [] };
    assert.equal(db.getGachaProfile('player1'), null);
    assert.equal(db.saveGachaProfile('player1', null, first), true);
    assert.equal(db.saveGachaProfile('player1', null, { revision: 1 }), false);
    const next = { ...first, revision: 1 };
    fs.renameSync = () => { throw new Error('simulated disk failure'); };
    assert.throws(() => db.saveGachaProfile('player1', 0, next), /disk failure/);
    assert.deepEqual(db.getGachaProfile('player1'), first);
    fs.renameSync = rename;
    assert.equal(db.saveGachaProfile('player1', 0, next), true);
    assert.equal(db.getGachaProfile('player2'), null);
    delete require.cache[dbPath];
    assert.deepEqual(require('./db').getGachaProfile('player1'), next);
    assert.ok(fs.existsSync(process.env.GAME_DATA_FILE));
  } finally {
    fs.renameSync = rename;
    if (previousPath === undefined) delete process.env.GAME_DATA_FILE; else process.env.GAME_DATA_FILE = previousPath;
    delete require.cache[dbPath];
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
