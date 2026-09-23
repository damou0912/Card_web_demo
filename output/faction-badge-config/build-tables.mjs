// Migrate the just-created source tables to faction-bound references, preserving IDs/names/order/paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook } from '@oai/artifact-tool';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../../UnityCard_demo');
const destination = path.join(project, 'ConfigTables');
const source = JSON.parse(await fs.readFile(path.join(project, 'Assets/Resources/Data/web-card-catalog.json'), 'utf8'));
const mapping = { sanguo_wei: '三国~魏', sanguo_shu: '三国~蜀', sanguo_wu: '三国~吴' };
const definitions = [];
const originals = {};
for (const [name, expected, header] of [
  ['卡牌效果表现表', ['cardId', 'cardName', 'countryBadgeId'], ['cardId', 'cardName', 'camp']],
  ['国度角标表', ['id', 'displayName', 'spritePath'], ['camp', 'displayName', 'spritePath']],
]) {
  const text = await fs.readFile(path.join(destination, `${name}.csv`), 'utf8');
  const previous = await Workbook.fromCSV(text.replace(/^\uFEFF/, ''), { sheetName: name });
  const values = previous.worksheets.getItem(name).getUsedRange().values;
  const rows = values.slice(1).filter(row => row.some(value => value !== null && value !== ''));
  if (JSON.stringify(values[0]) !== JSON.stringify(expected)) throw new Error('Unexpected schema (already migrated?): ' + name);
  originals[name] = text;
  const updated = rows.map(row => {
    const result = [...row];
    const index = name === '卡牌效果表现表' ? 2 : 0;
    if (!mapping[result[index]]) throw new Error('Unknown previous badge: ' + result[index]);
    result[index] = mapping[result[index]];
    if (index === 2 && source.cards.find(c => c.id === result[0])?.camp !== result[2])
      throw new Error('Source faction mismatch: ' + result[0]);
    return result;
  });
  definitions.push([name, header, updated]);
}
const book = Workbook.create();
for (const [name, header, rows] of definitions) {
  const sheet = book.worksheets.add(name);
  sheet.getRange(`A1:C${rows.length + 1}`).values = [header, ...rows];
  sheet.getRange(`A1:C${rows.length + 1}`).setNumberFormat('@');
  sheet.showGridLines = false;
  sheet.getRange(`A1:C${rows.length + 1}`).format.font = { name: 'Arial', size: 11 };
  sheet.getRange('A1:C1').format.fill = '#263B47';
  sheet.getRange('A1:C1').format.font.color = '#FFFFFF';
  sheet.getRange('A1:C1').format.font.bold = true;
  sheet.getRange(`A1:C${rows.length + 1}`).format.rowHeight = 24;
  sheet.getRange('A:A').format.columnWidth = 21;
  sheet.getRange('B:B').format.columnWidth = 20;
  sheet.getRange('C:C').format.columnWidth = 46;
  if (rows.length > 15) sheet.freezePanes.freezeRows(1);
}
book.recalculate();
await fs.mkdir(destination, { recursive: true });
for (const [index, [name, header, rows]] of definitions.entries()) {
  const sheet = book.worksheets.getItem(name);
  const values = sheet.getRange(`A1:C${rows.length + 1}`).values;
  if (JSON.stringify(values) !== JSON.stringify([header, ...rows])) throw new Error('String IDs or rows changed');
  const report = await book.inspect({ kind: 'table', range: `${name}!A1:C5`, include: 'values', tableMaxRows: 5, tableMaxCols: 3 });
  console.log(report.ndjson);
  const csv = '\uFEFF' + values.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
  if (await fs.readFile(path.join(destination, `${name}.csv`), 'utf8') !== originals[name])
    throw new Error('Table changed during migration: ' + name);
  await fs.writeFile(path.join(destination, `${name}.csv`), csv);
  try {
    const preview = await book.render({ sheetName: name, range: `A1:C${Math.min(rows.length + 1, 9)}`, scale: 1.5 });
    await fs.writeFile(path.join(here, `faction-table-${index + 1}.png`), new Uint8Array(await preview.arrayBuffer()));
  } catch (error) { console.warn('Preview unavailable: ' + error.message); }
}
console.log(`Migrated source CSVs: ${definitions[0][2].length} exact string card IDs and 3 faction paths; unrelated cells preserved.`);
