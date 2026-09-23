# 群英招募部署与数据

Web 入口 `/gacha/`，从主界面「群英招募 · 抽卡 / 兑换」进入。免费测试额度，无充值。Web 账号之间隔离，仍使用现有公开的预设测试账号，不能用于真实付费运营。

- 60 张基础卡免费，30 张额外卡默认锁定；保留展示和技能资料。
- 抽取、重复分解、碎片兑换、集齐转换在 C# 核心执行，与 Unity 相同。
- 服务端只接受账号会话；保存整个账本时按版本号 compare-and-swap，重复提交只有一次成功。
- 组卡保存和在线卡组提交检查拥有权限；混沌只随机玩家已拥有卡牌。AI 和对手重建不套用本人的持有列表。
- 旧未解锁卡组在使用时按同品质基础卡补位，不删除原记录。
- 不导入独立开发 Demo 的个人存档到公共账号，不默认赠送通用碎片。
- Web 与 Unity 本机存档尚不互通。Unity 的 90 张 Web 技能移植不在本次范围内；原基础/工坊对局保持原状。

## 本地运行

安装 Node.js 22 与 .NET 8 SDK，然后：

```powershell
npm ci
dotnet build UnityCard_demo/Tools/GachaService -c Release
npm start
```

## Railway

现有项目 `triumphant-acceptance` / `production` / `Card_web_demo`，域名 `https://cardwebdemo-production.up.railway.app/`。2026-09-23 已获用户批准创建 `card_web_demo-volume`，挂载 `/data`，当前套餐容量上限 500 MB，按实际存储计费。挂载完成不代表代码与数据迁移已完成，应以上线健康检查为准。

根目录 Dockerfile 构建规则服务，并将 Node + .NET 8 runtime 一同部署。无需 Unity 编辑器。`/health` 只有规则 worker 与存储检查成功才返回 200。

持久化优先使用 `DATABASE_URL`（增量创建 `gacha_profiles`、`account_sessions`，不删除旧表）；否则使用 Railway 挂载磁盘的 `RAILWAY_VOLUME_MOUNT_PATH/game-data.json`。本机可用 `GAME_DATA_FILE` 指定隔离测试文件，默认仍是根目录旧文件。Railway 缺少持久化配置时禁止创建临时账号存档。

首次挂盘前先备份旧实例的完整 JSON，将其通过 Railway 的受控磁盘文件管理上传为 `/data/game-data.json`，再部署新版本。不要把真实存档、数据库密码或会话放进 Git、镜像或公开静态目录。镜像排除根目录 game-data.json，HTTP 禁止访问 JSON/服务端模块/Unity 存档目录。文件驱动以临时文件原子替换保存，单实例使用；扩容前改 PostgreSQL。

## 验证

```powershell
node gacha-account.integration.test.js
node gacha-storage.test.js
node railway-server.integration.test.js
node core-v2.regression.test.js
node UnityCard_demo/Tools/GachaDemo/detail.test.cjs
node UnityCard_demo/Tools/GachaDemo/reveal.test.cjs
dotnet run --project UnityCard_demo/Tools/CoreSmokeTests -c Release
dotnet run --project UnityCard_demo/Tools/SourceChecks -c Release
node UnityCard_demo/Tools/check-project.mjs
```

集成测试在随机端口及临时存档运行，不读取真实玩家档案。Unity 仅做纯核心、语法与资源检查，不等同于 Unity 编辑器编译或实机渲染验收。
