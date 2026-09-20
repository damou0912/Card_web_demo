# 卡牌页面制作预留区

这个文件夹只处理**卡牌长什么样、页面展示什么**，与“卡牌技能制作”分开。可复用到卡牌图鉴、组卡详情、奖励展示等页面。

## 最简单的修改方法

1. 在 Unity Project 窗口找到 **`Assets/CardPageTemplate/Samples/ExampleCardPage.asset`**。
2. 建议先 `Ctrl+D` 复制为自己的资产，再在 Inspector 修改卡名、ID、势力、品质、战力、技能说明、自定义字段和按钮文字。标题、颜色、字号、立绘高度也可改。
3. 图片放在 **`Assets/CardPageTemplate/Artwork/`**。选中图片 → Texture Type 设为 **Sprite (2D and UI)** → Apply → 拖进配置的“卡牌立绘 Sprite”。没图片时自动显示占位提示。
4. 双击 **`Assets/CardPageTemplate/Scenes/CardPagePreview.unity`**，点击 Play 预览默认示例。若使用自己的资产，选中场景里的 `CardPagePreview` 对象，把副本拖入它的 `Content` 字段。
5. 修改后点击内容资产 Inspector 底部的“保存资产并刷新已打开的页面”。

也可以通过菜单 **Card Demo → Tools → Card Page** 访问以上入口。

## 想直接在 Unity 里改页面布局

选中自己的内容资产，点击 Inspector 的 **“以这份配置生成可编辑页面场景”**，或菜单 **Card Demo → Tools → Card Page → 3 - Generate Editable Page Scene**。

生成位置：**`Assets/CardPageTemplate/Generated/CardPageEditable.unity`**。
每次生成都使用新文件名；已有文件不会被覆盖，后续可能带 `1`、`2` 等后缀。

生成后的页面在编辑状态即有完整 UI Hierarchy，可以直接修改：

```text
CardPage                         Canvas + CardPageView
  SafeArea
    PageScroll                   整页竖向滚动
      ScrollContent
        EditableCard
          PageTitle / PageSubtitle
          CardName / CardId
          Stats                  势力 / 品质 / 战力
          ArtworkArea            立绘和空图占位
          SkillTitle / SkillDescription
          ExtraTitle / ExtraFields
          ExtensionSlot_AddYourWidgetsHere
          ActionButton
          Footer / ActionFeedback
```

`ExtensionSlot_AddYourWidgetsHere` 是通用扩展区域，可添加标签、星级、收集数量等自定义 UI。它使用竖向自动布局；自定义子物体可以加 `LayoutElement` 设置高度。

页面使用 LayoutGroup 自动排列，直接修改 RectTransform 的坐标可能被布局覆盖。间距、内边距在 LayoutGroup 上改，尺寸用 LayoutElement 改。若手动调整卡宽、立绘高度，取消 `CardPageView` 的 `Use Configured Sizes`，避免刷新内容时被配置覆盖。

刷新只更新绑定的文字、图片、样式，不销毁或重建你加的子物体。文字、颜色、字号默认跟随内容资产；按钮业务事件和 UI 布局保留。可把生成场景里的 `CardPage` 拖入 Project 保存为 Prefab，再放到其他场景；运行时需要场景中有 EventSystem。

## 简易通用内容

默认示例已包含：标题、副标题、卡名、ID、势力、品质、战力、立绘占位、技能标题、完整描述、扩展字段列表、可隐藏按钮及底部说明。

扩展字段按“标签 + 值”填写，例如“费用：3”“获得途径：关卡奖励”“拥有数量：2”，不必改代码。长内容可通过整页滚动阅读；立绘保持宽高比。

## 给后续开发预留的接口

- `CardPageView.Bind(CardPageData data)`：显示另一份页面配置。
- `CardPageView.ShowCard(CardDefinition definition, Sprite portrait = null)`：用现有卡牌数据填充详情；结构化技能自动生成说明。不会修改卡表、配置资产或技能。为避免串卡，绑定新卡会清除示例卡的立绘与扩展字段。
- `CardPageView.onActionRequested`：按钮触发卡牌 ID，可在 Inspector 绑定业务事件，也可在代码里监听。没有监听者时仅显示事件提示，**不代表已经加入卡组、抽卡或购买成功**。

```csharp
// page 是现有 CardPageView 组件。调用前先配置它的 Content。
page.ShowCard(cardDefinition, cardSprite);
page.onActionRequested.AddListener(cardId => {
    // 在这里接你自己的组卡 / 图鉴 / 奖励逻辑。
    UnityEngine.Debug.Log("选中卡牌：" + cardId);
});
```

如其他脚本放在独立 asmdef 中，需要引用 `CardDemo.CardPage`（以及使用卡牌模型时的 `CardDemo.Core`）。

此预览独立于 `Main` 战斗场景，**未自动加入战斗场景或默认构建列表**。如需打包这张页面，请在 Build Settings 添加预览／生成场景，使用 Unity 的普通 Build；现有工程的快捷 Build 菜单仍只构建 Main。

## 文件职责

| 文件 / 目录 | 用途 |
|---|---|
| `Samples/ExampleCardPage.asset` | 最常修改的示例内容与外观 |
| `Scenes/CardPagePreview.unity` | 直接 Play 预览 |
| `Artwork/` | 卡牌图片预留目录 |
| `Runtime/CardPageData.cs` | 配置字段定义，新增通用字段从这里开始 |
| `Runtime/CardPageFactory.cs` | 默认页面结构和自动布局 |
| `Runtime/CardPageView.cs` | 页面绑定、刷新和按钮事件 |
| `Editor/` | 中文 Inspector 和生成场景菜单 |
| `Tests/` | 七组 Unity EditMode 页面测试 |

已提供语法与资源引用检查；Unity 场景运行、实际窗口排版和 EditMode 页面测试需在 Unity 2022.3.62f3 中执行，不能用 .NET 规则测试代替。
