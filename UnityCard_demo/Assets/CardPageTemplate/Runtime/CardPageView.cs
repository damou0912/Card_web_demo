using System;
using System.Linq;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.UI;

namespace CardDemo.CardPage
{
    [Serializable] public sealed class CardPageAction : UnityEvent<string> { }

    // Keeps editable RectTransforms intact. Bind only changes content/style, never rebuilds children.
    public sealed class CardPageView : MonoBehaviour
    {
        [Header("替换这里的资产即可换一张卡的页面")]
        public CardPageData content;
        [Header("预留业务事件：返回当前展示的卡牌 ID")]
        public CardPageAction onActionRequested = new CardPageAction();
        [Header("勾选：宽度、立绘高度跟随配置；取消：手动布局不被覆盖")]
        public bool useConfiguredSizes = true;

        [HideInInspector] public RectTransform safeArea;
        [HideInInspector] public LayoutElement widthElement, artworkElement;
        [HideInInspector] public Image background, surface, artBackground, accentLine, artwork;
        [HideInInspector] public Image countryBadge;
        [HideInInspector] public Text pageTitle, pageSubtitle, cardName, cardId, faction, rarity, power;
        [HideInInspector] public Text artPlaceholder, skillTitle, skillDescription, extraTitle, extraBody, footer, actionText, feedback;
        [HideInInspector] public Button actionButton;
        [HideInInspector] public RectTransform extensionSlot;
        [HideInInspector] public ScrollRect pageScroll;

        private string displayedCardId;
        private Rect lastSafeArea;
        private int screenWidth, screenHeight;

        public string DisplayedCardId { get { return displayedCardId; } }

        private void Start()
        {
            if (actionButton == null)
            { Debug.LogError("CardPageView 需要通过页面生成器创建完整的 UI 引用。", this); enabled = false; return; }
            actionButton.onClick.RemoveListener(RequestAction);
            actionButton.onClick.AddListener(RequestAction);
            // Preserve a ShowCard/Bind call made immediately after Create, before Unity runs Start.
            if (string.IsNullOrEmpty(displayedCardId)) RefreshContent();
            UpdateSafeArea();
        }

        private void Update()
        {
            if (Screen.width != screenWidth || Screen.height != screenHeight || Screen.safeArea != lastSafeArea) UpdateSafeArea();
        }

        [ContextMenu("刷新页面内容（不重建布局）")]
        public void RefreshContent()
        {
            if (content == null) return;
            try { Bind(content); }
            catch (Exception error) { Debug.LogError("卡牌页面配置无效：" + error.Message, this); }
        }

        public void Bind(CardPageData data)
        {
            if (data == null) throw new ArgumentNullException("data");
            data.Validate();
            content = data; displayedCardId = data.cardId;
            pageTitle.text = data.pageTitle; pageSubtitle.text = data.pageSubtitle;
            cardName.text = data.cardName; cardId.text = "ID  " + data.cardId;
            faction.text = "势力  " + data.faction; rarity.text = "品质  " + data.rarity; power.text = "战力  " + data.power;
            CardBadgeResources.Bind(countryBadge, faction, data.cardId, data.faction);
            skillTitle.text = data.skillTitle; skillDescription.text = data.skillDescription;
            artwork.sprite = data.artwork; artwork.enabled = data.artwork != null;
            artPlaceholder.text = data.artworkPlaceholder;
            artPlaceholder.gameObject.SetActive(data.artwork == null);
            extraTitle.text = data.extraTitle;
            var extras = (data.extraFields ?? new CardPageExtraField[0])
                .Where(field => field != null && (!string.IsNullOrWhiteSpace(field.label) || !string.IsNullOrWhiteSpace(field.value))).ToArray();
            extraBody.text = string.Join("\n", extras.Select(field => field.label + "：" + field.value));
            extraTitle.gameObject.SetActive(extras.Length > 0);
            extraBody.gameObject.SetActive(extras.Length > 0);
            footer.text = data.footer; actionText.text = data.actionLabel;
            actionButton.gameObject.SetActive(data.showAction); feedback.text = "";
            background.color = data.backgroundColor; surface.color = data.surfaceColor;
            artBackground.color = data.artworkBackgroundColor;
            accentLine.color = data.accentColor; actionButton.image.color = data.accentColor;
            foreach (var text in new[] { pageTitle, cardName }) { text.color = data.textColor; text.fontSize = data.titleFontSize; }
            foreach (var text in new[] { faction, skillDescription, extraBody }) { text.color = data.textColor; text.fontSize = data.bodyFontSize; }
            foreach (var text in new[] { rarity, power, skillTitle, extraTitle }) { text.color = data.accentColor; text.fontSize = data.bodyFontSize; }
            foreach (var text in new[] { pageSubtitle, cardId, artPlaceholder, footer, feedback }) { text.color = data.mutedTextColor; text.fontSize = Math.Max(16, data.bodyFontSize - 3); }
            actionText.fontSize = data.bodyFontSize; actionText.color = data.buttonTextColor;
            if (useConfiguredSizes) { widthElement.preferredWidth = data.cardWidth; artworkElement.preferredHeight = data.artworkHeight; }
        }

        // Optional read-only bridge: lets deckbuilding, an encyclopedia or rewards reuse the page.
        // Does not execute effects or mutate the card definition / shared ScriptableObject.
        public void ShowCard(CardDefinition definition, Sprite portrait = null)
        {
            if (definition == null) throw new ArgumentNullException("definition");
            if (content == null) throw new InvalidOperationException("先设置页面内容资产，再绑定游戏卡牌。");
            Bind(content);
            displayedCardId = definition.id;
            cardName.text = definition.name; cardId.text = "ID  " + definition.id;
            faction.text = "势力  " + definition.camp; rarity.text = "品质  " + definition.rarity; power.text = "战力  " + definition.baseAttack;
            CardBadgeResources.Bind(countryBadge, faction, definition.id, definition.camp);
            skillTitle.text = definition.skill;
            skillDescription.text = definition.abilities != null && definition.abilities.Length > 0 ? SkillText.Describe(definition) : definition.effect;
            // A missing portrait must not display another sample card's artwork or custom metadata.
            artwork.sprite = portrait; artwork.enabled = portrait != null; artPlaceholder.gameObject.SetActive(portrait == null);
            extraTitle.gameObject.SetActive(false); extraBody.gameObject.SetActive(false);
            pageScroll.verticalNormalizedPosition = 1;
        }

        public void RequestAction()
        {
            if (content == null || !content.showAction || string.IsNullOrEmpty(displayedCardId)) return;
            // Neutral sample feedback: no silent deck edits, purchases or fake success messages.
            feedback.text = "已触发页面事件：" + displayedCardId + "（业务由事件监听方处理）";
            onActionRequested.Invoke(displayedCardId);
        }

        private void UpdateSafeArea()
        {
            if (safeArea == null || Screen.width <= 0 || Screen.height <= 0) return;
            screenWidth = Screen.width; screenHeight = Screen.height; lastSafeArea = Screen.safeArea;
            safeArea.anchorMin = new Vector2(lastSafeArea.xMin / screenWidth, lastSafeArea.yMin / screenHeight);
            safeArea.anchorMax = new Vector2(lastSafeArea.xMax / screenWidth, lastSafeArea.yMax / screenHeight);
        }
    }
}
