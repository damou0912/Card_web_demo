# 卡牌配置

配置拆为两份英文命名的 Excel，每份只有一个同名工作表。全部 90 张正式卡、3 个势力和 60 张默认卡的数据不变，卡名与技能文字仍为中文。

| 文件／工作表 | 内容 |
| --- | --- |
| Card Basics.xlsx / Card Basics | 一行一张卡：ID、名称、实际势力、品质、基础战力、技能名称、技能描述、默认卡组顺序 |
| Faction Icons.xlsx / Faction Icons | 每个势力对应的显示名称和图片路径 |

## 使用方法

1. 用 Excel 或 WPS 修改对应工作簿并保存。两份文件需一起保留在本目录。
2. 回到 `UnityCard_demo`，双击 `Export-CardPresentation.cmd`。
3. 看到 `PASS export` 即导出成功。重新进入卡牌页面查看变化。

命令行导出需安装 [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)，不需要安装 Excel、Python 或 Lua 插件，也不需要启动 Unity。已打开 Unity 时也可使用 `Card Demo → Tools → Presentation → Export Tables to Lua`。

## 字段说明

`Card Basics` 工作表从第 2 行开始填写，第一行英文字段名不要改。

| 字段 | 填写内容 |
| --- | --- |
| cardId | 文本 ID，保留前导零，如 `01101`；当前格式为 `0` + 势力编号 1–3 + 品质编号 1–5 + 两位编号 |
| cardName | 卡牌名称 |
| camp | 实际势力：`三国~魏`、`三国~蜀`、`三国~吴`，决定角标图片 |
| rarity | 普通、稀有、史诗、传说、特殊 |
| baseAttack | 0–99 的整数数字 |
| skill | 技能名称 |
| effect | 技能描述，支持单元格内换行 |
| defaultOrder | 整数数字；`0` 为备选卡，正数为默认卡组顺序，从 1 连续编号，不重复、不跳号 |

`Faction Icons` 使用 `camp / displayName / spritePath`。图片放在 `Assets/Resources/` 内，路径例如 `UI/FactionBadges/sanguo_wei`，不含目录前缀或 `.png` 后缀。图片须为单张 Sprite。

- 修改卡牌势力只改 `Card Basics.camp` 一处。更换势力图片只改 `Faction Icons.spritePath`，同势力卡牌共用。
- 新增卡牌只需在 `Card Basics` 追加一行，不再单独登记名单。新增势力时需补齐势力角标；扩展 ID 编号体系或卡牌总量还需同步现有校验规则。
- 保留两份文件和各自的工作表名称。除 `baseAttack` 和 `defaultOrder` 外，均填写文本。模板预留 1000 条数据行格式；超过后请先设置正确格式。
- 不使用公式或合并单元格。数字 ID 丢失前导零后必须重新输入，导出器不会猜测补零。
- 可以筛选、排序、增删行；导出包含隐藏行。默认卡组顺序由 `defaultOrder` 决定，不受整行排序影响。
- 技能字段是展示文案，不会自动生成技能执行逻辑。正式技能尚未接入 Main 演示对局。

## 自动生成的文件

保存后一次导出仅更新以下三个文件，不再生成 CSV 或额外名单：

- `Assets/Resources/Config/CardPresentation/cards.lua`：卡牌属性、技能文字和默认顺序，两个数字字段为 Lua 数值。
- `Assets/Resources/Config/CardPresentation/country-badges.lua`：势力图片映射。
- `Assets/Resources/Data/web-card-catalog.json`：兼容现有卡牌页面和参考库的读取格式。

这些是生成物，不要手动维护。当前 C# 界面读取 JSON 中的卡牌数据和势力角标 Lua；`cards.lua` 供后续 Lua 端使用，不能传入仅接受字符串的角标解析器。

导出会检查重复 ID、字段类型、默认顺序、势力映射和图片路径。数据校验失败时不会写入任何输出，错误包含工作表及单元格位置。文件占用、磁盘满等写入故障需排除后重试，不保证多文件写入的事务性。

在工程目录执行 `dotnet run --project Tools/PresentationConfig --configuration Release -- check` 可只校验而不写文件。将其中一份相同格式的工作簿拖到一键脚本上可替换该输入；工具通过工作表名识别类型，副本文件名不限，另一份仍从本目录读取。一次校验两份表，再写入本工程输出。运行中修改配置需重新进入，或由代码调用 `CardBadgeResources.ResetCache()` 后重新绑定。

`Faction Icons` 表示势力图标；`State Icons` 通常指状态图标，故不用于当前国度角标配置。

网页资料同步脚本只生成 `Artifacts/Imports/web-card-catalog.import.json` 对照稿；确认差异后更新本 Excel。演示库、工坊技能和全局游戏配置继续使用原有工具。

## 旧表备份

拆分前的合并工作簿已备份到 `Artifacts/ConfigTableBackups/before-english-split-20260923.xlsx`，从配置目录移除，不再参与导出。更早的旧 Excel、CSV、名单和已合并的 Lua 已归档到 `Artifacts/ConfigTableBackups/before-consolidation-20260923-160819.zip`，不参与导出，需要时可恢复。备份仅保存在本机。
