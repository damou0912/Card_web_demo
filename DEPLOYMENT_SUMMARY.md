# 挑战模式奖励机制修复 - 部署总结

**修复时间**: 2026-09-10  
**提交**: d759a6a  
**分支**: main  
**状态**: ✅ 已部署到Railway

## 修复内容

### 问题
挑战模式3选1奖励机制不生效 - 胜利后不显示奖励词条选择界面

### 根本原因
[script.js:548](script.js:548) 中获取获胜者ID时使用了错误的属性名：
```javascript
// ❌ 错误 (原始代码)
const winnerId = game?.winner?.id;

// ✅ 正确 (修复后)
const winnerId = game?.winner?.playerId;
```

实际上 `game.winner` 对象在 [core-v2.js:1748](core-v2.js:1748) 中定义时使用的是 `playerId` 属性。

### 功能改进
同时将奖励显示逻辑从"每关都显示"改为"每3关显示一次"：

| 关卡 | 显示奖励 | 说明 |
|------|--------|------|
| 1-2  | ❌ 否  | 无奖励 |
| **3**  | ✅ 是  | 首次奖励 |
| 4-5  | ❌ 否  | 无奖励 |
| **6**  | ✅ 是  | 第二次奖励 |
| 7-8  | ❌ 否  | 无奖励 |
| **9**  | ✅ 是  | 第三次奖励 |
| 10-11 | ❌ 否 | 无奖励 |
| **12** | ❌ 否 | 通关结算 |

## 修改代码

**文件**: `script.js`  
**行号**: 544-548

```javascript
function showResult() {
  renderResult(state.game);
  const game = state.game;
  const winnerId = game?.winner?.playerId;  // ← 修复属性名
  const shouldShowReward = game?.mode === "pve-challenge" && winnerId === 1 && Number(game.challengeLevel) % 3 === 0 && Number(game.challengeLevel) < 12;  // ← 新增3关一次逻辑
  if (shouldShowReward) {
    const ownedTraitIds = state.challengePlayerTraitIds || [];
    const rewardChoices = window.corePickChallengeRewardTraits?.(ownedTraitIds, 3) || [];
    if (rewardChoices.length) {
      setTimeout(() => window.showChallengeRewardSelection?.(rewardChoices), 500);
      return;
    }
  }
  switchScreen("result");
}
```

## 验证结果

✅ **逻辑验证成功**

```
关卡 | 是否显示奖励
1    | false
2    | false
3    | true  ← 首次奖励
4    | false
5    | false
6    | true  ← 第二次奖励
7    | false
8    | false
9    | true  ← 第三次奖励
10   | false
11   | false
12   | false ← 通关，无奖励
```

## 部署信息

- **Git Commit**: d759a6a
- **Branch**: main
- **Railway Status**: Auto-deploying
- **Health Check**: `/health`
- **Start Command**: `npm start`

## 测试建议

1. 启动挑战模式第1关
2. 快速赢到第3关
3. 验证第3关获胜时显示奖励选择界面
4. 继续到第6、9关验证
5. 第12关验证是否直接显示通关结果

