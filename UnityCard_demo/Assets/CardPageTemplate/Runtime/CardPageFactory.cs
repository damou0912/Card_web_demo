using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.CardPage
{
    // Shared by the preview scene and the editor's editable-scene generator.
    // No UnityEditor dependency: can also be called by a runtime UI manager.
    public static class CardPageFactory
    {
        public static CardPageView Create(CardPageData data, Transform parent = null)
        {
            if (data == null) throw new System.ArgumentNullException("data");
            data.Validate();
            var font = Resources.Load<Font>("Fonts/NotoSansSC-Regular");
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var root = Rect("CardPage", parent);
            var canvas = root.gameObject.AddComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = root.gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1000, 1000); scaler.matchWidthOrHeight = .5f;
            root.gameObject.AddComponent<GraphicRaycaster>();
            var view = root.gameObject.AddComponent<CardPageView>();
            view.background = root.gameObject.AddComponent<Image>();
            view.safeArea = Rect("SafeArea", root); Stretch(view.safeArea);
            var viewport = Rect("PageScroll", view.safeArea); Stretch(viewport, 18);
            viewport.gameObject.AddComponent<Image>().color = Color.clear;
            viewport.gameObject.AddComponent<RectMask2D>();
            var scroll = viewport.gameObject.AddComponent<ScrollRect>();
            scroll.viewport = viewport; scroll.horizontal = false; scroll.movementType = ScrollRect.MovementType.Clamped; scroll.scrollSensitivity = 35;
            view.pageScroll = scroll;

            // Full-width scroll content + centered non-expanding child. On narrow screens the card
            // contracts to the available width; long descriptions remain readable by scrolling.
            var content = Rect("ScrollContent", viewport);
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1); content.pivot = new Vector2(.5f, 1);
            content.offsetMin = Vector2.zero; content.offsetMax = Vector2.zero;
            var centering = Vertical(content, 0, 0);
            centering.childAlignment = TextAnchor.UpperCenter; centering.childForceExpandWidth = false;
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scroll.content = content;
            var card = Rect("EditableCard", content);
            view.surface = card.gameObject.AddComponent<Image>();
            view.widthElement = card.gameObject.AddComponent<LayoutElement>();
            view.widthElement.minWidth = 0; view.widthElement.preferredWidth = data.cardWidth;
            Vertical(card, 24, 12);

            view.pageTitle = Text("PageTitle", card, font, 36);
            view.pageSubtitle = Text("PageSubtitle", card, font, 20);
            var line = Rect("AccentLine", card); view.accentLine = line.gameObject.AddComponent<Image>();
            line.gameObject.AddComponent<LayoutElement>().preferredHeight = 3;
            view.cardName = Text("CardName", card, font, 36);
            view.cardId = Text("CardId", card, font, 20);

            var stats = Rect("Stats", card);
            var statsLayout = stats.gameObject.AddComponent<HorizontalLayoutGroup>();
            statsLayout.spacing = 10; statsLayout.childControlWidth = true; statsLayout.childControlHeight = true;
            statsLayout.childForceExpandWidth = true; statsLayout.childForceExpandHeight = false;
            view.faction = Stat("Faction", stats, font); view.rarity = Stat("Rarity", stats, font); view.power = Stat("Power", stats, font);

            var art = Rect("ArtworkArea", card); view.artBackground = art.gameObject.AddComponent<Image>();
            view.artworkElement = art.gameObject.AddComponent<LayoutElement>(); view.artworkElement.preferredHeight = data.artworkHeight;
            var picture = Rect("Artwork", art); Stretch(picture, 10);
            view.artwork = picture.gameObject.AddComponent<Image>(); view.artwork.preserveAspect = true; view.artwork.raycastTarget = false;
            view.artPlaceholder = Text("ArtworkPlaceholder", art, font, 20); Stretch(view.artPlaceholder.rectTransform, 16);
            view.artPlaceholder.alignment = TextAnchor.MiddleCenter;
            view.skillTitle = Text("SkillTitle", card, font, 23);
            view.skillDescription = Text("SkillDescription", card, font, 23);
            view.extraTitle = Text("ExtraTitle", card, font, 23);
            view.extraBody = Text("ExtraFields", card, font, 23);

            // Ready for any future child widgets (tags, animation, rarity stars, collection count).
            // Its height is determined by its children's LayoutElements, so it stays empty by default.
            view.extensionSlot = Rect("ExtensionSlot_AddYourWidgetsHere", card);
            Vertical(view.extensionSlot, 0, 8);

            var action = Rect("ActionButton", card);
            var actionImage = action.gameObject.AddComponent<Image>();
            view.actionButton = action.gameObject.AddComponent<Button>(); view.actionButton.targetGraphic = actionImage;
            var actionSize = action.gameObject.AddComponent<LayoutElement>(); actionSize.minHeight = 64;
            view.actionText = Text("ActionLabel", action, font, 23); Stretch(view.actionText.rectTransform, 10); view.actionText.alignment = TextAnchor.MiddleCenter;
            view.footer = Text("Footer", card, font, 20);
            view.feedback = Text("ActionFeedback", card, font, 20);
            view.Bind(data);
            return view;
        }

        private static RectTransform Rect(string name, Transform parent)
        {
            var obj = new GameObject(name, typeof(RectTransform)); obj.transform.SetParent(parent, false);
            return obj.GetComponent<RectTransform>();
        }

        private static void Stretch(RectTransform rect, float padding = 0)
        {
            rect.anchorMin = Vector2.zero; rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(padding, padding); rect.offsetMax = new Vector2(-padding, -padding);
        }

        private static VerticalLayoutGroup Vertical(RectTransform rect, int padding, float spacing)
        {
            var layout = rect.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.padding = new RectOffset(padding, padding, padding, padding); layout.spacing = spacing;
            layout.childControlHeight = true; layout.childControlWidth = true;
            layout.childForceExpandHeight = false; layout.childForceExpandWidth = true;
            return layout;
        }

        private static Text Text(string name, Transform parent, Font font, int size)
        {
            var rect = Rect(name, parent); var text = rect.gameObject.AddComponent<Text>();
            text.font = font; text.fontSize = size; text.supportRichText = false; text.raycastTarget = false;
            text.alignment = TextAnchor.UpperLeft; text.horizontalOverflow = HorizontalWrapMode.Wrap; text.verticalOverflow = VerticalWrapMode.Overflow;
            return text;
        }

        private static Text Stat(string name, Transform parent, Font font)
        {
            var text = Text(name, parent, font, 23);
            var element = text.gameObject.AddComponent<LayoutElement>();
            element.minWidth = 0; element.preferredWidth = 1; element.flexibleWidth = 1;
            return text;
        }
    }
}
