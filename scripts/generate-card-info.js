/* Generate the browser card information module from the unified XLSX table. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "outputs", "card-info-table-xlsx", "card_info_v2.xlsx");
const targetPath = path.join(root, "card-info.js");
const replacementCardsPath = path.join(root, "replacement-cards.js");
const cardInfoSchemaVersion = "card-info-v2-display-effect-isolation-20260908";
const expectedHeaders = ["卡牌ID", "卡牌名称", "势力", "技能名称", "基础战力", "品质", "技能效果描述"];
const defaultDeckHeader = "默认卡组";
const legacyEffectTagHeader = "触发词条";
const cardIdPattern = /^0[1-3][1-5]\d{2}$/;

function cellText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function effectText(value) {
  return value === undefined || value === null ? "" : String(value);
}

function fail(message) {
  throw new Error(`卡牌信息表校验失败：${message}`);
}

if (!fs.existsSync(sourcePath)) fail(`找不到 ${sourcePath}`);
const workbook = XLSX.readFile(sourcePath, { cellText: false, cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
const headers = (rows.shift() || []).map(cellText);
const baseHeadersMatch = headers.length === expectedHeaders.length
  && headers.every((header, index) => header === expectedHeaders[index]);
// Accept the version with default deck column
const withDefaultDeckMatch = headers.length === expectedHeaders.length + 1
  && headers.slice(0, expectedHeaders.length).every((header, index) => header === expectedHeaders[index])
  && headers[expectedHeaders.length] === defaultDeckHeader;
// Accept the old workbook shape during migration, but never read its tag column.
const legacyHeadersMatch = headers.length === expectedHeaders.length + 1
  && headers.slice(0, expectedHeaders.length).every((header, index) => header === expectedHeaders[index])
  && headers[expectedHeaders.length] === legacyEffectTagHeader;
if (!baseHeadersMatch && !withDefaultDeckMatch && !legacyHeadersMatch) {
  fail(`列标题不匹配：${headers.join("、")}`);
}

const ids = new Set();
const cards = [];
const replacementCards = [];

rows.filter((row) => row.some((value) => cellText(value))).forEach((row, index) => {
  const rowNumber = index + 2;
  const values = expectedHeaders.map((_, column) => row[column]);
  const id = cellText(values[0]);
  if (!cardIdPattern.test(id)) fail(`第 ${rowNumber} 行卡牌 ID 无效：${id}`);
  if (ids.has(id)) fail(`卡牌 ID 重复：${id}`);
  ids.add(id);

  const baseAttack = Number(values[4]);
  if (!Number.isInteger(baseAttack) || baseAttack < 0) fail(`第 ${rowNumber} 行基础战力无效：${cellText(values[4])}`);

  const card = {
    id,
    name: cellText(values[1]),
    camp: cellText(values[2]),
    skill: cellText(values[3]),
    baseAttack,
    attack: baseAttack,
    rarity: cellText(values[5]),
    effect: effectText(values[6])
  };
  if (!card.name || !card.camp || !card.skill || !card.rarity || !card.effect) fail(`第 ${rowNumber} 行存在空的卡牌基础信息：${id}`);

  // 检查是否在默认卡组中
  const inDefaultDeck = withDefaultDeckMatch ? Number(row[expectedHeaders.length]) === 1 : true;

  if (inDefaultDeck) {
    cards.push(card);
  } else {
    replacementCards.push(card);
  }
});

if (cards.length !== 60) fail(`卡牌数量应为 60，实际为 ${cards.length}（可能是因为"默认卡组"列过滤）`);
const output = [
  "/* Generated from outputs/card-info-table-xlsx/card_info_v2.xlsx. */",
  "/* Run: npm run generate:card-info */",
  `const CARD_INFO = ${JSON.stringify(cards, null, 2)};`,
  `window.CARD_INFO_SCHEMA_VERSION = ${JSON.stringify(cardInfoSchemaVersion)};`,
  "window.CARD_INFO = CARD_INFO;",
  ""
].join("\n");

fs.writeFileSync(targetPath, output, "utf8");

// 生成替换卡牌文件
const replacementOutput = [
  "/* Generated from outputs/card-info-table-xlsx/card_info_v2.xlsx. */",
  "/* 这些卡牌可用于在修改卡组页面中替换默认卡组中相同品质的卡牌 */",
  "/* Run: npm run generate:card-info */",
  `const REPLACEMENT_CARDS = ${JSON.stringify(replacementCards, null, 2)};`,
  "window.REPLACEMENT_CARDS = REPLACEMENT_CARDS;",
  ""
].join("\n");

fs.writeFileSync(replacementCardsPath, replacementOutput, "utf8");

const cacheVersion = `card-info-${crypto.createHash("sha1").update(output).digest("hex").slice(0, 12)}`;
for (const htmlName of ["index.html", "card-test.html"]) {
  const htmlPath = path.join(root, htmlName);
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html
    .replace(/card-info\.js\?v=[^"']+/g, `card-info.js?v=${cacheVersion}`)
    .replace(/v2-card-data\.js\?v=[^"']+/g, `v2-card-data.js?v=${cacheVersion}`)
    .replace(/replacement-cards\.js\?v=[^"']+/g, `replacement-cards.js?v=${cacheVersion}`);
  fs.writeFileSync(htmlPath, html, "utf8");
}
console.log(`Generated ${path.relative(root, targetPath)} from ${path.relative(root, sourcePath)}: ${cards.length} cards`);
console.log(`Generated ${path.relative(root, replacementCardsPath)}: ${replacementCards.length} replacement cards`);
