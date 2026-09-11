# Railway 部署操作指南 - 立即部署

## 🚀 快速部署步骤

### 步骤 1：登录 Railway 账户

访问：https://railway.app/dashboard

### 步骤 2：查看项目

选择项目：`Card_web_demo` 或 `codex-card`

### 步骤 3：检查自动部署状态

**预期流程**：
```
代码推送到 GitHub main 分支
  ↓
Railway 自动检测到新提交
  ↓
自动拉取最新代码
  ↓
构建应用（npm install）
  ↓
启动服务器（npm start）
  ↓
部署完成 ✅
```

### 步骤 4：查看部署日志

在 Railway 控制面板：
1. 点击项目名称
2. 找到应用服务
3. 点击"Logs"查看实时日志
4. 搜索关键词：
   - "listening on" - 服务启动成功
   - "error" - 查看错误
   - "健康检查" - 检查运行状态

### 步骤 5：验证部署成功

**预期看到的日志**：
```
✅ 服务已启动
Card Demo online server: http://0.0.0.0:8080

或

🗄️  使用 PostgreSQL 数据库
📁 使用 JSON 文件存储
```

---

## 🔍 部署状态检查

### 检查 1：应用在线

访问：`https://<your-railway-url>/health`

**成功响应**：
```json
{
  "ok": true,
  "rooms": 0
}
```

### 检查 2：API 可用

```bash
# 获取账号列表
curl https://<your-railway-url>/api/auth/presets

# 成功响应
{
  "accounts": ["player1", "player2", ..., "admin"],
  "password": "password123"
}
```

### 检查 3：前端加载

访问：`https://<your-railway-url>`

**预期看到**：
- 卡牌游戏主界面
- 右上角 👤 登录按钮
- 游戏模式选择
- 登录账号下拉菜单

---

## ⚙️ 配置数据库（可选但推荐）

### 添加 PostgreSQL

如果需要数据持久化（推荐生产环境）：

1. **在 Railway 项目中添加 PostgreSQL**
   - 点击"+"按钮
   - 选择"Database"
   - 选择"PostgreSQL"
   - 确认创建

2. **获取连接字符串**
   - PostgreSQL 数据库创建完成后
   - 点击 PostgreSQL 数据库卡片
   - 查看"Variables"选项卡
   - 复制 `DATABASE_URL`

3. **配置到应用**
   - 回到应用设置
   - 找到"Variables"或"Environment"
   - 添加新变量：
     - **Name**: `DATABASE_URL`
     - **Value**: 粘贴 PostgreSQL 连接字符串

4. **重新部署**
   - 保存配置
   - Railway 自动重新部署
   - 检查日志确认连接成功

**预期看到**：
```
🗄️  使用 PostgreSQL 数据库
✅ PostgreSQL 数据库已连接
```

---

## 🧪 功能测试

### 测试 1：登录功能

```bash
curl -X POST https://<your-railway-url>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"password123"}'

# 成功响应
{"success":true,"username":"player1"}
```

### 测试 2：排行榜

```bash
curl https://<your-railway-url>/api/leaderboard

# 成功响应
[{"username":"player1","nickname":"player1",...}]
```

### 测试 3：挑战进度

```bash
curl https://<your-railway-url>/api/challenge/progress/player1

# 成功响应
{"level":0,"savedAt":null,"expired":false}
```

### 测试 4：游戏记录保存

```bash
curl -X POST https://<your-railway-url>/api/game/record \
  -H "Content-Type: application/json" \
  -d '{
    "username":"player1",
    "gameType":"pve",
    "result":"win",
    "deckUsed":"deck1",
    "score":{"player1":20,"player2":5,"turns":12}
  }'

# 成功响应
{"success":true,"record":{...}}
```

---

## 📊 监控部署

### 实时监控

在 Railway 控制面板：

1. **查看内存使用**
   - 预期：< 500MB
   - 警告：> 1GB

2. **查看 CPU 使用**
   - 预期：< 50%
   - 警告：> 80%

3. **查看网络**
   - 上行/下行流量正常

4. **查看日志**
   - 无错误
   - 正常的请求日志

### 告警设置（可选）

在 Railway 设置中：
- 设置 CPU 超过 80% 告警
- 设置内存超过 1GB 告警
- 设置应用崩溃告警

---

## 🔧 故障排除

### 问题 1：应用无法启动

**症状**：
- 日志显示错误
- /health 端点返回 500

**检查清单**：
- [ ] npm install 是否成功
- [ ] Node.js 版本是否 >=18
- [ ] package.json 是否存在
- [ ] railway.json 配置是否正确

**解决方案**：
```bash
# 查看完整日志
# Railway 控制面板 → Logs → 搜索 "error"

# 如果是依赖问题，删除 node_modules 和 package-lock.json
# 然后重新推送代码让 Railway 重新安装
```

### 问题 2：数据库连接失败

**症状**：
- 日志显示 "连接拒绝"
- PostgreSQL 相关错误

**检查清单**：
- [ ] DATABASE_URL 是否设置
- [ ] DATABASE_URL 格式是否正确
- [ ] PostgreSQL 数据库是否运行
- [ ] SSL 连接是否配置

**解决方案**：
```bash
# 1. 验证 DATABASE_URL
# Railway 控制面板 → Variables → 查看 DATABASE_URL

# 2. 测试连接
# 可以尝试删除 DATABASE_URL 回到 JSON 模式测试

# 3. 检查 db-postgres.js 是否正确
```

### 问题 3：API 返回 404

**症状**：
- 访问 API 端点返回 404
- 但 /health 正常

**检查清单**：
- [ ] URL 是否正确
- [ ] HTTP 方法是否正确（GET/POST）
- [ ] API 端点是否在代码中实现

**解决方案**：
```bash
# 检查 API 端点是否存在
curl -I https://<your-railway-url>/api/auth/presets

# 预期：HTTP/1.1 200 OK
```

### 问题 4：页面加载缓慢

**症状**：
- 首次加载超过 10 秒
- API 响应缓慢

**优化方案**：
- 检查 Railway 资源配置
- 增加内存分配（如果可能）
- 优化数据库查询
- 启用缓存

---

## 📈 性能基准

### 预期性能

| 指标 | 预期 | 如何检查 |
|------|------|--------|
| 登录 API | <200ms | curl + time |
| 排行榜 | <500ms | curl + time |
| 页面加载 | <3s | 浏览器开发工具 |
| 内存 | <500MB | Railway 监控面板 |
| CPU | <50% | Railway 监控面板 |

### 如果性能不达预期

```bash
# 1. 检查日志中的慢查询
# Railway 控制面板 → Logs → 搜索 "slow"

# 2. 检查数据库连接
# 如果使用 PostgreSQL，检查连接池设置

# 3. 检查网络延迟
# Railway 到数据库的网络延迟

# 4. 优化代码
# 查看 db.js 和 railway-server.js 是否有瓶颈
```

---

## 🔐 安全检查

### 部署后安全验证

- [ ] 注册端点返回"已禁用"
- [ ] 密码验证正常
- [ ] API 输入验证有效
- [ ] 数据库连接使用 SSL
- [ ] 日志中无敏感信息泄露

### 生产清单

- [ ] DATABASE_URL 已配置（推荐）
- [ ] 应用日志监控已启用
- [ ] 备份策略已配置
- [ ] 告警规则已设置
- [ ] 访问日志已启用

---

## 📞 获取帮助

### 查看日志

```
Railway 控制面板
  → 项目选择
  → 应用卡片
  → 点击"Logs"标签
  → 实时查看日志
```

### 查看部署历史

```
Railway 控制面板
  → 项目选择
  → 应用卡片
  → 点击"Deployments"标签
  → 查看所有部署记录
```

### 常见日志

**成功启动**：
```
Card Demo online server: http://0.0.0.0:4173
✅ PostgreSQL 数据库已连接
```

**使用 JSON**：
```
📁 使用 JSON 文件存储
```

**错误示例**：
```
Error: Cannot find module 'express'
  → 依赖未安装，Railway 会自动修复

ECONNREFUSED
  → 数据库连接失败，检查 DATABASE_URL
```

---

## 🎯 最后检查清单

部署完成后，运行这个清单确保一切正常：

- [ ] 访问应用主页
- [ ] 登录功能可用
- [ ] 游戏可以开始
- [ ] 游戏结束自动保存
- [ ] 排行榜显示正确
- [ ] API 端点响应正常
- [ ] 无错误日志
- [ ] 性能指标正常
- [ ] 挑战进度保存
- [ ] 数据持久化有效

---

## ✨ 完成！

如果以上所有检查都通过，**部署已成功！🎉**

你的卡牌游戏现已在 Railway 上线。

**下一步**：
1. 分享应用 URL 给玩家
2. 监控性能指标
3. 收集用户反馈
4. 计划下一个功能版本

---

**祝你的应用用户量爆表！🚀**
