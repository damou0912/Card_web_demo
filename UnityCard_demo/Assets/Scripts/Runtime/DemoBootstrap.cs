using System;
using System.Linq;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace CardDemo
{
    public sealed class DemoBootstrap : MonoBehaviour
    {
        private static readonly Color Background = new Color32(15, 22, 35, 255);
        private static readonly Color PanelColor = new Color32(27, 39, 57, 255);
        private static readonly Color Friendly = new Color32(40, 146, 156, 255);
        private static readonly Color Enemy = new Color32(192, 87, 77, 255);
        private static readonly Color Muted = new Color32(157, 176, 199, 255);
        private GameEngine game;
        private GameConfig config;
        private CardCatalog demoCatalog;
        private WorkshopLibrary workshop;
        private Font font;
        private RectTransform safeRoot;
        private RectTransform boardRoot;
        private RectTransform handRoot;
        private Text title, players, status, details, result, logText, latest;
        private Button endButton, surrenderButton;
        private GameObject logPanel, resultPanel;
        private GridLayoutGroup grid;
        private ScrollRect logScroll;
        private ScrollRect detailScroll;
        private readonly Button[] boardButtons = new Button[25];
        private readonly Button[] handButtons = new Button[10];
        private int selectedHand = -1, selectedCell = -1;
        private int seenEvents = -1, seenTurn = -1, lastCountdown = -1;
        private DateTime deadline;
        private float nextAiTime;
        private bool confirmEnd;
        private bool gachaOpen;
        private int screenWidth, screenHeight;
        private Rect lastSafeArea;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Boot()
        {
            if (SceneManager.GetActiveScene().name == "Main" && FindObjectOfType<DemoBootstrap>() == null)
                new GameObject("Card Demo Runtime").AddComponent<DemoBootstrap>();
        }

        private void Awake()
        {
            Application.targetFrameRate = 60;
            // Bundled, licensed font avoids relying on fonts installed on the destination PC.
            font = Resources.Load<Font>("Fonts/NotoSansSC-Regular");
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildShell();
            try
            {
                config = ReadJson<GameConfig>("Config/game-config");
                if (config.useWorkshopCards)
                {
                    workshop = ReadJson<WorkshopLibrary>("Data/workshop-library");
                    WorkshopValidation.ThrowIfInvalid(workshop);
                    foreach (var card in workshop.cards) card.effect = SkillText.Describe(card);
                    demoCatalog = new CardCatalog { schemaVersion = 1, cards = workshop.cards };
                }
                else demoCatalog = ReadJson<CardCatalog>("Data/demo-cards");
                config.Validate();
                CreateBoard();
                StartMatch();
            }
            catch (Exception error)
            {
                Debug.LogException(error);
                details.text = "配置加载失败\n" + error.Message + "\n请使用 Card Demo > Configuration 检查配置。";
            }
        }

        private static T ReadJson<T>(string path)
        {
            var asset = Resources.Load<TextAsset>(path);
            if (asset == null) throw new InvalidOperationException("缺少资源：" + path);
            return JsonUtility.FromJson<T>(asset.text);
        }

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
            rect.offsetMin = new Vector2(12, 10); rect.offsetMax = new Vector2(-12, -10);
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
            title = Label(header, "Title", "Unity Card Demo", 29, TextAnchor.MiddleLeft);
            PositionedButton(header, "群英招募", new Vector2(.79f, .12f), new Vector2(.98f, .88f), OpenGachaDemo, Friendly);
            var playerPanel = Panel(safeRoot, "Fixed Player Information", new Vector2(.01f, .40f), new Vector2(.20f, .89f), PanelColor);
            players = Label(playerPanel, "Players", "", 27, TextAnchor.UpperLeft);
            var help = Panel(safeRoot, "Help", new Vector2(.01f, .23f), new Vector2(.20f, .385f), PanelColor);
            Label(help, "Help Text", "操作\n选手牌 → 点空格\n选己方卡 → 移动/攻击\n点击卡牌查看完整技能", 21, TextAnchor.MiddleLeft);
            boardRoot = Panel(safeRoot, "Board", new Vector2(.215f, .28f), new Vector2(.685f, .89f), Background);
            grid = boardRoot.gameObject.AddComponent<GridLayoutGroup>();
            grid.spacing = new Vector2(8, 8); grid.childAlignment = TextAnchor.MiddleCenter;
            grid.constraint = GridLayoutGroup.Constraint.FixedColumnCount;
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
            surrenderButton = PositionedButton(safeRoot, "认输", new Vector2(.01f, .09f), new Vector2(.10f, .145f), () => { if (game != null) { game.Surrender(1); Refresh(); } }, Enemy);
            PositionedButton(safeRoot, "新对局", new Vector2(.11f, .09f), new Vector2(.20f, .145f), () => { if (config != null && demoCatalog != null) StartMatch(); }, PanelColor);
            PositionedButton(safeRoot, "展开卡牌流程", new Vector2(.01f, .02f), new Vector2(.20f, .08f), () => { logPanel.SetActive(true); UpdateLog(); }, PanelColor);
            BuildLog();
            var resultRect = Panel(safeRoot, "Match Result", new Vector2(.25f, .28f), new Vector2(.75f, .76f), new Color32(24, 38, 58, 255));
            resultPanel = resultRect.gameObject;
            var resultTextPanel = Panel(resultRect, "Summary", new Vector2(.03f, .23f), new Vector2(.97f, .96f), Color.clear);
            result = Label(resultTextPanel, "Winner And Score", "", 30, TextAnchor.MiddleCenter);
            PositionedButton(resultRect, "再来一局", new Vector2(.06f, .05f), new Vector2(.46f, .19f), StartMatch, Friendly);
            PositionedButton(resultRect, "查看战场 / 流程", new Vector2(.52f, .05f), new Vector2(.94f, .19f), () => resultPanel.SetActive(false), PanelColor);
            resultPanel.SetActive(false);
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

        private void StartMatch()
        {
            if (config == null || demoCatalog == null) return;
            int seed = config.seed == 0 ? Environment.TickCount : config.seed;
            var playerDeck = workshop == null
                ? Enumerable.Range(0, config.deckSize).Select(i => demoCatalog.cards[i % demoCatalog.cards.Length]).ToArray()
                : workshop.ResolveDeck(config.playerDeckId, config.deckSize);
            try { GachaDemoPanel.ValidatePlayerDeck(playerDeck); }
            catch (Exception error) { details.text = error.Message; return; }
            game = new GameEngine(config, demoCatalog.cards, seed,
                playerDeck,
                workshop == null ? null : workshop.ResolveDeck(config.aiDeckId, config.deckSize));
            selectedCell = selectedHand = -1; seenEvents = seenTurn = -1; confirmEnd = false;
            resultPanel.SetActive(false); logPanel.SetActive(false);
            title.text = config.title + (workshop == null ? "    |    PVE 基础演示" : "    |    制作库测试对局") + " · 非完整网页版移植";
            details.text = "已就绪\n\n选中手牌，然后点击空格放置。\n演示包含鼓舞、压制、保护与被摧毁技能。\n\n正式卡表可在编辑器的 Card Demo > Configuration 中查看。";
            Refresh();
        }

        private void ClickHand(int index)
        {
            if (game == null || index >= game.State.Hands[1].Count) return;
            ShowCard(game.State.Hands[1][index]);
            if (game.State.Finished || game.State.ActivePlayer != 1) return;
            selectedHand = index; selectedCell = -1; confirmEnd = false; Refresh();
        }

        private void ClickCell(int cell)
        {
            if (game == null) return;
            bool acted = selectedHand >= 0 ? game.Place(1, selectedHand, cell) : selectedCell >= 0 && game.Move(1, selectedCell, cell);
            if (acted) { selectedHand = selectedCell = -1; confirmEnd = false; Refresh(); return; }
            var piece = game.State.Board[cell];
            if (piece != null)
            {
                if (piece.Definition != null) ShowCard(piece.Definition, piece);
                else details.text = "中立守军\n战力 " + piece.Power + "\n不属于任何玩家，无技能，不占领格子。";
                if (!game.State.Finished && piece.Owner == 1 && game.State.ActivePlayer == 1)
                { selectedCell = cell; selectedHand = -1; confirmEnd = false; Refresh(); }
            }
        }

        private void ShowCard(CardDefinition card, Piece piece = null)
        {
            details.text = card.name + "\nID：" + card.id + "\n品质：" + card.rarity + "   基础战力：" + card.baseAttack
                + (piece == null ? "" : "\n当前战力：" + piece.Power + "   " + (piece.Shield ? "护盾" : "无护盾"))
                + "\n\n「" + card.skill + "」\n" + card.effect;
            // Multi-step authored descriptions are scrollable rather than truncated or shrunk.
            Canvas.ForceUpdateCanvases(); detailScroll.verticalNormalizedPosition = 1;
        }

        private void EndHumanTurn()
        {
            if (game == null || game.State.Finished || game.State.ActivePlayer != 1) return;
            if (!confirmEnd && game.LegalActions(1).Count > 0) { confirmEnd = true; Refresh(); return; }
            game.EndTurn(1); selectedCell = selectedHand = -1; confirmEnd = false; Refresh();
        }

        private void Update()
        {
            if (screenWidth != Screen.width || screenHeight != Screen.height || lastSafeArea != Screen.safeArea) ApplySafeArea();
            if (config != null && grid != null)
            {
                float cell = Mathf.Max(1, (Mathf.Min(boardRoot.rect.width, boardRoot.rect.height) - (config.boardSize - 1) * 8) / config.boardSize);
                grid.cellSize = new Vector2(cell, cell);
            }
            if (gachaOpen || game == null || game.State.Finished) return;
            if (DateTime.UtcNow >= deadline)
            {
                game.EndTurn(game.State.ActivePlayer, "回合时间耗尽");
                selectedCell = selectedHand = -1; confirmEnd = false; Refresh(); return;
            }
            int remaining = Math.Max(0, (int)Math.Ceiling((deadline - DateTime.UtcNow).TotalSeconds));
            if (remaining != lastCountdown) { lastCountdown = remaining; UpdateStatus(remaining); }
            if (game.State.ActivePlayer == 2 && Time.unscaledTime >= nextAiTime)
            {
                game.StepAi(); nextAiTime = Time.unscaledTime + config.aiDelaySeconds; Refresh();
            }
        }

        private void OpenGachaDemo()
        {
            if (gachaOpen || FindObjectOfType<GachaDemoPanel>() != null) return;
            gachaOpen = true;
            DateTime opened = DateTime.UtcNow;
            GachaDemoPanel.Open(() => {
                if (this == null) return;
                // This is an offline preview: preserve the current battle timer while its UI is covered.
                deadline = deadline.Add(DateTime.UtcNow - opened);
                nextAiTime = Time.unscaledTime + (config == null ? .65f : config.aiDelaySeconds);
                gachaOpen = false;
            });
        }

        private void ApplySafeArea()
        {
            if (safeRoot == null || Screen.width == 0 || Screen.height == 0) return;
            screenWidth = Screen.width; screenHeight = Screen.height; lastSafeArea = Screen.safeArea;
            safeRoot.anchorMin = new Vector2(lastSafeArea.xMin / screenWidth, lastSafeArea.yMin / screenHeight);
            safeRoot.anchorMax = new Vector2(lastSafeArea.xMax / screenWidth, lastSafeArea.yMax / screenHeight);
        }

        private void UpdateStatus(int remaining)
        {
            bool human = game.State.ActivePlayer == 1;
            status.color = human ? Friendly : Enemy;
            status.text = (human ? "我方回合" : "对方回合") + "  |  行动 " + game.State.Actions + "  |  剩余 "
                + (remaining / 60).ToString("00") + ":" + (remaining % 60).ToString("00") + "  |  回合 " + game.State.Turn + " / " + config.maxTurns;
        }

        private void Refresh()
        {
            if (game == null) return;
            var state = game.State;
            if (seenTurn != state.Turn)
            {
                seenTurn = state.Turn; deadline = DateTime.UtcNow.AddSeconds(config.turnSeconds);
                nextAiTime = Time.unscaledTime + config.aiDelaySeconds; lastCountdown = -1;
            }
            // Both labels and the hand always stay in the human's perspective.
            players.text = "对方 ID\n" + config.aiId + "\n手牌 " + state.Hands[2].Count + "\n牌库 " + state.Decks[2].Count
                + "\n\n我方 ID\n" + config.playerId + "\n手牌 " + state.Hands[1].Count + "\n牌库 " + state.Decks[1].Count;
            for (int cell = 0; cell < state.Board.Length; cell++)
            {
                var piece = state.Board[cell]; var button = boardButtons[cell];
                bool legal = selectedHand >= 0 ? game.CanPlace(1, selectedHand, cell) : selectedCell >= 0 && game.CanMove(1, selectedCell, cell);
                Color color = piece == null ? PanelColor : piece.Owner == 1 ? Friendly * .75f : piece.Owner == 2 ? Enemy * .75f : (Color)new Color32(80, 88, 103, 255);
                color.a = 1;
                if (legal) color = piece == null ? new Color32(137, 110, 43, 255) : new Color32(167, 65, 64, 255);
                if (selectedCell == cell) color = Friendly;
                button.GetComponent<Image>().color = color;
                button.GetComponentInChildren<Text>().text = piece == null ? game.CellName(cell) + (legal ? "\n可放置 / 移动" : "")
                    : piece.Name + "\n战力 " + piece.Power + "\n" + (piece.Owner == 0 ? "中立" : piece.Owner == 1 ? "我方" : "对方")
                        + (piece.Shield ? " · 盾" : "") + (piece.Resting ? " · 休整" : piece.Moved ? " · 已移动" : "");
            }
            for (int i = 0; i < config.handLimit; i++)
            {
                var button = handButtons[i]; bool hasCard = i < state.Hands[1].Count;
                button.interactable = hasCard;
                button.GetComponent<Image>().color = selectedHand == i ? Friendly : PanelColor;
                button.GetComponentInChildren<Text>().color = hasCard ? Color.white : Muted;
                button.GetComponentInChildren<Text>().text = hasCard ? state.Hands[1][i].name + "\n战力 " + state.Hands[1][i].baseAttack
                    + "\n" + state.Hands[1][i].skill + "\n点击查看技能" : "空手牌位";
            }
            endButton.interactable = !state.Finished && state.ActivePlayer == 1;
            endButton.GetComponentInChildren<Text>().text = confirmEnd ? "仍可行动，再点确认" : "结束回合";
            surrenderButton.interactable = !state.Finished;
            UpdateStatus(Math.Max(0, (int)Math.Ceiling((deadline - DateTime.UtcNow).TotalSeconds)));
            if (seenEvents != state.Events.Count)
            {
                seenEvents = state.Events.Count;
                latest.text = string.Join("\n", state.Events.Skip(Math.Max(0, state.Events.Count - 2)).Select(e => e.Message));
                if (logPanel.activeSelf) UpdateLog();
            }
            if (state.Finished)
            {
                result.text = (state.Winner == 0 ? "平局 · 无获胜者" : "获胜者 ID：" + game.PlayerName(state.Winner))
                    + "\n\n" + config.playerId + "  " + game.Score(1) + " : " + game.Score(2) + "  " + config.aiId
                    + "\n回合数：" + state.Turn + "\n" + state.FinishReason;
                resultPanel.SetActive(true); status.text = "对局结束 · 可查看完整卡牌流程";
            }
        }

        private void UpdateLog()
        {
            if (game == null) return;
            logText.text = string.Join("\n\n", game.State.Events.Select(e => e.ToString()));
            Canvas.ForceUpdateCanvases(); logScroll.verticalNormalizedPosition = 0;
        }
    }
}
