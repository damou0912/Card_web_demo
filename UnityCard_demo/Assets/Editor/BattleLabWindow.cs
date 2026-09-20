using System;
using System.IO;
using System.Linq;
using CardDemo.Core;
using UnityEditor;
using UnityEngine;

namespace CardDemo.Editor
{
    public sealed class BattleLabWindow : EditorWindow
    {
        [SerializeField] private BattleScenario setup = new BattleScenario();
        [SerializeField] private int paintOwner = 1, paintCard, paintPower = 3;
        [SerializeField] private bool paintShield, paintResting;
        [SerializeField] private string filter = "";
        private WorkshopLibrary library;
        private GameEngine game;
        private int selectedHand = -1, selectedCell = -1;
        private Vector2 scroll, logScroll;
        private string message;

        [MenuItem("Card Demo/Tools/Battle Lab")]
        public static void Open() { GetWindow<BattleLabWindow>("战斗实验室").minSize = new Vector2(900, 700); }
        private void OnEnable() { LoadLibrary(); }

        private void LoadLibrary()
        {
            try { library = WorkshopStore.Load(); WorkshopValidation.ThrowIfInvalid(library); }
            catch (Exception error) { library = null; message = error.Message; }
        }

        private void OnGUI()
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                if (GUILayout.Button("卡牌与技能工坊", EditorStyles.toolbarButton)) CardWorkshopWindow.Open();
                if (GUILayout.Button("导入场景", EditorStyles.toolbarButton)) Import();
                if (GUILayout.Button("导出初始场景", EditorStyles.toolbarButton)) ExportSetup();
                using (new EditorGUI.DisabledScope(game == null))
                    if (GUILayout.Button("导出实验日志", EditorStyles.toolbarButton)) ExportLog();
                if (GUILayout.Button("重新读库 / 回到摆场", EditorStyles.toolbarButton)) { game = null; LoadLibrary(); }
            }
            EditorGUILayout.HelpBox("无需 Play。编辑初始棋盘 → 启动实验 → 放牌/移动/结束回合。使用与演示相同的 C# 结算；当前未保存的工坊草稿不会自动加载。", MessageType.Info);
            if (!string.IsNullOrEmpty(message)) EditorGUILayout.HelpBox(message, MessageType.Info);
            if (library == null) return;
            scroll = EditorGUILayout.BeginScrollView(scroll);
            if (game == null) DrawSetup(); else DrawExperiment();
            EditorGUILayout.EndScrollView();
        }

        private void DrawSetup()
        {
            setup.boardSize = EditorGUILayout.IntPopup("棋盘尺寸", setup.boardSize, new[] { "4 × 4", "5 × 5" }, new[] { 4, 5 });
            setup.seed = EditorGUILayout.IntField("随机种子", setup.seed);
            setup.activePlayer = EditorGUILayout.IntPopup("当前玩家", setup.activePlayer, new[] { "玩家 1", "玩家 2" }, new[] { 1, 2 });
            setup.turn = EditorGUILayout.IntSlider("全局回合", setup.turn, 1, 30);
            setup.actions = EditorGUILayout.IntSlider("剩余行动", setup.actions, 0, 10);
            EditorGUILayout.LabelField("棋盘画笔（点击格子摆入／替换）", EditorStyles.boldLabel);
            paintOwner = EditorGUILayout.IntPopup("归属", paintOwner, new[] { "清空", "中立守军", "玩家 1", "玩家 2" }, new[] { -1, 0, 1, 2 });
            paintCard = EditorGUILayout.Popup("卡牌", Mathf.Clamp(paintCard, 0, library.cards.Length - 1), library.cards.Select(c => c.name).ToArray());
            paintPower = EditorGUILayout.IntSlider("当前战力", paintPower, 0, 99);
            if (paintOwner > 0)
            {
                paintShield = EditorGUILayout.Toggle("已有护盾", paintShield);
                paintResting = EditorGUILayout.Toggle("休整中", paintResting);
            }
            for (int row = 0; row < setup.boardSize; row++)
                using (new EditorGUILayout.HorizontalScope())
                    for (int col = 0; col < setup.boardSize; col++)
                    {
                        int cell = row * setup.boardSize + col;
                        var piece = setup.pieces.FirstOrDefault(p => p.cell == cell);
                        string text = (row + 1) + "," + (col + 1) + "\n" + (piece == null ? "空格" : piece.owner == 0 ? "守军 / " + piece.power
                            : CardName(piece.cardId) + "\nP" + piece.owner + " / " + piece.power + (piece.shield ? " / 盾" : ""));
                        if (GUILayout.Button(text, GUILayout.Height(65)))
                        {
                            setup.pieces = setup.pieces.Where(p => p.cell != cell).ToArray();
                            if (paintOwner >= 0) setup.pieces = setup.pieces.Concat(new[] { new ScenarioPiece { cell = cell, owner = paintOwner,
                                cardId = paintOwner == 0 ? null : library.cards[paintCard].id, power = paintPower,
                                shield = paintOwner > 0 && paintShield, resting = paintOwner > 0 && paintResting } }).ToArray();
                        }
                    }
            if (setup.pieces.Any(p => p.cell >= setup.boardSize * setup.boardSize))
                EditorGUILayout.HelpBox("缩小棋盘后存在越界卡牌；请清空棋盘重新摆放，启动校验会拒绝越界。", MessageType.Warning);
            if (GUILayout.Button("清空棋盘") && EditorUtility.DisplayDialog("清空初始棋盘", "清空当前草稿的所有场上卡牌？", "清空", "取消")) setup.pieces = new ScenarioPiece[0];
            DrawHandSetup("玩家 1 手牌", ref setup.playerHand);
            DrawHandSetup("玩家 2 手牌", ref setup.aiHand);
            EditorGUILayout.HelpBox("摆场不触发入阵；请把待测卡放进手牌，再启动实验并放置。棋盘中的休整／护盾为明确设置的初始状态。", MessageType.None);
            if (GUILayout.Button("启动实验（使用当前已保存制作库）", GUILayout.Height(32))) StartExperiment();
        }

        private void DrawHandSetup(string label, ref string[] hand)
        {
            EditorGUILayout.LabelField(label, EditorStyles.boldLabel);
            for (int i = 0; i < hand.Length; i++)
                using (new EditorGUILayout.HorizontalScope())
                {
                    EditorGUILayout.LabelField(CardName(hand[i]));
                    if (GUILayout.Button("移除", GUILayout.Width(65))) { int index = i; hand = hand.Where((id, n) => n != index).ToArray(); break; }
                }
            using (new EditorGUI.DisabledScope(hand.Length >= 5))
                if (GUILayout.Button("加入画笔所选卡牌（最多 5 张）")) hand = hand.Concat(new[] { library.cards[paintCard].id }).ToArray();
        }

        private string CardName(string id)
        {
            var card = library.cards.FirstOrDefault(c => c.id == id);
            return card == null ? "缺失卡牌：" + id : card.name;
        }

        private void StartExperiment()
        {
            LoadLibrary(); if (library == null) return;
            try
            {
                game = GameEngine.FromScenario(new GameConfig { boardSize = setup.boardSize }, WorkshopStore.Clone(library).cards, setup);
                selectedHand = selectedCell = -1; message = null;
            }
            catch (Exception error) { game = null; message = error.Message; }
        }

        private void DrawExperiment()
        {
            var state = game.State;
            EditorGUILayout.LabelField("P" + state.ActivePlayer + " · 回合 " + state.Turn + " · 剩余行动 " + state.Actions
                + " · 比分 " + game.Score(1) + " : " + game.Score(2), EditorStyles.boldLabel);
            if (state.Finished) EditorGUILayout.HelpBox("实验结算：" + (state.Winner == 0 ? "平局" : game.PlayerName(state.Winner) + " 获胜") + "；" + state.FinishReason, MessageType.Info);
            for (int row = 0; row < game.Config.boardSize; row++)
                using (new EditorGUILayout.HorizontalScope())
                    for (int col = 0; col < game.Config.boardSize; col++)
                    {
                        int cell = row * game.Config.boardSize + col;
                        var piece = state.Board[cell];
                        bool legal = selectedHand >= 0 ? game.CanPlace(state.ActivePlayer, selectedHand, cell)
                            : selectedCell >= 0 && game.CanMove(state.ActivePlayer, selectedCell, cell);
                        string text = (legal ? "[可操作] " : selectedCell == cell ? "[已选] " : "") + game.CellName(cell)
                            + (piece == null ? "\n空格" : "\n" + piece.Name + "\nP" + piece.Owner + " / 战力 " + piece.Power
                                + (piece.Shield ? " / 盾" : "") + (piece.Resting ? " / 休整" : ""));
                        if (GUILayout.Button(text, GUILayout.Height(76)))
                        {
                            bool acted = selectedHand >= 0 ? game.Place(state.ActivePlayer, selectedHand, cell)
                                : selectedCell >= 0 && game.Move(state.ActivePlayer, selectedCell, cell);
                            if (acted) selectedCell = selectedHand = -1;
                            else if (piece != null)
                            {
                                message = piece.Definition == null ? "中立守军，无技能。" : SkillText.Describe(piece.Definition);
                                if (piece.Owner == state.ActivePlayer) { selectedCell = cell; selectedHand = -1; }
                            }
                        }
                    }
            EditorGUILayout.LabelField("当前行动方手牌（仅开发实验室可查看双方）");
            using (new EditorGUILayout.HorizontalScope())
                for (int i = 0; i < state.Hands[state.ActivePlayer].Count; i++)
                    if (GUILayout.Toggle(selectedHand == i, state.Hands[state.ActivePlayer][i].name, "Button")) { selectedHand = i; selectedCell = -1; }
            using (new EditorGUILayout.HorizontalScope())
            {
                using (new EditorGUI.DisabledScope(state.Finished))
                    if (GUILayout.Button("结束当前回合（测试收势／起势）")) { game.EndTurn(state.ActivePlayer); selectedCell = selectedHand = -1; }
                if (GUILayout.Button("按初始场景重建")) { StartExperiment(); return; }
            }
            EditorGUILayout.Space();
            filter = EditorGUILayout.TextField("日志搜索（卡名／原因／类型）", filter);
            logScroll = EditorGUILayout.BeginScrollView(logScroll, GUILayout.MinHeight(180));
            foreach (var entry in state.Events)
                if (string.IsNullOrEmpty(filter) || (entry.Kind + entry.Source + entry.Target + entry.Reason + entry.Message).IndexOf(filter, StringComparison.OrdinalIgnoreCase) >= 0)
                    EditorGUILayout.LabelField(entry.ToString(), EditorStyles.wordWrappedLabel);
            EditorGUILayout.EndScrollView();
        }

        private void Import()
        {
            string path = EditorUtility.OpenFilePanel("导入实验场景", "", "json");
            if (string.IsNullOrEmpty(path) || library == null) return;
            try
            {
                var imported = JsonUtility.FromJson<BattleScenario>(File.ReadAllText(path));
                if (imported == null) throw new ArgumentException("场景文件为空。");
                GameEngine.FromScenario(new GameConfig { boardSize = imported.boardSize }, library.cards, imported);
                if (!EditorUtility.DisplayDialog("替换实验场景", "导入将替换未保存的初始场景并结束当前实验。", "导入", "取消")) return;
                setup = imported; game = null; message = "已导入初始场景。";
            }
            catch (Exception error) { message = error.Message; }
        }

        private void ExportSetup()
        {
            string path = EditorUtility.SaveFilePanel("导出初始实验场景", "", "battle-scenario.json", "json");
            if (string.IsNullOrEmpty(path)) return;
            try { WorkshopStore.SaveText(path, JsonUtility.ToJson(setup, true) + "\n", null); message = "已导出初始场景；重放前请保留相同版本的制作库。"; }
            catch (Exception error) { message = error.Message; }
        }

        private void ExportLog()
        {
            string path = EditorUtility.SaveFilePanel("导出完整实验日志", "", "battle-log.txt", "txt");
            if (string.IsNullOrEmpty(path)) return;
            try
            {
                string header = "Battle Lab · seed " + setup.seed + "\n仅日志，不是自动回放文件。\n";
                WorkshopStore.SaveText(path, header + string.Join("\n", game.State.Events.Select(e => e.ToString())) + "\n", null);
                message = "已导出全部日志，不受搜索过滤影响。";
            }
            catch (Exception error) { message = error.Message; }
        }
    }
}
