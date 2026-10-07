using System;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CardDemo
{
    // Layout and UI construction are separate from battle commands and the pure rules engine.
    public sealed partial class DemoBootstrap
    {
        private RectTransform Panel(Transform parent, string name, Vector2 min, Vector2 max, Color color)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            obj.transform.SetParent(parent, false);
            var rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = min; rect.anchorMax = max; rect.offsetMin = Vector2.zero; rect.offsetMax = Vector2.zero;
            obj.GetComponent<Image>().color = color;
            return rect;
        }

        private Text Label(Transform parent, string name, string value, int size, TextAnchor alignment)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            obj.transform.SetParent(parent, false);
            var rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = Vector2.zero; rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(8, 3); rect.offsetMax = new Vector2(-8, -3);
            var text = obj.GetComponent<Text>();
            text.font = font; text.text = value; text.fontSize = size; text.color = Color.white;
            text.alignment = alignment; text.supportRichText = false; text.raycastTarget = false;
            text.horizontalOverflow = HorizontalWrapMode.Wrap; text.verticalOverflow = VerticalWrapMode.Truncate;
            return text;
        }

        private Button Button(Transform parent, string value, Action action, Color color, int size = 23)
        {
            var rect = Panel(parent, value, Vector2.zero, Vector2.one, color);
            var button = rect.gameObject.AddComponent<Button>();
            button.targetGraphic = rect.GetComponent<Image>();
            var colors = button.colors;
            colors.highlightedColor = new Color(1.15f, 1.15f, 1.15f);
            colors.selectedColor = Color.white;
            button.colors = colors;
            Label(rect, "Label", value, size, TextAnchor.MiddleCenter);
            button.onClick.AddListener(() => action());
            return button;
        }

        private Button PositionedButton(Transform parent, string value, Vector2 min, Vector2 max, Action action, Color color)
        {
            var button = Button(parent, value, action, color);
            var rect = (RectTransform)button.transform;
            rect.anchorMin = min; rect.anchorMax = max;
            return button;
        }

        private void BuildShell()
        {
            if (Camera.main == null)
            {
                var cameraObject = new GameObject("Main Camera", typeof(Camera));
                cameraObject.tag = "MainCamera";
                var camera = cameraObject.GetComponent<Camera>();
                camera.orthographic = true; camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = Background;
                cameraObject.transform.position = new Vector3(0, 0, -10);
            }
            if (FindObjectOfType<EventSystem>() == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            var canvasObject = new GameObject("Card Demo UI", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            canvasObject.transform.SetParent(transform, false);
            canvasObject.GetComponent<Canvas>().renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1600, 1000); scaler.matchWidthOrHeight = 0.5f;
            safeRoot = Panel(canvasObject.transform, "Safe Area", Vector2.zero, Vector2.one, Background);
            var header = Panel(safeRoot, "Header", new Vector2(.01f, .905f), new Vector2(.99f, .99f), PanelColor);
            title = Label(header, "Title", "Unity Card Demo", 25, TextAnchor.MiddleLeft);
            title.rectTransform.anchorMax = new Vector2(.79f, 1);
            PositionedButton(header, "对战菜单", new Vector2(.81f, .12f), new Vector2(.98f, .88f), OpenMenu, Friendly);
            var playerPanel = Panel(safeRoot, "Fixed Player Information", new Vector2(.01f, .40f), new Vector2(.20f, .89f), PanelColor);
            players = Label(playerPanel, "Players", "", 27, TextAnchor.UpperLeft);
            var help = Panel(safeRoot, "Help", new Vector2(.01f, .23f), new Vector2(.20f, .385f), PanelColor);
            var helpText = Label(help, "Help Text", "选手牌 → 点空格\n选己方卡 → 移动/攻击", 21, TextAnchor.MiddleLeft);
            helpText.rectTransform.anchorMin = new Vector2(0, .36f);
            PositionedButton(help, "取消选择", new Vector2(.05f,.04f), new Vector2(.95f,.36f), CancelSelection, PanelColor);
            boardRoot = Panel(safeRoot, "Board", new Vector2(.215f, .28f), new Vector2(.685f, .89f), Background);
            grid = boardRoot.gameObject.AddComponent<GridLayoutGroup>();
            grid.spacing = new Vector2(8, 8); grid.childAlignment = TextAnchor.MiddleCenter;
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
            boardRoot.gameObject.AddComponent<SquareBoardLayout>();
            var detailPanel = Panel(safeRoot, "Details", new Vector2(.70f, .48f), new Vector2(.99f, .89f), PanelColor);
            details = Label(detailPanel, "Card Details", "", 24, TextAnchor.UpperLeft);
            detailPanel.gameObject.AddComponent<RectMask2D>();
            detailScroll = detailPanel.gameObject.AddComponent<ScrollRect>();
            details.raycastTarget = true;
            details.verticalOverflow = VerticalWrapMode.Overflow;
            var detailContent = details.rectTransform;
            detailContent.anchorMin = new Vector2(0, 1); detailContent.anchorMax = new Vector2(1, 1); detailContent.pivot = new Vector2(.5f, 1);
            detailContent.offsetMin = new Vector2(12, 0); detailContent.offsetMax = new Vector2(-12, 0);
            detailContent.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            detailScroll.content = detailContent; detailScroll.viewport = detailPanel; detailScroll.horizontal = false;
            detailScroll.movementType = ScrollRect.MovementType.Clamped; detailScroll.scrollSensitivity = 30;
            var latestPanel = Panel(safeRoot, "Latest Events", new Vector2(.70f, .28f), new Vector2(.99f, .465f), PanelColor);
            latest = Label(latestPanel, "Recent Flow", "", 20, TextAnchor.UpperLeft);
            var statusPanel = Panel(safeRoot, "Turn Above Hand", new Vector2(.215f, .225f), new Vector2(.99f, .272f), PanelColor);
            status = Label(statusPanel, "Turn Timer", "", 25, TextAnchor.MiddleLeft);
            handRoot = Panel(safeRoot, "Human Hand", new Vector2(.215f, .02f), new Vector2(.99f, .212f), Background);
            var layout = handRoot.gameObject.AddComponent<HorizontalLayoutGroup>();
            layout.spacing = 8; layout.childControlHeight = true; layout.childControlWidth = true;
            layout.childForceExpandWidth = true; layout.childForceExpandHeight = true;
            endButton = PositionedButton(safeRoot, "结束回合", new Vector2(.01f, .155f), new Vector2(.20f, .21f), EndHumanTurn, Friendly);
            surrenderButton = PositionedButton(safeRoot, "认输", new Vector2(.01f, .09f), new Vector2(.10f, .145f), RequestSurrender, Enemy);
            PositionedButton(safeRoot, "返回主页", new Vector2(.11f, .09f), new Vector2(.20f, .145f), RequestHome, PanelColor);
            PositionedButton(safeRoot, "展开卡牌流程", new Vector2(.01f, .02f), new Vector2(.20f, .08f), () => { logPanel.SetActive(true); UpdateLog(); }, PanelColor);
            BuildLog();
            var resultOverlay = Panel(safeRoot, "Match Result", Vector2.zero, Vector2.one, new Color(0,0,0,.68f));
            resultPanel = resultOverlay.gameObject;
            var resultRect = Panel(resultOverlay, "Result Card", new Vector2(.25f, .28f), new Vector2(.75f, .76f), new Color32(24, 38, 58, 255));
            var resultTextPanel = Panel(resultRect, "Summary", new Vector2(.03f, .23f), new Vector2(.97f, .96f), Color.clear);
            result = Label(resultTextPanel, "Winner And Score", "", 30, TextAnchor.MiddleCenter);
            PositionedButton(resultRect, "再来一局", new Vector2(.04f, .05f), new Vector2(.32f, .19f), StartMatch, Friendly);
            PositionedButton(resultRect, "查看战场", new Vector2(.36f, .05f), new Vector2(.64f, .19f), () => resultPanel.SetActive(false), PanelColor);
            PositionedButton(resultRect, "返回主页", new Vector2(.68f, .05f), new Vector2(.96f, .19f), RequestHome, PanelColor);
            resultPanel.SetActive(false);
            BuildBattleMenu();
            ApplySafeArea();
        }

        private void BuildLog()
        {
            var root = Panel(safeRoot, "Full Card Flow", new Vector2(.12f, .08f), new Vector2(.97f, .91f), new Color32(19, 29, 44, 255));
            logPanel = root.gameObject;
            var logHeading = Panel(root, "Heading", new Vector2(.02f, .89f), new Vector2(.70f, .99f), Color.clear);
            Label(logHeading, "Title", "全部卡牌流程 · 来源 / 目标 / 原因", 28, TextAnchor.MiddleLeft);
            PositionedButton(root, "收起", new Vector2(.84f, .91f), new Vector2(.98f, .98f), () => logPanel.SetActive(false), Friendly);
            var viewport = Panel(root, "Viewport", new Vector2(.02f, .02f), new Vector2(.98f, .88f), Color.clear);
            viewport.gameObject.AddComponent<RectMask2D>();
            logScroll = viewport.gameObject.AddComponent<ScrollRect>();
            logText = Label(viewport, "Events", "", 22, TextAnchor.UpperLeft);
            logText.raycastTarget = true; logText.verticalOverflow = VerticalWrapMode.Overflow;
            var content = logText.rectTransform;
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1); content.pivot = new Vector2(.5f, 1);
            content.offsetMin = new Vector2(8, 0); content.offsetMax = new Vector2(-8, 0);
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            logScroll.content = content; logScroll.viewport = viewport; logScroll.horizontal = false;
            logScroll.movementType = ScrollRect.MovementType.Clamped; logScroll.scrollSensitivity = 35;
            logPanel.SetActive(false);
        }

        private void CreateBoard()
        {
            grid.constraintCount = config.boardSize;
            for (int i = 0; i < config.boardSize * config.boardSize; i++)
            {
                int index = i;
                boardButtons[i] = Button(boardRoot, "", () => ClickCell(index), PanelColor, config.boardSize == 5 ? 17 : 23);
            }
            for (int i = 0; i < config.handLimit; i++)
            {
                int index = i;
                handButtons[i] = Button(handRoot, "", () => ClickHand(index), PanelColor, 24);
                var layout = handButtons[i].gameObject.AddComponent<LayoutElement>();
                layout.minWidth = 0; layout.preferredWidth = 1; layout.flexibleWidth = 1;
            }
        }

        private void BuildBattleMenu()
        {
            var overlay = Panel(safeRoot, "Battle Menu", Vector2.zero, Vector2.one, new Color(0,0,0,.68f));
            menuPanel = overlay.gameObject;
            var panel = Panel(overlay, "Menu Card", new Vector2(.29f,.23f), new Vector2(.71f,.80f), PanelColor);
            var heading = Panel(panel, "Heading", new Vector2(.05f,.77f), new Vector2(.95f,.98f), Color.clear);
            Label(heading, "Title", "对战菜单 · 本机对局已暂停", 28, TextAnchor.MiddleCenter);
            PositionedButton(panel, "继续对战", new Vector2(.08f,.57f), new Vector2(.92f,.72f), CloseMenu, Friendly);
            PositionedButton(panel, "认输并结算", new Vector2(.08f,.37f), new Vector2(.92f,.52f), RequestSurrender, Enemy);
            PositionedButton(panel, "返回主页", new Vector2(.08f,.17f), new Vector2(.92f,.32f), RequestHome, Background);
            menuPanel.SetActive(false);
            var confirm = Panel(safeRoot, "Battle Confirmation", Vector2.zero, Vector2.one, new Color(0,0,0,.68f));
            confirmationPanel = confirm.gameObject;
            var box = Panel(confirm, "Confirmation Card", new Vector2(.25f,.32f), new Vector2(.75f,.70f), PanelColor);
            var body = Panel(box, "Message", new Vector2(.04f,.30f), new Vector2(.96f,.95f), Color.clear);
            confirmationText = Label(body, "Confirmation Text", "", 28, TextAnchor.MiddleCenter);
            PositionedButton(box, "取消", new Vector2(.07f,.07f), new Vector2(.46f,.26f), CloseMenu, Background);
            PositionedButton(box, "确认", new Vector2(.54f,.07f), new Vector2(.93f,.26f), () => {
                var action = confirmedAction; CloseMenu(); action?.Invoke();
            }, Enemy);
            confirmationPanel.SetActive(false);
        }
    }
}
