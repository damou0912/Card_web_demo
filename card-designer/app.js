(() => {
  'use strict';
  const M=window.CardAppearance,R=window.CardAppearanceRender,$=id=>document.getElementById(id),esc=R.esc;
  const KEY='card-appearance.project.v1';
  const catalog=[...(window.CARD_INFO||[]),...(window.REPLACEMENT_CARDS||[])];
  let doc=M.create(),selected='art',view='design',guides=true,snap=false,zoom=.85,automaticFit=true;
  let history=[],future=[],drag=null,protectedStorage=false,toastTimer,revision=0;
  const measureCanvas=document.createElement('canvas'),measureContext=measureCanvas.getContext('2d');
  const measure=(text,e)=>{measureContext.font=`${e.bold?700:400} ${e.fontSize}px ${M.FONTS[e.font]}`;return measureContext.measureText(text).width;};
  const current=()=>doc.elements.find(e=>e.id===selected);
  const snapshot=()=>JSON.stringify(doc);
  function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4600);}
  try {
    const saved=localStorage.getItem(KEY);
    if(saved)doc=M.validate(JSON.parse(saved));
    else {const card=catalog.find(c=>c.id==='01313');if(card)M.applyCard(doc,card);}
  } catch(e){protectedStorage=true;setTimeout(()=>notify('旧草稿未能读取，已保留原数据。当前方案可下载保存。'),100);}
  if(!current())selected=doc.elements[0]?.id||null;
  function persist(){
    if(protectedStorage){$('save-state').textContent='原草稿受保护 · 请下载保存';return;}
    try{localStorage.setItem(KEY,snapshot());$('save-state').innerHTML='<i></i>已保存至此浏览器';}
    catch(e){$('save-state').textContent='本地空间不足 · 请下载保存';}
  }
  function record(before){
    if(before===snapshot())return;
    history.push(before);while(history.length>30||(history.length>1&&history.reduce((n,s)=>n+s.length,0)>12*1024*1024))history.shift();
    future=[];revision++;persist();
  }
  function change(action,message){
    const before=snapshot();
    try{action();M.validate(doc);record(before);render();if(message)notify(message);}
    catch(e){doc=JSON.parse(before);render();notify(e.message);}
  }
  function undo(from,to){
    if(!from.length)return;
    to.push(snapshot());doc=JSON.parse(from.pop());revision++;
    if(!current())selected=doc.elements[0]?.id||null;
    persist();render();if(automaticFit)fit();
  }
  function fit(){
    const vp=$('viewport');zoom=M.clamp(Math.min((vp.clientWidth-70)/doc.canvas.width,(vp.clientHeight-60)/doc.canvas.height),.2,1.4);
    automaticFit=true;renderCanvas();
  }
  function renderCanvas(){
    const result=R.svg(doc,{measure,selected:view==='preview'?null:selected,guides:view!=='preview'&&guides,annotations:view==='annotations'});
    $('artboard').innerHTML=result.svg;$('artboard').style.width=doc.canvas.width*zoom+'px';$('artboard').style.height=doc.canvas.height*zoom+'px';
    $('zoom-value').textContent=Math.round(zoom*100)+'%';$('canvas-size').textContent=`${doc.canvas.width} × ${doc.canvas.height}`;
    const e=current();$('selection-info').textContent=e?`${e.label} · ${Math.round(e.width)} × ${Math.round(e.height)}${e.locked?' · 已锁定':''}`:'点击卡面元素开始编辑';
    $('warnings').textContent=result.warnings.length?'布局提醒：'+result.warnings.join('；'):'✓ 内容均在可见区域内';
    $('warnings').style.color=result.warnings.length?'#987139':'#8b9781';
    $('guides').classList.toggle('active',guides);$('guides').setAttribute('aria-pressed',guides);
    $('snap').classList.toggle('active',snap);$('snap').setAttribute('aria-pressed',snap);
    for(const mode of ['design','preview','annotations'])$('view-'+mode).classList.toggle('active',view===mode);
  }
  function renderLayers(){
    $('layer-count').textContent=`${doc.elements.length} 个元素`;
    $('layers').innerHTML=[...doc.elements].reverse().map(e=>`<div class="layer-row${e.id===selected?' selected':''}${e.visible?'':' hidden-layer'}"><button class="layer-select" data-select="${e.id}"><span class="layer-symbol">${{text:'T',image:'▧',badge:'◇',shape:'▭'}[e.type]}</span><span>${esc(e.label)}</span></button><button class="layer-toggle" data-visible="${e.id}" aria-label="${e.visible?'隐藏':'显示'}${esc(e.label)}" title="${e.visible?'隐藏':'显示'}">${e.visible?'◉':'○'}</button><button class="layer-toggle" data-lock="${e.id}" aria-label="${e.locked?'解锁':'锁定'}${esc(e.label)}" title="${e.locked?'解锁':'锁定'}">${e.locked?'▣':'▫'}</button></div>`).join('');
  }
  const numberField=(title,key,value,min,max,step=1)=>`<label class="field">${title}<input data-field="${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step}"></label>`;
  const colorField=(title,key,value)=>`<label class="field">${title}<input data-field="${key}" type="color" value="${value}"></label>`;
  const options=(values,value)=>Object.entries(values).map(([key,label])=>`<option value="${key}"${key===value?' selected':''}>${label}</option>`).join('');
  function renderProperties(){
    const e=current();$('selected-title').textContent=e?e.label:'选择一个元素';
    $('selected-subtitle').textContent=e?({text:'文字图层 / TEXT',image:'图片图层 / ARTWORK',badge:'徽章图层 / BADGE',shape:'装饰图层 / SHAPE'}[e.type]):'点击卡面或左侧图层开始设计。';
    if(!e){$('properties').innerHTML='<div class="empty-selection"><svg class="icon"><use href="#i-layers"/></svg>选中一个图层，设置它的位置、尺寸和外观。</div>';return;}
    let html=`<section class="property-section"><h3>位置与尺寸</h3><label class="field">图层名称<input data-field="label" value="${esc(e.label)}" maxlength="80"></label><div class="field-pair">${numberField('X 位置','x',e.x,0,doc.canvas.width-e.width)}${numberField('Y 位置','y',e.y,0,doc.canvas.height-e.height)}${numberField('宽度 W','width',e.width,2,doc.canvas.width)}${numberField('高度 H','height',e.height,2,doc.canvas.height)}</div><div class="align-buttons"><button data-align-box="left" title="左对齐">←</button><button data-align-box="center" title="水平居中">↔</button><button data-align-box="right" title="右对齐">→</button><button data-align-box="top" title="顶端对齐">↑</button><button data-align-box="middle" title="垂直居中">↕</button><button data-align-box="bottom" title="底端对齐">↓</button></div>${e.locked?'<p class="hint">画布拖拽已锁定；仍可在此精确设置。</p>':''}</section>`;
    if(e.type==='image')html+=`<section class="property-section"><h3>立绘与素材</h3><button class="upload-box" data-action="upload"><svg class="icon"><use href="#i-image"/></svg>${e.image?'更换图片':'上传立绘或卡面素材'}<small>PNG / JPG / WebP · 仅保存在本机</small></button>${e.image?'<button class="wide" data-action="clear-image">移除图片，恢复占位</button>':''}<label class="field">图片适配<select data-field="fit">${options({cover:'铺满区域（裁切）',contain:'完整显示（留白）'},e.fit)}</select></label><div class="field-pair"><label class="field">水平焦点 ${e.focusX}%<input data-field="focusX" type="range" min="0" max="100" value="${e.focusX}"></label><label class="field">垂直焦点 ${e.focusY}%<input data-field="focusY" type="range" min="0" max="100" value="${e.focusY}"></label></div></section>`;
    if(['text','badge'].includes(e.type))html+=`<section class="property-section"><h3>内容与字体</h3><label class="field">${e.type==='badge'?'徽章文字':'文字内容'}<textarea data-field="text" rows="${e.binding==='effect'?6:2}" maxlength="3000">${esc(e.text)}</textarea></label><label class="field">字体<select data-field="font">${options({serif:'宋体 · 典雅',sans:'黑体 · 清晰',display:'衬线数字 · 装饰'},e.font)}</select></label><div class="field-pair">${numberField('字号','fontSize',e.fontSize,8,120)}${colorField('文字颜色',e.type==='badge'?'color':'fill',e.type==='badge'?e.color||'#ffffff':e.fill)}</div><label class="field"><span><input data-field="bold" type="checkbox"${e.bold?' checked':''}> 加粗字重</span></label>${e.type==='text'?`<div class="align-buttons">${[['left','左对齐'],['center','居中'],['right','右对齐']].map(([v,n])=>`<button data-text-align="${v}" class="${e.align===v?'active':''}">${n}</button>`).join('')}</div>${numberField('行高倍数','lineHeight',e.lineHeight,1,2.5,.05)}`:''}</section>`;
    html+=`<section class="property-section"><h3>外观细节</h3>${e.type!=='text'?`<div class="field-pair">${colorField(e.type==='image'?'占位底色':'填充颜色','fill',e.fill)}${colorField('描边颜色','stroke',e.stroke)}</div>`:''}${e.type==='badge'?`<label class="field">徽章形状<select data-field="shape">${options({round:'圆形',diamond:'菱形',square:'圆角矩形'},e.shape)}</select></label>`:''}${e.type!=='text'?`<div class="field-pair">${numberField('圆角','radius',e.radius,0,800)}${numberField('描边宽度','strokeWidth',e.strokeWidth,0,20)}</div>`:''}<label class="field">不透明度 ${Math.round(e.opacity*100)}%<input data-field="opacity" type="range" min="0" max="1" step=".01" value="${e.opacity}"></label></section>`;
    html+=`<section class="property-section"><h3>图层操作</h3><div class="property-actions"><button data-action="up">上移一层</button><button data-action="down">下移一层</button><button data-action="duplicate">复制</button><button data-action="delete" class="danger">删除</button></div><p class="hint">删除、切换版式与布局调整均可撤销。</p></section>`;
    $('properties').innerHTML=html;
  }
  function render(){
    $('project-name').value=doc.name;
    for(const key of ['width','height','radius','background','border','borderWidth'])$('canvas-'+key).value=doc.canvas[key];
    document.querySelectorAll('[data-template]').forEach(b=>b.classList.toggle('active',b.dataset.template===doc.template));
    $('undo').disabled=!history.length;$('redo').disabled=!future.length;
    renderLayers();renderProperties();renderCanvas();
  }
  function select(id){selected=id;renderLayers();renderProperties();renderCanvas();document.querySelector('.inspector').scrollTop=0;}
  function renderCatalog(){
    const query=$('card-search').value.trim().toLowerCase();
    const list=catalog.filter(c=>`${c.id} ${c.name} ${c.skill} ${c.camp}`.toLowerCase().includes(query));
    $('catalog-count').textContent=`${catalog.length} 张预存`;
    $('card-picker').innerHTML=list.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.camp.slice(-1))} / ${esc(c.id)}</option>`).join('');
    $('apply-card').disabled=!list.length;
  }
  $('project-name').addEventListener('change',e=>change(()=>doc.name=e.target.value.trim()));
  $('card-search').addEventListener('input',renderCatalog);
  $('apply-card').addEventListener('click',()=>{const card=catalog.find(c=>c.id===$('card-picker').value);if(card)change(()=>M.applyCard(doc,card),'已套用卡牌文字，版式保持不变。');});
  document.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',()=>{change(()=>{doc=M.applyTemplate(doc,button.dataset.template);if(!current())selected='art';},'已切换版式，保留卡牌文字与立绘。可撤销。');fit();}));
  for(const key of ['width','height','radius','background','border','borderWidth'])$('canvas-'+key).addEventListener('change',e=>{
    const value=['background','border'].includes(key)?e.target.value:e.target.value.trim()?Number(e.target.value):NaN;
    change(()=>{if(key==='width'||key==='height')M.resize(doc,key==='width'?value:doc.canvas.width,key==='height'?value:doc.canvas.height);else doc.canvas[key]=value;});
    if(key==='width'||key==='height')fit();
  });
  $('layers').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.select)select(button.dataset.select);
    for(const [attr,key]of [['visible','visible'],['lock','locked']])if(button.dataset[attr])change(()=>{const e=doc.elements.find(e=>e.id===button.dataset[attr]);e[key]=!e[key];});
  });
  document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>change(()=>{
    if(doc.elements.length>=32)throw new Error('最多支持 32 个图层');
    const type=button.dataset.add,id='layer_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
    const e=M.layer(id,type,{text:'自定义文字',shape:'自定义装饰',image:'图片素材'}[type],30,100,Math.min(240,doc.canvas.width-60),type==='image'?180:type==='shape'?50:38,{text:type==='text'?'新的文字内容':'',fontSize:20,fill:type==='shape'?'#d6dfc9':'#355541',radius:type==='text'?0:8});
    M.fitElement(e,doc.canvas);doc.elements.push(e);selected=id;
  })));
  $('properties').addEventListener('change',event=>{
    const key=event.target.dataset.field;if(!key||!current())return;
    const input=event.target,value=input.type==='checkbox'?input.checked:['number','range'].includes(input.type)?(input.value.trim()?Number(input.value):NaN):input.value;
    change(()=>{const e=current();e[key]=value;if(['x','y','width','height'].includes(key)){if(!Number.isFinite(value))throw new Error('请填写有效数字');M.fitElement(e,doc.canvas);}});
  });
  $('properties').addEventListener('click',event=>{
    const button=event.target.closest('button'),e=current();if(!button||!e)return;
    if(button.dataset.textAlign)change(()=>e.align=button.dataset.textAlign);
    if(button.dataset.alignBox)change(()=>{
      const pos=button.dataset.alignBox;
      if(['left','center','right'].includes(pos))e.x=pos==='left'?0:pos==='center'?(doc.canvas.width-e.width)/2:doc.canvas.width-e.width;
      else e.y=pos==='top'?0:pos==='middle'?(doc.canvas.height-e.height)/2:doc.canvas.height-e.height;
    });
    const action=button.dataset.action;if(!action)return;
    if(action==='upload'){$('image-file').dataset.target=e.id;$('image-file').click();return;}
    change(()=>{
      const index=doc.elements.indexOf(e);
      if(action==='clear-image'){e.image='';e.imageWidth=0;e.imageHeight=0;}
      if(action==='delete'){doc.elements.splice(index,1);selected=doc.elements[Math.min(index,doc.elements.length-1)]?.id||null;}
      if(action==='duplicate'){if(doc.elements.length>=32)throw new Error('最多支持 32 个图层');const copy=M.clone(e);copy.id='copy_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);copy.label+=' 副本';copy.binding='';copy.x+=12;copy.y+=12;M.fitElement(copy,doc.canvas);doc.elements.splice(index+1,0,copy);selected=copy.id;}
      if(action==='up'&&index<doc.elements.length-1)[doc.elements[index],doc.elements[index+1]]=[doc.elements[index+1],doc.elements[index]];
      if(action==='down'&&index>0)[doc.elements[index],doc.elements[index-1]]=[doc.elements[index-1],doc.elements[index]];
    });
  });
  $('image-file').addEventListener('change',async event=>{
    const file=event.target.files[0],targetId=event.target.dataset.target,originalDoc=doc;if(!file)return;
    let objectUrl;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('请使用不超过 8 MB 的 PNG、JPG 或 WebP 图片');
      objectUrl=URL.createObjectURL(file);const img=await loadImage(objectUrl);
      if(img.width*img.height>40000000)throw new Error('图片像素过大，请先缩小至 4000 万像素以内');
      if(doc!==originalDoc||!doc.elements.some(e=>e.id===targetId))throw new Error('方案已切换，请重新选择图片');
      const ratio=Math.min(1,1600/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.round(img.width*ratio);canvas.height=Math.round(img.height*ratio);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const data=canvas.toDataURL('image/webp',.9);
      change(()=>{const e=doc.elements.find(e=>e.id===targetId);Object.assign(e,{image:data,imageWidth:canvas.width,imageHeight:canvas.height});},'图片已嵌入方案，可随方案文件保存。');
    }catch(e){notify(e.message);}finally{if(objectUrl)URL.revokeObjectURL(objectUrl);event.target.value='';}
  });
  const viewport=$('viewport');
  const point=event=>{const rect=$('artboard').getBoundingClientRect();return{x:(event.clientX-rect.left)/zoom,y:(event.clientY-rect.top)/zoom};};
  viewport.addEventListener('pointerdown',event=>{
    if(event.button!==0||view==='preview')return;
    const handle=event.target.closest('[data-resize]'),group=event.target.closest('[data-element]');
    if(group)select(group.dataset.element);else if(!handle){select(null);return;}
    const e=current();if(!e||e.locked)return;
    drag={before:snapshot(),id:e.id,start:point(event),original:M.clone(e),corner:handle?.dataset.resize};viewport.setPointerCapture(event.pointerId);event.preventDefault();viewport.focus({preventScroll:true});
  });
  viewport.addEventListener('pointermove',event=>{
    if(!drag)return;const e=current(),p=point(event),dx=p.x-drag.start.x,dy=p.y-drag.start.y,o=drag.original;
    const round=v=>snap?Math.round(v/4)*4:Math.round(v);
    if(!drag.corner){e.x=round(o.x+dx);e.y=round(o.y+dy);M.fitElement(e,doc.canvas);}
    else{
      let left=o.x,top=o.y,right=o.x+o.width,bottom=o.y+o.height;
      if(drag.corner.includes('w'))left=M.clamp(round(o.x+dx),0,right-8);else right=M.clamp(round(right+dx),left+8,doc.canvas.width);
      if(drag.corner.includes('n'))top=M.clamp(round(o.y+dy),0,bottom-8);else bottom=M.clamp(round(bottom+dy),top+8,doc.canvas.height);
      Object.assign(e,{x:left,y:top,width:right-left,height:bottom-top});
    }
    renderCanvas();for(const key of ['x','y','width','height']){const input=$('properties').querySelector(`[data-field="${key}"]`);if(input)input.value=e[key];}
  });
  viewport.addEventListener('pointerup',()=>{if(!drag)return;record(drag.before);drag=null;render();});
  viewport.addEventListener('pointercancel',()=>{if(!drag)return;doc=JSON.parse(drag.before);drag=null;render();});
  $('undo').addEventListener('click',()=>undo(history,future));$('redo').addEventListener('click',()=>undo(future,history));
  $('guides').addEventListener('click',()=>{guides=!guides;renderCanvas();});$('snap').addEventListener('click',()=>{snap=!snap;renderCanvas();});
  for(const mode of ['design','preview','annotations'])$('view-'+mode).addEventListener('click',()=>{view=mode;renderCanvas();});
  $('fit').addEventListener('click',fit);
  for(const[id,factor]of [['zoom-in',1.15],['zoom-out',1/1.15]])$(id).addEventListener('click',()=>{automaticFit=false;zoom=M.clamp(zoom*factor,.2,2);renderCanvas();});
  window.addEventListener('resize',()=>{if(automaticFit)requestAnimationFrame(fit);});
  window.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea,select')||$('spec-dialog').open)return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?undo(future,history):undo(history,future);return;}
    const e=current();if(!e||e.locked||view==='preview')return;
    if(event.key==='Delete'){event.preventDefault();change(()=>{doc.elements=doc.elements.filter(layer=>layer.id!==selected);selected=null;});}
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();const amount=event.shiftKey?10:1;change(()=>{e.x+=event.key==='ArrowLeft'?-amount:event.key==='ArrowRight'?amount:0;e.y+=event.key==='ArrowUp'?-amount:event.key==='ArrowDown'?amount:0;M.fitElement(e,doc.canvas);});}
  });
  function filename(extension){return(doc.name.replace(/[\\/:*?"<>|]/g,'_').trim()||'card-appearance')+'.'+extension;}
  function download(name,data,type){const url=URL.createObjectURL(data instanceof Blob?data:new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  const json=(name,value)=>download(name,JSON.stringify(value,null,2)+'\n','application/json');
  function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片读取失败，请换一张图片重试'));image.src=url;});}
  $('save-project').addEventListener('click',()=>{json(filename('json'),doc);notify('已下载完整方案，包含图片与所有图层。');});
  $('import-project').addEventListener('click',()=>$('project-file').click());
  $('project-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>12*1024*1024)throw new Error('方案文件不能超过 12 MB');const next=M.validate(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));if(!confirm('导入方案会替换当前布局，可撤销。是否继续？'))return;change(()=>{doc=next;selected=doc.elements[0]?.id||null;},'方案已导入。');fit();}
    catch(e){notify('导入失败，当前方案保留：'+e.message);}finally{event.target.value='';}
  });
  $('export-svg').addEventListener('click',()=>{download(filename('svg'),R.svg(doc,{measure}).svg,'image/svg+xml;charset=utf-8');notify('已导出 SVG，图片已内嵌，不包含编辑辅助线。');});
  $('export-png').addEventListener('click',async()=>{
    const button=$('export-png');button.disabled=true;let url;
    try{
      const exportDoc=M.clone(doc);url=URL.createObjectURL(new Blob([R.svg(exportDoc,{measure}).svg],{type:'image/svg+xml;charset=utf-8'}));const img=await loadImage(url);
      const canvas=document.createElement('canvas');canvas.width=exportDoc.canvas.width*2;canvas.height=exportDoc.canvas.height*2;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('PNG 导出失败');download(exportDoc.name.replace(/[\\/:*?"<>|]/g,'_')+'.png',blob);notify(`已导出 ${canvas.width} × ${canvas.height} PNG（2 倍分辨率）。`);
    }catch(e){notify(e.message);}finally{if(url)URL.revokeObjectURL(url);button.disabled=false;}
  });
  function showSpec(){
    $('spec-rows').innerHTML=doc.elements.map(e=>`<tr><td>${esc(e.label)}</td><td>${e.x} / ${e.y}</td><td>${e.width} / ${e.height}</td><td>${['text','badge'].includes(e.type)?e.fontSize:'—'}</td><td>${e.visible?'显示':'隐藏'}${e.locked?' · 锁定':''}</td></tr>`).join('');$('spec-dialog').showModal();
  }
  $('show-spec').addEventListener('click',showSpec);$('spec-shortcut').addEventListener('click',showSpec);$('close-spec').addEventListener('click',()=>$('spec-dialog').close());
  $('export-spec').addEventListener('click',()=>json(filename('layout.json'),M.spec(doc)));
  window.addEventListener('storage',event=>{if(event.key===KEY){protectedStorage=true;$('save-state').textContent='其他标签页已修改 · 自动保存暂停';notify('其他标签页修改了同一草稿，请下载当前方案后刷新，避免覆盖。');}});
  renderCatalog();if(catalog.some(c=>c.id==='01313'))$('card-picker').value='01313';render();requestAnimationFrame(fit);
  if(protectedStorage)$('save-state').textContent='原草稿受保护 · 请下载保存';
})();
