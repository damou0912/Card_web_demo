import fs from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../../UnityCard_demo');
const output = path.resolve(here, '../../outputs/card-content-20260923');
const target = path.join(project, 'ConfigTables/卡牌内容配置.xlsx');
try { await fs.access(target); throw new Error('Workbook exists; preserve user edits.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const source = JSON.parse(await fs.readFile(path.join(project, 'Assets/Resources/Data/web-card-catalog.json'), 'utf8'));
const cards = source.cards;
assert.equal(cards.length, 90);
const book = Workbook.create();
const definitions = [
  ['卡牌属性配置表', ['cardId', 'cardName', 'camp', 'rarity', 'baseAttack'], cards.map(c => [c.id, c.name, c.camp, c.rarity, c.baseAttack]), [18, 20, 22, 18, 20], 'CardAttributes'],
  ['技能展示表', ['cardId', 'skill', 'effect'], cards.map(c => [c.id, c.skill, c.effect]), [18, 20, 100], 'SkillDisplay'],
];
for (const [name, header, rows, widths, tableName] of definitions) {
  const sheet = book.worksheets.add(name);
  const last = String.fromCharCode(64 + header.length);
  const range = `A1:${last}${rows.length + 1}`;
  sheet.showGridLines = false;
  sheet.getRange(`A1:${last}1001`).setNumberFormat('@');
  if (last === 'E') sheet.getRange('E2:E1001').setNumberFormat('0');
  sheet.getRange(range).values = [header, ...rows];
  sheet.getRange(range).format.font = { name: 'Arial', size: 11, color: '#243345' };
  sheet.getRange(range).format.verticalAlignment = 'center';
  sheet.getRange(range).format.rowHeight = 25;
  sheet.getRange(range).format.horizontalAlignment = 'left';
  widths.forEach((width, i) => { const col = String.fromCharCode(65 + i); sheet.getRange(`${col}:${col}`).format.columnWidth = width; });
  sheet.tables.add(range, true, tableName);
  sheet.getRange(`A1:${last}1`).format.fill = '#2E4055';
  sheet.getRange(`A1:${last}1`).format.font = { name: 'Arial', size: 11, color: '#FFFFFF', bold: true };
  sheet.getRange(`A1:${last}1`).format.horizontalAlignment = 'center';
  sheet.getRange(`A1:${last}1`).format.rowHeight = 29;
  sheet.freezePanes.freezeRows(1);
  if (last === 'E') {
    sheet.getRange('E2:E91').format.horizontalAlignment = 'right';
    sheet.getRange('E2:E1001').dataValidation = { rule: { type: 'whole', operator: 'between', formula1: 0, formula2: 99 } };
    sheet.getRange('D2:D1001').dataValidation = { rule: { type: 'list', values: ['普通', '稀有', '史诗', '传说', '特殊'] } };
    for (const [camp, color] of [['三国~魏', '#2269A6'], ['三国~蜀', '#AC591D'], ['三国~吴', '#267442']])
      sheet.getRange('C2:C1001').conditionalFormats.add('cellIs', { operator: 'equal', formula: `"${camp}"`, format: { font: { color, bold: true } } });
  } else {
    sheet.getRange('C2:C91').format.wrapText = true;
    rows.forEach((row, index) => { sheet.getRange(`A${index+2}:C${index+2}`).format.rowHeight = Math.max(30, Math.ceil(row[2].length / 44) * 19 + 10); });
  }
}
const guide = book.worksheets.add('使用说明');
guide.showGridLines = false;
guide.getRange('A2').values = [['卡牌内容配置']];
const instructions = [
  ['项目', '说明'],
  ['技能展示表', 'cardId 是卡牌 ID；skill 是技能名称；effect 是完整展示描述。'],
  ['属性配置表', 'cardName 为卡名；camp 为实际势力；rarity 为品质；baseAttack 为基础战力。'],
  ['修改并保存', '在两张数据表修改后按 Ctrl+S，再双击工程根目录 Export-CardPresentation.cmd。'],
  ['格式要求', 'ID 和文字列为文本，保留前导零。基础战力为 0~99 的整数数字。'],
  ['势力修改', '属性表中的 camp 是实际势力，还需同步角标工作簿中的同卡 camp。'],
  ['技能规则', '技能展示只改变文字，不生成技能执行代码。正式技能仍需单独实现。'],
  ['新增卡牌', '先在同目录 card-catalog-index.json 注册 ID，再补齐属性、技能展示和角标表。'],
  ['导出结果', '自动生成 Lua、CSV 以及现有界面读取的正式卡牌 JSON，不再手动编辑这些输出。'],
  ['不参与迁移', '演示卡、工坊卡、技能步骤、游戏全局参数和网页版本保持原样。'],
  ['编辑限制', '保留表名和英文表头。不使用公式、合并单元格；数据列之外不要填内容。'],
  ['数据来源', '迁移自项目现有正式卡牌资料，90 张卡的属性及技能文案逐项保留。'],
];
guide.getRange(`A4:B${3 + instructions.length}`).values = instructions;
guide.getRange('A1:B15').format.font = { name: 'Arial', size: 11, color: '#243345' };
guide.getRange('A1:B15').format.rowHeight = 29;
guide.getRange('A1:B15').format.verticalAlignment = 'center';
guide.getRange('A2').format.font = { name: 'Arial', size: 16, bold: true };
guide.getRange('A4:B4').format.fill = '#2E4055';
guide.getRange('A4:B4').format.font.color = '#FFFFFF';
guide.getRange('A4:B4').format.font.bold = true;
guide.getRange('A:A').format.columnWidth = 22;
guide.getRange('B:B').format.columnWidth = 102;
guide.tabColor = '#98A4AD';
book.recalculate();
await fs.mkdir(output, { recursive: true });
for (const [name, header, rows] of definitions) {
  const last = String.fromCharCode(64 + header.length);
  assert.deepEqual(book.worksheets.getItem(name).getRange(`A1:${last}${rows.length+1}`).values, [header, ...rows]);
  console.log((await book.inspect({ kind: 'table', range: `${name}!A1:${last}4`, include: 'values,formulas', tableMaxRows: 4, tableMaxCols: header.length })).ndjson);
}
console.log((await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 20 } })).ndjson);
for (const [sheetName, range, name] of [['卡牌属性配置表', 'A1:E8', 'attributes'], ['技能展示表', 'A1:C8', 'skills'], ['使用说明', 'A1:B15', 'guide']]) {
  const preview = await book.render({sheetName, range, scale: 1.5});
  await fs.writeFile(path.join(output, name + '.png'), new Uint8Array(await preview.arrayBuffer()));
}
const xlsx = await SpreadsheetFile.exportXlsx(book);
const artifact = path.join(output, '卡牌内容配置.xlsx');
await xlsx.save(artifact);
await fs.copyFile(artifact, target, constants.COPYFILE_EXCL);
console.log('Created: ' + target);
