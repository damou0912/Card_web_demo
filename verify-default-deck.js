#!/usr/bin/env node
/**
 * 验证默认卡组配置
 * 检查：
 * 1. card-info.js 中只包含60张卡牌
 * 2. 那10张不在默认卡组的卡牌被正确过滤
 * 3. 所有卡牌信息完整
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

console.log('🔍 开始验证默认卡组配置...\n');

// 1. 读取Excel文件
const excelPath = path.join(__dirname, 'outputs', 'card-info-table-xlsx', 'card_info_v2.xlsx');
const workbook = XLSX.readFile(excelPath, { cellText: false, cellDates: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });

const headers = rows.shift();
console.log('📊 Excel 表格信息：');
console.log(`   列数：${headers.length}`);
console.log(`   列名：${headers.join(', ')}`);

// 识别默认卡组列的位置
const defaultDeckColIndex = headers.indexOf('默认卡组');
console.log(`   默认卡组列索引：${defaultDeckColIndex}\n`);

// 提取Excel中的卡牌配置
const excelCards = new Map();
const inDefaultDeck = new Set();
const notInDefaultDeck = new Set();

rows.forEach((row, idx) => {
  if (!row.length || !row[0]) return;

  const cardId = String(row[0]).padStart(5, '0');
  const cardName = row[1];
  const isInDefault = Number(row[defaultDeckColIndex]) === 1;

  excelCards.set(cardId, { name: cardName, inDefault: isInDefault });

  if (isInDefault) {
    inDefaultDeck.add(cardId);
  } else {
    notInDefaultDeck.add(cardId);
  }
});

console.log('📑 Excel 配置统计：');
console.log(`   总卡牌数：${excelCards.size}`);
console.log(`   默认卡组中：${inDefaultDeck.size} 张`);
console.log(`   不在默认卡组中：${notInDefaultDeck.size} 张\n`);

console.log('   不在默认卡组的卡牌：');
Array.from(notInDefaultDeck).sort().forEach(id => {
  const card = excelCards.get(id);
  console.log(`     ${id} - ${card.name}`);
});

// 2. 读取生成的 card-info.js
const cardInfoPath = path.join(__dirname, 'card-info.js');
const cardInfoContent = fs.readFileSync(cardInfoPath, 'utf8');
const match = cardInfoContent.match(/const CARD_INFO = (\[[\s\S]*?\]);/);

if (!match) {
  console.error('❌ 无法解析 card-info.js');
  process.exit(1);
}

const CARD_INFO = JSON.parse(match[1]);
console.log('\n📄 card-info.js 配置统计：');
console.log(`   总卡牌数：${CARD_INFO.length}`);

const generatedIds = new Set(CARD_INFO.map(c => c.id));

// 3. 验证一致性
console.log('\n✅ 验证卡牌过滤：');
let allCorrect = true;

// 验证被过滤的卡牌确实不在生成的列表中
console.log('   检查不在默认卡组的卡牌是否被过滤...');
for (const id of notInDefaultDeck) {
  if (generatedIds.has(id)) {
    console.log(`     ❌ ${id} 未被过滤（应该被排除）`);
    allCorrect = false;
  }
}
if (Array.from(notInDefaultDeck).every(id => !generatedIds.has(id))) {
  console.log(`     ✓ 所有 ${notInDefaultDeck.size} 张不在默认卡组的卡牌都被正确过滤`);
}

// 验证在默认卡组的卡牌都在生成的列表中
console.log('   检查默认卡组的卡牌是否都被包含...');
for (const id of inDefaultDeck) {
  if (!generatedIds.has(id)) {
    console.log(`     ❌ ${id} 缺失（应该被包含）`);
    allCorrect = false;
  }
}
if (Array.from(inDefaultDeck).every(id => generatedIds.has(id))) {
  console.log(`     ✓ 所有 ${inDefaultDeck.size} 张默认卡组卡牌都被正确包含`);
}

// 4. 统计分析
console.log('\n📈 卡牌分布分析：');

// 按势力统计
const campStats = {};
CARD_INFO.forEach(card => {
  campStats[card.camp] = (campStats[card.camp] || 0) + 1;
});
console.log('   按势力分布：');
Object.entries(campStats).sort().forEach(([camp, count]) => {
  console.log(`     ${camp}: ${count} 张`);
});

// 按品质统计
const rarityStats = {};
CARD_INFO.forEach(card => {
  rarityStats[card.rarity] = (rarityStats[card.rarity] || 0) + 1;
});
console.log('   按品质分布：');
const rarityOrder = ['普通', '稀有', '史诗', '传说', '特殊'];
rarityOrder.forEach(rarity => {
  if (rarityStats[rarity]) {
    console.log(`     ${rarity}: ${rarityStats[rarity]} 张`);
  }
});

// 5. 验证卡牌数据完整性
console.log('\n🔎 卡牌数据完整性检查：');
let missingFields = 0;
CARD_INFO.forEach((card, idx) => {
  const fields = ['id', 'name', 'camp', 'skill', 'rarity', 'effect'];
  for (const field of fields) {
    if (!card[field]) {
      console.log(`   ❌ 卡牌 ${idx} 缺少字段：${field}`);
      missingFields++;
    }
  }
  // baseAttack 和 attack 必须是整数或0
  if (!Number.isInteger(card.baseAttack) || card.baseAttack < 0) {
    console.log(`   ❌ 卡牌 ${idx}(${card.id}) baseAttack 无效：${card.baseAttack}`);
    missingFields++;
  }
});
if (missingFields === 0) {
  console.log('   ✓ 所有卡牌数据完整');
}

// 最终结果
console.log('\n' + '='.repeat(50));
if (allCorrect && missingFields === 0 && CARD_INFO.length === 60) {
  console.log('✅ 所有验证通过！默认卡组配置正确');
  console.log(`   - ${CARD_INFO.length} 张卡牌已生成`);
  console.log(`   - ${notInDefaultDeck.size} 张不在默认卡组的卡牌已过滤`);
  console.log('   - 卡牌数据完整');
  process.exit(0);
} else {
  console.log('❌ 验证失败，请检查配置');
  process.exit(1);
}
