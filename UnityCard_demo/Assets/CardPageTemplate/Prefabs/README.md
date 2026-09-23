# 单张卡牌预制体：EditableCard.prefab

这是可以直接在 Unity 编辑器里拖动内部元素的**卡牌 Prefab**，不是整页 UI，也没有运行时拖拽系统。Main 对局界面保持原样。

## 最短操作

1. Project 中双击 `Assets/CardPageTemplate/Prefabs/EditableCard.prefab`，进入 Prefab 编辑模式。无需点击 Play。
2. 在 Hierarchy 选中 `CardName`（卡名）、`ArtworkArea`（立绘区）、`PowerBadge`（战力）、`Rarity`（品质）、`SkillTitle` 或 `SkillDescription`。
3. 按 **T** 切换 Rect 工具，拖动位置与边框调整大小。Inspector 的 Rect Transform 可以精确填写 Pos X/Y、Width/Height。
4. 修改 Text 的文字、字号、颜色，或修改 Image 的颜色和 Sprite；保存 Prefab。这里没有 LayoutGroup 自动排列，不会把你的位置改回去。

也可通过菜单 **Card Demo → Tools → Card Prefab → 1 - Open Editable Card** 打开。

## 结构

```text
EditableCard                 420 × 600，单张卡牌根节点
  AccentLine                 顶部装饰
  CardName / Faction / Rarity 卡名、势力、品质
  PowerBadge                 战力区域，整体移动
    Power / PowerLabel       数字与“战力”文字
  ArtworkArea                立绘区域，整体移动和调整大小
    Artwork                  替换 Sprite 的位置
    ArtworkPlaceholder       没有图片时的提示
    CountryBadge             国度角标，由实际势力配表加载，可拖动位置和尺寸
  SkillTitle                 技能名称
  SkillDescription           技能描述
  ExtensionSlot              空的自定义扩展区
  CardId                     底部卡牌 ID
```

`Artwork` 和占位文字随立绘区伸缩；其他内容可自由摆放。长技能说明默认不自动缩小字号，放不下时请增大说明区域或调整字体。卡牌根节点改宽高后，可自行调整内部排版，没有自动避让。

## 换立绘

国度角标由实际势力决定：在 `ConfigTables/Card Basics.xlsx` 只填写一次 `camp`，由 `ConfigTables/Faction Icons.xlsx` 的该势力行提供图片路径。修改后统一导出 Lua 和 JSON。根节点 Inspector 提供“按真实卡牌势力预览角标”，输入 `01101` 可预览蜀角标；具体说明见 `Documentation/FACTION_BADGE_PIPELINE.md`。

`CountryBadge` 默认隐藏（示例卡未配置真实势力），绑定真实卡后按表显示。运行中不要直接给此 Image 指定另一国的图来替代势力数据。

将图片放进 `Assets/CardPageTemplate/Artwork`，Texture Type 设为 **Sprite (2D and UI)**，Apply。
把 Sprite 拖到 `Artwork` 的 **Image → Source Image**。选择根节点，点 Inspector 的 **换图后同步显示立绘 / 占位文字**。

此按钮只切换图片与占位文字的显示；不会改尺寸、位置或颜色。也可手动启用 Artwork 的 Image，关闭 ArtworkPlaceholder。

## 内容与外观分开

直接编辑子物体的 Text/Image 就能调整样式，不依赖额外内容资产。
如果要使用之前的卡牌内容资产，在根节点 Inspector 选择 `ExampleCardPage.asset` 或自己的副本，再点 **填入文字和图片**。这一步只填卡名、ID、势力、品质、战力、立绘与技能，不套用整页标题、按钮或自动布局；可以 Ctrl+Z 撤销。

`CardPrefabView` 没有启动自动刷新，也不重建子物体。位置、宽高、字号、颜色、自定义装饰始终由你在预制体里控制。

代码填入真实卡牌：`cardView.ShowCard(cardDefinition, sprite)`。这只是展示，不执行技能，也不会改卡组或战斗数据。不要删掉已绑定的子物体；替换它们时在根节点 CardPrefabView 中重新绑定引用。

## 放入场景

它自身不带 Canvas。把 Prefab 拖到现有 **Canvas** 下即可使用；保存 Prefab 的修改会更新所有未单独覆盖相应属性的实例。建议先 Ctrl+D 复制，或创建 Prefab Variant 做不同卡框。

想单独看效果，菜单 **Card Demo → Tools → Card Prefab → 2 - Create Preview Scene** 会生成 `Assets/CardPageTemplate/Generated/CardPrefabPreview.unity`（重名自动换新文件名）。场景引用原 Prefab，不是独立重建一份卡牌；无需 Play 即可查看。场景内的实例改动只影响该实例，通用样式请双击原 Prefab 修改。

这个预制体没有自动替换 Main 中的手牌／棋盘显示，也没有加入对局点击、拖牌或联网逻辑。若需要实际对局使用同一张卡框，需要再接入对应的显示和操作接口。

静态检查覆盖序列化引用、字体、组件与无自动布局；附带 4 组 Unity EditMode 测试。未运行 Unity 编辑器，因此 Prefab 导入、拖动与渲染效果仍需在 Unity 2022.3.62f3 中验收。
