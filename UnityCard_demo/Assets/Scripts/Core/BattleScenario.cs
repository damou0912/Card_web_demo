using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    [Serializable]
    public sealed class ScenarioPiece
    {
        public int cell;
        public string cardId;
        public int owner = 1;
        public int power = 3;
        public bool shield;
        public bool resting;
    }

    [Serializable]
    public sealed class BattleScenario
    {
        public int schemaVersion = 1;
        public int boardSize = 4;
        public int seed = 123;
        public int activePlayer = 1;
        public int turn = 2;
        public int actions = 2;
        public ScenarioPiece[] pieces = new ScenarioPiece[0];
        public string[] playerHand = new string[0];
        public string[] aiHand = new string[0];
    }

    public sealed partial class GameEngine
    {
        // Explicit sandbox factory for the editor lab. Loading a setup does NOT trigger OnPlace.
        // Use Place/Move/EndTurn afterwards to exercise the same resolution path as the game UI.
        public static GameEngine FromScenario(GameConfig config, CardDefinition[] catalog, BattleScenario scenario)
        {
            if (scenario == null || scenario.schemaVersion != 1) throw new ArgumentException("实验场景版本无效。");
            if (scenario.boardSize != config.boardSize || (scenario.activePlayer != 1 && scenario.activePlayer != 2)
                || scenario.turn < 1 || scenario.turn > config.maxTurns || scenario.actions < 0 || scenario.actions > 10)
                throw new ArgumentException("实验场景的棋盘、玩家、回合或行动数无效。");
            var game = new GameEngine(config, catalog, scenario.seed);
            var byId = catalog.ToDictionary(c => c.id);
            var cells = new HashSet<int>();
            if (scenario.pieces == null) throw new ArgumentException("实验场景缺少棋盘列表。");
            foreach (var piece in scenario.pieces)
            {
                if (piece == null || !game.InBoard(piece.cell) || !cells.Add(piece.cell) || piece.owner < 0 || piece.owner > 2
                    || piece.power < 0 || piece.power > 999 || (piece.owner != 0 && (piece.cardId == null || !byId.ContainsKey(piece.cardId))))
                    throw new ArgumentException("实验场景卡牌、位置或战力无效。");
                if (piece.owner == 0 && (piece.shield || piece.resting || !string.IsNullOrEmpty(piece.cardId)))
                    throw new ArgumentException("中立守军不能设置技能卡 ID、护盾或休整。");
            }
            var hands = new[] { scenario.playerHand, scenario.aiHand };
            foreach (var hand in hands)
                if (hand == null || hand.Length > config.handLimit || hand.Any(id => id == null || !byId.ContainsKey(id)))
                    throw new ArgumentException("实验场景手牌引用或数量无效。");
            Array.Clear(game.State.Board, 0, game.State.Board.Length);
            game.nextUid = 0;
            foreach (var piece in scenario.pieces)
                game.State.Board[piece.cell] = new Piece { Uid = ++game.nextUid,
                    Definition = piece.owner == 0 ? null : byId[piece.cardId], Owner = piece.owner, Power = piece.power,
                    Shield = piece.shield, Resting = piece.resting };
            for (int owner = 1; owner <= 2; owner++)
            {
                game.State.Hands[owner].Clear();
                game.State.Hands[owner].AddRange(hands[owner - 1].Select(id => byId[id]));
                // Refill an independent lab draw pile; no hidden opening draws in the scenario.
                game.State.Decks[owner].Clear();
                for (int i = 0; i < config.deckSize; i++) game.State.Decks[owner].Add(catalog[i % catalog.Length]);
                game.Shuffle(game.State.Decks[owner]);
            }
            game.State.ActivePlayer = scenario.activePlayer; game.State.Turn = scenario.turn; game.State.Actions = scenario.actions;
            game.State.Events.Clear();
            game.StartSkillCommand();
            game.Log("lab-setup", "战斗实验室", "棋盘", "装载快照，不触发入阵", "实验场景已加载；种子 " + scenario.seed + "，摆放过程不触发技能。请通过放置、移动或结束回合测试。");
            game.CheckVictory();
            return game;
        }
    }
}
