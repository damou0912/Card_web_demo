using System;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.CardPage
{
    // A single, directly editable card. No Canvas, layout group or runtime UI reconstruction.
    // Binding changes content only: positions, sizes, fonts, colors and custom children stay intact.
    public sealed class CardPrefabView : MonoBehaviour
    {
        public Text cardName, cardId, faction, rarity, power;
        public Image artwork;
        [Tooltip("按卡牌实际势力及效果表现表加载对应国度角标；只替换图片，不改手动排版。")]
        public Image countryBadge;
        public Text artworkPlaceholder, skillTitle, skillDescription;
        public RectTransform extensionSlot;
        [SerializeField] private string displayedCardId = "preview_001";
        public string DisplayedCardId { get { return displayedCardId; } }

        public void ValidateBindings()
        {
            if (cardName == null || cardId == null || faction == null || rarity == null || power == null
                || artwork == null || artworkPlaceholder == null || skillTitle == null || skillDescription == null || extensionSlot == null)
                throw new InvalidOperationException("卡牌预制体有引用未绑定，请检查 CardPrefabView。");
            foreach (var part in new Component[] { cardName, cardId, faction, rarity, power, artwork, artworkPlaceholder, skillTitle, skillDescription, extensionSlot })
                if (!part.transform.IsChildOf(transform)) throw new InvalidOperationException("卡牌展示组件必须位于当前预制体内部。");
            if (countryBadge != null && !countryBadge.transform.IsChildOf(transform))
                throw new InvalidOperationException("国度角标必须位于当前预制体内部。");
        }

        // Explicit opt-in authoring helper. It never runs automatically when opening or playing.
        public void ShowContent(CardPageData data)
        {
            if (data == null) throw new ArgumentNullException("data");
            data.Validate(); ValidateBindings();
            SetContent(data.cardId, data.cardName, data.faction, data.rarity, data.power,
                data.skillTitle, data.skillDescription, data.artwork, data.artworkPlaceholder);
        }

        public void ShowCard(CardDefinition definition, Sprite portrait = null)
        {
            if (definition == null) throw new ArgumentNullException("definition");
            if (string.IsNullOrWhiteSpace(definition.id) || string.IsNullOrWhiteSpace(definition.name) || definition.baseAttack < 0)
                throw new ArgumentException("卡牌 ID、名称和战力无效。");
            ValidateBindings();
            string description = definition.abilities != null && definition.abilities.Length > 0
                ? SkillText.Describe(definition) : definition.effect;
            SetContent(definition.id, definition.name, definition.camp, definition.rarity, definition.baseAttack,
                definition.skill, description, portrait, "卡牌立绘\n将 Sprite 拖入 Artwork");
        }

        private void SetContent(string id, string name, string camp, string quality, int attack,
            string skill, string description, Sprite portrait, string placeholder)
        {
            displayedCardId = id;
            cardName.text = name; cardId.text = "ID  " + id;
            faction.text = camp; rarity.text = quality; power.text = attack.ToString();
            CardBadgeResources.Bind(countryBadge, faction, id, camp);
            skillTitle.text = skill; skillDescription.text = description;
            artwork.sprite = portrait; artwork.enabled = portrait != null;
            artworkPlaceholder.text = placeholder; artworkPlaceholder.gameObject.SetActive(portrait == null);
        }
    }
}
