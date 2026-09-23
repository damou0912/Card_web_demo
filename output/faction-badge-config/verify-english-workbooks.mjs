import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const folder = 'C:/codex_card/UnityCard_demo/ConfigTables';
const output = 'C:/codex_card/outputs/card-tables-english-20260923';
await fs.mkdir(output, { recursive: true });
const before = await SpreadsheetFile.importXlsx(await FileBlob.load(`${folder}/卡牌配置.xlsx`));
for (const [oldName, newName, range, previewRange] of [
  ['卡牌', 'Card Basics', 'A1:H1001', 'A1:H5'],
  ['势力角标', 'Faction Icons', 'A1:C1001', 'A1:C4'],
]) {
  const book = process.argv[2] === 'after'
    ? await SpreadsheetFile.importXlsx(await FileBlob.load(`${folder}/${newName}.xlsx`)) : before;
  const name = process.argv[2] === 'after' ? newName : oldName;
  assert.deepEqual(book.worksheets.getItem(name).getRange(range).values, before.worksheets.getItem(oldName).getRange(range).values);
  console.log((await book.inspect({ kind: 'sheet', include: 'id,name', maxChars: 1000 })).ndjson);
  console.log((await book.inspect({ kind: 'table', sheetId: name, range: previewRange, include: 'values,formulas', tableMaxRows: 5, tableMaxCols: 8, maxChars: 2800 })).ndjson);
  const preview = await book.render({ sheetName: name, range: previewRange, scale: 1 });
  await fs.writeFile(`${output}/${process.argv[2]}-${newName}.png`, new Uint8Array(await preview.arrayBuffer()));
}
console.log('PASS: source values preserved; previews generated without editing workbook contents.');
