# 玩家账号系统 - 快速开始

## 快速概览

该系统为卡牌游戏添加了玩家账号功能，支持：
- ✅ 账号注册和登录
- ✅ 游戏通关记录保存
- ✅ 玩家排行榜
- ✅ 昵称修改
- ✅ 卡牌所有权追踪

**关键特性**：不登录也能玩游戏，仅已登录用户的游戏记录才会被保存。

---

## 3 分钟上手

### 1. 启动服务器
```bash
npm install  # 只需首次运行
node railway-server.js
```

### 2. 访问游戏
打开浏览器访问：`http://localhost:4173`

### 3. 注册账号
1. 点击主菜单中的 **👤 按钮**（玩家 ID 栏右侧）
2. 选择 **"注册"** 标签页
3. 输入账号、密码（最少 6 位）、确认密码
4. 点击 **"注册"** 按钮
5. 注册成功后自动登录

### 4. 开始游戏
- 玩家 ID 栏现在显示你的账号
- 进行一局游戏
- 游戏结束后自动保存记录

### 5. 修改昵称
- 点击 **⚙ 按钮**（需已登录）
- 输入新昵称
- 确认更新

---

## 实际示例

### 示例数据库内容

初始化后，`game-data.json` 包含：

```json
{
  "users": {
    "alice": {
      "passwordHash": "...",
      "createdAt": "2026-09-10T12:00:00.000Z"
    }
  },
  "profiles": {
    "alice": {
      "nickname": "alice",
      "wins": 0,
      "pvpWins": 0,
      "pveWins": 0,
      "totalGames": 0,
      "bestDeck": null,
      "lastLogin": "2026-09-10T12:00:00.000Z"
    }
  },
  "cards": {
    "alice": {
      "cardCount": 60,
      "cards": {}
    }
  },
  "gameRecords": []
}
```

### 游戏结束后

一局 PVE 胜利后：

```json
{
  "profiles": {
    "alice": {
      "nickname": "alice",
      "wins": 1,
      "pvpWins": 0,
      "pveWins": 1,
      "totalGames": 1,
      "bestDeck": "deck1",
      "lastLogin": "2026-09-10T12:05:00.000Z"
    }
  },
  "gameRecords": [
    {
      "username": "alice",
      "gameType": "pve",
      "result": "win",
      "deckUsed": "deck1",
      "score": {
        "player1": 18,
        "player2": 7,
        "turns": 14
      },
      "timestamp": "2026-09-10T12:05:00.000Z"
    }
  ]
}
```

---

## 功能详解

### 账号相关

| 操作 | 说明 |
|------|------|
| **注册** | 创建新账号（账号必须唯一，密码最少 6 位） |
| **登录** | 进入已有账号（状态保存在浏览器 localStorage） |
| **登出** | 刷新页面后点击登录按钮，再登录其他账号 |
| **修改昵称** | 点击 ⚙ 按钮修改显示的昵称 |

### 游戏记录

| 场景 | 行为 |
|------|------|
| 未登录状态下游戏 | 游戏正常运行，**不保存** 任何记录 |
| 已登录状态下游戏 | 游戏结束时**自动保存**到数据库 |
| 修改密码或注册 | 不支持（功能预留） |

### 数据可见性

| 数据 | 可见范围 |
|------|--------|
| 昵称 | 公开（排行榜可见） |
| 通关次数 | 公开（排行榜可见） |
| 游戏记录 | 个人可见 |
| 密码 | 只有所有者知道（服务器加密存储） |
| 卡牌 | 个人可见 |

---

## API 速查表

### 新建账号
```bash
curl -X POST http://localhost:4173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
```

**响应**：
```json
{"success":true,"username":"alice"}
```

### 登录
```bash
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}'
```

### 查看玩家档案
```bash
curl http://localhost:4173/api/profile/alice
```

**响应**：
```json
{
  "nickname":"alice",
  "wins":1,
  "pvpWins":0,
  "pveWins":1,
  "totalGames":1,
  "bestDeck":"deck1",
  "lastLogin":"2026-09-10T12:05:00.000Z"
}
```

### 查看排行榜
```bash
curl http://localhost:4173/api/leaderboard
```

**响应**：
```json
[
  {
    "username":"alice",
    "nickname":"alice",
    "wins":5,
    "totalGames":8,
    "winRate":"62.50"
  },
  {
    "username":"bob",
    "nickname":"bob",
    "wins":3,
    "totalGames":7,
    "winRate":"42.86"
  }
]
```

---

## 常见问题

### Q：不登录能玩吗？
**A**：可以！但游戏记录不会被保存。这对测试或临时游戏很方便。

### Q：账号数据存在哪里？
**A**：存在 `game-data.json` 文件中（项目根目录）。这是一个 JSON 格式的本地数据库。

### Q：可以修改密码吗？
**A**：暂不支持（可自行扩展功能）。需要时删除账号重新注册。

### Q：可以删除账号吗？
**A**：暂不支持。可在 `game-data.json` 中手动删除用户数据。

### Q：能导出游戏记录吗？
**A**：可以直接查看 `game-data.json` 文件，或通过 API 获取数据。

### Q：多个设备登录可以吗？
**A**：可以。每个设备的浏览器 localStorage 独立保存登录状态。

### Q：游戏记录什么时候保存？
**A**：游戏结束时自动保存。无需手动操作。

### Q：排行榜怎么排序？
**A**：按总通关次数降序排列。通关次数相同时保持加入顺序。

---

## 文件清单

### 核心文件
| 文件 | 说明 |
|------|------|
| `db.js` | 数据库操作模块 |
| `auth-client.js` | 前端 API 客户端 |
| `game-integration.js` | 游戏集成模块（登录UI、保存记录） |
| `railway-server.js` | 后端服务器（已修改，添加 API 端点） |
| `script.js` | 游戏主逻辑（已修改，游戏结束时保存记录） |
| `index.html` | 页面模板（已修改，添加登录模态框） |
| `style.css` | 样式表（已修改，添加认证界面样式） |

### 数据文件
| 文件 | 说明 |
|------|------|
| `game-data.json` | 玩家账号和游戏记录（自动创建） |

### 文档文件
| 文件 | 说明 |
|------|------|
| `ACCOUNT_SYSTEM.md` | 完整技术文档 |
| `ACCOUNT_QUICKSTART.md` | 本文件 |

---

## 下一步

### 立即可做
- [ ] 启动服务器测试账号系统
- [ ] 注册多个账号对比
- [ ] 查看排行榜数据
- [ ] 验证游戏记录保存

### 短期增强
- [ ] 添加账号找回（邮箱验证）
- [ ] 支持昵称唯一性检查
- [ ] 添加用户头像功能
- [ ] 实现好友系统

### 长期规划
- [ ] 迁移到 PostgreSQL（生产环保）
- [ ] 添加支付功能
- [ ] 实现成就系统
- [ ] 构建社区功能

---

## 获取帮助

查看完整文档：`ACCOUNT_SYSTEM.md`

查看 API 详细说明和测试命令。
