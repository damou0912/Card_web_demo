# AI 逻辑优化更新

## 新增功能

### 1. AI 自动认输逻辑
**函数**: `coreCheckAiSurrender(game, player)`

当满足以下条件时，AI 会自动认输：
- 手牌为空
- 牌库为空
- 场上没有己方卡牌

**实现细节**：
```javascript
const handEmpty = player.hand.length === 0;
const deckEmpty = player.drawPile.length === 0;
const boardEmpty = !game.boardCards.some((card) => card.ownerId === player.id && !card.isGuard);
return handEmpty && deckEmpty && boardEmpty;
```

### 2. 优势评估系统
**函数**: `coreCalculatePositionAdvantage(game, player)`

计算玩家当前的局面优势，包括：
- `controlDiff`: 占领格子数差值
- `powerDiff`: 战力差值
- `totalAdvantage`: 综合优势分值（占领格子差值 * 10 + 战力差值）

**计算逻辑**：
- 占领格子数差值 = 己方占领 - 敌方占领
- 战力差值 = 己方总战力 - 敌方总战力
- 综合分值将占领权重放大10倍，确保对格子控制的重视

### 3. 卡牌技能风险评估
**函数**: `coreEvaluateCardEffectRisk(game, player, card, isPlacement)`

评估卡牌技能效果可能带来的风险：

**检查的标志位**:
- `hasDangerousEffect`: 具有危险效果的卡牌（如反伤）
- `retaliate`: 反击类效果
- `needsSetup`: 需要特殊条件的卡牌
- `buffsAllies`: 强化友方的卡牌
- `avoidCombatWhenBehind`: 劣势时避免交战的卡牌

**风险评分**:
- 放置时有危险效果：-5 分
- 交战时触发反击：-2 到 -4 分（取决于战斗结果）
- 存在强化效果：+2 分

### 4. 行动结果模拟（增强版）
**函数**: `coreSimulateActionOutcome(game, player, action)`

在执行行动前，预测该行动对局面的影响，**现已包含卡牌技能评估**。

#### 放置行动 (type: "place")
- 计算新卡牌的战力
- 检查相邻敌方卡牌是否会立即交战
- **评估放置卡牌的技能风险**
- **评估相邻敌方卡牌的反击能力**
- 预测战斗结果对占领和战力的影响

#### 移动行动 (type: "move")
- 判断目标格子是否有敌方卡牌
- 计算交战胜负
- **评估我方卡牌的技能风险**
- **评估敌方卡牌的反击能力**
- **检查敌方卡牌是否具有特殊的劣势保护机制**
- 预测占领和战力的变化

### 5. 行动有益性判定
**函数**: `coreIsActionBeneficial(game, player, action)`

在执行行动前进行检查，判断该行动是否有益：

**判定规则**：
- 如果当前优势 >= 0：行动后优势 >= 行动前优势 则为有益
- 如果当前劣势 < 0：行动后优势 >= 行动前优势 则为有益（尽量减少劣势）

**示例**：
- 占优情况：拒绝会让优势减少的行动
- 劣势情况：接受任何能改善劣势的行动，即使不能扭转

### 6. 更新的 AI 回合执行
**函数**: `coreRunAiTurn(game)`

集成新逻辑的完整AI回合流程：

```javascript
async function coreRunAiTurn(game) {
  const ai = corePlayer(game, game.activePlayerId);
  
  // 1. 检查是否应该自动认输
  if (coreCheckAiSurrender(game, ai)) {
    await coreSurrender(game, ai.id);
    return;
  }
  
  // 2. 逐次执行有益的行动
  while (!game.winner && game.activePlayerId === ai.id && coreHasExecutableAction(game)) {
    const action = corePlanAiAction(game, ai);
    if (!action || !coreIsActionBeneficial(game, ai, action)) {
      await coreEndTurn(game, false);
      return;
    }
    await coreResolveAction(game, action);
    await wait(420);
  }
  
  // 3. 结束回合
  if (!game.winner && game.activePlayerId === ai.id) {
    await coreEndTurn(game, true);
  }
}
```

## 行为改变

### 之前的 AI 行为
- 无论局面如何都会继续执行行动直到无法执行
- 没有考虑行动对优势的影响
- 不会主动认输

### 现在的 AI 行为
1. **更智能的决策**：在执行每个行动前，评估是否会减少优势
2. **主动认输**：当完全无力回天时主动认输而非继续浪费时间
3. **灵活的策略**：
   - 占优时：保守行动，避免冒险
   - 劣势时：积极出击，尽量改善局面

## 测试验证

所有函数已通过语法检查，并已添加到导出 API 中供测试使用。

### 相关测试用例建议

1. **认输测试**
   - 创建手牌、牌库、场地都空的局面
   - 验证 AI 是否主动认输

2. **占优保守测试**
   - 创建 AI 占优的局面
   - 验证 AI 拒绝会减少优势的行动

3. **劣势进攻测试**
   - 创建 AI 劣势的局面
   - 验证 AI 优先执行能改善局面的行动

4. **平衡局面测试**
   - 创建势均力敌的局面
   - 验证 AI 的最优选择

## 代码位置

- 文件：`core-v2.js`
- 新函数位置：紧接在 `coreAiMoveScore` 和 `corePlanAiAction` 之后
- 修改的函数：`coreRunAiTurn`（原位置保持不变，逻辑大幅增强）
