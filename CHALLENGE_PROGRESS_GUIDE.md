# 挑战模式进度保存系统

## 功能概述

玩家在挑战模式中的进度（已通过的最高关卡）会自动保存，下次登录可以继续挑战。

### 核心特性

| 特性 | 说明 |
|------|------|
| ✅ 自动保存 | 每次通关后自动保存 |
| ✅ 单一进度 | 每个账号只保存一个进行中的进度 |
| ✅ 72小时有效期 | 存档3天后自动失效 |
| ✅ 进度失效规则 | 选择其他关卡则进度清除 |
| ✅ 只限挑战模式 | PVP 和普通 PVE 不影响进度 |

---

## 进度保存规则

### 自动保存时机

游戏结束时检查：
1. 是否为挑战模式（`gameType === "pve-challenge"`）
2. 是否为胜利（`result === "win"`）
3. 是否包含关卡信息（`score.challengeLevel`）

满足条件 → 自动保存关卡信息

### 进度有效性

**有效条件**：
- 存档不超过 72 小时
- 玩家未选择其他关卡

**失效条件**：
- 存档超过 72 小时
- 玩家从不同的关卡开始新游戏
- 玩家主动清除进度

### 进度覆盖规则

**进度覆盖**：
- 通过关卡 N → 可以覆盖关卡 N-1 的进度
- 不能跳级（只能通过 N-1 才能到 N）
- 新进度自动覆盖旧进度

---

## 前端交互流程

### 场景 1：首次进入挑战模式

```
玩家点击"PVE 挑战模式"
  ↓
系统检查账号进度 → 无进度或已过期
  ↓
显示"开始新挑战"选项，默认从第 1 关开始
  ↓
玩家选择关卡开始游戏
```

### 场景 2：有效的挑战进度

```
玩家点击"PVE 挑战模式"
  ↓
系统检查账号进度 → 第 5 关（有效）
  ↓
显示两个选项：
  - "继续第 6 关"（推荐）
  - "重新开始"
  ↓
玩家选择继续或重新开始
```

### 场景 3：进度失效

```
玩家选择"重新开始"或选择第 1-4 关
  ↓
系统自动清除存档进度
  ↓
开始新游戏
```

---

## API 端点

### 获取进度

```bash
GET /api/challenge/progress/{username}
```

**响应成功**：
```json
{
  "level": 5,
  "savedAt": "2026-09-11T10:30:00.000Z",
  "expired": false
}
```

**响应失效/过期**：
```json
{
  "level": 0,
  "expired": true
}
```

### 保存进度

```bash
POST /api/challenge/progress
Content-Type: application/json

{
  "username": "player1",
  "level": 5
}
```

**响应**：
```json
{
  "success": true,
  "level": 5
}
```

### 清除进度

```bash
POST /api/challenge/clear
Content-Type: application/json

{
  "username": "player1"
}
```

**响应**：
```json
{
  "success": true
}
```

---

## 前端集成

### 自动保存（在 game-integration.js）

```javascript
// 游戏结束时自动调用
async function saveGameResult(gameType, result, deckUsed, score) {
  if (!currentUser) return;

  // 如果是挑战模式且胜利，保存进度
  if (gameType === "pve-challenge" && result === "win" && score?.challengeLevel) {
    await authClient.saveChallengeProgress(currentUser, score.challengeLevel);
  }

  return await authClient.saveGameRecord(currentUser, gameType, result, deckUsed, score);
}
```

### 加载进度（在 script.js）

```javascript
// 进入挑战模式时调用
async function loadChallengeProgress() {
  const currentUser = gameIntegration?.getCurrentUser?.();
  if (!currentUser) return null;

  const progress = await gameIntegration?.loadChallengeProgress?.();
  return progress;
}
```

### 清除进度（用户选择其他关卡时）

```javascript
// 当玩家选择不同的关卡时
async function onChallengeSelectLevel(selectedLevel) {
  const progress = await gameIntegration?.loadChallengeProgress?.();

  // 如果选择的关卡不是进度+1，则清除进度
  if (selectedLevel !== (progress?.level || 0) + 1) {
    await gameIntegration?.clearChallengeProgress?.();
  }
}
```

---

## 数据库实现

### 字段定义

在 `profiles` 表中：

```sql
challengeProgress INTEGER DEFAULT 0
  -- 已通过的最高关卡（0 = 无进度）

challengeProgressSavedAt TIMESTAMP
  -- 进度保存时间戳
```

### 查询实现

**获取进度**：
```javascript
function getChallengeProgress(username) {
  const profile = db.profiles[username];
  const savedAt = profile.challengeProgressSavedAt ? 
    new Date(profile.challengeProgressSavedAt) : null;
  
  // 检查 72 小时有效期
  if (savedAt && now - savedAt > 72 * 60 * 60 * 1000) {
    return { level: 0, expired: true };
  }

  return {
    level: profile.challengeProgress || 0,
    savedAt,
    expired: false
  };
}
```

**保存进度**：
```javascript
function saveChallengeProgress(username, level) {
  const profile = db.profiles[username];
  profile.challengeProgress = level;
  profile.challengeProgressSavedAt = new Date().toISOString();
  writeDB(db);
  return { success: true, level };
}
```

**清除进度**：
```javascript
function clearChallengeProgress(username) {
  const profile = db.profiles[username];
  profile.challengeProgress = 0;
  profile.challengeProgressSavedAt = null;
  writeDB(db);
  return { success: true };
}
```

---

## 场景举例

### 例 1：普通流程

**Day 1 - 下午 14:00**
- 玩家登录，通过第 4 关
- 系统保存：`level = 4, savedAt = 2026-09-11 14:00:00`

**Day 1 - 下午 18:00**
- 玩家再次登录
- 系统检查：进度有效（仅4小时），显示"继续第 5 关"

**Day 2**
- 玩家通过第 5 关
- 系统更新：`level = 5, savedAt = 2026-09-12 10:30:00`

### 例 2：进度失效

**Day 1 - 14:00 通过第 3 关**
- `level = 3, savedAt = 2026-09-11 14:00:00`

**Day 4 - 10:00 登录**
- 系统检查：超过 72 小时，进度失效
- 返回：`level = 0, expired = true`

### 例 3：进度清除

**Day 1 - 通过第 5 关**
- `level = 5, savedAt = 2026-09-11 14:00:00`

**Day 2 - 玩家选择"第 2 关重新开始"**
- 系统清除：`level = 0, savedAt = null`

---

## 配置参数

### 可调整参数

在 `db.js` 中：

```javascript
const CHALLENGE_PROGRESS_HOURS = 72;  // 有效期（小时）

// 使用
const hoursInMs = CHALLENGE_PROGRESS_HOURS * 60 * 60 * 1000;
if (now - savedAt > hoursInMs) {
  // 进度过期
}
```

---

## 与其他系统的交互

### 与通关记录系统

| 系统 | 记录内容 | 保存条件 |
|------|--------|--------|
| **通关记录** | 每次游戏的结果 | 所有 gameType |
| **挑战进度** | 最高通过关卡 | 仅 pve-challenge + win |

关系：
- 挑战进度依赖通关记录的胜利判定
- 通关记录会列出所有游戏（包括失败）
- 挑战进度只关心成功

### 与排行榜系统

- 排行榜统计：总通关数、胜率
- 进度信息：仅在挑战模式中使用，不影响排行榜

### 与账号系统

- 账号登录时自动加载进度
- 进度绑定到账号，不同账号独立
- 账号删除时进度同时删除

---

## 常见问题

### Q: 怎样才能重新开始？

选择"重新开始"或选择比当前进度更低的关卡。系统会清除进度。

### Q: 能选择更高的关卡吗？

不能。只能通过当前关卡后自动进入下一关。进度会自动更新。

### Q: 进度什么时候过期？

如果 72 小时未登录，进度自动失效。下次登录显示"开始新挑战"。

### Q: 是否可以自行清除进度？

目前没有手动清除按钮。只能通过选择其他关卡来清除。

可以添加"清除进度"按钮（可选功能）。

### Q: 进度能否保留超过 72 小时？

不能。这是为了防止僵尸进度堆积。如需调整，可修改 `CHALLENGE_PROGRESS_HOURS` 参数。

### Q: 进度与其他模式冲突吗？

不会。只有挑战模式（pve-challenge）才会保存进度，其他模式不受影响。

---

## 测试用例

### TC-001: 保存进度

**前置**：玩家已登录
**操作**：通过挑战第 3 关
**验证**：
- [ ] 调用 GET /api/challenge/progress 返回 level=3
- [ ] savedAt 不为空
- [ ] expired = false

### TC-002: 继续进度

**前置**：玩家有进度，进度有效
**操作**：进入挑战模式
**验证**：
- [ ] 显示"继续第 X 关"
- [ ] 默认进度 + 1 关

### TC-003: 进度失效

**前置**：玩家进度超过 72 小时
**操作**：进入挑战模式
**验证**：
- [ ] 进度信息显示失效
- [ ] 显示"开始新挑战"

### TC-004: 进度清除

**前置**：玩家有进度
**操作**：选择比进度更低的关卡
**验证**：
- [ ] 调用 POST /api/challenge/clear
- [ ] 进度已清除

---

## 监控和日志

### 关键事件

```
[CHALLENGE_PROGRESS] Saved: player1 -> level 5
[CHALLENGE_PROGRESS] Loaded: player1 -> level 4 (valid)
[CHALLENGE_PROGRESS] Expired: player1 -> level 0 (72h+ old)
[CHALLENGE_PROGRESS] Cleared: player1 -> reason: selected_level_2
```

### 性能指标

- 保存速度：< 100ms
- 加载速度：< 50ms
- 清除速度：< 100ms

---

**系统已就绪！挑战模式进度保存功能完全集成。**
