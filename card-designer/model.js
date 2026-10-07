(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CardAppearance = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'card-appearance-project';
  const FONTS = { serif: 'SimSun, STSong, serif', sans: 'Microsoft YaHei, PingFang SC, sans-serif', display: 'Georgia, SimSun, serif' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const color = value => typeof value === 'string' && /^#[\da-fA-F]{6}$/.test(value);
  function layer(id, type, label, x, y, width, height, extra = {}) {
    return { id, type, label, x, y, width, height, visible: true, locked: false, opacity: 1,
      fill: '#203c35', stroke: '#ba985f', strokeWidth: 0, radius: 0,
      text: '', fontSize: 16, font: 'sans', bold: false, align: 'left', lineHeight: 1.55,
      image: '', imageWidth: 0, imageHeight: 0, fit: 'cover', focusX: 50, focusY: 50, shape: 'round', binding: '', ...extra };
  }
  function create(template = 'classic') {
    const doc = { format: FORMAT, version: 1, name: '青山 · 卡面外观方案', template,
      canvas: { width: 420, height: 600, radius: 20, background: '#f3eedf', border: '#baa06f', borderWidth: 2 },
      elements: [
        layer('art', 'image', '角色立绘', 18, 18, 384, 367, { fill: '#d9e4d7', radius: 10, binding: 'art' }),
        layer('name', 'text', '卡牌名称', 38, 37, 275, 46, { text: '赵云', font: 'serif', fontSize: 34, bold: true, binding: 'name' }),
        layer('faction', 'badge', '势力标识', 337, 35, 46, 46, { fill: '#294e42', text: '蜀', font: 'serif', fontSize: 23, bold: true, color: '#faf3de', binding: 'faction' }),
        layer('rarity', 'text', '品质标签', 39, 355, 210, 25, { text: '史诗 · EPIC', fontSize: 12, fill: '#e8dabc', bold: true, binding: 'rarity' }),
        layer('power', 'badge', '战力徽章', 324, 340, 62, 62, { fill: '#294e42', strokeWidth: 2, text: '4', color: '#fff2cc', font: 'display', fontSize: 34, bold: true, shape: 'diamond', binding: 'power' }),
        layer('line', 'shape', '分隔装饰', 39, 395, 342, 2, { fill: '#c2ab7e' }),
        layer('skill', 'text', '技能名称', 39, 412, 285, 27, { text: '龙胆', font: 'serif', fontSize: 19, bold: true, binding: 'skill' }),
        layer('description', 'text', '技能描述', 39, 451, 342, 103, { text: '起势：我方回合开始时，自身战力恢复为 4。\n防护：首次被摧毁时保留在原格，战力变为 1。', fontSize: 15, fill: '#4d594d', lineHeight: 1.65, binding: 'effect' }),
        layer('id', 'text', '底部编号', 39, 570, 342, 15, { text: '01313  /  三国 · 蜀', fontSize: 10, fill: '#95876d', binding: 'id' })
      ] };
    if (template === 'fullart') {
      doc.name = '夜幕 · 全幅立绘方案'; doc.canvas.background = '#172b2c'; doc.canvas.border = '#c6a56c';
      const art = doc.elements.find(e => e.id === 'art'); Object.assign(art, { x: 8, y: 8, width: 404, height: 584, fill: '#647c70', radius: 15 });
      doc.elements.splice(1, 0, layer('panel', 'shape', '技能底板', 23, 398, 374, 170, { fill: '#152e2d', opacity: .92, radius: 12 }));
      for (const e of doc.elements) if (e.type === 'text') e.fill = ['name', 'skill'].includes(e.id) ? '#e7d5aa' : '#e5e4d3';
      Object.assign(doc.elements.find(e => e.id === 'description'), { y: 448, height: 105 });
    } else if (template === 'landscape') {
      doc.name = '远征 · 横向卡面方案'; doc.canvas.width = 600; doc.canvas.height = 420;
      const positions = { art: [16,16,258,388], name:[296,43,224,44], faction:[533,32,43,43], rarity:[298,98,200,24], power:[507,333,67,67], line:[298,141,268,2], skill:[298,164,267,29], description:[298,211,268,111], id:[298,371,200,18] };
      for (const e of doc.elements) { const [x,y,width,height] = positions[e.id]; Object.assign(e, {x,y,width,height}); }
      doc.elements.find(e=>e.id==='rarity').fill='#456650';
    } else assert(template === 'classic', '未知版式');
    return doc;
  }
  function validate(value) {
    assert(value && value.format === FORMAT && value.version === 1, '请选择卡面外观规划器导出的方案 JSON');
    assert(typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 100, '方案名称需为 1～100 个字符');
    const c = value.canvas;
    assert(c && number(c.width, 240, 1600) && number(c.height, 240, 1600) && Number.isInteger(c.width) && Number.isInteger(c.height), '画布宽高应为 240～1600 的整数');
    assert(number(c.radius, 0, Math.min(c.width, c.height) / 2) && number(c.borderWidth, 0, 20) && color(c.background) && color(c.border), '卡框颜色、圆角或线宽不正确');
    assert(Array.isArray(value.elements) && value.elements.length <= 32, '最多支持 32 个图层');
    const ids = new Set(); let imageBytes = 0;
    for (const e of value.elements) {
      assert(e && typeof e.id === 'string' && /^[\w-]{1,80}$/.test(e.id) && !ids.has(e.id), '图层 ID 无效或重复'); ids.add(e.id);
      assert(['text', 'image', 'badge', 'shape'].includes(e.type), '不支持的图层类型');
      assert(typeof e.label === 'string' && e.label.length <= 80 && typeof e.binding === 'string' && e.binding.length <= 30, '图层名称或绑定无效');
      assert(number(e.x, 0, c.width) && number(e.y, 0, c.height) && number(e.width, 2, c.width) && number(e.height, 2, c.height) && e.x + e.width <= c.width + .01 && e.y + e.height <= c.height + .01, '图层区域必须位于卡牌画布内');
      assert(typeof e.visible === 'boolean' && typeof e.locked === 'boolean' && number(e.opacity, 0, 1), '图层状态无效');
      assert(color(e.fill) && color(e.stroke) && (e.color === undefined || color(e.color)) && number(e.strokeWidth, 0, 20) && number(e.radius, 0, 800), '图层颜色或边框无效');
      assert(typeof e.text === 'string' && e.text.length <= 3000 && number(e.fontSize, 8, 120) && Object.hasOwn(FONTS, e.font) && typeof e.bold === 'boolean' && ['left', 'center', 'right'].includes(e.align) && number(e.lineHeight, 1, 2.5), '文本格式无效');
      assert(['round', 'diamond', 'square'].includes(e.shape) && ['cover', 'contain'].includes(e.fit) && number(e.focusX, 0, 100) && number(e.focusY, 0, 100), '图形或图片设置无效');
      assert(typeof e.image === 'string' && e.image.length <= 4 * 1024 * 1024 && (!e.image || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(e.image)), '图片需为内嵌 PNG、JPEG 或 WebP，且小于 4 MB');
      assert(number(e.imageWidth, 0, 20000) && number(e.imageHeight, 0, 20000) && (!e.image || (e.imageWidth > 0 && e.imageHeight > 0)), '图片原始尺寸无效');
      imageBytes += e.image.length;
    }
    assert(imageBytes <= 8 * 1024 * 1024, '图片总量过大，请减少图片或降低分辨率');
    return clone(value);
  }
  function fitElement(e, canvas) {
    e.width = Math.round(clamp(e.width, 2, canvas.width)*10)/10; e.height = Math.round(clamp(e.height, 2, canvas.height)*10)/10;
    e.x = clamp(e.x, 0, canvas.width - e.width); e.y = clamp(e.y, 0, canvas.height - e.height);
    for (const k of ['x','y','width','height']) e[k] = Math.round(e[k] * 10) / 10;
    return e;
  }
  function resize(doc, width, height) {
    assert(Number.isInteger(width) && Number.isInteger(height) && number(width, 240, 1600) && number(height, 240, 1600), '画布宽高应为 240～1600 的整数');
    const sx = width / doc.canvas.width, sy = height / doc.canvas.height;
    for (const e of doc.elements) { e.x *= sx; e.y *= sy; e.width *= sx; e.height *= sy; e.fontSize = clamp(Math.round(e.fontSize * Math.min(sx, sy)), 8, 120); fitElement(e, {width,height}); }
    Object.assign(doc.canvas, {width,height}); doc.canvas.radius = Math.min(doc.canvas.radius, width / 2, height / 2);
  }
  function applyCard(doc, card) {
    const values = { name: card.name, skill: card.skill, effect: card.effect, power: String(card.baseAttack), faction: card.camp.slice(-1), rarity: card.rarity, id: `${card.id}  /  ${card.camp.replace('~', ' · ')}` };
    for (const e of doc.elements) if (Object.hasOwn(values, e.binding)) e.text = values[e.binding];
  }
  function applyTemplate(doc, key) {
    const next = create(key);
    for (const e of next.elements) {
      const original = doc.elements.find(old => old.binding && old.binding === e.binding);
      if (original) { e.text = original.text; if (e.type === 'image') { e.image = original.image; e.imageWidth=original.imageWidth;e.imageHeight=original.imageHeight; } }
    }
    next.name = doc.name; return next;
  }
  function spec(doc) {
    validate(doc);
    return { format: 'card-appearance-layout-spec', version: 1, name: doc.name, coordinateSystem: 'top-left; pixels; Unity anchors/pivot top-left', canvas: clone(doc.canvas),
      layers: doc.elements.map((e, order) => ({ id: e.id, label: e.label, type: e.type, binding: e.binding, order, visible: e.visible,
        rect: {x:e.x,y:e.y,width:e.width,height:e.height}, normalized: {x:e.x/doc.canvas.width,y:e.y/doc.canvas.height,width:e.width/doc.canvas.width,height:e.height/doc.canvas.height},
        unityRectTransform: {anchorMin:[0,1],anchorMax:[0,1],pivot:[0,1],anchoredPosition:[e.x,-e.y],sizeDelta:[e.width,e.height]},
        appearance: {fill:e.fill,color:e.color || e.fill,stroke:e.stroke,strokeWidth:e.strokeWidth,radius:e.radius,opacity:e.opacity,shape:e.shape},
        text: {content:e.text,font:FONTS[e.font],fontSize:e.fontSize,bold:e.bold,align:e.align,lineHeight:e.lineHeight},
        image: e.type === 'image' ? {includedInProject:!!e.image,fit:e.fit,focusX:e.focusX,focusY:e.focusY} : undefined })) };
  }
  return {FORMAT,FONTS,clone,clamp,create,layer,validate,fitElement,resize,applyCard,applyTemplate,spec};
});
