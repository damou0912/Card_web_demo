# PostgreSQL 数据库配置指南

## 概述

系统现已支持**自动检测两种驱动**：
- ✅ **PostgreSQL** - 生产环境（Railway 推荐）
- ✅ **JSON 文件** - 开发环境（默认）

**自动选择规则**：
- 如果设置了 `DATABASE_URL` 环境变量 → 使用 PostgreSQL
- 否则 → 使用 JSON 文件存储

---

## Railway 设置

### 1. 在 Railway 项目中添加 PostgreSQL

1. 打开 Railway 仪表板
2. 点击 "Add" → "Database" → "PostgreSQL"
3. 等待数据库创建（通常 1-2 分钟）

### 2. 获取连接字符串

创建完成后，Railway 会显示 `DATABASE_URL`，格式为：
```
postgresql://user:password@host:port/database
```

### 3. 配置环境变量

在 Railway 项目中添加环境变量：

**变量名**：`DATABASE_URL`
**变量值**：从 PostgreSQL 数据库信息中复制

步骤：
1. 进入项目设置
2. 找到 PostgreSQL 数据库
3. 复制连接字符串
4. 粘贴到应用的环境变量中

### 4. 部署应用

推送代码到 GitHub，Railway 会自动：
1. 检测 `DATABASE_URL` 环境变量
2. 初始化数据库表
3. 启动应用

---

## 本地开发

### 不使用数据库（默认）

保持开发模式，使用 JSON 文件：

```bash
npm start
```

数据存储在 `game-data.json`。

### 使用本地 PostgreSQL

#### 安装 PostgreSQL

**macOS**：
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian**：
```bash
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**Windows**：
下载安装程序：https://www.postgresql.org/download/windows/

#### 创建数据库

```bash
psql -U postgres
CREATE DATABASE card_demo;
\q
```

#### 设置连接字符串

```bash
export DATABASE_URL="postgresql://postgres:password@localhost:5432/card_demo"
npm start
```

**Windows PowerShell**：
```powershell
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/card_demo"
npm start
```

---

## 数据库架构

自动创建的表：

### users 表
```sql
CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_preset BOOLEAN DEFAULT false
);
```

### profiles 表
```sql
CREATE TABLE profiles (
  username TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  wins INTEGER DEFAULT 0,
  pve_wins INTEGER DEFAULT 0,
  pvp_wins INTEGER DEFAULT 0,
  total_games INTEGER DEFAULT 0,
  best_deck TEXT,
  last_login TIMESTAMP
);
```

### cards 表
```sql
CREATE TABLE cards (
  username TEXT PRIMARY KEY,
  card_data JSONB DEFAULT '{}'::jsonb
);
```

### game_records 表
```sql
CREATE TABLE game_records (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  game_type TEXT NOT NULL,
  result TEXT NOT NULL,
  deck_used TEXT,
  score JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**：
- `idx_game_records_username` - 加快玩家记录查询
- `idx_profiles_wins` - 加快排行榜排序

---

## 迁移数据

### 从 JSON 到 PostgreSQL

如果已经在用 JSON 存储，需要迁移现有数据：

```bash
# 1. 启用 PostgreSQL
export DATABASE_URL="postgresql://..."

# 2. 运行迁移脚本
node migrate-to-postgres.js

# 3. 验证数据
npm start
```

**迁移脚本示例** (`migrate-to-postgres.js`)：

```javascript
const fs = require("fs");
const { Pool } = require("pg");

async function migrate() {
  const json = JSON.parse(fs.readFileSync("game-data.json", "utf-8"));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 迁移用户
    for (const [username, user] of Object.entries(json.users)) {
      await pool.query(
        "INSERT INTO users (username, password_hash, created_at, is_preset) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
        [username, user.passwordHash, user.createdAt, user.isPreset]
      );
    }

    // 迁移档案
    for (const [username, profile] of Object.entries(json.profiles)) {
      await pool.query(
        `INSERT INTO profiles (username, nickname, wins, pve_wins, pvp_wins, total_games, best_deck, last_login) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING`,
        [
          username,
          profile.nickname,
          profile.wins,
          profile.pveWins,
          profile.pvpWins,
          profile.totalGames,
          profile.bestDeck,
          profile.lastLogin
        ]
      );
    }

    // 迁移卡牌
    for (const [username, cards] of Object.entries(json.cards)) {
      await pool.query(
        "INSERT INTO cards (username, card_data) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [username, JSON.stringify(cards)]
      );
    }

    // 迁移游戏记录
    for (const record of json.gameRecords) {
      await pool.query(
        `INSERT INTO game_records (username, game_type, result, deck_used, score, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          record.username,
          record.gameType,
          record.result,
          record.deckUsed,
          JSON.stringify(record.score),
          record.timestamp
        ]
      );
    }

    console.log("✅ 迁移完成");
  } finally {
    await pool.end();
  }
}

migrate().catch(console.error);
```

---

## 常见问题

### Q: 使用 PostgreSQL 还是 JSON？

| 场景 | 推荐 | 原因 |
|------|------|------|
| 本地开发 | JSON | 无需安装数据库 |
| 演示/测试 | JSON | 快速部署 |
| **生产环境** | **PostgreSQL** | 数据持久化、性能好 |
| Railway 部署 | PostgreSQL | 原生支持 |

### Q: 如何切换到 PostgreSQL？

在 Railway 添加 PostgreSQL 数据库后：
1. 复制 `DATABASE_URL`
2. 添加到项目环境变量
3. 重新部署（自动检测）

### Q: 如何回到 JSON 存储？

删除 `DATABASE_URL` 环境变量后重新部署。

### Q: PostgreSQL 连接失败怎么办？

检查：
- ✅ `DATABASE_URL` 格式正确
- ✅ 数据库服务运行
- ✅ 防火墙允许连接
- ✅ 凭据正确

### Q: 能同时用两种存储吗？

不行。系统自动选择其一（优先 PostgreSQL）。

### Q: 如何备份 PostgreSQL 数据？

```bash
# 导出
pg_dump $DATABASE_URL > backup.sql

# 恢复
psql $DATABASE_URL < backup.sql
```

---

## 性能对比

| 指标 | JSON | PostgreSQL |
|------|------|-----------|
| 写入速度 | ⚠️ 慢（整文件同步） | ✅ 快（行级操作） |
| 查询速度 | ⚠️ 慢（全表扫描） | ✅ 快（索引） |
| 并发 | ⚠️ 受限 | ✅ 好 |
| 应用重启 | ⚠️ 数据重置 | ✅ 数据保留 |
| 存储大小 | ✅ 小 | ⚠️ 稍大 |

---

## 监控 PostgreSQL

### 查看连接数

```sql
SELECT count(*) FROM pg_stat_activity;
```

### 查看表大小

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 查看慢查询

```sql
SELECT query, mean_exec_time FROM pg_stat_statements 
ORDER BY mean_exec_time DESC LIMIT 10;
```

---

## 故障恢复

### 数据库损坏

```bash
# 1. 备份
pg_dump $DATABASE_URL > backup.sql

# 2. 删除并重建
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. 恢复
psql $DATABASE_URL < backup.sql
```

### 连接池溢出

增加环境变量：
```
DATABASE_POOL_MAX=20
```

---

## 推荐配置

### 开发环境
```bash
DATABASE_URL=""  # 使用 JSON
```

### Railway 生产
```bash
DATABASE_URL="postgresql://..."  # 自动检测
```

### 自托管生产
```bash
DATABASE_URL="postgresql://user:pass@host/db?ssl=require"
DATABASE_POOL_MAX=20
DATABASE_IDLE_TIMEOUT=30000
```

---

**已完全集成！选择适合的存储方式即可。**
