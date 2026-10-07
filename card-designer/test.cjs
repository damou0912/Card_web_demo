'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model.js'),R=require('./render.js');
const {createServer}=require('./server.cjs');
test('all three templates round-trip and resize inside canvas bounds',()=>{
  for(const key of ['classic','fullart','landscape']){
    const doc=M.create(key);assert.deepEqual(M.validate(JSON.parse(JSON.stringify(doc))),doc);
    M.resize(doc,300,450);assert.doesNotThrow(()=>M.validate(doc));
    for(const e of doc.elements){assert.ok(e.x+e.width<=300.01);assert.ok(e.y+e.height<=450.01);}
  }
});
test('template changes preserve card bindings and embedded image dimensions',()=>{
  const doc=M.create(),art=doc.elements.find(e=>e.id==='art');
  Object.assign(art,{image:'data:image/png;base64,AAAA',imageWidth:100,imageHeight:200});
  M.applyCard(doc,{name:'测试角色',id:'01101',camp:'三国~蜀',rarity:'普通',baseAttack:8,skill:'测试技能',effect:'测试效果'});
  const next=M.applyTemplate(doc,'landscape');M.validate(next);
  assert.equal(next.elements.find(e=>e.binding==='name').text,'测试角色');assert.equal(next.elements.find(e=>e.binding==='power').text,'8');
  assert.equal(next.elements.find(e=>e.binding==='art').imageWidth,100);
});
test('untrusted imports reject malformed sizes, arbitrary resources and duplicate layers',()=>{
  for(const mutate of [d=>d.canvas.width=Infinity,d=>d.elements[0].x=-10,d=>d.elements[0].image='https://example.com/a.png',d=>d.elements[0].image='data:image/svg+xml;base64,AAAA',d=>d.elements.push(M.clone(d.elements[0])),d=>d.elements[0].id='"><script>',d=>d.elements[0].fill='url(https://example.com/a)',d=>d.elements[0].font='invalid']){
    const doc=M.create();mutate(doc);assert.throws(()=>M.validate(doc));
  }
});
test('SVG escapes literal content and omits all editor overlays on export',()=>{
  const doc=M.create();doc.name='<script>alert(1)</script>';doc.elements.find(e=>e.id==='name').text='<img onerror="bad">';
  const out=R.svg(doc).svg;assert.ok(!out.includes('<script>'));assert.ok(!out.includes('<img '));assert.match(out,/&lt;/);assert.ok(!out.includes('data-selection'));
  assert.match(R.svg(doc,{selected:'name',guides:true}).svg,/data-selection/);
  doc.elements.find(e=>e.id==='name').visible=false;assert.ok(!R.svg(doc).svg.includes('data-element="name"'));
});
test('text overflow reports clipping and normalized Unity layout uses top-left anchors',()=>{
  const doc=M.create(),e=doc.elements.find(e=>e.id==='description');e.text='非常长的描述'.repeat(150);
  assert.ok(R.svg(doc).warnings.some(w=>w.includes('技能描述')));
  const spec=M.spec(doc),layer=spec.layers.find(l=>l.id===e.id);assert.deepEqual(layer.unityRectTransform.anchoredPosition,[e.x,-e.y]);assert.equal(layer.normalized.width,e.width/doc.canvas.width);
  assert.deepEqual(R.wrap('一\r\n二',100,s=>s.length),['一','二']);
});
test('image focus maps continuously to crop coordinates and keeps full embedded image',()=>{
  const doc=M.create(),e=doc.elements[0];Object.assign(e,{image:'data:image/png;base64,AAAA',imageWidth:800,imageHeight:400,focusX:25});
  const getX=()=>Number(R.svg(doc).svg.match(/<image href="[^"]+" x="([^"]+)"/)[1]);const x=getX();assert.ok(x<0);e.focusX=50;assert.equal(getX(),x*2);
  e.fit='contain';assert.ok(getX()>=0);
});
test('standalone and workshop-mounted servers expose only explicit designer assets',async()=>{
  const servers=[createServer(),require('../card-workshop/server.cjs').createServer()];
  for(let i=0;i<servers.length;i++){
    const server=servers[i];await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`,prefix=i?'/appearance':'';
    try{
      for(const file of ['/','/style.css','/model.js','/render.js','/app.js','/card-info.js','/replacement-cards.js'])assert.equal((await fetch(origin+prefix+file)).status,200);
      for(const file of ['/server.cjs','/../game-data.json','/.env','/%2e%2e%2f.env'])assert.equal((await fetch(origin+prefix+file)).status,404);
      assert.equal((await fetch(origin+prefix+'/',{method:'POST',body:'{}'})).status,405);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  }
});
