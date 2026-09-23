using System;
using System.Linq;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class GachaChecks
    {
        public static void RunAll(GachaConfig config, CardDefinition[] catalog, Action<string> log, int simulations = 10000)
        {
            var engine = new GachaDemo(config, catalog);
            var initial = engine.NewState();
            var first = engine.Draw(initial, bound => 0);
            Check(first.bundles == 1 && engine.Spent(first) == 20 && engine.Remaining(first) == 480, "one bundle pricing");
            Check(first.lastRewards.Count == 5 && first.owned.Count == 1 && first.owned[0].shards == 20, "duplicates within bundle");
            Check(first.lastRewards[0].isNew && first.lastRewards.Skip(1).All(r => !r.isNew && r.shards == 5), "reward annotations");
            Check(initial.bundles == 0 && initial.owned.Count == 0 && initial.lastRewards.Count == 0, "transaction is immutable");
            Throws(() => engine.Draw(initial, bound => bound), "invalid random rejected");
            int cumulative = 0;
            foreach (var group in config.groups)
            {
                int threshold = cumulative; bool chooseGroup = true;
                var selected = engine.Draw(initial, bound => { int value = chooseGroup ? threshold : 0; chooseGroup = !chooseGroup; return value; });
                Check(selected.owned.Single().cardId == group.cardIds[0], "weight boundary " + group.rarity);
                Check(selected.owned.Single().shards == 4 * group.duplicateShards, "shard ratio " + group.rarity);
                cumulative += group.weight;
            }
            var orangeId = config.groups.Single(g => g.rarity == "传说").cardIds.Single();
            int orangeStart = config.groups.TakeWhile(g => g.rarity != "传说").Sum(g => g.weight);
            bool category = true;
            var early = engine.Draw(initial, bound => { int value = category ? orangeStart : 0; category = !category; return value; });
            Check(early.owned.Any(c => c.cardId == orangeId), "orange possible in first bundle");
            var worst = initial;
            for (int i = 1; i <= 25; i++)
            {
                worst = engine.Draw(worst, bound => 0); engine.ValidateState(worst);
                Check(worst.lastRewards.Take(5).All(r => !r.guarantee), "five draws are never replaced");
                if (i == 14) Check(worst.owned.Count == 1, "no early guaranteed cards");
                if (i == 15) Check(worst.owned.Count == 8 && worst.lastRewards.Count == 12, "300 minimum eight plus bonus");
                if (i == 20) Check(worst.owned.Count == 9, "400 minimum nine");
            }
            Check(engine.Complete(worst) && engine.Spent(worst) == 500 && worst.owned.Any(c => c.cardId == orangeId), "500 all ten incl orange");
            Throws(() => engine.Draw(worst, bound => 0), "no spending after completion");
            Throws(() => engine.ValidateState(new GachaState { poolId = "wrong" }), "pool isolation");
            Throws(() => engine.ValidateState(new GachaState { poolId = config.poolId, bundles = 25 }), "corrupt milestone save");
            var resumed = engine.Draw(first, bound => 0);
            Check(resumed.owned[0].shards == 45 && first.owned[0].shards == 20 && resumed.revision == 2, "resume inventory and revision");
            int originalWeight = config.groups[0].weight;
            try { config.groups[0].weight = 0; Throws(() => new GachaDemo(config, catalog), "invalid config"); }
            finally { config.groups[0].weight = originalWeight; }
            var random = new Random(20260923); long total = 0, orangeTotal = 0; int hard = 0;
            for (int run = 0; run < simulations; run++)
            {
                var state = engine.NewState(); int firstOrange = 0;
                while (!engine.Complete(state))
                {
                    state = engine.Draw(state, random.Next);
                    if (firstOrange == 0 && state.owned.Any(c => c.cardId == orangeId)) firstOrange = engine.Spent(state);
                    Check(state.bundles <= 25, "bounded run");
                }
                engine.ValidateState(state);
                total += engine.Spent(state); orangeTotal += firstOrange;
                if (state.bundles == 25) hard++;
            }
            double average = total / (double)simulations;
            Check(average > 340 && average < 360, "average near 350 target");
            log("PASS gacha: boundaries, first-bundle orange, duplicates, 300/400/500 guarantees, save validation, completed stop.");
            log(string.Format(System.Globalization.CultureInfo.InvariantCulture,
                "SIMULATION {0} collections: mean {1:F2}, orange mean {2:F2}, max 500, final-guarantee rate {3:P2}. Test credit only.",
                simulations, average, orangeTotal / (double)simulations, hard / (double)simulations));
        }
        private static void Check(bool value, string name) { if (!value) throw new Exception("Gacha check failed: " + name); }
        private static void Throws(Action action, string name)
        {
            try { action(); } catch (ArgumentException) { return; } catch (InvalidOperationException) { return; }
            throw new Exception("Gacha invalid case accepted: " + name);
        }
    }
}
