// One-time workbook authoring. The shipped exporter needs only .NET/Unity, not this library.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../../UnityCard_demo');
const output = path.resolve(here, '../../outputs/excel-lua-20260923');
const target = path.join(project, 'ConfigTables/卡牌表现配置.xlsx');
try { await fs.access(target); throw new Error('Workbook already exists; do not overwrite user edits.'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const book = Workbook.create();
const sourceRows = new Map();
const colors = { '三国~魏': '#2269A6', '三国~蜀': '#AC591D', '三国~吴': '#267442' };
for (const [name, widths, campColumn, tableName] of [
  ['卡牌效果表现表', [22, 24, 24], 'C', 'CardPresentation'],
  ['国度角标表', [22, 24, 50], 'A', 'FactionBadges'],
]) {
  const imported = await Workbook.fromCSV((await fs.readFile(path.join(project, 'ConfigTables', name + '.csv'), 'utf8')).replace(/^\uFEFF/, ''), { sheetName: name });
  const values = imported.worksheets.getItem(name).getUsedRange().values;
  sourceRows.set(name, values);
  const sheet = book.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRange('A1:C1001').setNumberFormat('@'); // Reserve correctly typed input rows for additions.
  sheet.getRange(`A1:C${values.length}`).values = values;
  sheet.getRange(`A1:C${values.length}`).format.font = { name: 'Arial', size: 11, color: '#243345' };
  sheet.getRange(`A1:C${values.length}`).format.rowHeight = 25;
  sheet.getRange(`A1:C${values.length}`).format.verticalAlignment = 'center';
  sheet.getRange(`A1:C${values.length}`).format.horizontalAlignment = 'left';
  for (let i = 0; i < 3; i++) sheet.getRange(`${'ABC'[i]}:${'ABC'[i]}`).format.columnWidth = widths[i];
  sheet.tables.add(`A1:C${values.length}`, true, tableName);
  sheet.getRange('A1:C1').format.fill = '#2E4055';
  sheet.getRange('A1:C1').format.font = { name: 'Arial', size: 11, color: '#FFFFFF', bold: true };
  sheet.getRange('A1:C1').format.horizontalAlignment = 'center';
  sheet.getRange('A1:C1').format.rowHeight = 29;
  for (const [camp, color] of Object.entries(colors))
    sheet.getRange(`${campColumn}2:${campColumn}1001`).conditionalFormats.add('cellIs', {
      operator: 'equal', formula: '"' + camp + '"', format: { font: { color, bold: true } },
    });
  if (values.length > 15) sheet.freezePanes.freezeRows(1);
}
const guide = book.worksheets.add('使用说明');
guide.showGridLines = false;
guide.getRange('A2').values = [['Excel 转 Lua']];
guide.getRange('A4:B17').values = [
  ['步骤', '操作'],
  ['1. 修改配置', '在前两个工作表修改数据，保留工作表名称和第一行英文字段。'],
  ['2. 保存', '按 Ctrl+S 保存为 .xlsx。工具只读取磁盘上已保存的内容。'],
  ['3. 导出', '在 UnityCard_demo 文件夹双击 Export-CardPresentation.cmd。'],
  ['4. 查看结果', '成功后，两份 Lua 在 Assets/Resources/Config/CardPresentation/。'],
  ['首次使用', '命令行导出需安装 .NET 8 SDK，不需要安装 Excel 或启动 Unity。'],
  ['Unity 内导出', 'Card Demo / Tools / Presentation / Export Tables to Lua'],
  ['ID 为文本', '示例 01101。不要转成数字；丢失的前导零需要重新输入。'],
  ['数据格式', '所有字段为文本。不要使用公式、合并单元格或在 A:C 外填写数据。'],
  ['势力规则', 'camp 必须与卡牌资料一致。魏蓝、蜀橙、吴绿，同势力共用图片。'],
  ['图片路径', '例如 UI/FactionBadges/sanguo_wei，不含 Resources 前缀和扩展名。'],
  ['新增数据', '在表格末尾增加行。新增卡牌先更新资料，再填写同 ID 和势力。'],
  ['文件用途', '本 Excel 是编辑源。CSV 和 Lua 由工具生成，不要手动维护。'],
  ['原始数据', '现有卡牌表现配置：90 张正式卡牌、3 个势力角标。'],
];
guide.getRange('A1:B17').format.font = { name: 'Arial', size: 11, color: '#243345' };
guide.getRange('A1:B17').format.rowHeight = 28;
guide.getRange('A1:B17').format.verticalAlignment = 'center';
guide.getRange('A2').format.font = { name: 'Arial', size: 16, bold: true };
guide.getRange('A4:B4').format.fill = '#2E4055';
guide.getRange('A4:B4').format.font.color = '#FFFFFF';
guide.getRange('A4:B4').format.font.bold = true;
guide.getRange('A:A').format.columnWidth = 22;
guide.getRange('B:B').format.columnWidth = 94;
guide.tabColor = '#98A4AD';

book.recalculate();
await fs.mkdir(output, { recursive: true });
for (const [name, values] of sourceRows) {
  assert.deepEqual(book.worksheets.getItem(name).getRange(`A1:C${values.length}`).values, values);
  console.log((await book.inspect({ kind: 'table', range: `${name}!A1:C5`, include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 3 })).ndjson);
}
assert.equal(sourceRows.get('卡牌效果表现表').length, 91);
assert.equal(sourceRows.get('国度角标表').length, 4);
console.log((await book.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 30 } })).ndjson);
for (const [name, range, file] of [
  ['卡牌效果表现表', 'A1:C12', 'cards.png'],
  ['国度角标表', 'A1:C4', 'badges.png'],
  ['使用说明', 'A1:B17', 'guide.png'],
]) {
  const image = await book.render({ sheetName: name, range, scale: 1.5 });
  await fs.writeFile(path.join(output, file), new Uint8Array(await image.arrayBuffer()));
}
const exported = await SpreadsheetFile.exportXlsx(book);
const artifact = path.join(output, '卡牌表现配置.xlsx');
await exported.save(artifact);
await fs.copyFile(artifact, target, (await import('node:fs')).constants.COPYFILE_EXCL);
console.log('Created: ' + target);
