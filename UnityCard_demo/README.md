# UnityCard_demo

独立、可搬到新电脑的 Unity 2D 卡牌起步工程。现有网页游戏无需启动，也无需复制旧电脑的缓存、字体或账号。

**版本：Unity 2022.3.62f3（revision `96770f904ca7`）。当前是基础 PVE 演示，不是完整网页版移植，也不是可直接发布的微信小游戏。**

新增卡牌制作工具：**Card Demo → Tools → Card And Skill Workshop / Battle Lab**。
包括卡牌编辑、技能组合、测试卡组、战斗实验室，详见 [工具使用指南与示例](Documentation/AUTHORING_TOOLS.md)。

新增独立的卡牌页面制作区：[`Assets/CardPageTemplate`](Assets/CardPageTemplate/README.md)。
修改 `Samples/ExampleCardPage.asset` 即可替换页面内容、图片、颜色和字号；菜单 **Card Demo → Tools → Card Page** 可预览或生成可编辑 UI 场景。

单张卡牌的可编辑预制体：[`Assets/CardPageTemplate/Prefabs/EditableCard.prefab`](Assets/CardPageTemplate/Prefabs/README.md)。双击进入 Prefab 模式，按 T 自由调整卡名、立绘、战力、技能等子物体的位置和大小，无自动排列；无需 Play。它不改变现有 Main 对局界面。

## 新电脑最快启动

后续仅使用 [GitHub 双击同步方案](Documentation/GITHUB_SYNC.md)：首次运行 `Download-GitHub.cmd`，之后关闭 Unity 再运行 `Update-GitHub.cmd`。Unity Hub 选择下载后仓库中的 `UnityCard_demo` 子目录；Git 仍需要能够连接 GitHub。

1. 下载本仓库 ZIP 并解压，或 `git clone https://github.com/damou0912/Card_web_demo.git`。
2. 打开本目录的 `Tools/setup-links.html`，按页面链接安装 [Unity Hub](https://unity.com/download)。
3. 在 Unity Hub 登录，并按自己的资格激活 Unity 许可证。安装 **2022.3.62f3**；可在 [Unity 版本归档](https://unity.com/releases/editor/archive) 搜索，或使用页面中的 Hub 安装链接。
4. Unity Hub → Projects → Add project from disk，选择 **`UnityCard_demo` 文件夹**。不要选择仓库根目录或 `Assets`。
5. 等待首次包恢复与资源导入完成，双击 `Assets/Scenes/Main.unity`，点击 **Play**。场景中的界面在 Play 时生成，编辑状态只有一个标记对象属于正常情况。
6. 菜单 **Card Demo → Configuration** 修改参数；保存后退出并重新进入 Play 生效。

主场景建议以横屏 16:10 或 16:9 查看。点击手牌，再点击空格放置；点击己方场上卡牌，再点击相邻空格或敌卡移动／攻击。右侧查看技能，左下角展开全部战斗流程。

首次安装需要网络、可访问 Unity 包服务以及合法许可证；不需要付费插件。完成依赖下载后，演示对局不访问服务器。Unity 自身安装与许可证受官方环境要求约束，本项目不携带编辑器或激活工具。

## 本版包含

- 纯 C# 规则核心，与 Unity 界面分离；4×4 / 5×5 棋盘、2 个中立守军、放置、休整、移动和交战。
- 玩家对 AI，20 张牌库、5 张手牌上限、随机先手、30 个全局回合、每回合默认 300 秒。
- 五张明确标为「演示」的卡，演示属性增减、护盾保护与被摧毁技能；演示牌库按配置循环这些卡，不代表正式品质配额。
- 固定我方／对方信息位置；始终展示我方手牌；对方回合的行动数与计时变色；任意回合认输。
- 结算显示获胜者 ID、双方 ID、比分和回合数。
- 可展开流程记录：来源卡、目标卡、属性变化、摧毁及保护原因；不泄露 AI 抽到的手牌名称。
- 正式网页卡牌 **90 张资料**（60 张默认 + 30 张备选），可以在配置窗口搜索查看；正式技能未接入演示。
- 配置面板、安装导航、Windows 环境检查／可选安装、Windows 和 macOS 打开方式、命令行测试／构建入口。
- 随项目分发的中文字体、许可证、稳定 `.meta` GUID、固定 Unity 版本和包依赖。

## 配置入口

**推荐：Card Demo → Configuration。** 也可以直接编辑：

| 文件 | 用途 |
|---|---|
| `Assets/Resources/Config/game-config.json` | 标题、玩家 ID、4/5 格棋盘、回合秒数、回合上限、牌库与手牌数、AI 速度、种子 |
| `Assets/Resources/Data/demo-cards.json` | 五张演示卡的数值、说明、已有演示技能类型 |
| `Assets/Resources/Data/web-card-catalog.json` | 正式卡牌资料快照，只供查阅 |
| `Assets/Resources/Data/workshop-library.json` | 独立制作库：卡牌、可执行技能步骤与测试卡组 |
| `Assets/Scripts/Core/GameEngine.cs` | 演示结算；新增技能必须实现代码并增加测试，仅改描述不会新增效果 |

`seed = 0` 表示每局重新随机；非零值用于重现对局。`useWorkshopCards` 可切换到制作库，默认关闭；双方测试卡组 ID 可在工坊设置。`serverUrl`、`wechatAppId` 仅预留，当前不发起联网。**客户端文件中不能写 AppSecret、数据库密码、支付密钥或访问令牌。**

## Windows 辅助工具

从 `UnityCard_demo` 目录打开 PowerShell。默认只检查环境，不安装软件、不修改全局执行策略：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Setup-Windows.ps1
```

以下命令是用户主动选择的安装动作，会下载软件并可能需要系统权限。先阅读脚本再运行；`-ExecutionPolicy Bypass` 仅对这次进程有效：

```powershell
# 安装 Unity Hub；编辑器和许可证仍在 Hub 内选择、确认。
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Setup-Windows.ps1 -InstallHub -OpenEditorInstall

# 可选：Git、VS Code、.NET 8 SDK、Node.js LTS。
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Setup-Windows.ps1 -InstallDevTools

# 安装完成后打开工程；自定义安装位置可加 -UnityPath。
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Setup-Windows.ps1 -OpenProject
```

如果没有 winget，使用安装导航中的官方网站手动安装。只在 Unity 中玩演示**不需要**独立 Node.js 或 .NET SDK。

macOS：安装相同版本的 Unity 后，运行 `sh Tools/open-project-macos.sh`；自定义路径可设置 `UNITY_EDITOR_PATH`。未针对 Linux 桌面或特定手机型号承诺验证。

## 测试和构建

可选安装 .NET 8 SDK，运行纯规则测试（不需要 Unity，不下载第三方 NuGet 包）：

```sh
dotnet run --project Tools/CoreSmokeTests/CoreSmokeTests.csproj --configuration Release
```

可选安装 Node.js 18 或更新版本，检查资源、配置、引用 GUID、卡表和字体校验和：

```sh
node Tools/check-project.mjs
```

Unity 内：**Card Demo → Validate Project**；**Window → General → Test Runner → EditMode → Run All**。

Windows 命令行（先关闭这个项目的 Unity 编辑器；以下路径为默认安装示例）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Run-Unity.ps1 -UnityPath "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe" -Task Validate
powershell -NoProfile -ExecutionPolicy Bypass -File .\Tools\Run-Unity.ps1 -UnityPath "C:\Program Files\Unity\Hub\Editor\2022.3.62f3\Editor\Unity.exe" -Task Test
```

将 `-Task` 改为 `Windows` 或 `WebGL` 可构建对应平台；也可使用 **Card Demo → Build** 菜单。先在 Hub 安装对应平台模块，输出在 `Builds/`，日志在 `Artifacts/`。WebGL 构建要用 HTTP 静态服务器打开，不能双击 `index.html`。

**WebGL 不是微信发布包。** 微信转换 SDK、登录、网络和真机适配属于后续工作。当前 UI 使用 uGUI、传统 Input Manager 和横屏布局；升级输入系统／Unity 大版本前请另开分支验证。

## 维护与移植边界

- 本目录可以单独复制或归档，运行不读取 `../` 下任何网页文件。
- 若以后更新正式卡牌资料，可在 Node.js 环境运行 `node Tools/export-web-cards.mjs /path/to/web-repo`；这是可选的单向数据生成，不会执行或修改网页源码。
- `.meta` 文件必须随资源提交；不要提交 `Library`、`Temp`、`Logs`、`UserSettings`、`Builds` 或本机凭据。
- GitHub 的 `Unity Card Demo checks` 工作流只执行静态完整性检查和纯 C# 测试，**不代表 Unity 编辑器已编译或真机验证**。
- 未来完整移植需要明确正式规则来源、移植各势力技能和精英 AI、组卡／挑战／存档，接入权威服务器、微信身份及重连；不在本起步工程中虚构这些接口已经完成。
- 演示计时使用本机 UTC 截止时间，切回前台后处理当前回合超时；不是可信服务器计时，也不补跑后台经过的所有回合。

详见 [迁移路线和架构](Documentation/ARCHITECTURE.md)、[验收状态](Documentation/VERIFICATION.md)。第三方字体见随包 `OFL.txt`；项目源码和游戏数据沿用所属仓库的授权范围，未擅自改为开源许可证。
