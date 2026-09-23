using System;
using System.Linq;
using CardDemo.Core;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.CardPage.Tests
{
    public sealed class CardPrefabTests
    {
        private GameObject instance;
        private CardPrefabView view;
        private CardPageData data;
        private Texture2D texture;
        private Sprite sprite;

        [SetUp]
        public void SetUp()
        {
            var asset = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/CardPageTemplate/Prefabs/EditableCard.prefab");
            Assert.That(asset, Is.Not.Null);
            instance = UnityEngine.Object.Instantiate(asset);
            view = instance.GetComponent<CardPrefabView>();
            data = ScriptableObject.CreateInstance<CardPageData>();
        }

        [TearDown]
        public void TearDown()
        {
            if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
            if (data != null) UnityEngine.Object.DestroyImmediate(data);
            if (sprite != null) UnityEngine.Object.DestroyImmediate(sprite);
            if (texture != null) UnityEngine.Object.DestroyImmediate(texture);
        }

        [Test]
        public void ShippedCardHasRealEditableChildrenAndNoAutomaticLayout()
        {
            Assert.That(view, Is.Not.Null); Assert.DoesNotThrow(view.ValidateBindings);
            Assert.That(instance.GetComponentsInChildren<LayoutGroup>(true), Is.Empty);
            Assert.That(instance.GetComponentsInChildren<ContentSizeFitter>(true), Is.Empty);
            Assert.That(instance.GetComponentsInChildren<Canvas>(true), Is.Empty);
            Assert.That(((RectTransform)instance.transform).sizeDelta, Is.EqualTo(new Vector2(420, 600)));
            Assert.That(instance.GetComponentsInChildren<MonoBehaviour>(true).Any(c => c == null), Is.False, "No missing script references.");
            Assert.That(view.cardName.font, Is.Not.Null); Assert.That(view.skillDescription.supportRichText, Is.False);
        }

        [Test]
        public void BindingKeepsManualLayoutFontsColorsAndCustomChildren()
        {
            var custom = new GameObject("UserDecoration", typeof(RectTransform)); custom.transform.SetParent(view.extensionSlot, false);
            view.cardName.rectTransform.anchoredPosition = new Vector2(73, -123);
            view.cardName.rectTransform.sizeDelta = new Vector2(222, 47);
            view.cardName.fontSize = 19; view.cardName.color = Color.magenta;
            data.cardName = "测试卡名"; data.cardWidth = 900; data.artworkHeight = 500; data.titleFontSize = 56;
            view.ShowContent(data);
            Assert.That(view.cardName.text, Is.EqualTo("测试卡名"));
            Assert.That(view.cardName.rectTransform.anchoredPosition, Is.EqualTo(new Vector2(73, -123)));
            Assert.That(view.cardName.rectTransform.sizeDelta, Is.EqualTo(new Vector2(222, 47)));
            Assert.That(view.cardName.fontSize, Is.EqualTo(19)); Assert.That(view.cardName.color, Is.EqualTo(Color.magenta));
            Assert.That(view.extensionSlot.Find("UserDecoration"), Is.Not.Null);
            Assert.That(((RectTransform)instance.transform).sizeDelta, Is.EqualTo(new Vector2(420, 600)));
        }

        [Test]
        public void GameCardBindingOnlyDisplaysDataAndClearsPreviousArtwork()
        {
            texture = new Texture2D(2, 2); sprite = Sprite.Create(texture, new Rect(0, 0, 2, 2), new Vector2(.5f, .5f));
            data.artwork = sprite;
            string before = data.cardName; view.ShowContent(data);
            Assert.That(view.artwork.sprite, Is.EqualTo(sprite)); Assert.That(view.artwork.enabled, Is.True);
            Assert.That(view.artworkPlaceholder.gameObject.activeSelf, Is.False);
            var definition = new CardDefinition { id = "workshop_preview", name = "预览卡", camp = "吴", rarity = "史诗", baseAttack = 5,
                skill = "鼓舞", effect = "说明", abilities = new[] { SkillTemplates.Create(0) } };
            view.ShowCard(definition);
            Assert.That(view.DisplayedCardId, Is.EqualTo(definition.id));
            Assert.That(view.power.text, Is.EqualTo("5"));
            Assert.That(view.skillDescription.text, Is.EqualTo(SkillText.Describe(definition)));
            Assert.That(view.artwork.sprite, Is.Null); Assert.That(view.artwork.enabled, Is.False);
            Assert.That(view.artworkPlaceholder.gameObject.activeSelf, Is.True);
            Assert.That(data.cardName, Is.EqualTo(before)); Assert.That(definition.effect, Is.EqualTo("说明"));
        }

        [Test]
        public void BadgeUsesActualFactionAndClearsStaleImagesWithoutMovingSlot()
        {
            Assert.That(view.countryBadge, Is.Not.Null);
            Assert.That(Resources.Load<TextAsset>(CardPresentationTables.BadgeResource), Is.Not.Null, "Lua importer must supply TextAsset");
            var catalog = JsonUtility.FromJson<CardCatalog>(Resources.Load<TextAsset>("Data/web-card-catalog").text);
            var card = catalog.cards.First(c => c.camp == "三国~蜀");
            view.countryBadge.rectTransform.anchoredPosition = new Vector2(31, -21);
            view.countryBadge.rectTransform.sizeDelta = new Vector2(120, 100);
            view.ShowCard(card);
            Assert.That(view.countryBadge.sprite, Is.EqualTo(Resources.Load<Sprite>("UI/FactionBadges/sanguo_shu")));
            Assert.That(view.countryBadge.enabled, Is.True);
            Assert.That(view.faction.enabled, Is.False);
            Assert.That(card.camp, Is.EqualTo("三国~蜀"));
            Assert.That(view.countryBadge.rectTransform.anchoredPosition, Is.EqualTo(new Vector2(31, -21)));
            Assert.That(view.countryBadge.rectTransform.sizeDelta, Is.EqualTo(new Vector2(120, 100)));
            var mismatched = new CardDefinition { id = card.id, name = card.name, camp = "三国~魏", rarity = card.rarity, baseAttack = 1 };
            view.ShowCard(mismatched);
            Assert.That(view.countryBadge.sprite, Is.Null);
            Assert.That(view.countryBadge.gameObject.activeSelf, Is.False);
            Assert.That(view.faction.enabled, Is.True);
            view.ShowCard(card);
            Assert.That(view.countryBadge.gameObject.activeSelf, Is.True);
            view.ShowContent(data);
            Assert.That(view.countryBadge.sprite, Is.Null);
            Assert.That(view.faction.enabled, Is.True);
        }

        [Test]
        public void InvalidDataOrMissingReferencesAreRejectedBeforeChangingContent()
        {
            string before = view.cardName.text; data.cardName = "";
            Assert.Throws<ArgumentException>(() => view.ShowContent(data));
            Assert.That(view.cardName.text, Is.EqualTo(before));
            data.cardName = "合法卡名"; view.power = null;
            Assert.Throws<InvalidOperationException>(() => view.ShowContent(data));
            Assert.That(view.cardName.text, Is.EqualTo(before));
        }
    }
}
