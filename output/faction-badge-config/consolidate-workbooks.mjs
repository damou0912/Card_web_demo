import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../../UnityCard_demo');
const folder = path.join(project, 'ConfigTables');
const output = path.resolve(here, '../../outputs/card-config-consolidated-20260923');
const target = path.join(folder, '卡牌配置.xlsx');
try { await fs.access(target); throw new Error('Unified workbook already exists; preserve edits.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const sourceNames = ['卡牌内容配置.xlsx', '卡牌表现配置.xlsx'];
const originalBytes = await Promise.all(sourceNames.map(n => fs.readFile(path.join(folder, n))));
const content = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(folder, sourceNames[0])));
const presentation = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(folder, sourceNames[1])));
const registry = JSON.parse(await fs.readFile(path.join(folder, 'card-catalog-index.json'), 'utf8'));
const cleanRows = (book, name, end) => book.worksheets.getItem(name).getRange(`A1:${end}1001`).values
  .filter(row => row.some(v => v !== null && v !== ''));
const attributes = cleanRows(content, '卡牌属性配置表', 'E');
const skills = cleanRows(content, '技能展示表', 'C');
const mappings = cleanRows(presentation, '卡牌效果表现表', 'C');
const badges = cleanRows(presentation, '国度角标表', 'C');
assert.deepEqual(attributes[0], ['cardId', 'cardName', 'camp', 'rarity', 'baseAttack']);
assert.deepEqual(skills[0], ['cardId', 'skill', 'effect']);
assert.equal(attributes.length, skills.length);
assert.equal(attributes.length, mappings.length);
const bySkill = new Map(skills.slice(1).map(row => [row[0], row]));
const byMapping = new Map(mappings.slice(1).map(row => [row[0], row]));
const defaults = new Map(registry.defaultCardIds.map((id, i) => [id, i + 1]));
const ids = new Set();
const rows = attributes.slice(1).map(row => {
  assert.equal(typeof row[0], 'string');
  assert.ok(!ids.has(row[0])); ids.add(row[0]);
  assert.equal(typeof row[4], 'number');
  assert.deepEqual(row.slice(0, 3), byMapping.get(row[0]));
  const skill = bySkill.get(row[0]); assert.ok(skill);
  return [...row, skill[1], skill[2], defaults.get(row[0]) ?? 0];
});
assert.deepEqual([...ids].sort(), registry.cards.map(c => c.id).sort());
await fs.mkdir(output, { recursive: true });
// Inspect affected source ranges and render before redesign.
console.log((await content.inspect({ kind: 'table', range: '卡牌属性配置表!A1:E4', include: 'values,formulas', tableMaxRows: 4, tableMaxCols: 5 })).ndjson);
for (const [book, sheetName, range, file] of [[content, '技能展示表', 'A1:C5', 'before-skills'], [presentation, '国度角标表', 'A1:C4', 'before-badges']]) {
  const preview = await book.render({sheetName, range, scale: 1});
  await fs.writeFile(path.join(output, file + '.png'), new Uint8Array(await preview.arrayBuffer()));
}
const book = Workbook.create();
const headers = ['cardId', 'cardName', 'camp', 'rarity', 'baseAttack', 'skill', 'effect', 'defaultOrder'];
for (const [name, values, widths, tableName] of [
  ['卡牌', [headers, ...rows], [15, 17, 19, 13, 16, 20, 90, 18], 'Cards'],
  ['势力角标', badges, [22, 24, 50], 'FactionBadges'],
]) {
  const sheet = book.worksheets.add(name);
  const last = String.fromCharCode(64 + widths.length);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${last}1001`).setNumberFormat('@');
  if (name === '卡牌') for (const c of ['E', 'H']) sheet.getRange(`${c}2:${c}1001`).setNumberFormat('0');
  sheet.getRange(`A1:${last}${values.length}`).values = values;
  sheet.getRange(`A1:${last}${values.length}`).format.font = { name: 'Arial', size: 11, color: '#243345' };
  sheet.getRange(`A1:${last}${values.length}`).format.rowHeight = 28;
  sheet.getRange(`A1:${last}${values.length}`).format.verticalAlignment = 'center';
  sheet.getRange(`A1:${last}${values.length}`).format.horizontalAlignment = 'left';
  widths.forEach((width, i) => { const c = String.fromCharCode(65+i); sheet.getRange(`${c}:${c}`).format.columnWidth = width; });
  sheet.tables.add(`A1:${last}${values.length}`, true, tableName);
  sheet.getRange(`A1:${last}1`).format.fill = '#2E4055';
  sheet.getRange(`A1:${last}1`).format.font = { name:'Arial', size:11, bold:true, color:'#FFFFFF' };
  sheet.getRange(`A1:${last}1`).format.horizontalAlignment = 'center';
  if (name === '卡牌') {
    sheet.freezePanes.freezeRows(1);
    sheet.getRange('G2:G91').format.wrapText = true;
    for (const c of ['E', 'H']) sheet.getRange(`${c}2:${c}91`).format.horizontalAlignment = 'right';
    sheet.getRange('E2:E1001').dataValidation = { rule:{type:'whole',operator:'between',formula1:0,formula2:99} };
    sheet.getRange('H2:H1001').dataValidation = { rule:{type:'whole',operator:'between',formula1:0,formula2:50000} };
    sheet.getRange('D2:D1001').dataValidation = { rule:{type:'list',values:['普通','稀有','史诗','传说','特殊']} };
    rows.forEach((row,i) => {
      const lines = row[6].split(/\r?\n/).reduce((n,line) => n + Math.max(1, Math.ceil(line.length / 36)),0);
      sheet.getRange(`A${i+2}:H${i+2}`).format.rowHeight = Math.max(30, lines*19+10);
    });
  }
  const campColumn = name === '卡牌' ? 'C' : 'A';
  for (const [camp,color] of [['三国~魏','#2269A6'],['三国~蜀','#AC591D'],['三国~吴','#267442']])
    sheet.getRange(`${campColumn}2:${campColumn}1001`).conditionalFormats.add('cellIs',{operator:'equal',formula:`"${camp}"`,format:{font:{color,bold:true}}});
}
book.recalculate();
assert.deepEqual(book.worksheets.getItem('卡牌').getRange('A1:H91').values, [headers,...rows]);
assert.deepEqual(book.worksheets.getItem('势力角标').getRange('A1:C4').values, badges);
console.log((await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20}})).ndjson);
for (const [sheetName,range,file] of [['卡牌','A1:H6','cards'],['势力角标','A1:C4','badges']]) {
  const preview = await book.render({sheetName,range,scale:1});
  await fs.writeFile(path.join(output,file+'.png'),new Uint8Array(await preview.arrayBuffer()));
}
const artifact = path.join(output, '卡牌配置.xlsx');
await (await SpreadsheetFile.exportXlsx(book)).save(artifact);
for (let i=0;i<sourceNames.length;i++) assert.ok(originalBytes[i].equals(await fs.readFile(path.join(folder,sourceNames[i]))),'Source changed during consolidation');
await fs.copyFile(artifact,target,constants.COPYFILE_EXCL);
console.log('Consolidated 90 cards / 3 factions / 60 default card IDs into ' + target);
