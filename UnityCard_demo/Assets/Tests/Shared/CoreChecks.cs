using System;
using System.Linq;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class CoreChecks
    {
        private static CardDefinition Card(DemoEffect effect = DemoEffect.None, int power = 3)
        {
            return new CardDefinition { id = "test_" + effect, name = "Test " + effect, baseAttack = power,
                skill = effect.ToString(), effect = "Test", demoEffect = effect.ToString() };
        }

        private static GameEngine Game()
        {
            return new GameEngine(new GameConfig(), new[] { Card(), Card(DemoEffect.Shield, 2),
                Card(DemoEffect.LastWill, 1), Card(DemoEffect.BoostAdjacent, 2), Card(DemoEffect.WeakenEnemy, 2) }, 123);
        }

        private static void Assert(bool value, string message)
        {
            if (!value) throw new InvalidOperationException("FAILED: " + message);
        }

        private static Piece Piece(int owner, int power, DemoEffect effect = DemoEffect.None)
        {
            return new Piece { Uid = owner * 100 + power, Owner = owner, Power = power,
                Definition = Card(effect, power), Shield = effect == DemoEffect.Shield };
        }

        private static void Empty(GameEngine game)
        {
            Array.Clear(game.State.Board, 0, game.State.Board.Length);
            game.State.ActivePlayer = 1; game.State.Actions = 2;
        }

        public static void RunAll(Action<string> log)
        {
            var cases = new Action[] { Opening, InvalidCommands, RestAndMove, Combat, Protection, SimultaneousCombat,
                BuffsAndDebuffs, DeathEffects, SurrenderAnyTurn, TurnLimit, VictoryStopsEffects, Determinism,
                ExhaustedDeck, ValidateConfig, FuzzMatches };
            foreach (var test in cases) { test(); log("PASS " + test.Method.Name); }
            log("All " + cases.Length + " checks passed (including 100 full seeded matches).");
            WorkshopChecks.RunAll(log);
        }

        private static void Opening()
        {
            var game = Game(); var s = game.State;
            Assert(s.Board.Count(p => p != null && p.Owner == 0) == 2, "two neutral guards");
            Assert(s.Board.Where(p => p != null).All(p => p.Power == 2 || p.Power == 3), "guard powers");
            Assert(s.Hands[1].Count == 3 && s.Hands[2].Count == 3, "opening draw");
            Assert(s.Actions == 1 && s.Turn == 1, "first turn action limit");
            Assert(game.Score(1) == 0 && game.Score(2) == 0 && game.VictoryThreshold == 9, "neutral score");
            Assert(s.Events.Where(e => e.Kind == "draw").All(e => !e.Message.Contains("Test")), "hidden cards not leaked");
        }

        private static void InvalidCommands()
        {
            var g = Game(); int events = g.State.Events.Count;
            Assert(!g.Place(0, 0, 0) && !g.Place(3 - g.State.ActivePlayer, 0, 0), "wrong owner rejected");
            Assert(!g.Place(g.State.ActivePlayer, -1, 0) && !g.Place(g.State.ActivePlayer, 0, 100), "bounds rejected");
            Assert(!g.Move(1, -1, 999) && !g.Surrender(0), "invalid commands rejected");
            Assert(g.State.Events.Count == events, "invalid commands do not mutate");
        }

        private static void RestAndMove()
        {
            var g = Game(); Empty(g);
            Assert(g.Place(1, 0, 0), "place succeeds");
            Assert(!g.Move(1, 0, 1), "new piece rests");
            g.EndTurn(1); g.EndTurn(2);
            Assert(g.Move(1, 0, 1), "piece ready next own turn");
            Assert(!g.Move(1, 1, 2), "one move per turn");
            Assert(!g.Neighbours(3).Contains(4), "no horizontal wraparound");
        }

        private static void Combat()
        {
            var g = Game(); Empty(g);
            g.State.Board[0] = Piece(1, 4); g.State.Board[1] = Piece(2, 2);
            Assert(g.Move(1, 0, 1) && g.State.Board[0] == null && g.State.Board[1].Owner == 1, "winner advances");
            g = Game(); Empty(g); g.State.Board[0] = Piece(1, 1); g.State.Board[1] = Piece(2, 4);
            g.Move(1, 0, 1);
            Assert(g.State.Board[0] == null && g.State.Board[1].Owner == 2, "weaker attacker destroyed");
            Assert(g.State.Events.Any(e => e.Kind == "destroyed" && e.Source.Contains("Test") && e.Reason.Length > 0), "destruction reason logged");
        }

        private static void Protection()
        {
            var g = Game(); Empty(g);
            g.State.Board[0] = Piece(1, 4); g.State.Board[1] = Piece(2, 2, DemoEffect.Shield);
            g.Move(1, 0, 1);
            Assert(g.State.Board[0] != null && g.State.Board[1] != null && !g.State.Board[1].Shield, "shield prevents advance");
            Assert(g.State.Events.Any(e => e.Kind == "protected" && e.Reason.Contains("护盾")), "protection cause logged");
        }

        private static void SimultaneousCombat()
        {
            var g = Game(); Empty(g); g.State.Board[0] = Piece(1, 3); g.State.Board[1] = Piece(2, 3);
            g.Move(1, 0, 1); Assert(g.State.Board[0] == null && g.State.Board[1] == null, "equal strength removes both");
            g = Game(); Empty(g); g.State.Board[0] = Piece(1, 3, DemoEffect.Shield); g.State.Board[1] = Piece(2, 3);
            g.Move(1, 0, 1);
            Assert(g.State.Board[0] != null && g.State.Board[1] == null && !g.State.Board[0].Shield, "equal shield survivor stays at origin");
        }

        private static void BuffsAndDebuffs()
        {
            var g = Game(); Empty(g); g.State.Board[1] = Piece(1, 2);
            g.State.Hands[1].Clear(); g.State.Hands[1].Add(Card(DemoEffect.BoostAdjacent, 2));
            g.Place(1, 0, 0); Assert(g.State.Board[1].Power == 3, "adjacent boost");
            Assert(g.State.Events.Any(e => e.Kind == "power" && e.Source != e.Target), "source target power trace");
            g = Game(); Empty(g); g.State.Board[1] = Piece(2, 0);
            g.State.Hands[1].Clear(); g.State.Hands[1].Add(Card(DemoEffect.WeakenEnemy, 2));
            g.Place(1, 0, 0); Assert(g.State.Board[1].Power == 0, "zero clamp and no auto destroy");
        }

        private static void DeathEffects()
        {
            var g = Game(); Empty(g); g.State.Board[0] = Piece(1, 1, DemoEffect.LastWill);
            g.State.Board[1] = Piece(2, 4); g.State.Board[4] = Piece(1, 2);
            g.Move(1, 0, 1);
            Assert(g.State.Board[0] == null && g.State.Board[4].Power == 3, "death effect uses old position");
        }

        private static void SurrenderAnyTurn()
        {
            var g = Game(); g.State.ActivePlayer = 2;
            Assert(g.Surrender(1) && g.State.Winner == 2, "surrender during opponent turn");
            int count = g.State.Events.Count;
            Assert(!g.EndTurn(2) && !g.Place(2, 0, 0) && !g.Surrender(2), "no commands after settlement");
            Assert(g.State.Events.Count == count, "finished state stays unchanged");
        }

        private static void TurnLimit()
        {
            var g = Game(); for (int i = 0; i < 30; i++) g.EndTurn(g.State.ActivePlayer);
            Assert(g.State.Finished && g.State.Turn == 30 && g.State.Winner == 0, "turn 30 draw settlement");
            g = Game(); Empty(g); g.State.Board[0] = Piece(1, 2);
            for (int i = 0; i < 30; i++) g.EndTurn(g.State.ActivePlayer);
            Assert(g.State.Winner == 1, "turn limit compares actual score");
        }

        private static void VictoryStopsEffects()
        {
            var g = Game(); Empty(g);
            for (int i = 1; i <= 8; i++) g.State.Board[i] = Piece(1, 2);
            g.State.Hands[1].Clear(); g.State.Hands[1].Add(Card(DemoEffect.BoostAdjacent, 2));
            g.Place(1, 0, 0);
            Assert(g.State.Finished && g.State.Winner == 1 && g.Score(1) == 9, "majority win");
            Assert(g.State.Board[1].Power == 2, "stop skills immediately on win");
        }

        private static void Determinism()
        {
            var a = Game(); var b = Game();
            Assert(a.State.ActivePlayer == b.State.ActivePlayer, "same first player");
            Assert(a.State.Hands[1].Select(c => c.id).SequenceEqual(b.State.Hands[1].Select(c => c.id)), "same shuffle");
            Assert(a.State.Board.Select(p => p == null ? -1 : p.Power).SequenceEqual(b.State.Board.Select(p => p == null ? -1 : p.Power)), "same guards");
        }

        private static void ExhaustedDeck()
        {
            var g = Game(); g.State.Decks[1].Clear(); g.State.Hands[1].Clear();
            if (g.State.ActivePlayer == 1) g.EndTurn(1);
            g.EndTurn(2);
            Assert(g.State.Hands[1].Count == 0 && g.State.Events.Any(e => e.Reason == "牌库已空"), "no replacement cards on empty deck");
        }

        private static void ValidateConfig()
        {
            bool failed = false;
            try { new GameConfig { boardSize = 0 }.Validate(); } catch (ArgumentException) { failed = true; }
            Assert(failed, "reject invalid board size");
            failed = false;
            try { new GameConfig { serverUrl = "http://unsafe.example" }.Validate(); } catch (ArgumentException) { failed = true; }
            Assert(failed, "reject invalid endpoint");
            new GameConfig { boardSize = 5, serverUrl = "wss://example.com" }.Validate();
        }

        private static void FuzzMatches()
        {
            for (int seed = 1; seed <= 100; seed++)
            {
                var random = new Random(seed);
                var g = new GameEngine(new GameConfig { boardSize = seed % 2 == 0 ? 4 : 5 },
                    new[] { Card(), Card(DemoEffect.Shield, 2), Card(DemoEffect.LastWill, 1), Card(DemoEffect.BoostAdjacent, 2), Card(DemoEffect.WeakenEnemy, 2) }, seed);
                for (int step = 0; step < 300 && !g.State.Finished; step++)
                {
                    if (g.State.ActivePlayer == 2) g.StepAi();
                    else
                    {
                        var actions = g.LegalActions(1);
                        if (actions.Count == 0) g.EndTurn(1);
                        else
                        {
                            var action = actions[random.Next(actions.Count)];
                            Assert(action.IsPlacement ? g.Place(1, action.From, action.To) : g.Move(1, action.From, action.To), "legal action executes");
                        }
                    }
                    Assert(g.State.Actions >= 0, "nonnegative actions");
                    Assert(g.State.Hands[1].Count <= 5 && g.State.Hands[2].Count <= 5, "bounded hands");
                    Assert(g.State.Board.Where(p => p != null).All(p => p.Power >= 0), "nonnegative power");
                    var uids = g.State.Board.Where(p => p != null).Select(p => p.Uid).ToArray();
                    Assert(uids.Distinct().Count() == uids.Length, "unique board pieces");
                }
                Assert(g.State.Finished && g.State.Turn <= 30, "match always completes");
            }
        }
    }
}
