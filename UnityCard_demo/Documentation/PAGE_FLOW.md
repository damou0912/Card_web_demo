# Web 对应页面拆分与 Unity 入口

## 启动与范围

打开 `Assets/Scenes/Main.unity`，点击 Play。顺序为：**加载 → 登录 / 游客 → 主页 → 对战 → 结算 / 返回主页**。

采用一个入口场景、四个独立页面根节点，不是四份互相复制资源的场景。页面在运行时创建，编辑状态的 Main 仍只有标记对象；Play 后可在 Hierarchy 查看 `Card App / Page Router`。原卡牌预制体、转表工具、技能工坊和独立 GachaDemo 场景不变。

本次完善的是页面内容、导航与账号登录接口，并未把全部 Web 游戏机制宣称为已迁入 Unity。

## 对照与维护位置

| 页面 | Web 对应 | Unity 维护文件 | 当前能力 |
| --- | --- | --- | --- |
| 加载 | `index.html` 的数据脚本加载与缺失检查 | `Scripts/Runtime/Pages/LoadingPage.cs`、`AppBootstrap.cs` | 分阶段读取页面配置、规则、演示牌、制作库、正式资料；实际进度、失败提示、重试 |
| 账号登录 | `login-menu-modal`；`account-routes.js` 登录 / session / logout；profile 接口 | `Pages/LoginPage.cs`、`WebAccountClient.cs` | 地址、账号、密码输入；真实 HTTP 验证会话；游客；档案读取；退出；错误反馈 |
| 主页 | `menu-screen` | `Pages/HomePage.cs` | PVE、4×4 / 5×5、演示 / 制作库牌库、账号信息、操作指南、90 张正式卡只读检索、势力筛选、招募 Demo 入口 |
| 对战 | `game-screen`、对战菜单、流程弹层、`result-screen` | `DemoBootstrap.cs`、`DemoBootstrap.View.cs`、`SquareBoardLayout.cs` | 棋盘、固定双方信息、手牌、详情、计时、行动数、取消选择、认输确认、流程记录、结算、重开、返回主页 |

表中脚本路径相对于 `Assets/`。`Pages/PageUi.cs` 维护前三页的文本、按钮、输入框和滚动容器；四页视觉参数共用 `Resources/UI/AppUiTheme.asset`，战场保留深色配色。布局覆盖与无需 Play 的页面预览见 [页面视觉工作台](UI_FOUNDATION.md)。

### 导航与生命周期

- `Scripts/Core/AppFlow.cs` 是不依赖 Unity 的页面状态机，限制非法跳转，分开维护游客与服务端账号身份。
- `AppBootstrap` 独占页面导航。加载期间不创建对局；点击开始时才建立 `04 Battle Page`。
- 棋盘尺寸与牌库选择只修改本次配置副本，不回写 `game-config.json`。
- 返回主页时先禁用、再销毁旧对战对象，AI、计时和选择状态不会带入新局。
- 对战菜单为本机暂停，关闭时补偿菜单停留时间；未结束的对局返回主页须确认。
- 结算弹层遮挡并拦截底层输入。可重开、查看战场，或回到主页。
- 本机招募从主页进入，独立存档，与登录的 Web 账号库存无关。基础演示 / 制作库对局不会读写招募存档。

## 账号配置

`Assets/Resources/Config/app-flow.json`：

```json
{
  "serverUrl": "",
  "requestTimeoutSeconds": 12,
  "allowGuest": true
}
```

- `serverUrl` 留空时不自动联网，在登录页填写现有 Web 服务的根地址；例如自己部署的 HTTPS 域名。它与 `game-config.json` 中尚未接入的对战 `serverUrl` 是不同设置。
- 使用当前仓库 `railway-server.js` / `account-routes.js` 提供的账号服务，不是 5190 技能工坊或 5192 卡面规划器的静态服务。
- 原生 Unity 登录调用 `POST /api/auth/login`，接收 `card_session` Cookie，再调用 `GET /api/auth/session` 确认身份。成功后读取 `GET /api/profile/{username}`；档案读取失败不会显示伪造的零胜场。
- 退出调用 `POST /api/auth/logout`；失败保留当前账号并提供重试，不假装服务端已经退出。
- 密码在提交后清空输入框；密码和 Cookie 不保存到 PlayerPrefs、配置或文件。应用重启需重新登录；没有硬编码账号密码，也不实现已被 Web 禁用的注册。
- 外部地址必须 HTTPS；只允许本机回环地址使用 HTTP。拒绝 URL 内嵌账号、路径、查询、片段和登录重定向，避免将凭据转发到其他地址。
- Unity `insecureHttpOption` 设为 DevelopmentOnly，便于编辑器 / Development Build 测试本机 HTTP。正式发布构建使用 HTTPS，不允许明文远端登录。
- WebGL 不能手动读取 / 写入 HttpOnly Cookie，使用浏览器 Cookie 路径；需要部署在 Web 后端同源地址。本次验收的是 Unity 编辑器原生请求，未宣称 WebGL 跨域、微信登录或正式服务器联调已完成。
- 不发送本地演示结果到 `/api/game/record`，避免把与 Web 不同的规则计入正式账号战绩。

## 仍未迁移的内容

主页保留 Web 的 PVE 挑战、联网对战对应入口，点击说明缺少的能力，不会启动普通 PVE 冒充这些模式。尚未迁入：90 张正式卡全部可执行技能、正式势力组卡 / 混沌、12 关精英挑战与词条、房间 / 观战 / 重连、四节交互教程、正式账号库存与招募同步、正式战绩上传。

卡牌资料弹层读取转表产物 `Data/web-card-catalog.json`，可查默认卡与备选卡，但不编辑源表。正式文字修改仍应修改 Excel 后转表。当前可执行的两类牌库是基础演示与 `workshop-library.json` 制作库。

## 验证入口

- `dotnet run --project Tools/CoreSmokeTests --configuration Release`：核心规则、制作库、AppFlow 导航、URL / Cookie 约束及已有回归。
- `node Tools/check-project.mjs`：资源 GUID、配置、卡表、依赖与字体完整性。
- Unity Test Runner → PlayMode → `CardDemo.Tests.PageFlowTests`：三组集成测试，实际创建 UI，并使用独立回环 HTTP 模拟账号服务；不连接真实账号服务、不触碰玩家数据库或招募存档。
- PlayMode 覆盖加载、游客进入 / 退出、错误密码后游客退出、登录 / 会话 / 档案 / 退出、危险地址、缺少会话、卡表搜索、地图与制作库切换、实际出牌、菜单暂停、取消返回、销毁旧局、认输结算及再次开局。
- 使用图形设备运行测试时，截图写入 `Artifacts/PageFlow/`，涵盖加载、登录、主页、图鉴、战场、菜单及结算，包含 16:10 / 16:9 布局。无图形设备时跳过截图，不能据此声称视觉验收。

2026-10-07：已在本机 Unity **2022.3.62f3c1** 实际编译并通过 3 组 PlayMode 集成测试，检查了实际渲染截图；纯 C# 回归与 109 个资源条目完整性检查通过。尚未做 Windows 发布包、WebGL、微信小游戏或手机真机验收。
