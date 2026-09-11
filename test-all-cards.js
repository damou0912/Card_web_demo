const fs = require('fs');

// 模拟浏览器环境
global.window = {
  CARD_INFO: [],
  CARD_INFO_SCHEMA_VERSION: "",
  CARD_EFFECTS_V2: {}
};

// 加载卡牌数据
const cardInfo = fs.readFileSync('card-info.js', 'utf8').replace(/^window\./, 'global.window.');
eval(cardInfo);

// 加载蜀卡效果
const shuEffects = fs.readFileSync('shu-card-effects.js', 'utf8').replace(/^window\./, 'global.window.');
eval(shuEffects);

// Mock Context
class MockContext {
  constructor(card, player = {}, enemy = {}, board = []) {
    this.card = card;
    this.player = player;
    this.otherPlayer = enemy;
    this.board = board;
    this.destroyed = [];
    this.adjusted = [];
    this.logs = [];
  }

  allies() {
    return this.board.filter(c => c && c.ownerId === this.card.ownerId && c !== this.card);
  }

  enemies() {
    return this.board.filter(c => c && c.ownerId && c.ownerId !== this.card.ownerId);
  }

  adjacent() {
    return this.board.filter(c => c && this.isAdjacent(this.card, c));
  }

  isAdjacent(c1, c2) {
    if (!c1 || !c2) return false;
    const dist = Math.abs((c1.row || 0) - (c2.row || 0)) + Math.abs((c1.col || 0) - (c2.col || 0));
    return dist === 1;
  }

  adjust(card, amount, temp = false) {
    if (!card) return;
    this.adjusted.push({ card: card.name, amount, temp });
    card.currentAttack = Math.max(0, (card.currentAttack || 0) + amount);
  }

  destroy(card) {
    if (!card) return;
    this.destroyed.push(card.name);
    card.destroyed = true;
  }

  pickRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  canFight(c1, c2) {
    return this.isAdjacent(c1, c2);
  }

  skillAttack(attacker, defender) {
    if (!attacker || !defender) return;
    const aAtk = attacker.currentAttack || 0;
    const dAtk = defender.currentAttack || 0;
    if (aAtk > dAtk) {
      this.destroy(defender);
    } else if (aAtk === dAtk) {
      this.destroy(attacker);
      this.destroy(defender);
    } else {
      this.destroy(attacker);
    }
  }

  canSwap(c1, c2) {
    return true;
  }

  swap(c1, c2) {
    if (!c1 || !c2) return;
    const temp = { row: c1.row, col: c1.col };
    c1.row = c2.row;
    c1.col = c2.col;
    c2.row = temp.row;
    c2.col = temp.col;
  }

  addActions(player, count) {
    this.logs.push(`action:${count}`);
  }

  log(msg) {
    this.logs.push(msg);
  }
}

// 测试 01123 陈到
console.log("\n测试 01123 陈到 - 白毦");
try {
  const card = { id: "01123", name: "陈到", ownerId: 1, row: 1, col: 1, currentAttack: 1 };
  const player = { cards: [card] };
  const ctx = new MockContext(card, player, {}, [card]);

  if (global.window.CARD_EFFECTS_V2.shu["01123"].onPlace) {
    global.window.CARD_EFFECTS_V2.shu["01123"].onPlace(ctx);
  }

  console.log("Result:", card.v2NoRest === true ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01124 刘封
console.log("\n测试 01124 刘封 - 鼎力");
try {
  const card = { id: "01124", name: "刘封", ownerId: 1, row: 1, col: 1, currentAttack: 3 };
  const lowEnemy = { id: "02101", name: "曹洪", ownerId: 2, row: 0, col: 1, currentAttack: 1, destroyed: false };
  const equalEnemy = { id: "02102", name: "曹休", ownerId: 2, row: 1, col: 0, currentAttack: 2, destroyed: false };
  const board = [card, lowEnemy, equalEnemy];
  const ctx = new MockContext(card, {}, {}, board);

  console.log("Before: card=", card.currentAttack, "lowEnemy=", lowEnemy.currentAttack, "equalEnemy=", equalEnemy.currentAttack);

  if (global.window.CARD_EFFECTS_V2.shu["01124"].onTurnStart) {
    global.window.CARD_EFFECTS_V2.shu["01124"].onTurnStart(ctx);
  }

  console.log("After: card=", card.currentAttack);
  console.log("Destroyed:", ctx.destroyed);
  console.log("Result:", card.currentAttack === 2 && lowEnemy.destroyed && !equalEnemy.destroyed ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01225 刘琦
console.log("\n测试 01225 刘琦 - 继任");
try {
  const card = { id: "01225", name: "刘琦", ownerId: 1, row: 1, col: 1, currentAttack: 1 };
  const enemy = { id: "02101", name: "曹洪", ownerId: 2, row: 0, col: 1, currentAttack: 1 };
  const board = [card, enemy];
  const ctx = new MockContext(card, {}, {}, board);

  if (global.window.CARD_EFFECTS_V2.shu["01225"].onPlace) {
    global.window.CARD_EFFECTS_V2.shu["01225"].onPlace(ctx);
  }
  const placeLocked = card.v2Locked && enemy.v2Locked;
  console.log("After onPlace: card.v2Locked=", card.v2Locked, "enemy.v2Locked=", enemy.v2Locked);

  if (global.window.CARD_EFFECTS_V2.shu["01225"].onDestroy) {
    global.window.CARD_EFFECTS_V2.shu["01225"].onDestroy(ctx);
  }
  const destroyUnlocked = !enemy.v2Locked;
  console.log("After onDestroy: enemy.v2Locked=", enemy.v2Locked);

  console.log("Result:", placeLocked && destroyUnlocked ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01227 蒋琬
console.log("\n测试 01227 蒋琬 - 安国（边角测试）");
try {
  const card = { id: "01227", name: "蒋琬", ownerId: 1, row: 0, col: 0, currentAttack: 1 };
  const right = { id: "01101", name: "廖化", ownerId: 1, row: 0, col: 1 };
  const down = { id: "01102", name: "王平", ownerId: 1, row: 1, col: 0 };
  const board = [card, right, down];
  const player = { cards: board };
  const ctx = new MockContext(card, player, {}, board);

  console.log("蒋琬在角落(0,0)，仅有右和下两个友军");

  if (global.window.CARD_EFFECTS_V2.shu["01227"].onTurnStart) {
    global.window.CARD_EFFECTS_V2.shu["01227"].onTurnStart(ctx);
  }

  const hasAction = ctx.logs.some(l => l.includes("action"));
  console.log("Result:", hasAction ? "✓ PASS" : "✗ FAIL (无行动数加成)");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01328 张飞
console.log("\n测试 01328 张飞 - 万夫莫当");
try {
  const card = { id: "01328", name: "张飞", ownerId: 1, row: 1, col: 1, currentAttack: 4 };
  const enemy1 = { id: "02101", name: "曹洪", ownerId: 2, row: 0, col: 1, currentAttack: 2, destroyed: false };
  const enemy2 = { id: "02102", name: "曹休", ownerId: 2, row: 1, col: 0, currentAttack: 1, destroyed: false };
  const board = [card, enemy1, enemy2];
  const ctx = new MockContext(card, {}, {}, board);

  console.log("Before: card=", card.currentAttack);

  if (global.window.CARD_EFFECTS_V2.shu["01328"].onPlace) {
    global.window.CARD_EFFECTS_V2.shu["01328"].onPlace(ctx);
  }

  if (global.window.CARD_EFFECTS_V2.shu["01328"].onTurnStart) {
    global.window.CARD_EFFECTS_V2.shu["01328"].onTurnStart(ctx);
  }

  console.log("After: card=", card.currentAttack);
  console.log("Destroyed count:", ctx.destroyed.length);
  console.log("Result:", ctx.destroyed.length >= 1 && card.currentAttack === 2 ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01429 刘备
console.log("\n测试 01429 刘备 - 汉室中兴");
try {
  const card = { id: "01429", name: "刘备", ownerId: 1, row: 1, col: 1, currentAttack: 1 };
  const ally = { id: "01101", name: "廖化", ownerId: 1, currentAttack: 2 };
  const enemy = { id: "02101", name: "曹洪", ownerId: 2, currentAttack: 1 };
  const player = { cards: [card, ally] };
  const ctx = new MockContext(card, player, {}, [card, ally, enemy]);

  console.log("Before: ally=", ally.currentAttack);

  if (global.window.CARD_EFFECTS_V2.shu["01429"].onTurnStart) {
    global.window.CARD_EFFECTS_V2.shu["01429"].onTurnStart(ctx);
  }

  console.log("After: ally=", ally.currentAttack);

  // 测试敌方无法增加
  const beforeAdjust = global.window.CARD_EFFECTS_V2.shu["01429"].onBeforeAdjust;
  const canIncrease = beforeAdjust(ctx, enemy, 1) !== 0;
  const canDecrease = beforeAdjust(ctx, enemy, -1) !== 0;

  console.log("Enemy can increase (+1):", canIncrease, "can decrease (-1):", canDecrease);
  console.log("Result:", ally.currentAttack === 3 && !canIncrease && canDecrease ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

// 测试 01530 七星灯
console.log("\n测试 01530 七星灯 - 星落五丈原");
try {
  const card = { id: "01530", name: "七星灯", ownerId: 1, row: 1, col: 1, currentAttack: 3 };
  const ally = { id: "01101", name: "廖化", ownerId: 1, currentAttack: 0 };
  const player = { cards: [card, ally] };
  const ctx = new MockContext(card, player, {}, [card, ally]);

  console.log("Before: card=", card.currentAttack, "ally=", ally.currentAttack);

  const beforeDestroy = global.window.CARD_EFFECTS_V2.shu["01530"].onBeforeAllyDestroy;
  const result = beforeDestroy(ctx);

  console.log("After onBeforeAllyDestroy: card=", card.currentAttack, "result=", result);

  if (global.window.CARD_EFFECTS_V2.shu["01530"].onTurnEnd) {
    global.window.CARD_EFFECTS_V2.shu["01530"].onTurnEnd(ctx);
  }

  console.log("After onTurnEnd: destroyed=", ctx.destroyed);
  console.log("Result:", card.currentAttack === 0 && result === false && ctx.destroyed.includes("廖化") ? "✓ PASS" : "✗ FAIL");
} catch (e) {
  console.log("ERROR:", e.message);
}

console.log("\n========== 测试完成 ==========");
