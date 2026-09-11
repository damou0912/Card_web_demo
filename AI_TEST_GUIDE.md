# AI 逻辑测试指南

## 功能测试清单

### ✅ Test 1: AI 自动认输
**场景**: 创建一个 AI 完全无力的局面
- 手牌数: 0
- 牌库数: 0  
- 场地卡数: 0

**预期结果**: AI 应主动认输，显示认输消息

**验证步骤**:
```javascript
// 在浏览器控制台运行
const game = state.game;
const ai = game.players[1]; // 假设 AI 是玩家2
console.log("手牌:", ai.hand.length); // 应为 0
console.log("牌库:", ai.drawPile.length); // 应为 0
console.log("场地:", game.boardCards.filter(c => c.ownerId === ai.id).length); // 应为 0
```

---

### ✅ Test 2: 占优局面保守行动
**场景**: AI 占领 3+ 格，战力领先 10+
- AI 占领: 4 格
- 玩家占领: 1 格
- AI 战力: 20
- 玩家战力: 8

**预期结果**: 
- AI 优先选择稳定的防守行动
- 拒绝风险较大的进攻
- 不会尝试不利于的交战

**检验方法**:
```javascript
const advantage = coreCalculatePositionAdvantage(game, ai);
console.log("优势评分:", advantage.totalAdvantage);
// 应该 > 0（占优）
```

---

### ✅ Test 3: 劣势局面积极进攻
**场景**: AI 占领 1 格，战力落后 15
- AI 占领: 1 格
- 玩家占领: 4 格
- AI 战力: 5
- 玩家战力: 20

**预期结果**:
- AI 会尝试任何能改善局面的行动
- 接受较高风险的交战机会
- 优先击杀敌方卡牌以减少劣势

**检验方法**:
```javascript
const advantage = coreCalculatePositionAdvantage(game, ai);
console.log("劣势评分:", advantage.totalAdvantage);
// 应该 < 0（劣势）
```

---

### ✅ Test 4: 卡牌技能风险评估
**场景**: 放置具有不同技能的卡牌

#### 测试 4a: 强化卡牌
放置"鼓舞"卡牌（buffsAllies）
- **预期**: 获得 +2 风险评分，倾向于放置

#### 测试 4b: 反击卡牌
在反击卡旁放置弱卡
- **预期**: 获得 -2 到 -4 风险评分，可能拒绝

#### 测试 4c: 危险效果卡
放置具有 hasDangerousEffect 标志的卡牌
- **预期**: 获得 -5 风险评分，倾向于避免

**验证代码**:
```javascript
const card = ai.hand[0];
const riskScore = coreEvaluateCardEffectRisk(game, ai, card, true);
console.log("技能风险评分:", riskScore);
```

---

### ✅ Test 5: 行动结果预测
**场景**: 预测放置卡牌的影响

#### 测试 5a: 放置强势卡
放置战力 8 的卡牌在敌方战力 5 的卡旁
```javascript
const action = { type: "place", playerId: ai.id, cardUid: card.uid, target: cell };
const outcome = coreSimulateActionOutcome(game, ai, action);
console.log("预测优势变化:", outcome.totalAdvantage - before.totalAdvantage);
// 应为正数（+占领 +战力 +技能评分）
```

#### 测试 5b: 放置弱势卡
放置战力 2 的卡牌在敌方战力 8 的卡旁
```javascript
const action = { type: "place", playerId: ai.id, cardUid: card.uid, target: cell };
const outcome = coreSimulateActionOutcome(game, ai, action);
console.log("预测优势变化:", outcome.totalAdvantage - before.totalAdvantage);
// 应为负数（失去战力）
```

---

### ✅ Test 6: 有益性判定
**场景**: 验证 AI 是否执行有益的行动

#### 测试 6a: 好的行动
- 前状态优势: 10
- 行动后优势: 15
- **预期**: 接受该行动

#### 测试 6b: 坏的行动
- 前状态优势: 10
- 行动后优势: 5
- **预期**: 拒绝该行动（如果还有更好的选择）

**验证代码**:
```javascript
const beneficial = coreIsActionBeneficial(game, ai, action);
console.log("行动有益?", beneficial); // true 或 false
```

---

### ✅ Test 7: 完整回合流程
**场景**: 观察一个完整的 AI 回合

**检查点**:
1. 回合开始时是否检查认输条件 ✓
2. 是否计划行动 ✓
3. 是否评估行动有益性 ✓
4. 是否拒绝有害行动 ✓
5. 是否在无法继续时结束回合 ✓

**控制台监控**:
```javascript
// 打开控制台，观察日志
const game = state.game;
console.log("=== AI 回合流程 ===");
console.log("回合数:", game.turn);
console.log("当前玩家:", game.players[game.activePlayerId - 1].name);
console.log("已用行动:", game.actionsUsed, "/", coreActionLimit(game));
```

---

## 精英词条交互测试

### ✅ Test 8: 词条与 AI 行动
**场景**: 挑战模式下的词条影响

#### 测试 8a: 强化词条
- 词条: "鼓舞"（回合开始+1 战力）
- **预期**: AI 评估考虑词条加成的战力值

#### 测试 8b: 限制词条
- 词条: "关山急"（己方最低战力 2）
- **预期**: AI 放置战力 1 的卡牌时考虑自动提升

#### 测试 8c: 手牌限制词条
- 词条: "断粮"（手牌始终为1）
- **预期**: AI 认为自己的手牌上限为 1，调整策略

**验证步骤**:
```javascript
const handLimit = coreHandLimitForPlayer(game, ai);
console.log("AI 手牌上限:", handLimit);
```

---

## 性能与边界测试

### ✅ Test 9: 性能测试
**场景**: 大量卡牌时的决策速度

- 棋盘大小: 5x5
- AI 卡牌数: 8
- 玩家卡牌数: 8

**预期**: 决策时间 < 500ms

**监控代码**:
```javascript
const start = performance.now();
const action = corePlanAiAction(game, ai);
const duration = performance.now() - start;
console.log("规划时间:", duration.toFixed(2), "ms");
```

---

### ✅ Test 10: 边界情况
**测试项**:
1. ✓ 手牌为空，牌库非空 → 应继续行动
2. ✓ 牌库为空，手牌非空 → 应继续行动
3. ✓ 场地仅有一张卡 → 应能评估
4. ✓ 没有可执行的行动 → 应立即结束回合
5. ✓ 敌方无卡时 → 应直接占领

---

## 调试技巧

### 启用 AI 行动日志
```javascript
// 在 coreRunAiTurn 中添加日志
console.log("[AI] 当前优势:", coreCalculatePositionAdvantage(game, ai).totalAdvantage);
console.log("[AI] 规划行动:", action);
console.log("[AI] 行动有益?", coreIsActionBeneficial(game, ai, action));
```

### 逐步执行一个回合
```javascript
const game = state.game;
const ai = game.players[1];

// 1. 检查认输
if (coreCheckAiSurrender(game, ai)) {
  console.log("[AI] 应该认输");
  await coreSurrender(game, ai.id);
}

// 2. 规划行动
const action = corePlanAiAction(game, ai);
console.log("[AI] 规划的行动:", action);

// 3. 评估行动
const beneficial = coreIsActionBeneficial(game, ai, action);
console.log("[AI] 行动有益?", beneficial);

// 4. 执行或结束
if (beneficial) {
  await coreResolveAction(game, action);
} else {
  await coreEndTurn(game, false);
}
```

---

## 结果验收标准

| 功能 | 通过条件 |
|------|--------|
| 自动认输 | 无资源时主动认输 |
| 占优保守 | 优先选择低风险行动 |
| 劣势进攻 | 接受高风险改善机会 |
| 技能评估 | 正确识别卡牌特性 |
| 结果预测 | 预测与实际结果偏差 < 5% |
| 完整流程 | 无异常，流程通顺 |
