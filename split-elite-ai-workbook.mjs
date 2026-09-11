import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/codex_card/outputs";
const inputPath = "C:/codex_card/outputs/elite-ai-traits.xlsx";
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sourceSheet = sourceWorkbook.worksheets.getItemAt(0);
const sourceValues = sourceSheet.getRange("A1:F34").values;
const headers = sourceValues[3] || ["词条 ID", "词条名称", "等级", "具体效果描述", "启用", "备注"];
const sourceRows = sourceValues.slice(4).filter((row) => Number.isFinite(Number(row?.[0])));

const workbook = Workbook.create();
const sheetConfigs = [
  { name: "初级词条", level: "初级", range: "1000-1999", tabColor: "#2F76C7", fill: "#DCEBFA", fontColor: "#2F76C7", tableName: "BeginnerEliteAiTraits" },
  { name: "中级词条", level: "中级", range: "2000-2999", tabColor: "#8150B5", fill: "#E9DDF5", fontColor: "#8150B5", tableName: "IntermediateEliteAiTraits" },
  { name: "高级词条", level: "高级", range: "3000-3999", tabColor: "#D56B26", fill: "#FBE1CF", fontColor: "#D56B26", tableName: "AdvancedEliteAiTraits" }
];

for (const config of sheetConfigs) {
  const sheet = workbook.worksheets.add(config.name);
  sheet.showGridLines = false;
  sheet.tabColor = config.tabColor;
  const rows = sourceRows.filter((row) => row[2] === config.level).sort((a, b) => Number(a[0]) - Number(b[0]));
  const endRow = 5 + rows.length;
  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1").values = [[`PVE 挑战模式 · ${config.name}`]];
  sheet.getRange("A2:F2").merge();
  sheet.getRange("A2").values = [[`本页仅维护${config.level}词条。词条 ID 使用 ${config.range}，颜色由等级自动判定，不需要单独填写。`]];
  sheet.getRange("A4:F4").values = [headers];
  sheet.getRange(`A5:F${endRow}`).values = rows;

  sheet.getRange("A1:F1").format = { font: { name: "Arial", size: 16, bold: true, color: "#24333A" }, verticalAlignment: "center" };
  sheet.getRange("A2:F2").format = { font: { name: "Arial", size: 10, italic: true, color: "#5B6A70" }, wrapText: true, verticalAlignment: "center" };
  sheet.getRange("A4:F4").format = { fill: "#334A52", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: "#334A52" } };
  sheet.getRange(`A5:F${endRow}`).format = { font: { name: "Arial", size: 10, color: "#24333A" }, verticalAlignment: "center", wrapText: true, borders: { preset: "inside", style: "thin", color: "#D8E0DE" } };
  sheet.getRange(`A5:A${endRow}`).format = { font: { name: "Courier New", size: 10, color: "#5B6A70" }, horizontalAlignment: "center" };
  sheet.getRange(`C5:C${endRow}`).format = { fill: config.fill, font: { name: "Arial", size: 10, bold: true, color: config.fontColor }, horizontalAlignment: "center" };
  sheet.getRange(`E5:E${endRow}`).format.horizontalAlignment = "center";
  sheet.getRange("A1:F1").format.rowHeight = 28;
  sheet.getRange("A2:F2").format.rowHeight = 30;
  sheet.getRange("A4:F4").format.rowHeight = 24;
  sheet.getRange(`A5:F${endRow}`).format.rowHeight = 42;

  sheet.getRange(`A5:A${endRow}`).dataValidation = { rule: { type: "whole", operator: "between", formula1: Number(config.range.split("-")[0]) + 1, formula2: Number(config.range.split("-")[1]) } };
  sheet.getRange(`C5:C${endRow}`).dataValidation = { rule: { type: "list", values: [config.level] } };
  sheet.getRange(`E5:E${endRow}`).dataValidation = { rule: { type: "list", values: [true, false] } };
  const table = sheet.tables.add(`A4:F${endRow}`, true, config.tableName);
  table.style = "TableStyleMedium2";
  table.showFilterButton = true;
  sheet.freezePanes.freezeRows(4);
  sheet.getRange("A:A").format.columnWidth = 12;
  sheet.getRange("B:B").format.columnWidth = 16;
  sheet.getRange("C:C").format.columnWidth = 12;
  sheet.getRange("D:D").format.columnWidth = 58;
  sheet.getRange("E:E").format.columnWidth = 10;
  sheet.getRange("F:F").format.columnWidth = 24;
}

workbook.recalculate();
for (const config of sheetConfigs) {
  const inspection = await workbook.inspect({ kind: "table", range: `${config.name}!A1:F20`, include: "values,formulas", tableMaxRows: 20, tableMaxCols: 6 });
  console.log(inspection.ndjson);
  const preview = await workbook.render({ sheetName: config.name, range: "A1:F20", scale: 1.5, format: "png" });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(`${outputDir}/elite-ai-traits-${config.level}.png`, new Uint8Array(await preview.arrayBuffer()));
}
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 50 }, summary: "final formula error scan" });
console.log(errors.ndjson);
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(inputPath);
