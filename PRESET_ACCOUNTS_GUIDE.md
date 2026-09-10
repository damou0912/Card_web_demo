# 预设账号系统 - 使用指南

## 概述

游戏账号系统采用**预设账号模式**：
- ✅ 11 个预设账号（player1 ~ player10 + admin）
- ✅ 所有账号密码统一：`password123`
- ❌ 禁用自由注册（注册功能已关闭）
- ✅ 允许不登录游戏，但数据不会被保存

---

## 快速开始

### 1. 查看预设账号列表

访问 API 端点：
```bash
curl http://localhost:4173/api/auth/presets
```

**响应示例**：
```json
{
  "accounts": [
    "player1", "player2", "player3", "player4", "player5",
    "player6", "player7", "player8", "player9", "player10",
    "admin"
  ],
  "password": "password123"
}
```

### 2. 登录任意预设账号

前端登录步骤：
1. 点击主菜单右上角的 **👤 按钮**
2. 在下拉菜单中选择账号（如 `player1`）
3. 输入密码：`password123`
4. 点击 **"登录"** 按钮

**或使用 API**：
```bash
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"password123"}'
```

**响应**：
```json
{"success":true,"username":"player1"}
```

### 3. 开始游戏并保存记录

- 登录后进行游戏
- 游戏结束时自动保存记录
- 玩家档案自动更新

---

## 11 个预设账号

| # | 账号 | 初始昵称 | 用途 |
|---|------|--------|------|
| 1 | player1 | player1 | 一般玩家 |
| 2 | player2 | player2 | 一般玩家 |
| 3 | player3 | player3 | 一般玩家 |
| 4 | player4 | player4 | 一般玩家 |
| 5 | player5 | player5 | 一般玩家 |
| 6 | player6 | player6 | 一般玩家 |
| 7 | player7 | player7 | 一般玩家 |
| 8 | player8 | player8 | 一般玩家 |
| 9 | player9 | player9 | 一般玩家 |
| 10 | player10 | player10 | 一般玩家 |
| 11 | admin | admin | 管理员 |

所有账号的**密码均为**：`password123`

---

## 核心特性

### ✅ 登录状态管理
- 登录状态保存在浏览器 localStorage
- 刷新页面后保持登录
- 切换浏览器或清除缓存后需要重新登录

### ✅ 账号数据持久化
- 所有账号信息存储在 `game-data.json`
- 服务器重启后数据保持
- 每个账号有独立的玩家档案

### ✅ 游戏记录自动保存
- 已登录玩家的游戏结束时自动保存
- 未登录玩家的游戏不被记录
- 记录包括：游戏类型、胜负、卡组、分数

### ❌ 禁用注册
- 尝试注册时返回错误消息
- 前端隐藏注册选项
- API 明确拒绝注册请求

---

## 常见操作

### 登录不同账号
```bash
# 登录 player1
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"password123"}'

# 登录 admin
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

### 查询玩家档案
```bash
# 查询 player1 的档案
curl http://localhost:4173/api/profile/player1

# 查询 player5 的档案
curl http://localhost:4173/api/profile/player5
```

### 查看排行榜
```bash
curl http://localhost:4173/api/leaderboard
```

**响应示例**：
```json
[
  {
    "username": "player1",
    "nickname": "player1",
    "wins": 3,
    "totalGames": 5,
    "winRate": "60.00"
  },
  {
    "username": "player2",
    "nickname": "player2",
    "wins": 2,
    "totalGames": 4,
    "winRate": "50.00"
  }
]
```

### 修改昵称
```bash
curl -X POST http://localhost:4173/api/profile/nickname \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","nickname":"勇士"}'
```

### 保存游戏记录
```bash
curl -X POST http://localhost:4173/api/game/record \
  -H "Content-Type: application/json" \
  -d '{
    "username":"player1",
    "gameType":"pve",
    "result":"win",
    "deckUsed":"deck1",
    "score":{"player1":18,"player2":7,"turns":12}
  }'
```

---

## 账号管理

### 重置账号数据
删除 `game-data.json` 文件后重启服务器会重新初始化所有账号：

```bash
rm game-data.json
node railway-server.js
```

### 添加新账号
编辑 `db.js` 中的 `PRESET_ACCOUNTS` 数组：

```javascript
const PRESET_ACCOUNTS = [
  "player1", "player2", // ... 现有账号 ...
  "player11",  // 新增
  "player12"   // 新增
];
```

然后删除 `game-data.json` 重新初始化。

### 修改默认密码
编辑 `db.js` 中的 `PRESET_PASSWORD` 常量：

```javascript
const PRESET_PASSWORD = "your_new_password";
```

---

## 数据库结构

### users 表（账号列表）
```json
{
  "username": {
    "passwordHash": "salt:hash",
    "createdAt": "2026-09-10T13:08:07.322Z",
    "isPreset": true
  }
}
```

### profiles 表（玩家档案）
```json
{
  "username": {
    "nickname": "昵称",
    "wins": 数字,
    "pvpWins": 数字,
    "pveWins": 数字,
    "totalGames": 数字,
    "bestDeck": "卡组名",
    "lastLogin": "ISO时间戳"
  }
}
```

### cards 表（卡牌所有权）
```json
{
  "username": {
    "cardCount": 60,
    "cards": {},
    "deckSlots": {
      "deck1": [0, 1, 2, ...],
      "deck2": [0, 1, 2, ...],
      "deck3": [0, 1, 2, ...]
    }
  }
}
```

### gameRecords 数组（游戏历史）
```json
[
  {
    "username": "player1",
    "gameType": "pve",
    "result": "win",
    "deckUsed": "deck1",
    "score": {"player1": 18, "player2": 7, "turns": 12},
    "timestamp": "2026-09-10T13:10:00.000Z"
  }
]
```

---

## 前端集成

### 自动加载账号列表
页面加载时自动调用 `/api/auth/presets` 填充下拉菜单：

```javascript
async function loadPresetAccounts() {
  const presets = await authClient.getPresetAccounts();
  const select = document.getElementById("login-username");
  presets.accounts.forEach((account) => {
    const option = document.createElement("option");
    option.value = account;
    option.textContent = account;
    select.appendChild(option);
  });
}
```

### 登录流程
```javascript
async function login(username, password) {
  const result = await authClient.login(username, password);
  if (result.success) {
    // 登录成功，保存用户名
    authClient.saveUser(username);
    // 显示成功提示
    showAuthSuccess(username);
  } else {
    // 显示错误信息
    showError(result.error);
  }
}
```

---

## 安全性说明

### 密码存储
- 使用 PBKDF2 + SHA-256 加密
- 100,000 次迭代
- 32 字节随机 salt
- 格式：`salt:hash`（Base64 编码）

### 会话管理
- localStorage 存储账号名（非敏感信息）
- 服务器不需要复杂的会话管理
- 每次请求时可验证账号有效性

### 预设密码
- 所有账号使用相同密码
- 仅用于测试和演示环境
- 生产环境应改用：
  - 随机密码
  - 不同的密码（如账号名+后缀）
  - 邮件/SMS 发送凭证

---

## 迁移计划

### 从预设转为自由注册
编辑 `db.js` 中的 `createUser` 函数：

```javascript
function createUser(username, password) {
  const db = readDB();
  if (db.users[username]) return { error: "账号已存在" };
  
  db.users[username] = {
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString()
  };
  
  // ... 初始化档案和卡牌 ...
  
  writeDB(db);
  return { success: true, username };
}
```

### 从 JSON 迁移到数据库
见 `ACCOUNT_SYSTEM.md` 中的"迁移计划"部分。

---

## 故障排除

### 登录失败
- ✅ 确认账号名正确（如 `player1`）
- ✅ 确认密码为 `password123`
- ✅ 检查服务器是否在运行

### 游戏记录未保存
- ✅ 确认已登录（玩家 ID 栏显示账号名）
- ✅ 确认游戏完整进行到结束
- ✅ 检查 `game-data.json` 文件是否存在

### 无法修改昵称
- ✅ 确认已登录
- ✅ 检查网络连接
- ✅ 查看浏览器控制台是否有错误

---

## 获取帮助

- **完整系统文档**：`ACCOUNT_SYSTEM.md`
- **快速参考**：`ACCOUNT_QUICKSTART.md`
- **这份指南**：`PRESET_ACCOUNTS_GUIDE.md`

有问题？检查上述文档获取更多信息。
