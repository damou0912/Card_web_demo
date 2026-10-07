# 页面视觉工作台与 UI 优化基础

本轮为加载、登录、主页和对战建立可维护的视觉入口。保留原有导航、账号接口和对战规则；不是最终美术，也没有把运行时页面改为完整的 Prefab 系统。

## 使用步骤

Unity 菜单：**Card Demo → UI → 页面视觉工作台**。无需 Play 即可查看页面。

1. 保持默认主题和布局，选择“页面 / 状态”，点击“打开独立预览场景”。当前场景有未保存内容时，会先询问保存。
2. 在 Game 视图查看页面，在 Scene / Hierarchy 中选择区域；建议同时检查 16:10 和 16:9。
3. 修改主题参数后点击“按当前主题 / 布局刷新预览”。
4. 调整位置时，选择带 `UiElement` 的节点，按 T 修改 RectTransform，再点击“记录选中节点的 RectTransform / 字号”。**先记录，后刷新**，否则未记录的场景调整会被替换。
5. 点击“检查预览：重复 ID / 文字裁切”。自动检查只能提示可能裁切，仍需目视检查遮挡、对比度和留白。
6. 返回 `Assets/Scenes/Main.unity`，重新 Play 验证交互。只改预览场景、未记录到布局资产的调整不会进入游戏。

预览使用示例状态，不登录、不运行 AI、不读写玩家存档。不会覆盖 Main 或自动加入构建场景列表；可另存为设计稿。刷新预览和记录布局支持 Unity Undo。

## 两份运行时资产

| 资产 | 可维护内容 |
| --- | --- |
| `Assets/Resources/UI/AppUiTheme.asset` | 中文字体、字号缩放、按钮 / 输入框字号、页面与战场配色、选中描边、交互过渡、棋盘间距、背景与控件图片 |
| `Assets/Resources/UI/AppUiLayout.asset` | 按稳定节点 ID 保存位置、大小和文字字号；默认空列表，沿用代码初始布局 |

默认资产的修改用于实际页面。菜单“选择运行时主题 / 布局”可直接定位。自建副本可在工作台试验，但**不会自动替换运行时资产**。

图片槽位为空时使用纯色。图片导入为 Sprite 后可拖入槽位；面板、按钮、输入框在 Sprite 设置了 Border 时按九宫格显示，否则按普通图片显示。四页分别有背景槽位；图片仍受对应配色染色，接入美术时需一起检查。不要删除中文字体引用。

全局字号缩放范围为 0.8～1.2。布局覆盖 `fontSize = 0` 表示沿用主题字号，非零为最终字号，不再叠加缩放。放大后需检查裁切。

## 布局与绑定规则

- `UiElement.key` 是视觉绑定 ID。在预览中只修改物体名称不会改变 ID；不要手动修改 ID。后续代码重命名构建节点时需保留原 ID 或迁移布局。
- 示例：`login/Brand Panel`、`home/Heading`、`home/Start Battle`、`battle/Board`、`battle/Human Hand`、`battle/Details`。
- 保存相对直接父区域的归一化矩形：左上角为原点，位置和尺寸为 0～1。请调整位置与大小，不使用旋转、缩放代替排版。
- 页面根节点和自动排版子项受保护。棋盘格、手牌、滚动长文仍由布局组件排列，应调整外层区域。棋盘格间距在主题中调整。
- 调整按钮文字字号时选择按钮下的 `Label`；选择按钮本体只记录按钮区域。
- 移除选中节点覆盖后刷新，可恢复代码默认排版。非法、越界或重复 ID 配置会报错，失败记录不会覆盖已有有效值。
- 布局应用不替换按钮事件或业务数据。运行中的页面不会实时重建；修改后返回 Main 并重新 Play 验证。

## 预览状态

| 页面 | 工作台状态 |
| --- | --- |
| 加载 | `Loading`、`LoadingError` |
| 登录 | `Login`、`LoginBusy`、`LoginError` |
| 主页 | `HomeGuest`、`HomeAccount`（示例账号档案） |
| 对战 | `Battle`、`BattleMenu`、`BattleResult` |

地图选中态统一为勾选与描边；登录提交中显示忙碌文字并禁用操作；按钮首次出现立即应用主题颜色，后续交互使用主题过渡时间。

## 维护与验证

以下代码路径相对 `Assets/`：

- `Scripts/Runtime/Pages/UiTheme.cs`：主题参数和按钮皮肤。
- `Scripts/Runtime/Pages/UiLayoutProfile.cs`、`UiElement.cs`：布局覆盖与标识。
- `Scripts/Runtime/Pages/PageUi.cs`：前三页共用控件。
- `Scripts/Runtime/DemoBootstrap.View.cs`：战场 UI；规则仍与视觉配置分离。
- `Editor/UiWorkbenchWindow.cs`：预览、记录与检查。

验证入口：`Card Demo → Validate Project`；Test Runner → EditMode → `UiFoundationTests`；PlayMode → `PageFlowTests`。本轮新增 6 组 EditMode 检查，覆盖 10 种预览状态、主题配色 / 字号 / 九宫格、布局回放、重命名、非法保存保护和回调保持；沿用 3 组页面流程回归。

后续可继续设计正式配色与图片、逐区替换为 Prefab、补动效和本地化。当前未制作最终背景 / 图标，未改为 TextMeshPro，也未完成手机竖屏、WebGL 或发布包适配验收。
