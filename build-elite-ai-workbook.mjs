import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/codex_card/outputs";
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("词条维护");
sheet.showGridLines = false;
sheet.tabColor = "#8150B5";

sheet.getRange("A1:F1").merge();
sheet.getRange("A1").values = [["PVE 挑战模式 AI 词条维护"]];
sheet.getRange("A2:F2").merge();
sheet.getRange("A2").values = [["词条 ID 使用数字分段：1000-1999 初级，2000-2999 中级，3000-3999 高级。颜色由等级自动判定，不在表格中单独维护。"]];

const headers = [["词条 ID", "词条名称", "等级", "具体效果描述", "启用", "备注"]];
const rows = [
  [1001, "战备补给", "初级", "每个精英 AI 回合开始时，AI 额外抽取 1 张牌。", true, "初级 ID 段：1000-1999"],
  [1002, "战术储备", "初级", "精英 AI 每个自己的回合再额外获得 1 个行动位。", true, "初级 ID 段：1000-1999"],
  [2001, "铁壁军势", "中级", "每个精英 AI 回合开始时，AI 场上卡牌本回合战力 +1。", true, "中级 ID 段：2000-2999"],
  [3001, "猎杀标记", "高级", "每个精英 AI 回合开始时，敌方当前战力最高的卡牌本回合战力 -1。", true, "高级 ID 段：3000-3999"]
];
sheet.getRange("A4:F4").values = headers;
sheet.getRange("A5:F8").values = rows;

sheet.getRange("A1:F1").format = {
  font: { name: "Arial", size: 16, bold: true, color: "#24333A" },
  horizontalAlignment: "left",
  verticalAlignment: "center"
};
sheet.getRange("A2:F2").format = {
  font: { name: "Arial", size: 10, italic: true, color: "#5B6A70" },
  wrapText: true,
  verticalAlignment: "center"
};
sheet.getRange("A4:F4").format = {
  fill: "#334A52",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  borders: { preset: "outside", style: "thin", color: "#334A52" }
};
sheet.getRange("A5:F8").format = {
  font: { name: "Arial", size: 10, color: "#24333A" },
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#D8E0DE" }
};
sheet.getRange("A5:A8").format = { font: { name: "Courier New", size: 10, color: "#5B6A70" }, horizontalAlignment: "center" };
sheet.getRange("C5:C8").format.horizontalAlignment = "center";
sheet.getRange("E5:E8").format.horizontalAlignment = "center";
sheet.getRange("A1:F1").format.rowHeight = 28;
sheet.getRange("A2:F2").format.rowHeight = 34;
sheet.getRange("A4:F4").format.rowHeight = 24;
sheet.getRange("A5:F8").format.rowHeight = 42;

sheet.getRange("A5:A100").dataValidation = { rule: { type: "whole", operator: "between", formula1: 1001, formula2: 3999 } };
sheet.getRange("C5:C100").dataValidation = { rule: { type: "list", values: ["初级", "中级", "高级"] } };
sheet.getRange("E5:E100").dataValidation = { rule: { type: "list", values: [true, false] } };

sheet.getRange("C5:C100").conditionalFormats.add("containsText", {
  text: "初级",
  format: { fill: "#DCEBFA", font: { color: "#2F76C7", bold: true } }
});
sheet.getRange("C5:C100").conditionalFormats.add("containsText", {
  text: "中级",
  format: { fill: "#E9DDF5", font: { color: "#8150B5", bold: true } }
});
sheet.getRange("C5:C100").conditionalFormats.add("containsText", {
  text: "高级",
  format: { fill: "#FBE1CF", font: { color: "#D56B26", bold: true } }
});

const table = sheet.tables.add("A4:F8", true, "EliteAiTraitsTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;
sheet.freezePanes.freezeRows(4);
sheet.getRange("A:A").format.columnWidth = 12;
sheet.getRange("B:B").format.columnWidth = 16;
sheet.getRange("C:C").format.columnWidth = 12;
sheet.getRange("D:D").format.columnWidth = 58;
sheet.getRange("E:E").format.columnWidth = 10;
sheet.getRange("F:F").format.columnWidth = 24;

workbook.recalculate();
const inspect = await workbook.inspect({
  kind: "table",
  range: "词条维护!A1:F8",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 7
});
console.log(inspect.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan"
});
console.log(errors.ndjson);
const preview = await workbook.render({ sheetName: "词条维护", range: "A1:F8", scale: 1.5, format: "png" });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/elite-ai-traits-preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/elite-ai-traits.xlsx`);
