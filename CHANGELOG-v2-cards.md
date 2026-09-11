# 新增蜀卡和技能修复报告

**提交哈希**: 0dff454  
**日期**: 2026-09-11  
**涉及文件**: `card-info.js`, `shu-card-effects.js`, `wei-card-effects.js`

---

## 📊 新增卡牌统计

### 蜀卡总数
- **原有**: 20张 (01101-01520)
- **新增**: 10张 (01121-01530)
- **现有**: 30张

### 新增卡牌列表

#### 普通卡 (4张)
| ID | 名称 | 技能 | 战力 | 效果 |
|----|------|------|------|------|
| 01121 | 李恢 | 回驰 | 2 | 起势：随机交换自身与四方相邻一张卡牌的位置 |
| 01122 | 张任 | 锐进 | 2 | 起势：向四方相邻一张敌方卡牌发起攻击；若成功摧毁战力永久+1 |
| 01123 | 陈到 | 白毦 | 1 | 入阵：本回合我方卡牌不会进入休整状态 |
| 01124 | 刘封 | 鼎力 | 3 | 起势：战力-1；摧毁四方相邻战力低于此卡的非我方卡牌 |

#### 稀有卡 (3张)
| ID | 名称 | 技能 | 战力 | 效果 |
|----|------|------|------|------|
| 01225 | 刘琦 | 继任 | 1 | 入阵：此卡无法被移动；四方相邻敌方卡牌无法移动。遗志：锁定解除 |
| 01226 | 法正 | 密策 | 1 | 起势：本回合第一张放置的卡牌战力+2 |
| 01227 | 蒋琬 | 安国 | 1 | 起势：若四方相邻的合法格子内都为友军则行动数+1 |

#### 史诗卡 (1张)
| ID | 名称 | 技能 | 战力 | 效果 |
|----|------|------|------|------|
| 01328 | 张飞 | 万夫莫当 | 4 | 入阵：攻击四方相邻随机一张敌方卡牌。攻击后若成功摧毁则再攻击。起势：战力-2 |

#### 传说卡 (1张)
| ID | 名称 | 技能 | 战力 | 效果 |
|----|------|------|------|------|
| 01429 | 刘备 | 汉室中兴 | 1 | 起势：我方卡牌战力+1。敌方卡牌战力无法增加。无法移动 |

#### 特殊卡 (1张)
| ID | 名称 | 技能 | 战力 | 效果 |
|----|------|------|------|------|
| 01530 | 七星灯 | 星落五丈原 | 0 | 我方其他卡牌被摧毁时此卡战力-3免疫摧毁。收势：摧毁我方其他战力为0的卡牌 |

---

## 🔧 技能实现修复

### 修复的卡牌

#### ❌→✅ 01121 李恢 (回驰)
**问题**: 只能交换友军，应包括敌方

**修改前**:
```javascript
const allies = ctx.allies();  // 只获取友军
```

**修改后**:
```javascript
const adjacent = ctx.adjacent();  // 包括敌方和友方
```

---

#### ❌→✅ 01122 张任 (锐进)
**问题**: 逻辑反转，没有摧毁才加战力

**修改前**:
```javascript
if (!target.destroyed) {  // ❌ 反了
  ctx.adjust(ctx.card, 1);
}
```

**修改后**:
```javascript
if (target.destroyed) {  // ✓ 正确
  ctx.adjust(ctx.card, 1);
}
```

---

#### ❌→✅ 01226 法正 (密策)
**问题**: 只设置标记，未实际应用效果

**修改前**:
```javascript
onTurnStart(ctx) {
  ctx.player.v2FirstPlaceBonus = 2;  // ❌ 仅设置标记
}
```

**修改后**:
```javascript
onTurnStart(ctx) {
  ctx.player.v2FirstPlaceThisTurn = null;  // 重置标记
},
onOtherCardPlace(ctx, placedCard) {
  if (placedCard.ownerId === ctx.card.ownerId && !ctx.player.v2FirstPlaceThisTurn) {
    ctx.player.v2FirstPlaceThisTurn = placedCard;
    ctx.adjust(placedCard, 2);  // ✓ 实际加战力
  }
}
```

---

#### ❌→✅ 01227 蒋琬 (安国)
**问题**: 边角位置逻辑错误，不考虑战场边界

**修改前**:
```javascript
if (adjacentCount === 4 || (adjacentCount > 0 && adjacentCount === ctx.enemies().length)) {
  // ❌ 不考虑边界
}
```

**修改后**:
```javascript
const validDirections = directions.filter((dir) => {
  return dir.row >= 0 && dir.row < 5 && dir.col >= 0 && dir.col < 5;
});

const allValidDirectionsHaveAllies = validDirections.length > 0 && 
  validDirections.every((dir) => {
    const card = ctx.board.find((c) => c.row === dir.row && c.col === dir.col);
    return card && card.ownerId === ctx.card.ownerId;
  });

if (allValidDirectionsHaveAllies) {
  ctx.addActions(ctx.player, 1);  // ✓ 正确处理边角
}
```

---

#### ❌→✅ 01429 刘备 (汉室中兴)
**问题**: 完全禁止敌方战力调整，应仅禁止增加

**修改前**:
```javascript
onBeforeAdjust(ctx, target) {
  if (target.ownerId !== ctx.card.ownerId) {
    return 0;  // ❌ 禁止所有调整
  }
}
```

**修改后**:
```javascript
onBeforeAdjust(ctx, target, amount) {
  // 仅禁止增加，允许减少
  if (target.ownerId !== ctx.card.ownerId && amount > 0) {
    return 0;  // ✓ 仅禁止增加
  }
}
```

---

#### ❌→✅ 02313 许褚 (虎痴震岳)
**问题**: 入阵战力数值不匹配

**描述**: 入阵：战力+8  
**实现**: 仅+5

**修改前**:
```javascript
ctx.adjust(ctx.card, 5);  // ❌
```

**修改后**:
```javascript
ctx.adjust(ctx.card, 8);  // ✓ 符合描述
```

---

## ✅ 测试验证

所有10张新增卡牌已通过边界测试：

| 卡牌 | 测试场景 | 结果 |
|----|---------|------|
| 01121 李恢 | 与友军和敌方交换 | ✓ PASS |
| 01122 张任 | 成功摧毁敌卡加战力 | ✓ PASS |
| 01123 陈到 | 本回合不进入休整 | ✓ PASS |
| 01124 刘封 | 战力-1后摧毁低战卡 | ✓ PASS |
| 01225 刘琦 | 锁定/解锁机制 | ✓ PASS |
| 01226 法正 | 第一张放置卡牌+2 | ✓ PASS |
| 01227 蒋琬 | 边角四面友军+1行动 | ✓ PASS |
| 01328 张飞 | 连续攻击逻辑 | ✓ PASS |
| 01429 刘备 | 我方+1，敌方禁增 | ✓ PASS |
| 01530 七星灯 | 代替摧毁+清理0战力 | ✓ PASS |

---

## 📁 文件变更

### 修改文件
- **card-info.js** (+140 行)
  - 新增10张蜀卡的卡牌信息数据
  
- **shu-card-effects.js** (+136 行)
  - 新增10张蜀卡的技能效果实现
  - 修复01121、01122、01226、01227

- **wei-card-effects.js** (+2 行)
  - 修复02313许褚战力数值

### 测试文件（未提交）
- `test-all-cards.js` - 完整测试套件
- `test-new-shu-cards.html` - HTML测试页面
- 其他临时文件已清理

---

## 🎯 总结

✅ **新增**: 10张蜀卡 (30张蜀卡总计)  
✅ **修复**: 6张卡的技能实现不一致  
✅ **验证**: 所有新卡通过边界测试  
✅ **提交**: Commit 0dff454
