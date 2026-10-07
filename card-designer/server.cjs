'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const assets=new Map([
  ['/',[path.join(__dirname,'index.html'),'text/html; charset=utf-8']],
  ...['index.html','style.css','model.js','render.js','app.js'].map(file=>['/'+file,[path.join(__dirname,file),file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8']]),
  ...['card-info.js','replacement-cards.js'].map(file=>['/'+file,[path.join(__dirname,'..',file),'text/javascript; charset=utf-8']])
]);
function createServer(){return http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  const file=assets.get((req.url||'/').split('?')[0]);if(!file){res.writeHead(404);res.end('Not found');return;}
  fs.readFile(file[0],(error,data)=>{if(error){res.writeHead(500);res.end('Unable to load designer');return;}res.writeHead(200,{'Content-Type':file[1],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);});
});}
if(require.main===module){
  const port=Number(process.argv[2]||5192);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port must be between 1 and 65535');
  const server=createServer();server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Choose another port: node card-designer/server.cjs 5193`:error.message);process.exitCode=1;});server.listen(port,'127.0.0.1',()=>console.log(`Card Appearance Studio: http://127.0.0.1:${port}/`));
}
module.exports={assets,createServer};
