(function(root,factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model.js'));
  else root.CardAppearanceRender = factory(root.CardAppearance);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(M) {
  'use strict';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
  function wrap(text, width, measure) {
    const lines = [];
    for (const paragraph of text.replace(/\r\n?/g,'\n').split('\n')) {
      let line = '';
      for (const char of paragraph) { if (line && measure(line + char) > width) { lines.push(line); line = char; } else line += char; }
      lines.push(line);
    }
    return lines;
  }
  function textLayout(e, measure) {
    const fn = measure ? s => measure(s,e) : s => Array.from(s).reduce((n,c)=>n+(/[\u0000-\u00ff]/.test(c) ? .56 : 1)*e.fontSize,0);
    const lines = wrap(e.text, e.width, fn), capacity = Math.max(0, Math.floor((e.height-e.fontSize)/(e.fontSize*e.lineHeight))+1);
    return {lines,capacity,overflow:lines.length > capacity};
  }
  function artwork(e) {
    if (e.image) {
      const ratio=e.fit==='contain'?Math.min(e.width/e.imageWidth,e.height/e.imageHeight):Math.max(e.width/e.imageWidth,e.height/e.imageHeight);
      const width=e.imageWidth*ratio,height=e.imageHeight*ratio,x=(e.width-width)*e.focusX/100,y=(e.height-height)*e.focusY/100;
      return `<image href="${esc(e.image)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none"/>`;
    }
    // A scalable landscape placeholder: layout artwork, not a generated character portrait.
    return `<svg width="${e.width}" height="${e.height}" viewBox="0 0 400 390" preserveAspectRatio="xMidYMid slice"><rect width="400" height="390" fill="${e.fill}"/><circle cx="287" cy="104" r="43" fill="#efe3bb" opacity=".9"/><path d="M-10 270 64 181 124 236 215 131 318 231 410 169V410H-10Z" fill="#83988b" opacity=".35"/><path d="M-20 316 76 226 122 262 171 223 246 304 318 216 422 315V410H-20Z" fill="#567565" opacity=".6"/><path d="M-10 368Q57 312 126 343T258 338T410 341V410H-10Z" fill="#2a5044" opacity=".86"/><path d="M0 327Q100 298 203 319T400 297" fill="none" stroke="#f3ead3" stroke-width="2" opacity=".35"/><g fill="#2c4f43" opacity=".8"><path d="m74 97 9-3 8 4-8-1zM102 85l9-2 9 4-9-1zM123 101l8-3 8 4-8-1z"/></g><text x="200" y="292" text-anchor="middle" font-size="12" letter-spacing="5" fill="#f0ebdc" font-family="Microsoft YaHei,sans-serif" opacity=".7">立绘预留区域</text></svg>`;
  }
  function svg(doc, options={}) {
    const c=doc.canvas, warnings=[];
    let defs=`<clipPath id="card-clip"><rect width="${c.width}" height="${c.height}" rx="${c.radius}"/></clipPath>`;
    const content=doc.elements.filter(e=>e.visible).map(e=>{
      defs+=`<clipPath id="clip-${e.id}"><rect width="${e.width}" height="${e.height}" rx="${e.radius}"/></clipPath>`;
      let body='';
      if(e.type==='shape') body=`<rect width="${e.width}" height="${e.height}" rx="${e.radius}" fill="${e.fill}" stroke="${e.stroke}" stroke-width="${e.strokeWidth}"/>`;
      if(e.type==='image') body=`<g clip-path="url(#clip-${e.id})">${artwork(e)}</g><rect width="${e.width}" height="${e.height}" rx="${e.radius}" fill="none" stroke="${e.stroke}" stroke-width="${e.strokeWidth}"/>`;
      if(e.type==='text') {
        const layout=textLayout(e,options.measure); if(layout.overflow)warnings.push(`「${e.label}」文字需要 ${layout.lines.length} 行，当前只容纳 ${layout.capacity} 行`);
        const x=e.align==='center'?e.width/2:e.align==='right'?e.width:0;
        body=`<g clip-path="url(#clip-${e.id})"><text fill="${e.fill}" font-family="${esc(M.FONTS[e.font])}" font-size="${e.fontSize}" font-weight="${e.bold?700:400}" text-anchor="${e.align==='center'?'middle':e.align==='right'?'end':'start'}">${layout.lines.slice(0,layout.capacity).map((line,i)=>`<tspan x="${x}" y="${e.fontSize+i*e.fontSize*e.lineHeight}">${esc(line)}</tspan>`).join('')}</text></g>`;
      }
      if(e.type==='badge') {
        const textWidth=options.measure?options.measure(e.text,e):Array.from(e.text).length*e.fontSize;
        if(textWidth>e.width*(e.shape==='diamond'?.72:.88)||e.fontSize>e.height*.8||/[\r\n]/.test(e.text))warnings.push(`「${e.label}」徽章文字可能超出区域，请减少文字或字号`);
        const sw=e.strokeWidth, fill=`fill="${e.fill}" stroke="${e.stroke}" stroke-width="${sw}"`;
        body=e.shape==='diamond'?`<path d="M${e.width/2} ${sw} L${e.width-sw} ${e.height/2} ${e.width/2} ${e.height-sw} ${sw} ${e.height/2}Z" ${fill}/>`:e.shape==='round'?`<ellipse cx="${e.width/2}" cy="${e.height/2}" rx="${(e.width-sw)/2}" ry="${(e.height-sw)/2}" ${fill}/>`:`<rect x="${sw/2}" y="${sw/2}" width="${e.width-sw}" height="${e.height-sw}" rx="${e.radius}" ${fill}/>`;
        body+=`<g clip-path="url(#clip-${e.id})"><text x="${e.width/2}" y="${e.height/2+e.fontSize*.34}" text-anchor="middle" font-family="${esc(M.FONTS[e.font])}" font-size="${e.fontSize}" font-weight="${e.bold?700:400}" fill="${e.color||'#ffffff'}">${esc(e.text)}</text></g>`;
      }
      return `<g data-element="${e.id}" transform="translate(${e.x} ${e.y})" opacity="${e.opacity}">${body}</g>`;
    }).join('');
    let overlay='';
    if(options.guides) overlay+=`<g pointer-events="none" fill="none" stroke="#43c0ac" stroke-width="1" opacity=".75" stroke-dasharray="5 5"><rect x="16" y="16" width="${c.width-32}" height="${c.height-32}"/><path d="M${c.width/2} 0V${c.height}M0 ${c.height/2}H${c.width}"/></g>`;
    if(options.annotations) overlay+=doc.elements.filter(e=>e.visible).map(e=>`<g pointer-events="none"><rect x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="none" stroke="#a067ea" stroke-width="1" stroke-dasharray="3 3"/><text x="${e.x+3}" y="${e.y+11}" font-size="9" fill="#743db6" font-family="Microsoft YaHei,sans-serif">${esc(e.label)} · ${Math.round(e.width)}×${Math.round(e.height)}</text></g>`).join('');
    const selected=doc.elements.find(e=>e.id===options.selected&&e.visible);
    if(selected) {
      const e=selected;
      overlay+=`<g data-selection="true"><rect pointer-events="none" x="${e.x}" y="${e.y}" width="${e.width}" height="${e.height}" fill="none" stroke="${e.locked?'#a9a9a9':'#d18b39'}" stroke-width="1.5"/>${e.locked?'':[[0,0,'nw'],[e.width,0,'ne'],[0,e.height,'sw'],[e.width,e.height,'se']].map(([x,y,corner])=>`<rect data-resize="${corner}" x="${e.x+x-4}" y="${e.y+y-4}" width="8" height="8" fill="#fff" stroke="#bd8138" stroke-width="1.5"/>`).join('')}</g>`;
    }
    const result=`<svg xmlns="http://www.w3.org/2000/svg" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}" role="img" aria-label="${esc(doc.name)}"><title>${esc(doc.name)}</title><defs>${defs}</defs><g clip-path="url(#card-clip)"><rect width="${c.width}" height="${c.height}" fill="${c.background}"/>${content}<rect x="${c.borderWidth/2}" y="${c.borderWidth/2}" width="${c.width-c.borderWidth}" height="${c.height-c.borderWidth}" rx="${Math.max(0,c.radius-c.borderWidth/2)}" fill="none" stroke="${c.border}" stroke-width="${c.borderWidth}" pointer-events="none"/></g>${overlay}</svg>`;
    return {svg:result,warnings};
  }
  return {esc,wrap,textLayout,svg};
});
