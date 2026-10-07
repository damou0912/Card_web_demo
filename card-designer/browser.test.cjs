'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require(process.env.DESIGNER_PLAYWRIGHT||'playwright');
const {createServer}=require('./server.cjs');
const M=require('./model.js');
const KEY='card-appearance.project.v1';
(async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.DESIGNER_BROWSER?{executablePath:process.env.DESIGNER_BROWSER}:{})});
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(origin);await page.locator('#artboard > svg').waitFor();
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
    assert.equal(await page.locator('#card-picker option').count(),90);assert.equal(await page.locator('#layers .layer-row').count(),9);
    assert.match(await page.locator('[data-element="name"]').textContent(),/赵云/);
    // Pointer dragging, resize handles, undo and keyboard adjustment mutate the saved model.
    const nameBox=await page.locator('[data-element="name"]').boundingBox();
    await page.mouse.move(nameBox.x+12,nameBox.y+14);await page.mouse.down();await page.mouse.move(nameBox.x+42,nameBox.y+24,{steps:5});await page.mouse.up();
    let doc=await saved();assert.ok(doc.elements.find(e=>e.id==='name').x>38);await page.locator('#undo').click();assert.equal((await saved()).elements.find(e=>e.id==='name').x,38);
    await page.locator('#redo').click();
    const handle=await page.locator('[data-resize="se"]').boundingBox();await page.mouse.move(handle.x+4,handle.y+4);await page.mouse.down();await page.mouse.move(handle.x-25,handle.y+10,{steps:5});await page.mouse.up();
    assert.ok((await saved()).elements.find(e=>e.id==='name').width<275);
    await page.locator('#viewport').focus();await page.keyboard.press('Shift+ArrowDown');
    const changedY=(await saved()).elements.find(e=>e.id==='name').y;assert.ok(changedY>47);
    await page.locator('[data-field="text"]').fill('<img src=x onerror=alert(1)>');await page.locator('[data-field="text"]').press('Tab');assert.equal(await page.locator('#artboard img').count(),0);
    await page.reload();await page.locator('[data-select="name"]').click();assert.equal(await page.locator('[data-field="text"]').inputValue(),'<img src=x onerror=alert(1)>');
    // Formal card content is independent from design geometry.
    const oldX=(await saved()).elements.find(e=>e.id==='name').x;await page.locator('#card-search').fill('01101');await page.locator('#apply-card').click();
    assert.equal((await saved()).elements.find(e=>e.id==='name').x,oldX);assert.equal((await saved()).elements.find(e=>e.id==='name').text,'廖化');
    await page.locator('[data-visible="name"]').click();assert.equal(await page.locator('[data-element="name"]').count(),0);await page.locator('#undo').click();
    await page.locator('[data-lock="name"]').click();await page.locator('#viewport').focus();const beforeLocked=(await saved()).elements.find(e=>e.id==='name').x;await page.keyboard.press('ArrowRight');assert.equal((await saved()).elements.find(e=>e.id==='name').x,beforeLocked);await page.locator('[data-lock="name"]').click();
    const order=(await saved()).elements.findIndex(e=>e.id==='name');await page.locator('[data-action="up"]').click();assert.equal((await saved()).elements.findIndex(e=>e.id==='name'),order+1);await page.locator('[data-action="down"]').click();assert.equal((await saved()).elements.findIndex(e=>e.id==='name'),order);
    await page.locator('[data-add="text"]').click();assert.equal(await page.locator('.layer-row').count(),10);await page.locator('[data-action="duplicate"]').click();assert.equal(await page.locator('.layer-row').count(),11);await page.locator('[data-action="delete"]').click();assert.equal(await page.locator('.layer-row').count(),10);
    // Real image upload embeds pixels; focus changes actual SVG crop offsets.
    const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=40;const x=c.getContext('2d');x.fillStyle='#ff0000';x.fillRect(0,0,40,40);x.fillStyle='#0000ff';x.fillRect(40,0,40,40);return c.toDataURL('image/png');});
    await page.locator('[data-select="art"]').click();await page.locator('[data-action="upload"]').click();
    await page.locator('#image-file').setInputFiles({name:'test-art.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});
    await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).elements.find(e=>e.id==='art').image.startsWith('data:image/webp'),KEY);
    const embedded=(await saved()).elements.find(e=>e.id==='art');assert.equal(embedded.imageWidth,80);assert.equal(embedded.imageHeight,40);
    await page.locator('[data-field="focusX"]').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('change',{bubbles:true}));});const crop=Number(await page.locator('[data-element="art"] image').getAttribute('x'));assert.ok(crop<0);
    await page.locator('[data-field="focusX"]').evaluate(el=>{el.value='50';el.dispatchEvent(new Event('change',{bubbles:true}));});assert.equal(Number(await page.locator('[data-element="art"] image').getAttribute('x')),crop*2);
    const takeDownload=async action=>{const pending=page.waitForEvent('download');await action();return fs.readFile(await(await pending).path());};
    const projectBytes=await takeDownload(()=>page.locator('#save-project').click());M.validate(JSON.parse(projectBytes));
    const png=await takeDownload(()=>page.locator('#export-png').click());assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),840);assert.equal(png.readUInt32BE(20),1200);
    // Embedded art must survive raster export, not just appear in an SVG tag.
    const pixel=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);return [...x.getImageData(160,320,1,1).data];},png.toString('base64'));assert.ok(pixel[0]>180&&pixel[1]<80&&pixel[2]<80,'PNG lost uploaded art: '+pixel);
    await page.locator('.export-menu summary').click();const svg=await takeDownload(()=>page.locator('#export-svg').click());assert.match(svg.toString(),/data:image\/webp/);assert.ok(!svg.toString().includes('data-selection'));
    await page.locator('#show-spec').click();const specBytes=await takeDownload(()=>page.locator('#export-spec').click());const spec=JSON.parse(specBytes);assert.equal(spec.layers[0].unityRectTransform.anchoredPosition[1],-18);await page.locator('#close-spec').click();
    await page.locator('[data-template="landscape"]').click();assert.equal((await saved()).canvas.width,600);assert.equal((await saved()).elements.find(e=>e.id==='art').image,embedded.image);
    await page.locator('#project-file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:projectBytes});assert.equal((await saved()).canvas.width,420);
    const beforeInvalid=JSON.stringify(await saved());await page.locator('#project-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"invalid"}')});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('导入失败'));assert.equal(JSON.stringify(await saved()),beforeInvalid);
    // A long description produces a layout warning instead of silently claiming a fit.
    await page.locator('[data-select="description"]').click();await page.locator('[data-field="text"]').fill('很长的技能说明'.repeat(100));await page.locator('[data-field="text"]').press('Tab');assert.match(await page.locator('#warnings').innerText(),/文字需要/);
    await page.locator('#canvas-width').fill('300');await page.locator('#canvas-width').press('Tab');M.validate(await saved());
    await page.locator('#view-preview').click();assert.equal(await page.locator('[data-selection]').count(),0);await page.locator('#view-design').click();
    // New artwork must also fit the smallest supported canvas.
    await page.locator('#canvas-width').fill('240');await page.locator('#canvas-width').press('Tab');await page.locator('#canvas-height').fill('240');await page.locator('#canvas-height').press('Tab');
    const smallCount=(await saved()).elements.length;await page.locator('[data-add="image"]').click();assert.equal((await saved()).elements.length,smallCount+1);M.validate(await saved());
    // Restore a clean scene and inspect desktop / tablet / narrow mobile layouts.
    const fresh=M.create();await page.locator('#project-file').setInputFiles({name:'fresh.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fresh))});
    await page.locator('#card-search').fill('01313');await page.locator('#apply-card').click();
    await page.locator('.export-menu summary').click();
    const output=process.env.DESIGNER_SCREENSHOTS||path.join(__dirname,'test-output');await fs.mkdir(output,{recursive:true});
    for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.locator('#fit').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'overflow at '+width);await page.screenshot({path:path.join(output,`designer-${width}.png`),fullPage:true});}
    // Corrupt data and cross-tab edits never silently overwrite another draft.
    const other=await context.newPage();await other.goto(origin);await other.locator('#project-name').fill('其他标签页');await other.locator('#project-name').press('Tab');await page.waitForFunction(()=>document.querySelector('#save-state').textContent.includes('暂停'));
    const brokenContext=await browser.newContext();await brokenContext.addInitScript(key=>localStorage.setItem(key,'broken JSON'),KEY);const brokenPage=await brokenContext.newPage();await brokenPage.goto(origin);await brokenPage.locator('#project-name').fill('受保护草稿');await brokenPage.locator('#project-name').press('Tab');assert.equal(await brokenPage.evaluate(key=>localStorage.getItem(key),KEY),'broken JSON');await brokenContext.close();
    assert.deepEqual(errors,[]);console.log('PASS designer browser: drag/resize/undo, card data, layer visibility/lock/order, image crop, PNG pixel validation, SVG/JSON/spec exports, safe imports/storage, 4 viewports.');console.log('Screenshots: '+output);
  }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
