using System;
using UnityEngine;

namespace CardDemo.CardPage
{
    [Serializable]
    public sealed class CardPageExtraField
    {
        public string label = "自定义项目";
        public string value = "可替换的内容";
    }

    // Presentation data only. Editing a page never changes the battle catalog or a card's skills.
    [CreateAssetMenu(fileName = "NewCardPage", menuName = "Card Demo/卡牌页面内容")]
    public sealed class CardPageData : ScriptableObject
    {
        [Header("页面文字")]
        public string pageTitle = "卡牌详情";
        public string pageSubtitle = "通用页面模板 · 可用于图鉴、组卡、抽卡结果";
        public string cardId = "preview_001";
        public string cardName = "示例武将";
        public string faction = "自定义势力";
        public string rarity = "稀有";
        [Min(0)] public int power = 3;

        [Header("立绘（留空时显示占位区）")]
        public Sprite artwork;
        public string artworkPlaceholder = "立绘占位区\n将 Sprite 拖入配置中的卡牌立绘";

        [Header("技能文字（仅展示，不执行技能）")]
        public string skillTitle = "示例技能 · 鼓舞";
        [TextArea(4, 12)] public string skillDescription = "入阵：四方相邻的其他己方卡牌，本回合战力 +1。\n\n这是展示示例。实际效果请在卡牌与技能工坊中制作。";

        [Header("通用扩展内容")]
        public string extraTitle = "其他资料";
        public CardPageExtraField[] extraFields = {
            new CardPageExtraField { label = "定位", value = "辅助 / 可修改" },
            new CardPageExtraField { label = "获得途径", value = "这里填写说明" }
        };
        public bool showAction = true;
        public string actionLabel = "选用这张卡牌";
        [TextArea(2, 5)] public string footer = "预留按钮：尚未连接组卡、抽卡或购买逻辑。";

        [Header("颜色与排版")]
        public Color backgroundColor = new Color32(14, 22, 35, 255);
        public Color surfaceColor = new Color32(27, 40, 59, 255);
        public Color artworkBackgroundColor = new Color32(36, 56, 74, 255);
        public Color accentColor = new Color32(89, 204, 185, 255);
        public Color textColor = new Color32(238, 244, 250, 255);
        public Color mutedTextColor = new Color32(163, 181, 201, 255);
        public Color buttonTextColor = new Color32(12, 32, 36, 255);
        [Range(360, 960)] public float cardWidth = 680;
        [Range(100, 600)] public float artworkHeight = 240;
        [Range(22, 56)] public int titleFontSize = 36;
        [Range(16, 36)] public int bodyFontSize = 23;

        public void Validate()
        {
            if (string.IsNullOrWhiteSpace(pageTitle) || string.IsNullOrWhiteSpace(cardId) || string.IsNullOrWhiteSpace(cardName))
                throw new ArgumentException("页面标题、卡牌 ID 和名称不能为空。");
            if (power < 0) throw new ArgumentException("展示战力不能为负数。");
            if (float.IsNaN(cardWidth) || float.IsInfinity(cardWidth) || cardWidth < 360 || cardWidth > 960
                || float.IsNaN(artworkHeight) || float.IsInfinity(artworkHeight) || artworkHeight < 100 || artworkHeight > 600)
                throw new ArgumentException("页面宽度为 360~960，立绘高度为 100~600。");
            if (titleFontSize < 22 || titleFontSize > 56 || bodyFontSize < 16 || bodyFontSize > 36)
                throw new ArgumentException("标题字号为 22~56，正文字号为 16~36。");
            if (showAction && string.IsNullOrWhiteSpace(actionLabel)) throw new ArgumentException("显示按钮时，按钮文字不能为空。");
        }
    }
}
