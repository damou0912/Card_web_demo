import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load('C:/codex_card/outputs/data-table-20260914/数据表.xlsx'));
for (const range of ['A6:D13', 'A17:H23', 'A27:H30', 'A34:H39']) {
  console.log((await workbook.inspect({ kind: 'table', sheetId: '数据表', range, include: 'values,formulas', tableMaxRows: 12, tableMaxCols: 8, maxChars: 6500 })).ndjson);
}
