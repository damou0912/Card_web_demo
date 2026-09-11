const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer((req, res) => {
  let url = req.url === '/' ? '/index.html' : req.url;
  let file = path.join(__dirname, url);
  
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    
    const ext = path.extname(file);
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8'
    };
    res.writeHead(200, {'Content-Type': types[ext] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(9999, '127.0.0.1', () => {
  console.log('Test server running at http://127.0.0.1:9999/');
});
