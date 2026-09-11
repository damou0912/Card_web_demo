# 技能摧毁特效指南

## 概述
技能效果现在支持专属的摧毁动画和特效。当卡牌被技能效果摧毁时，会播放炫彩爆裂动画。

## 动画特效说明

### 技能摧毁特效 (destroy-skill)
- **特效颜色**: 紫色（#8A2BE2）+ 橙色（#FFA500）
- **动画效果**:
  - 紫橙色辐射光晕逐渐扩散
  - 彩虹环状光圈旋转缩放
  - 卡牌缩放并旋转360度消失
  - 总时长: 600ms

### 其他摧毁类型（已加速）
- **tear（撕毁）**: 360ms - 卡牌撕裂消失
- **return（返回）**: 380ms - 卡牌飞回牌库
- **collapse（崩解）**: 350ms - 卡牌破碎消失
- **fire（焚烧）**: 400ms - 卡牌燃烧消失
- **ram（冲撞）**: 340ms - 卡牌被击飞
- **quake（地震）**: 350ms - 卡牌震颤消失

## 如何在卡牌效果中标记技能摧毁

### 在摧毁事件中添加标记

```javascript
// 摧毁事件结构
{
  kind: "destroy",
  cardId: cardId,
  ownerId: card.ownerId,
  destruction: {
    kind: "skill",        // 使用 "skill" 标记技能摧毁
    isSkillEffect: true,  // 可选：额外标记
    label: "技能摧毁"     // 显示标签
  }
}
```

### 使用示例

```javascript
// 在卡牌效果中摧毁对方卡牌
if (targetCard) {
  boardCards.splice(boardCards.indexOf(targetCard), 1);
  game.destroy = [...(game.destroy || []), {
    kind: "destroy",
    cardId: targetCard.id,
    ownerId: targetCard.ownerId,
    destruction: {
      kind: "skill",
      label: "被[技能名]摧毁"
    }
  }];
}
```

## 动画时间线

### 快速效果时间表
- 抽卡动画: 380ms (加速2.6倍)
- 技能效果: 320-480ms
- 技能摧毁: 600ms
- 战力变化: 480ms

## CSS 类名参考

```css
/* 技能摧毁卡牌元素会获得以下类名 */
.combat-card.destroy-skill           /* 基础摧毁类 */
.skill-destruction-effect             /* 特效标记 */
```

## 动画关键帧

### combat-skill-burst (600ms)
卡牌的主体动画：
- 0ms: 原始大小，亮度正常
- 150ms: 放大1.1倍，亮度1.4，紫色光晕
- 300ms: 放大1.2倍，亮度1.8，橙色加强
- 450ms: 收缩，光晕减弱
- 600ms: 完全消失

### skill-destruction-glow (600ms)
辐射光晕效果：从模糊0px逐渐扩散到20px

### skill-destruction-spin (600ms)
彩虹环旋转效果：360度旋转同时缩放到0

## 添加新的摧毁类型

如需添加新的摧毁动画类型，请：

1. 在 style.css 中添加新的 `@keyframes` 动画定义
2. 在 `.combat-card.destroy-{type}` 中引用该动画
3. 在卡牌效果中使用 `destruction: { kind: "{type}" }`
4. 更新此文档

## 调试技巧

查看浏览器控制台查看摧毁事件：
```javascript
// 在浏览器控制台中
window.__CARD_DEMO_DEBUG__.state.game.destroy  // 查看所有摧毁事件
```
