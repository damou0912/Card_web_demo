# 动画配置快速参考

## 所有动画时长一览

| 动画类型 | 代码常量 | 新时长 | 旧时长 | 加速 |
|---------|---------|---------|---------|------|
| **抽卡** |
| 可见时间 | CARD_FLOW_VISIBLE_MS | 380ms | 980ms | 2.6x |
| 淡出时间 | CARD_FLOW_FADE_MS | 100ms | 260ms | 2.6x |
| 步骤间隔 | CARD_FLOW_STEP_GAP_MS | 50ms | 140ms | 2.8x |
| **技能脉冲** |
| 可见时间 | BOARD_PULSE_VISIBLE_MS | 320ms | 520ms | 1.6x |
| 淡出时间 | BOARD_PULSE_FADE_MS | 140ms | 260ms | 1.9x |
| 步骤间隔 | BOARD_PULSE_STEP_GAP_MS | 80ms | 140ms | 1.75x |
| **行动动画** |
| 移动时间 | ACTION_ANIMATION_MS | 600ms | 1200ms | 2x |
| 冲击保持 | ACTION_IMPACT_HOLD_MS | 140ms | 280ms | 2x |
| **战力变化** |
| 可见时间 | POWER_CHANGE_VISIBLE_MS | 480ms | 980ms | 2x |
| 淡出时间 | POWER_CHANGE_FADE_MS | 150ms | 300ms | 2x |
| **回合开始** |
| 可见时间 | TURN_START_PULSE_VISIBLE_MS | 1200ms | 2200ms | 1.8x |
| 淡出时间 | TURN_START_PULSE_FADE_MS | 200ms | 320ms | 1.6x |
| 步骤间隔 | TURN_START_PULSE_STEP_GAP_MS | 120ms | 220ms | 1.8x |
| **新增** |
| 技能摧毁 | SKILL_DESTRUCTION_MS | 600ms | - | 新增 |

## CSS 摧毁动画时长

| 摧毁类型 | CSS 类名 | 新时长 | 旧时长 | 加速 | 视觉效果 |
|---------|---------|--------|--------|------|---------|
| 技能摧毁 | destroy-skill | 600ms | - | 新增 | 🟣 炫彩爆裂 |
| 撕裂 | destroy-tear | 360ms | 720ms | 2x | 💔 撕毁 |
| 返回 | destroy-return | 380ms | 760ms | 2x | ⬆️ 回飞 |
| 崩解 | destroy-collapse | 350ms | 700ms | 2x | 💥 破碎 |
| 燃烧 | destroy-fire | 400ms | 800ms | 2x | 🔥 燃烧 |
| 冲撞 | destroy-ram | 340ms | 680ms | 2x | 💨 击飞 |
| 地震 | destroy-quake | 350ms | 700ms | 2x | 📍 颤动 |

## 技能摧毁标记方式

### 快速集成

```javascript
// 在卡牌摧毁时添加这个结构
game.destroy.push({
  kind: "destroy",
  cardId: targetCard.id,
  ownerId: targetCard.ownerId,
  destruction: {
    kind: "skill",
    label: "被[技能名]摧毁"
  }
});
```

### 配色参考

| 特效类型 | 主色 | 副色 | 用途 |
|---------|------|------|------|
| 技能摧毁 | #8A2BE2 (紫) | #FFA500 (橙) | destroy-skill |
| 战力提升 | #8cd57a (绿) | - | power-change-boost |
| 战力下降 | #ff6b68 (红) | - | power-change-weaken |

## CSS 新增类名

```css
/* 技能摧毁相关 */
.combat-card.destroy-skill              /* 主体动画类 */
.combat-card.skill-destruction-effect   /* 特效标记类 */
.combat-card.skill-destruction-effect::before  /* 光晕层 */
.combat-card.skill-destruction-effect::after   /* 旋转层 */
```

## 新增动画关键帧

```javascript
// 600ms 动画 - 技能摧毁爆裂
@keyframes combat-skill-burst
  0%   → 原始状态，亮度正常
  25%  → 放大1.1倍，紫色光晕
  50%  → 放大1.2倍，橙色加强
  75%  → 收缩，光晕减弱
  100% → 完全消失，缩放到0

// 600ms 动画 - 辐射光晕
@keyframes skill-destruction-glow
  从 blur(0px) 扩散到 blur(20px)

// 600ms 动画 - 彩虹环旋转
@keyframes skill-destruction-spin
  从 scale(1) rotate(0deg) 到 scale(0) rotate(360deg)
```

## 使用场景速查表

| 场景 | 推荐类型 | 时长 | 原因 |
|------|---------|------|------|
| 技能摧毁 | skill | 600ms | 强力反馈，吸引注意 |
| 击败弱小卡 | tear | 360ms | 快速处理 |
| 反弹/回手 | return | 380ms | 表现卡牌回移 |
| 大范围破坏 | collapse | 350ms | 快速展示破坏 |
| 法术伤害 | fire | 400ms | 模拟燃烧过程 |
| 物理冲撞 | ram | 340ms | 表现碰撞方向 |
| 环境伤害 | quake | 350ms | 表现震动效应 |

## 性能监控

### 检查当前动画状态

```javascript
// 在浏览器控制台中

// 查看当前配置
console.log({
  cardFlowVisible: window.CARD_FLOW_VISIBLE_MS,
  actionAnimation: window.ACTION_ANIMATION_MS,
  skillPulse: window.BOARD_PULSE_VISIBLE_MS
})

// 查看摧毁事件
console.log(window.__CARD_DEMO_DEBUG__.state.game.destroy)

// 监控动画时间
console.time('draw-animation')
// ... 进行抽卡
console.timeEnd('draw-animation')
```

## 调整建议

### 如果动画太快
1. 增加常量值 (每增加 50ms 较明显)
2. 从 style.css 中对应的 @keyframes 里调整时间

### 如果动画太慢
1. 减少常量值 (每减少 50ms 较明显)
2. 参考本表格中的"新时长"作为基准

### 如果特效效果不明显
1. 调整 CSS 中的 filter 属性 (brightness, saturate)
2. 增加 box-shadow 的模糊值
3. 参考 combat-skill-burst 的关键帧调整百分比点

## 文件位置

- **配置常量**: `script.js` (第 1-16 行)
- **CSS 动画**: `style.css` (搜索 @keyframes)
- **动画应用**: `script.js` (playBoardAnimations 函数)
- **摧毁处理**: `script.js` (applyDestructionVisual 函数)

## 常见问题

**Q: 如何为特定卡牌添加不同的摧毁动画?**
A: 在卡牌效果中设置 `destruction.kind` 为对应的类型即可

**Q: 技能摧毁动画可以更长吗?**
A: 可以，修改 `SKILL_DESTRUCTION_MS` 或 CSS 中的 `combat-skill-burst` 时长

**Q: 如何增加新的摧毁类型?**
A: 
1. 在 CSS 中添加 `@keyframes` 动画
2. 添加 `.combat-card.destroy-{newtype}` 规则
3. 在卡牌效果中使用 `kind: "{newtype}"`

**Q: 技能摧毁特效支持哪些浏览器?**
A: 所有现代浏览器 (Chrome 60+, Firefox 55+, Safari 12+)
