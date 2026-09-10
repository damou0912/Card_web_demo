# 玩家账号与数据记录系统

## 系统概述

为游戏添加了完整的用户认证和游戏数据记录系统，包括账号管理、通关记录、卡牌管理等功能。

## 核心功能

### 1. 用户认证系统
- **注册** - 创建账号（账号唯一，密码最少 6 位）
- **登录** - 验证账号密码并保存登录状态
- **密码加密** - 使用 PBKDF2 + SHA256（100,000 次迭代）
- **会话管理** - localStorage 持久化登录状态

### 2. 玩家档案
每个用户拥有独立档案记录：
- `nickname` - 昵称（可随意更改）
- `wins` - 总通关次数
- `pvpWins` - PVP 模式通关数
- `pveWins` - PVE 模式通关数
- `totalGames` - 总游戏局数
- `bestDeck` - 最成功的卡组
- `lastLogin` - 最后登录时间

### 3. 卡牌系统
- **默认卡牌** - 用户初始拥有 60 张卡牌（3 套完整卡组）
- **卡牌追踪** - 记录每张卡牌的拥有状态
- **预设卡组** - 3 个卡组槽位（deck1/deck2/deck3）
- **预留接口** - 支持卡牌交易和额外卡牌转资源功能

### 4. 游戏记录
游戏结束时自动保存：
- 游戏类型（PVP/PVE）
- 胜负结果
- 使用的卡组
- 最终分数（占领比例、回合数）
- 时间戳

### 5. 排行榜
支持查询全球排行榜：
- 按总通关数排序
- 显示昵称、通关数、胜率
- 允许其他玩家查看

## 数据结构

### 数据库文件：game-data.json
```json
{
  "users": {
    "username": {
      "passwordHash": "salt:hash",
      "createdAt": "ISO8601时间戳"
    }
  },
  "profiles": {
    "username": {
      "nickname": "昵称",
      "wins": 数字,
      "pvpWins": 数字,
      "pveWins": 数字,
      "totalGames": 数字,
      "bestDeck": "卡组名",
      "lastLogin": "ISO8601时间戳"
    }
  },
  "cards": {
    "username": {
      "cardCount": 60,
      "cards": { "cardId": 拥有数 }
    }
  },
  "gameRecords": [
    {
      "username": "玩家名",
      "gameType": "pvp|pve",
      "result": "win|loss",
      "deckUsed": "卡组名",
      "score": { "player1": 数字, "player2": 数字, "turns": 数字 },
      "timestamp": "ISO8601时间戳"
    }
  ]
}
```

## API 端点

### 认证接口
- `POST /api/auth/register` - 注册新账号
- `POST /api/auth/login` - 登录账号

### 玩家档案
- `GET /api/profile/{username}` - 查询玩家档案
- `POST /api/profile/nickname` - 更新昵称

### 卡牌
- `GET /api/cards/{username}` - 查询玩家卡牌

### 游戏数据
- `POST /api/game/record` - 保存游戏记录
- `GET /api/leaderboard` - 查询排行榜

## 前端实现

### 主要模块

#### auth-client.js
- 封装所有 API 调用
- 处理 HTTP 请求和响应
- localStorage 会话管理

#### game-integration.js
- UI 交互逻辑
- 登录/注册模态框
- 游戏结束时保存记录

### UI 组件

#### 登录模态框（auth-modal）
- 登录标签页 - 账号密码登录
- 注册标签页 - 账号密码注册
- 成功提示 - 登录成功后显示欢迎信息
- 标签页切换 - 登录和注册分离

#### 玩家 ID 栏（player-id-bar）
- 显示当前登录用户或"未登录"
- 编辑按钮 - 修改昵称（需要已登录）
- 登录按钮 - 打开登录模态框

## 游戏流程集成

### 游戏开始前
1. 用户可选择登录或直接开始游戏
2. 已登录用户显示账号信息
3. 未登录用户点击登录按钮可随时登录

### 游戏进行中
- 无变化，正常游戏流程

### 游戏结束
1. 自动检测当前登录用户
2. 保存游戏记录到服务器
3. 记录内容包括：
   - 游戏类型（PVP/PVE）
   - 胜负结果
   - 使用的卡组
   - 最终分数

### 数据记录
- 未登录玩家：游戏正常进行，不保存记录
- 已登录玩家：游戏结束时自动保存
- 玩家档案自动更新（通关数、胜率等）

## 使用场景

### 场景 1：新玩家
1. 进入游戏，玩家 ID 栏显示"未登录"
2. 可直接开始游戏（PVP/PVE）
3. 游戏结束，数据不被记录
4. 点击登录按钮，选择"注册"
5. 输入账号（如：player123）、密码、确认密码
6. 注册成功后自动登录
7. 后续游戏记录将被保存

### 场景 2：已注册玩家
1. 进入游戏，点击登录按钮
2. 选择"登录"标签页
3. 输入账号和密码
4. 登录成功后，玩家 ID 栏显示账号名
5. 后续游戏都将被记录
6. 可点击编辑按钮修改昵称

### 场景 3：查看档案
1. 登录成功后点击编辑按钮
2. 输入新昵称确认更新
3. 昵称在排行榜中显示
4. 其他玩家可通过 API 查询你的统计数据

## 技术实现细节

### 密码加密
- 算法：PBKDF2 with SHA-256
- 迭代：100,000 次
- Salt：32 字节随机值
- 存储格式：`salt:hash`（Base64 编码）

### 数据持久化
- 格式：JSON 文件（game-data.json）
- 位置：项目根目录
- 自动创建：首次启动时自动初始化
- 线程安全：Node.js fs 同步操作

### 前端状态管理
- 登录状态：localStorage 中存储用户名
- 模态框状态：CSS class 控制显示/隐藏
- 游戏结果：通过 gameIntegration 模块跨页面传递

## 迁移计划

### 从 JSON 到数据库
当数据量增大或部署到生产环境时：

1. **SQLite** - 开发阶段临时方案
   ```bash
   npm install better-sqlite3
   ```

2. **PostgreSQL** - 推荐生产方案（Railway 原生支持）
   ```bash
   npm install pg
   ```

3. 迁移步骤：
   - 创建数据库 schema
   - 编写数据迁移脚本
   - 更新 db.js 使用新数据库驱动
   - 测试所有接口

## 未来增强

### 短期
- [ ] 邮箱找回密码功能
- [ ] 用户头像支持
- [ ] 好友系统
- [ ] 私聊功能

### 中期
- [ ] 卡牌交易市场
- [ ] 成就系统
- [ ] 赛季排行榜
- [ ] 积分系统

### 长期
- [ ] 实名认证（可选）
- [ ] 支付系统
- [ ] 社团功能
- [ ] 直播集成

## 安全说明

### 已实现
- ✅ 密码加密存储（PBKDF2）
- ✅ 会话 token 管理
- ✅ 账号唯一性验证
- ✅ 密码长度限制（最少 6 位）

### 待改进
- ⚠ 添加 HTTPS 支持
- ⚠ 实现速率限制（防暴力破解）
- ⚠ 添加账号锁定机制
- ⚠ 实现审计日志
- ⚠ 添加 CORS 跨域限制

## 部署说明

### 本地开发
```bash
npm install
node railway-server.js
```

### Railway 部署
1. 在 Railway 项目中添加 PostgreSQL 数据库
2. 设置环境变量 `DATABASE_URL`
3. 更新 db.js 使用 PostgreSQL
4. 部署：`git push heroku main`

### 数据备份
```bash
# 备份 JSON 文件
cp game-data.json game-data.backup.json

# 或使用 cron 定时备份
0 2 * * * cp /app/game-data.json /backup/game-data-$(date +\%Y\%m\%d).json
```

## 测试 API

### 注册
```bash
curl -X POST http://localhost:4173/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass123"}'
```

### 登录
```bash
curl -X POST http://localhost:4173/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"pass123"}'
```

### 查询档案
```bash
curl http://localhost:4173/api/profile/testuser
```

### 排行榜
```bash
curl http://localhost:4173/api/leaderboard
```

### 保存游戏记录
```bash
curl -X POST http://localhost:4173/api/game/record \
  -H "Content-Type: application/json" \
  -d '{
    "username":"testuser",
    "gameType":"pve",
    "result":"win",
    "deckUsed":"deck1",
    "score":{"player1":15,"player2":8,"turns":12}
  }'
```
