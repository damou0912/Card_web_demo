/**
 * 技能摧毁效果示例
 * 展示如何在卡牌效果中使用新的技能摧毁特效
 */

// 示例 1: 简单的技能摧毁
{
  id: "01001",
  name: "爆破术",
  skill: "法术摧毁",
  effect: function(game, card, actions) {
    // 摧毁目标卡牌，使用技能摧毁特效
    const targetCard = game.boardCards.find(c => c.ownerId !== card.ownerId);

    if (targetCard) {
      // 从棋盘移除卡牌
      game.boardCards.splice(game.boardCards.indexOf(targetCard), 1);

      // 添加摧毁事件，带技能摧毁特效
      if (!game.destroy) game.destroy = [];
      game.destroy.push({
        kind: "destroy",
        cardId: targetCard.id,
        ownerId: targetCard.ownerId,
        destruction: {
          kind: "skill",           // 标记为技能摧毁
          isSkillEffect: true,
          label: "被爆破术摧毁"
        }
      });

      return {
        success: true,
        message: `摧毁了对方的 ${targetCard.name}`
      };
    }
    return { success: false, message: "没有可摧毁的目标" };
  }
}

// 示例 2: 连锁摧毁多张卡牌
{
  id: "01002",
  name: "连锁爆炸",
  skill: "全场摧毁",
  effect: function(game, card, actions) {
    const targetCards = game.boardCards.filter(c =>
      c.ownerId !== card.ownerId && !c.isGuard
    );

    targetCards.forEach(targetCard => {
      game.boardCards.splice(game.boardCards.indexOf(targetCard), 1);

      if (!game.destroy) game.destroy = [];
      game.destroy.push({
        kind: "destroy",
        cardId: targetCard.id,
        ownerId: targetCard.ownerId,
        destruction: {
          kind: "skill",
          label: "被连锁爆炸摧毁"
        }
      });
    });

    return {
      success: true,
      message: `摧毁了 ${targetCards.length} 张卡牌`
    };
  }
}

// 示例 3: 条件性摧毁
{
  id: "01003",
  name: "精准打击",
  skill: "摧毁低攻",
  effect: function(game, card, actions) {
    const lowAttackCards = game.boardCards.filter(c =>
      c.ownerId !== card.ownerId && c.currentAttack <= 3
    );

    lowAttackCards.forEach(targetCard => {
      game.boardCards.splice(game.boardCards.indexOf(targetCard), 1);

      if (!game.destroy) game.destroy = [];
      game.destroy.push({
        kind: "destroy",
        cardId: targetCard.id,
        ownerId: targetCard.ownerId,
        destruction: {
          kind: "skill",
          label: "被精准打击摧毁"
        }
      });
    });

    return {
      success: true,
      message: `摧毁了 ${lowAttackCards.length} 张攻击力≤3的卡牌`
    };
  }
}

// 示例 4: 使用其他摧毁类型进行对比
{
  id: "01004",
  name: "物理破坏",
  skill: "冲撞摧毁",
  effect: function(game, card, actions) {
    // 这会使用加速过的 "ram" (冲撞) 摧毁动画 - 340ms
    const targetCard = game.boardCards.find(c => c.ownerId !== card.ownerId);

    if (targetCard) {
      game.boardCards.splice(game.boardCards.indexOf(targetCard), 1);

      if (!game.destroy) game.destroy = [];
      game.destroy.push({
        kind: "destroy",
        cardId: targetCard.id,
        ownerId: targetCard.ownerId,
        destruction: {
          kind: "ram",      // 使用不同的摧毁类型
          label: "被冲撞摧毁"
        }
      });

      return { success: true, message: `冲撞摧毁了 ${targetCard.name}` };
    }
    return { success: false };
  }
}

// 示例 5: 技能摧毁 + 战力变化 组合
{
  id: "01005",
  name: "削弱爆破",
  skill: "削弱后摧毁",
  effect: function(game, card, actions) {
    const targetCard = game.boardCards.find(c => c.ownerId !== card.ownerId);

    if (targetCard) {
      // 先削弱
      const oldAttack = targetCard.currentAttack;
      targetCard.currentAttack = Math.max(0, targetCard.currentAttack - 2);

      // 添加战力变化事件
      if (!game.destroy) game.destroy = [];
      game.destroy.push({
        kind: "power",
        row: targetCard.row,
        col: targetCard.col,
        delta: targetCard.currentAttack - oldAttack
      });

      // 检查是否应该摧毁
      if (targetCard.currentAttack <= 0) {
        game.boardCards.splice(game.boardCards.indexOf(targetCard), 1);
        game.destroy.push({
          kind: "destroy",
          cardId: targetCard.id,
          ownerId: targetCard.ownerId,
          destruction: {
            kind: "skill",
            label: "被削弱爆破摧毁"
          }
        });
      }

      return { success: true };
    }
    return { success: false };
  }
}

/**
 * 使用技能摧毁时的最佳实践：
 *
 * 1. 在 destruction.kind 中设置 "skill" 来触发专属动画
 * 2. 在 destruction.label 中提供描述性文本
 * 3. 可选地设置 isSkillEffect: true 以增强样式
 * 4. 确保在摧毁前从 boardCards 中移除卡牌
 * 5. 如果需要延迟效果，可以使用其他 destruction.kind 类型
 *
 * 摧毁类型及时长：
 * - "skill": 600ms (炫彩爆裂)
 * - "tear": 360ms (撕裂)
 * - "return": 380ms (返回)
 * - "collapse": 350ms (崩解)
 * - "fire": 400ms (燃烧)
 * - "ram": 340ms (冲撞)
 * - "quake": 350ms (地震)
 */
