'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('./server.cjs');

test('read-only local server serves only editor assets', async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const asset of ['/', '/index.html', '/style.css', '/model.js', '/presets.js', '/app.js', '/web-effects.js', '/web-editor.js', '/verify-worker.js', '/engine-harness.js', '/runtime/core-v2.js']) {
      const response = await fetch(origin + asset); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    for (const forbidden of ['/server.cjs', '/../game-data.json', '/.env', '/model.test.cjs', '/preset-definitions.cjs', '/build-presets.cjs', '/..%2f.env', '/api/save', '/runtime/account-routes.js', '/runtime/db.js', '/runtime/../.env']) assert.equal((await fetch(origin + forbidden)).status, 404);
    assert.match((await fetch(origin + '/verify-worker.js')).headers.get('content-security-policy'), /connect-src 'none'/);
    assert.equal((await fetch(origin, { method: 'POST', body: '{}' })).status, 405);
    assert.equal((await fetch(origin, { method: 'HEAD' })).status, 200);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
