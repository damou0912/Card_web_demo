using System;
using CardDemo.Core;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace CardDemo.CardPage.Tests
{
    public sealed class CardPageTests
    {
        private CardPageData data;
        private CardPageView view;

        [SetUp]
        public void SetUp() { data = ScriptableObject.CreateInstance<CardPageData>(); }

        [TearDown]
        public void TearDown()
        {
            if (view != null) UnityEngine.Object.DestroyImmediate(view.gameObject);
            if (data != null) UnityEngine.Object.DestroyImmediate(data);
        }

        [Test]
        public void ShippedAssetIsValidAndSceneExists()
        {
            var sample = AssetDatabase.LoadAssetAtPath<CardPageData>("Assets/CardPageTemplate/Samples/ExampleCardPage.asset");
            Assert.That(sample, Is.Not.Null);
            Assert.DoesNotThrow(sample.Validate);
            Assert.That(AssetDatabase.LoadAssetAtPath<SceneAsset>("Assets/CardPageTemplate/Scenes/CardPagePreview.unity"), Is.Not.Null);
        }

        [Test]
        public void FactoryPopulatesContentAndUsesPlaceholderWithoutArt()
        {
            view = CardPageFactory.Create(data);
            Assert.That(view.cardName.text, Is.EqualTo(data.cardName));
            Assert.That(view.skillDescription.text, Is.EqualTo(data.skillDescription));
            Assert.That(view.artwork.enabled, Is.False);
            Assert.That(view.artPlaceholder.gameObject.activeSelf, Is.True);
            Assert.That(view.widthElement.preferredWidth, Is.EqualTo(data.cardWidth));
            Assert.That(view.pageScroll.vertical, Is.True);
        }

        [Test]
        public void RebindingKeepsCustomChildrenAndManualLayout()
        {
            view = CardPageFactory.Create(data);
            var custom = new GameObject("CustomWidget", typeof(RectTransform)); custom.transform.SetParent(view.extensionSlot, false);
            view.useConfiguredSizes = false; view.artworkElement.preferredHeight = 120;
            data.artworkHeight = 500; data.cardName = "新名称";
            view.Bind(data);
            Assert.That(view.extensionSlot.childCount, Is.EqualTo(1));
            Assert.That(view.artworkElement.preferredHeight, Is.EqualTo(120));
            Assert.That(view.cardName.text, Is.EqualTo("新名称"));
        }

        [Test]
        public void LongTextAndCustomFieldsAreNotDiscarded()
        {
            data.skillDescription = new string('字', 6000);
            data.extraFields = new[] { new CardPageExtraField { label = "标签", value = "通用" }, null };
            view = CardPageFactory.Create(data);
            Assert.That(view.skillDescription.text.Length, Is.EqualTo(6000));
            Assert.That(view.skillDescription.supportRichText, Is.False);
            Assert.That(view.extraBody.text, Is.EqualTo("标签：通用"));
            Assert.That(view.extraBody.gameObject.activeSelf, Is.True);
            data.extraFields = new CardPageExtraField[0]; view.Bind(data);
            Assert.That(view.extraBody.gameObject.activeSelf, Is.False);
        }

        [Test]
        public void GameCardBridgeDoesNotMutateSourceOrLeakSampleMetadata()
        {
            view = CardPageFactory.Create(data);
            string originalName = data.cardName;
            var definition = new CardDefinition { id = "workshop_test", name = "测试卡", camp = "测试", rarity = "普通", baseAttack = 4,
                skill = "结构化技能", effect = "旧文字", abilities = new[] { SkillTemplates.Create(0) } };
            view.ShowCard(definition);
            Assert.That(view.DisplayedCardId, Is.EqualTo(definition.id));
            Assert.That(view.skillDescription.text, Is.EqualTo(SkillText.Describe(definition)));
            Assert.That(view.extraBody.gameObject.activeSelf, Is.False);
            Assert.That(data.cardName, Is.EqualTo(originalName));
            Assert.That(definition.effect, Is.EqualTo("旧文字"));
        }

        [Test]
        public void ActionIsAnExplicitIdEventAndCanBeHidden()
        {
            view = CardPageFactory.Create(data);
            string received = null; view.onActionRequested.AddListener(id => received = id);
            view.RequestAction(); Assert.That(received, Is.EqualTo(data.cardId));
            received = null; data.showAction = false; view.Bind(data); view.RequestAction();
            Assert.That(received, Is.Null); Assert.That(view.actionButton.gameObject.activeSelf, Is.False);
        }

        [Test]
        public void InvalidConfigurationIsRejectedBeforeChangingView()
        {
            view = CardPageFactory.Create(data); string originalName = view.cardName.text;
            data.cardName = "";
            Assert.Throws<ArgumentException>(() => view.Bind(data));
            Assert.That(view.cardName.text, Is.EqualTo(originalName));
            data.cardName = "正常名称"; data.cardWidth = float.NaN;
            Assert.Throws<ArgumentException>(data.Validate);
        }
    }
}
