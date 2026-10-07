using System;
using System.Linq;
using CardDemo.Core;
using CardDemo.Pages;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CardDemo
{
    // Battle controller only. AppBootstrap owns loading/login/home and creates this on demand.
    public sealed partial class DemoBootstrap : MonoBehaviour
    {
        private UiTheme theme;
        private UiLayoutProfile layoutProfile;
        private Color Background { get { return theme.battleBackground; } }
        private Color PanelColor { get { return theme.battlePanel; } }
        private Color Friendly { get { return theme.friendly; } }
        private Color Enemy { get { return theme.enemy; } }
        private Color Muted { get { return theme.battleMuted; } }
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
        private bool menuOpen;
        private Action returnHome;
        private DateTime menuOpenedAt;
        private GameObject menuPanel, confirmationPanel;
        private Text confirmationText;
        private Action confirmedAction;
        public GameState State { get { return game == null ? null : game.State; } }
        private int screenWidth, screenHeight;
        private Rect lastSafeArea;

        public void Initialize(GameConfig settings, CardCatalog cards, WorkshopLibrary library, Action onReturnHome)
        {
            if (config != null) throw new InvalidOperationException("对战页已初始化。");
            config = settings; demoCatalog = cards; workshop = library; returnHome = onReturnHome;
            config.Validate();
            theme=UiTheme.Load();layoutProfile=Resources.Load<UiLayoutProfile>(UiLayoutProfile.ResourcePath);
            // Bundled, licensed font avoids relying on fonts installed on the destination PC.
            font = theme.font;
            if (font == null) font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            BuildShell();
            CreateBoard(); StartMatch();
            if (game == null) throw new InvalidOperationException(details.text);
        }


        private void StartMatch()
        {
            if (config == null || demoCatalog == null) return;
            int seed = config.seed == 0 ? Environment.TickCount : config.seed;
            var playerDeck = workshop == null
                ? Enumerable.Range(0, config.deckSize).Select(i => demoCatalog.cards[i % demoCatalog.cards.Length]).ToArray()
                : workshop.ResolveDeck(config.playerDeckId, config.deckSize);
            // Demo/workshop cards do not consume account inventory or touch recruitment saves.
            try { if (playerDeck.Any(c => !c.id.StartsWith("demo_") && !c.id.StartsWith("workshop_"))) GachaDemoPanel.ValidatePlayerDeck(playerDeck); }
            catch (Exception error) { details.text = error.Message; return; }
            game = new GameEngine(config, demoCatalog.cards, seed,
                playerDeck,
                workshop == null ? null : workshop.ResolveDeck(config.aiDeckId, config.deckSize));
            selectedCell = selectedHand = -1; seenEvents = seenTurn = -1; confirmEnd = false;
            resultPanel.SetActive(false); logPanel.SetActive(false);
            title.text = (workshop == null ? "PVE 基础演示" : "制作库测试对局") + "  /  " + config.boardSize + "×" + config.boardSize + "  /  本机规则，非正式战绩";
            details.text = "已就绪\n\n选中手牌，点击高亮空格放置。\n选中己方卡，移动或攻击相邻目标。\n\n" + (workshop == null ? "基础演示：鼓舞、压制、保护、被摧毁技能。" : "制作库：执行工坊配置的触发、条件与技能步骤。")
                + "\n\n正式卡牌资料可返回主页查看。";
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
            if (Input.GetKeyDown(KeyCode.Escape) && game != null) { if (menuOpen) CloseMenu(); else OpenMenu(); }
            if (menuOpen || game == null || game.State.Finished) return;
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

        private void CancelSelection()
        {
            selectedHand = selectedCell = -1; confirmEnd = false; Refresh();
        }
        private void OpenMenu()
        {
            if (game == null) return;
            if (!menuOpen) { menuOpenedAt = DateTime.UtcNow; menuOpen = true; }
            confirmationPanel.SetActive(false); menuPanel.SetActive(true); menuPanel.transform.SetAsLastSibling();
        }
        private void CloseMenu()
        {
            if (menuOpen) deadline = deadline.Add(DateTime.UtcNow - menuOpenedAt);
            nextAiTime = Time.unscaledTime + config.aiDelaySeconds; menuOpen = false;
            menuPanel.SetActive(false); confirmationPanel.SetActive(false); confirmedAction = null;
        }
        private void Confirm(string message, Action action)
        {
            OpenMenu(); menuPanel.SetActive(false); confirmationText.text = message; confirmedAction = action;
            confirmationPanel.SetActive(true); confirmationPanel.transform.SetAsLastSibling();
        }
        private void RequestSurrender()
        {
            if (game == null || game.State.Finished) return;
            Confirm("确认认输？\n本局将立即结算，不写入 Web 账号战绩。", () => { game.Surrender(1); Refresh(); });
        }
        private void RequestHome()
        {
            if (game == null || game.State.Finished) { returnHome?.Invoke(); return; }
            Confirm("返回主页将结束当前本机对局，无法恢复。\n是否继续？", () => returnHome?.Invoke());
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
                + "\n占领 " + game.Score(2) + " 格\n\n我方 ID\n" + config.playerId + "\n手牌 " + state.Hands[1].Count + "\n牌库 " + state.Decks[1].Count
                + "\n占领 " + game.Score(1) + " 格";
            for (int cell = 0; cell < state.Board.Length; cell++)
            {
                var piece = state.Board[cell]; var button = boardButtons[cell];
                bool legal = selectedHand >= 0 ? game.CanPlace(1, selectedHand, cell) : selectedCell >= 0 && game.CanMove(1, selectedCell, cell);
                Color color = piece == null ? PanelColor : piece.Owner == 1 ? Friendly * .75f : piece.Owner == 2 ? Enemy * .75f : theme.neutral;
                color.a = 1;
                if (legal) color = piece == null ? theme.legalMove : theme.legalAttack;
                if (selectedCell == cell) color = Friendly;
                theme.Button(button,color,theme.battleText,selectedCell==cell);
                button.GetComponentInChildren<Text>().text = piece == null ? game.CellName(cell) + (legal ? "\n可放置 / 移动" : "")
                    : piece.Name + "\n战力 " + piece.Power + "\n" + (piece.Owner == 0 ? "中立" : piece.Owner == 1 ? "我方" : "对方")
                        + (piece.Shield ? " · 盾" : "") + (piece.Resting ? " · 休整" : piece.Moved ? " · 已移动" : "");
            }
            for (int i = 0; i < config.handLimit; i++)
            {
                var button = handButtons[i]; bool hasCard = i < state.Hands[1].Count;
                button.interactable = hasCard;
                theme.Button(button,selectedHand==i?Friendly:PanelColor,hasCard?theme.battleText:Muted,selectedHand==i);
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
