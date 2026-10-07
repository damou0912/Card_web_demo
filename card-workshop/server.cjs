'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/presets.js', ['presets.js', 'text/javascript; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']]
]);
for (const [url, [file, type]] of require('../card-designer/server.cjs').assets) publicFiles.set('/appearance' + url, [path.relative(__dirname, file), type]);
for (const file of ['web-effects.js', 'web-editor.js', 'engine-harness.js', 'verify-worker.js']) publicFiles.set('/' + file, [file, 'text/javascript; charset=utf-8']);
// Only these public game scripts can be read by the isolated regression worker.
for (const file of ['shu-card-effects.js', 'wei-card-effects.js', 'wu-card-effects.js', 'elite-ai-info.js', 'elite-ai-effects.js', 'card-info.js', 'replacement-cards.js', 'v2-card-data.js', 'script.js', 'core-v2.js', 'core-v2.test-suite.js']) publicFiles.set('/runtime/' + file, ['../' + file, 'text/javascript; charset=utf-8']);
function createServer() {
  return http.createServer((request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    // This is a read-only local editor. Do not expose repository files or write APIs.
    const pathname = (request.url || '/').split('?')[0];
    if (pathname === '/appearance') { response.writeHead(302, { Location: '/appearance/' }); response.end(); return; }
    if (pathname === '/verify-worker.js') response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'");
    const file = publicFiles.get(pathname);
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
    if (!file) { response.writeHead(404); response.end('Not found'); return; }
    fs.readFile(path.join(__dirname, file[0]), (error, data) => {
      if (error) { response.writeHead(500); response.end('Unable to load editor'); return; }
      response.writeHead(200, { 'Content-Type': file[1], 'Content-Length': data.length });
      response.end(request.method === 'HEAD' ? undefined : data);
    });
  });
}
if (require.main === module) {
  const port = Number(process.argv[2] || 5190);
  if (!Number.isInteger(port) || port < 1 || port > 65535) { console.error('Port must be between 1 and 65535.'); process.exit(1); }
  const server = createServer();
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is busy. Open the existing editor or choose another port: node card-workshop/server.cjs 5191` : error.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Card Workshop: http://127.0.0.1:${port}/`));
}
module.exports = { createServer };
