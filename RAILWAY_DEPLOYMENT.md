# Railway 部署说明

## 快速部署

代码已推送到 GitHub，Railway 会自动部署。

### 1. 检查部署状态

访问 Railway 项目：
```
https://railway.app/dashboard
```

### 2. 查看应用日志

在 Railway 控制面板查看实时日志，确认应用启动成功。

### 3. 访问应用

部署完成后，Railway 会分配一个 URL，格式为：
```
https://your-project-name.railway.app
```

---

## 部署配置说明

### 启动命令
```json
{
  "startCommand": "npm start"
}
```

对应 package.json 中的：
```json
"start": "node railway-server.js"
```

### 健康检查
- **路径**：`/health`
- **超时**：30 秒
- **响应示例**：`{"ok":true,"rooms":0}`

### 重启策略
- **类型**：失败重启
- **最大重试**：10 次

---

## 环境变量配置

### 自动设置
Railway 自动设置：
- `NODE_ENV=production`
- `PORT=8080`（或分配的端口）

### 可选自定义
在 Railway 控制面板添加：

| 变量 | 值 | 说明 |
|------|---|------|
| `HOST` | `0.0.0.0` | 监听地址 |
| `RECONNECT_GRACE_MS` | `300000` | 重连超时（5分钟） |

---

## 文件结构

关键文件已提交：

```
├── railway-server.js       ✅ 主服务器（已修改，包含账号API）
├── db.js                   ✅ 数据库操作层（新建）
├── auth-client.js          ✅ 前端认证客户端（新建）
├── game-integration.js     ✅ 前端集成模块（新建）
├── script.js               ✅ 游戏主逻辑（已修改，包含记录保存）
├── index.html              ✅ 页面模板（已修改，添加登录界面）
├── style.css               ✅ 样式表（已修改，添加登录样式）
├── core-v2.js              ✅ 游戏规则引擎
├── package.json            ✅ 依赖配置
├── railway.json            ✅ Railway 部署配置
└── PRESET_ACCOUNTS_GUIDE.md ✅ 预设账号使用指南
```

---

## 数据持久化

### 本地开发
- 数据存储在 `game-data.json`（项目根目录）
- 包含：用户账号、玩家档案、卡牌、游戏记录

### Railway 部署
- Railway 提供 **临时文件系统**（应用重启时丢失）
- `game-data.json` 在应用重启后会重新初始化

### ⚠️ 重要注意
为确保数据持久化，建议：

**方案 1：使用 Railway PostgreSQL**（推荐）
```bash
# 在 Railway 仪表板添加 PostgreSQL 数据库
# 设置环境变量 DATABASE_URL
# 更新 db.js 使用 PostgreSQL 驱动
npm install pg
```

**方案 2：使用云存储**
- AWS S3、Google Cloud Storage 等
- 定期备份 `game-data.json`

**方案 3：保持 JSON 存储**（临时方案）
- 应用重启时数据重新初始化
- 仅用于演示和测试

---

## 预设账号

所有部署环境使用相同的预设账号：

| 账号 | 密码 | 说明 |
|------|------|------|
| player1~player10 | `password123` | 普通玩家 |
| admin | `password123` | 管理员 |

**登录流程**：
1. 点击 👤 按钮打开登录框
2. 从下拉菜单选择账号
3. 输入密码 `password123`
4. 点击登录

---

## API 端点

所有 API 端点已部署：

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/auth/presets` | 获取预设账号列表 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/register` | 注册（已禁用） |
| GET | `/api/profile/{username}` | 查询玩家档案 |
| POST | `/api/profile/nickname` | 修改昵称 |
| GET | `/api/cards/{username}` | 查询卡牌 |
| POST | `/api/game/record` | 保存游戏记录 |
| GET | `/api/leaderboard` | 查询排行榜 |
| GET | `/health` | 健康检查 |

---

## 测试部署

部署完成后，测试 API：

```bash
# 获取账号列表
curl https://your-app-url/api/auth/presets

# 登录
curl -X POST https://your-app-url/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"password123"}'

# 查询排行榜
curl https://your-app-url/api/leaderboard
```

---

## 故障排除

### 应用无法启动
检查日志中的错误：
```
Error: Cannot find module 'ws'
```
**解决**：确保 `npm install` 在构建时执行（Railway 自动处理）

### 404 错误
检查请求路径是否正确：
- ✅ `/api/auth/login` （正确）
- ❌ `/api/auth/login/` （末尾有斜杠，错误）

### 连接超时
- 检查防火墙设置
- 确认 Railway 分配的 URL 正确
- 检查应用日志确认启动成功

### 游戏记录未保存
- 确保已登录（使用 `/api/auth/presets` 获取账号列表）
- 使用正确的 API 端点 `/api/game/record`
- 检查请求数据格式

---

## 性能优化

### 当前瓶颈
- 使用 JSON 文件存储（每次操作都需要读写磁盘）
- 没有数据库索引

### 优化建议

**短期**：
- 添加内存缓存
- 缓存排行榜结果（60秒更新一次）

**中期**：
- 迁移到 SQLite（本地）
- 或 PostgreSQL（Railway）

**长期**：
- 添加 Redis 缓存层
- 实现消息队列（异步记录保存）

---

## 备份和恢复

### 备份 game-data.json
```bash
# 从 Railway 下载备份
railway run "cat game-data.json" > backup.json

# 或通过 SSH 连接后导出
```

### 恢复数据
```bash
# 上传备份文件到项目
git add game-data.json
git commit -m "恢复备份数据"
git push origin main

# Railway 自动重新部署
```

---

## 监控和维护

### 实时监控
- Railway 仪表板显示 CPU、内存、网络使用
- 日志实时输出

### 定期检查
- [ ] 应用是否在线
- [ ] 是否有异常重启
- [ ] API 响应时间
- [ ] 错误日志

### 定期备份
- [ ] 每天备份 `game-data.json`
- [ ] 保存到 GitHub 或云存储
- [ ] 测试恢复流程

---

## 扩展部署

### 多区域部署
Railway 不支持多区域，建议：
- 使用 Fly.io、AWS、GCP 等
- 或前面加 CDN（如 Cloudflare）

### 负载均衡
当前单实例部署。若需水平扩展：
- 迁移到数据库（共享状态）
- 使用消息队列（解耦游戏逻辑）
- 部署多个实例

---

## 文档链接

- **预设账号指南**：`PRESET_ACCOUNTS_GUIDE.md`
- **完整系统文档**：`ACCOUNT_SYSTEM.md`
- **快速开始**：`ACCOUNT_QUICKSTART.md`

---

## 问题反馈

遇到问题？

1. 检查 Railway 日志
2. 查看本文档对应章节
3. 查阅系统文档
4. 检查 GitHub issues

---

**部署日期**：2026-09-10
**系统版本**：账号系统 v1.0
**Node.js**：>=18
**主入口**：railway-server.js
