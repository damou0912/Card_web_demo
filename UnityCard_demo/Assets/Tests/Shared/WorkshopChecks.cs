using System;
using System.Linq;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class WorkshopChecks
    {
        private static void Assert(bool value, string message) { if (!value) throw new InvalidOperationException("FAILED: " + message); }
        private static SkillStep Step(string operation = "ModifyPower", string target = "Self", int amount = 1, string duration = "Permanent", string selection = "All")
        { return new SkillStep { operation = operation, target = target, amount = amount, duration = duration, selection = selection }; }
        private static SkillDefinition Skill(string trigger, params SkillStep[] steps)
        { return new SkillDefinition { name = "测试技能", trigger = trigger, steps = steps }; }
        private static CardDefinition Card(string suffix, params SkillDefinition[] abilities)
        { return new CardDefinition { id = "workshop_" + suffix, name = suffix, camp = "测试", rarity = "普通", baseAttack = 3, demoEffect = "None", abilities = abilities }; }
        private static ScenarioPiece Piece(string id, int cell, int owner = 1, int power = 3, bool shield = false)
        { return new ScenarioPiece { cardId = "workshop_" + id, cell = cell, owner = owner, power = power, shield = shield }; }
        private static GameEngine Lab(CardDefinition[] cards, ScenarioPiece[] pieces, params string[] hand)
        {
            return GameEngine.FromScenario(new GameConfig(), cards, new BattleScenario { pieces = pieces, playerHand = hand.Select(id => "workshop_" + id).ToArray() });
        }
        private static void Reject(Action action, string message)
        {
            bool rejected = false;
            try { action(); } catch (ArgumentException) { rejected = true; }
            Assert(rejected, message);
        }

        public static void RunAll(Action<string> log)
        {
            var checks = new Action[] { StepOrder, AllTriggers, Conditions, TemporaryPower, ShieldAndDestroy,
                DeathSnapshot, SelfDestruction, ChainLimit, ImmediateVictory, TargetSelection, DeckReferences,
                DataValidation, ScenarioValidation, IndependentDecks, NewSkillsFuzz };
            foreach (var check in checks) { check(); log("PASS Workshop." + check.Method.Name); }
            log("All " + checks.Length + " workshop checks passed (including 40 seeded skill matches).");
        }

        private static void StepOrder()
        {
            var card = Card("combo", Skill("OnPlace", Step(amount: 2), Step(amount: -1)));
            var game = Lab(new[] { card }, new ScenarioPiece[0], "combo");
            Assert(game.Place(1, 0, 0) && game.State.Board[0].Power == 4, "ordered steps execute");
            Assert(game.State.Events.Count(e => e.Kind == "skill") == 1 && game.State.Events.Count(e => e.Kind == "power") == 2, "single trigger, both steps traced");
            Assert(SkillText.Describe(card).Contains("入阵") && SkillText.Describe(card).Contains("+2"), "description generated from config");
        }

        private static void AllTriggers()
        {
            foreach (string trigger in new[] { "OnOwnTurnStart", "OnOwnTurnEnd", "OnMove", "AfterCombat" })
            {
                var cards = new[] { Card("subject", Skill(trigger, Step(amount: 2))), Card("victim") };
                var game = Lab(cards, new[] { Piece("subject", 0, power: 5), Piece("victim", 1, 2, 1) });
                switch (trigger)
                {
                    case "OnOwnTurnStart": game.EndTurn(1); game.EndTurn(2); break;
                    case "OnOwnTurnEnd": game.EndTurn(1); break;
                    case "OnMove": game.Move(1, 0, 4); break;
                    case "AfterCombat": game.Move(1, 0, 1); break;
                }
                Assert(game.State.Board.First(p => p != null && p.Owner == 1).Power == 7, "trigger executes " + trigger);
            }
            var actionCard = Card("actions", Skill("OnPlace", Step("AddActions", amount: 2)));
            var g = Lab(new[] { actionCard }, new ScenarioPiece[0], "actions"); g.Place(1, 0, 0);
            Assert(g.State.Actions == 3, "additional actions delivered");
        }

        private static void Conditions()
        {
            var conditional = Skill("OnPlace", Step("DrawCards")); conditional.condition = "HandBelow"; conditional.conditionValue = 1;
            var card = Card("draw", conditional);
            var game = Lab(new[] { card }, new ScenarioPiece[0], "draw"); game.Place(1, 0, 0);
            Assert(game.State.Hands[1].Count == 1, "condition evaluates after placement removes hand");
            game = Lab(new[] { card }, new ScenarioPiece[0], "draw", "draw"); game.Place(1, 0, 0);
            Assert(game.State.Events.Any(e => e.Kind == "condition-skipped"), "failed condition is explicit");
            conditional.condition = "BehindOnScore";
            game = Lab(new[] { card }, new[] { Piece("draw", 1, 2), Piece("draw", 2, 2) }, "draw"); game.Place(1, 0, 0);
            Assert(game.State.Hands[1].Count == 1, "behind score condition");
            conditional.condition = "HasAdjacentEnemy";
            game = Lab(new[] { card }, new[] { new ScenarioPiece { owner = 0, cell = 1, power = 2 } }, "draw"); game.Place(1, 0, 0);
            Assert(game.State.Hands[1].Count == 1, "adjacent neutral counts as non-ally");
        }

        private static void TemporaryPower()
        {
            var card = Card("temp", Skill("OnPlace", Step(amount: -10, duration: "CurrentTurn"), Step(amount: 2)));
            var game = Lab(new[] { card }, new ScenarioPiece[0], "temp"); game.Place(1, 0, 0);
            Assert(game.State.Board[0].Power == 0 && game.State.Board[0].PermanentPower == 5, "temporary reduction does not erase permanent buffs");
            game.EndTurn(1);
            Assert(game.State.Board[0].Power == 5 && game.State.Board[0].TemporaryPower == 0, "current global turn expiration");
            Assert(game.State.Events.Any(e => e.Kind == "expired"), "expiration traced");
            card = Card("end", Skill("OnOwnTurnEnd", Step(amount: 9, duration: "CurrentTurn")));
            game = Lab(new[] { card }, new[] { Piece("end", 0) }); game.EndTurn(1);
            Assert(game.State.Board[0].Power == 3, "end-phase temporary buffs expire before next player");
        }

        private static void ShieldAndDestroy()
        {
            var killer = Card("kill", Skill("OnPlace", Step("Destroy", "AdjacentEnemies")));
            var guard = Card("guard", Skill("OnPlace", Step("GrantShield")));
            var game = Lab(new[] { killer, guard }, new[] { Piece("guard", 1, 2, shield: true) }, "kill", "kill");
            game.Place(1, 0, 0);
            Assert(game.State.Board[1] != null && !game.State.Board[1].Shield && game.State.Events.Any(e => e.Kind == "protected"), "shield blocks skill destruction");
            game.Place(1, 0, 2); Assert(game.State.Board[1] == null, "second destruction succeeds");
            game = Lab(new[] { guard }, new ScenarioPiece[0], "guard"); game.Place(1, 0, 0);
            Assert(game.State.Board[0].Shield, "grant shield step");
        }

        private static void DeathSnapshot()
        {
            var dead = Card("dead", Skill("OnDestroyed", Step(target: "AdjacentAllies", amount: 4)));
            var killer = Card("killer", Skill("OnPlace", Step("Destroy", "AdjacentEnemies")));
            var game = Lab(new[] { dead, killer }, new[] { Piece("dead", 1, 2), Piece("dead", 2, 2) }, "killer");
            game.Place(1, 0, 0);
            Assert(game.State.Board[1] == null && game.State.Board[2].Power == 7, "destroyed source uses its old location and owner");
        }

        private static void SelfDestruction()
        {
            var card = Card("self", Skill("OnPlace", Step("Destroy"), Step("DrawCards")), Skill("OnDestroyed", Step("DrawCards")));
            var game = Lab(new[] { card }, new ScenarioPiece[0], "self"); game.Place(1, 0, 0);
            Assert(game.State.Board[0] == null && game.State.Hands[1].Count == 1, "leaving source stops live steps; death trigger still executes once");
        }

        private static void ChainLimit()
        {
            var card = Card("many", Enumerable.Range(0, 8).Select(i => Skill("OnOwnTurnStart", Step())).ToArray());
            var game = Lab(new[] { card }, new[] { Piece("many", 0), Piece("many", 1) });
            game.EndTurn(1); game.EndTurn(2);
            Assert(game.State.Events.Count(e => e.Kind == "skill") == 10, "bounded per-command skill processing");
            Assert(game.State.Events.Any(e => e.Kind == "chain-limit"), "limit exposed in trace");
        }

        private static void ImmediateVictory()
        {
            var card = Card("winner", Skill("OnPlace", Step("DrawCards")));
            var game = Lab(new[] { card }, Enumerable.Range(1, 8).Select(i => Piece("winner", i)).ToArray(), "winner");
            game.Place(1, 0, 0);
            Assert(game.State.Finished && game.State.Hands[1].Count == 0, "winning placement prevents later skill draw");
        }

        private static void TargetSelection()
        {
            foreach (string selection in new[] { "RandomOne", "HighestPower", "LowestPower" })
            {
                var card = Card("target", Skill("OnPlace", Step(target: "AllEnemies", amount: -1, selection: selection)));
                var pieces = new[] { Piece("target", 1, 2, 2), Piece("target", 2, 2, 5), Piece("target", 3, 2, 3) };
                var a = Lab(new[] { card }, pieces, "target"); var b = Lab(new[] { card }, pieces, "target");
                a.Place(1, 0, 0); b.Place(1, 0, 0);
                Assert(a.State.Events.Count(e => e.Kind == "power") == 1, "single target " + selection);
                Assert(a.State.Board.Select(p => p == null ? -1 : p.Power).SequenceEqual(b.State.Board.Select(p => p == null ? -1 : p.Power)), "seeded selection");
                if (selection == "HighestPower") Assert(a.State.Board[2].Power == 4, "highest target");
                if (selection == "LowestPower") Assert(a.State.Board[1].Power == 1, "lowest target");
            }
            var row = Card("row", Skill("OnPlace", Step(target: "RowColumnEnemies", amount: -1)));
            var game = Lab(new[] { row }, new[] { Piece("row", 1, 2), Piece("row", 4, 2), Piece("row", 5, 2) }, "row");
            game.Place(1, 0, 0);
            Assert(game.State.Board[1].Power == 2 && game.State.Board[4].Power == 2 && game.State.Board[5].Power == 3, "row/column excludes diagonal");
            game = Lab(new[] { row }, new ScenarioPiece[0], "row"); game.Place(1, 0, 0);
            Assert(game.State.Events.Any(e => e.Kind == "no-target"), "missing target logged");
        }

        private static void DeckReferences()
        {
            var card = Card("deck");
            var library = new WorkshopLibrary { cards = new[] { card }, decks = new[] { new WorkshopDeck { id = "deck", name = "测试", cardIds = Enumerable.Repeat(card.id, 20).ToArray() } } };
            Assert(library.ResolveDeck("deck", 20).Length == 20, "explicit duplicate copies allowed for development");
            Reject(() => library.ResolveDeck("deck", 19), "deck size validation");
            Reject(() => library.ResolveDeck("missing", 20), "missing deck rejection");
            library.decks[0].cardIds[0] = "workshop_deleted";
            Reject(() => WorkshopValidation.ThrowIfInvalid(library), "dangling card ref rejected");
        }

        private static void DataValidation()
        {
            for (int i = 0; i < SkillTemplates.Names.Length; i++)
                WorkshopValidation.ValidateAbilities(Card("template", SkillTemplates.Create(i)));
            var card = Card("validation", Skill("OnPlace", Step()));
            var library = new WorkshopLibrary { cards = new[] { card } };
            WorkshopValidation.ThrowIfInvalid(library);
            card.abilities[0].steps[0].operation = "Unsupported";
            Reject(() => WorkshopValidation.ThrowIfInvalid(library), "unknown operation rejected");
            card.abilities[0].steps[0] = Step("DrawCards", "AllEnemies");
            Reject(() => WorkshopValidation.ThrowIfInvalid(library), "invalid player target rejected");
            card.abilities[0].steps[0] = Step(); card.abilities[0].trigger = "0";
            Reject(() => WorkshopValidation.ThrowIfInvalid(library), "numeric trigger rejected");
            card.abilities[0].trigger = "OnPlace"; card.demoEffect = "Shield";
            Reject(() => WorkshopValidation.ThrowIfInvalid(library), "dual legacy/configured effects rejected");
        }

        private static void ScenarioValidation()
        {
            var card = Card("scenario");
            Reject(() => Lab(new[] { card }, new[] { Piece("scenario", 0), Piece("scenario", 0) }), "duplicate cells");
            Reject(() => Lab(new[] { card }, new[] { Piece("missing", 1) }), "missing scenario card");
            Reject(() => Lab(new[] { card }, new[] { Piece("scenario", 16) }), "out of bounds");
            var game = Lab(new[] { card }, new[] { Piece("scenario", 0, shield: true) }, "scenario");
            Assert(game.State.Events.Count == 1 && game.State.Board[0].Shield && game.State.Board[0].Uid == 1, "setup does not silently fire skills");
        }

        private static void IndependentDecks()
        {
            var a = Card("a"); var b = Card("b");
            var g = new GameEngine(new GameConfig(), new[] { a, b }, 10, Enumerable.Repeat(a, 20).ToArray(), Enumerable.Repeat(b, 20).ToArray());
            Assert(g.State.Hands[1].All(c => c.id == a.id) && g.State.Hands[2].All(c => c.id == b.id), "separate configured decks");
            Assert(g.State.Decks[1].All(c => c.id == a.id) && g.State.Decks[2].All(c => c.id == b.id), "draw piles independent");
        }

        private static void NewSkillsFuzz()
        {
            var cards = new[] { Card("buff", Skill("OnPlace", Step(target: "AdjacentAllies", duration: "CurrentTurn"))),
                Card("shield", Skill("OnPlace", Step("GrantShield"))), Card("death", Skill("OnDestroyed", Step(target: "AdjacentEnemies", amount: -1))),
                Card("start", Skill("OnOwnTurnStart", Step("DrawCards"))), Card("kill", Skill("OnPlace", Step("Destroy", "AdjacentEnemies", selection: "RandomOne"))) };
            for (int seed = 0; seed < 40; seed++)
            {
                var game = new GameEngine(new GameConfig(), cards, seed); var random = new Random(seed);
                for (int i = 0; i < 1000 && !game.State.Finished; i++)
                {
                    int owner = game.State.ActivePlayer; var choices = game.LegalActions(owner);
                    if (choices.Count == 0) game.EndTurn(owner);
                    else
                    {
                        var action = choices[random.Next(choices.Count)];
                        Assert(action.IsPlacement ? game.Place(owner, action.From, action.To) : game.Move(owner, action.From, action.To), "configured legal action");
                    }
                    Assert(game.State.Actions >= 0 && game.State.Actions <= 10, "configured actions bounded");
                    Assert(game.State.Hands[1].Count <= 5 && game.State.Hands[2].Count <= 5, "draw skill respects cap");
                    Assert(game.State.Board.Where(p => p != null).All(p => p.Power >= 0), "configured power bounded below");
                }
                Assert(game.State.Finished, "configured match terminates");
            }
        }
    }
}
