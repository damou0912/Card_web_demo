# 国度角标：选用方案 1

## 已确定

使用竖签大字版，题签为「三国」，不显示短横线。魏蓝、蜀橙、吴绿。

三个角标已经独立切图，使用统一裁剪区域、768 × 640 透明画布和中心锚点，避免切换势力时发生基准位置跳动。

| 角标 ID | 资源文件 | Unity Resources 内部路径 |
| --- | --- | --- |
| sanguo_wei | `Assets/Resources/UI/FactionBadges/sanguo_wei.png` | `UI/FactionBadges/sanguo_wei` |
| sanguo_shu | `Assets/Resources/UI/FactionBadges/sanguo_shu.png` | `UI/FactionBadges/sanguo_shu` |
| sanguo_wu | `Assets/Resources/UI/FactionBadges/sanguo_wu.png` | `UI/FactionBadges/sanguo_wu` |

文件设置为单张 Sprite，保留透明度，不生成 mipmap，不使用有损压缩。运行时路径不含 `Assets/Resources/` 前缀或 `.png` 扩展名，也不包含任何本机绝对路径。

## 配置关系

`卡牌 ID → Card Basics.camp（实际势力） → Faction Icons.camp → spritePath → Sprite`

- **Card Basics**：同一行维护 ID、名称、实际势力、属性、技能文字和默认卡组顺序，共 90 张正式卡，ID 为字符串。不再维护重复的逐卡表现表。
- **Faction Icons**：`camp,displayName,spritePath`，每个具体势力只对应一份角标。魏蓝、蜀橙、吴绿。
- 取消逐卡任意指定 `countryBadgeId` 的设计。势力决定图片，图片不反向决定卡牌势力。
- 导出时检查正式卡与演示库、制作库的 ID 不冲突，每张正式卡的实际势力必须存在图片映射。卡牌势力只需修改一处，属性与显示共用同一数据源。
- 运行时核对传入卡牌的 `camp` 与导出的卡牌 JSON 一致。不一致、未知卡牌或缺失图片时回退该卡自己的势力文字，清除上一张图片。不会自动猜测一个国度。
- 同时校验重复卡牌／势力键、空势力、字段格式、越界路径、缺失图片；图片路径只接受安全的内部相对路径。

## 当前接入状态

配表源为 `ConfigTables/Card Basics.xlsx` 和 `ConfigTables/Faction Icons.xlsx`，各自只有一个同名工作表。生成 `Assets/Resources/Config/CardPresentation/country-badges.lua`、合并后的 `cards.lua` 和供原界面使用的 `Assets/Resources/Data/web-card-catalog.json`。不再生成 CSV，不再维护独立卡牌名单。详见 [Excel 导出步骤](../ConfigTables/README.md)。

使用真正的 `.lua` 文件，通过 `LuaConfigImporter` 导入为 Unity TextAsset。角标运行时读取 JSON 卡牌资料和势力角标 Lua，不重复存储逐卡势力映射。纯 C# 角标读取器仅支持导出器的 `return { ["键"] = { 字段 = "字符串" } }` 数据子集，不执行脚本、函数或表达式；不是完整 Lua VM，不依赖第三方插件。包含数字字段的 `cards.lua` 供后续 Lua 端使用，不交给该字符串解析器。

导出菜单：`Card Demo → Tools → Presentation → Export Tables to Lua`。无需启动 Unity 的导出入口：工程根目录 `Export-CardPresentation.cmd`（需要 .NET 8 SDK）。两个入口共用直接读取 `.xlsx` 的纯 C# 工具，不需要安装 Excel 或第三方 Excel 包。基础战力和默认卡组顺序为整数数字，其余字段为文本；拒绝公式和数字类型 ID。数据先全部校验，再写出。

单卡预制体已绑定 `ArtworkArea/CountryBadge`，默认立绘左上角 96 × 80，可在 Prefab 中自由调整，不会被数据绑定重排。`CardPrefabView.ShowCard` / `ShowContent` 会按 ID 和实际势力刷新角标；详情页 `CardPageView` 也使用同一读取逻辑。缺少角标时显示原势力文字。

预览真实卡：双击 `EditableCard.prefab`，在根节点 Inspector 的“按真实卡牌势力预览角标”输入如 `01101`，点击“从卡牌资料填入并预览角标”。保留原示例卡 `preview_001`，它没有真实三国势力，默认不会假装有三国角标。

当前 **Main** 手牌／棋盘仍使用原有按钮式演示界面，没有切换为此预制体，也没有替演示卡编造三国归属。若要在 Main 展示这些正式卡及其技能，需要独立接入；此处未声称完成。

## 验证

离线检查覆盖：两份 Excel 一次导出→Lua/JSON→势力图引用、90 张卡数据完整、字符串前导零、修改一次实际势力即可切换图片、拒绝运行时过期势力、同势力共图、未知记录／失效路径回退、Lua 数据格式限制、预制体序列化引用、手动布局保持。Excel 读取器另有共享／内联文本、富文本、转义、数字格式、默认顺序和拒绝公式等回归测试。

新增 Unity EditMode 用例验证 .lua 导入为 TextAsset、Sprite 加载、切卡清空旧图和不移动角标槽；按照用户要求未启动 Unity，因此实际导入／渲染及这些 EditMode 用例尚待编辑器验证。

## 字形授权

素材沿用本机华文行楷 STXingkai 的字体加工预览，用户已选定视觉方案，但尚未核验游戏商业发布所需的字形授权。当前仅供开发测试；正式发布前应确认授权或替换成授权明确的字形。本项目未复制字体文件。
