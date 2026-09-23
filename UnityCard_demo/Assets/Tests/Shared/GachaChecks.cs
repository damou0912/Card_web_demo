using System;
using System.Linq;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class GachaChecks
    {
        // Same engine as the live demo; calibration never reads or writes player profiles.
        public static void SimulateEconomy(GachaConfig config, CardDefinition[] catalog, Action<string> log, int samples = 100000, bool verifyTarget = true)
        {
            if (samples < 1000 || samples > 1000000) throw new ArgumentException("模拟样本数须为 1000～1000000。");
            var engine = new GachaDemo(config, catalog);
            var ids = config.groups.SelectMany(g => g.cardIds).ToArray();
            var oranges = config.groups.Single(g => g.rarity == "传说").cardIds;
            foreach (string strategy in new[] { "finish-only", "cheapest-first", "orange-first" })
            foreach (bool carry in new[] { false, true })
            {
                var random = new Random(20260923); var costs = new int[samples]; int universal = 0;
                for (int run = 0; run < samples; run++)
                {
                    if (!carry) universal = 0;
                    var state = engine.NewState();
                    while (!engine.Complete(state))
                    {
                        var missing = ids.Where(id => state.owned.All(c => c.cardId != id)).ToArray();
                        bool finish = missing.Sum(engine.ExchangeCost) <= (long)engine.ShardBalance(state) + universal;
                        foreach (var id in missing.OrderBy(id => strategy == "orange-first" && oranges.Contains(id) ? -1 : engine.ExchangeCost(id)))
                        {
                            if (strategy == "finish-only" && !finish) break;
                            if (strategy == "orange-first" && oranges.Any(orange => !state.owned.Any(c => c.cardId == orange)) && !oranges.Contains(id)) continue;
                            var quote = engine.Quote(state, id, universal);
                            if (!quote.canAfford) continue;
                            state = engine.Exchange(state, config.poolId, id, universal); universal -= quote.universalUsed;
                        }
                        if (!engine.Complete(state)) state = engine.Draw(state, random.Next);
                    }
                    universal += state.conversion.universalShards;
                    costs[run] = engine.Spent(state);
                }
                Array.Sort(costs);
                if (verifyTarget) Check(Math.Abs(costs.Average() - config.targetAverageCost) <= config.targetAverageCost * .05,
                    "average within five percent of configured target: " + strategy + " carry=" + carry);
                Check(costs.Last() <= config.testCredit, "costs obey configured safety ceiling");
                log(string.Format(System.Globalization.CultureInfo.InvariantCulture,
                    "ECONOMY {0} carry={1} N={2}: mean={3:F2}, p50={4}, p90={5}, p99={6}, max={7}, overTarget={8:P2}",
                    strategy, carry, samples, costs.Average(), costs[samples / 2], costs[(int)(samples * .90)], costs[(int)(samples * .99)], costs.Last(), costs.Count(c => c > config.targetAverageCost) / (double)samples));
            }
        }
        public static void RunAll(GachaConfig config, CardDefinition[] catalog, Action<string> log, int simulations = 10000)
        {
            var inventoryEngine = new GachaDemo(config, catalog);
            var inventory = GachaProfiles.Open(GachaProfiles.New(), inventoryEngine, config.poolId, null, out _);
            var extraCard = catalog.First(card => card.id == config.groups[0].cardIds[0]);
            Check(GachaInventory.OwnedExtraCardIds(inventory, config).Length == 0, "new inventory grants no extra cards");
            Throws(() => GachaInventory.ValidatePlayerDeck(new[] { extraCard }, inventory, config), "unowned extra deck rejected");
            GachaInventory.ValidatePlayerDeck(catalog.Where(card => !config.groups.SelectMany(g => g.cardIds).Contains(card.id)), inventory, config);
            inventory = GachaProfiles.Draw(inventory, inventoryEngine, config.poolId, bound => 0);
            GachaInventory.ValidatePlayerDeck(new[] { extraCard }, inventory, config);
            Check(GachaInventory.OwnedExtraCardIds(inventory, config).SequenceEqual(new[] { extraCard.id }), "draw only unlocks acquired card");
            inventory = GachaProfiles.Reset(inventory, inventoryEngine, config.poolId);
            GachaInventory.ValidatePlayerDeck(new[] { extraCard }, inventory, config);
            log("PASS inventory: no default extras, base cards retained, acquired cards and archived acquisitions preserved.");
            // Keep old ledger/transaction regression cases against the exact original economy.
            var previous = PreviousConfig();
            var legacy = new GachaConfig { schemaVersion = 1, poolId = previous.poolId, title = previous.title, shardName = previous.shardName,
                bundlePrice = 20, bundleSize = 5, testCredit = 500, targetAverageCost = 350,
                groups = previous.groups.Select(g => new GachaGroup { rarity = g.rarity, cardIds = g.cardIds.ToArray(),
                    weight = g.rarity == "传说" ? 82 : g.rarity == "特殊" ? 518 : g.weight,
                    duplicateShards = g.duplicateShards, exchangeCost = g.rarity == "传说" ? 1300 : g.exchangeCost }).ToArray(),
                milestones = new[] { new GachaMilestone { spent = 300, uniqueCards = 8 }, new GachaMilestone { spent = 400, uniqueCards = 9 }, new GachaMilestone { spent = 500, uniqueCards = 10 } } };
            CheckLegacy(legacy, catalog, log);
            CheckCurrentEconomy(previous, legacy, catalog, log);
            if (config.poolId != previous.poolId) CheckCombinedPool(config, previous, catalog, log);
            // The merged pool keeps the previous per-draw odds/prices. Report its new collection
            // distribution; the old ten-card ±5% calibration is not a claim about thirty cards.
            SimulateEconomy(config, catalog, log, simulations, verifyTarget: config.poolId == previous.poolId);
        }
        private static GachaConfig PreviousConfig()
        {
            return new GachaConfig { schemaVersion = 1, poolId = "shu-demo-v1", title = "蜀汉 · 群英招募", shardName = "蜀汉·第一期碎片",
                bundlePrice = 20, bundleSize = 5, testCredit = 1000, targetAverageCost = 500,
                groups = new[] {
                    new GachaGroup { rarity = "普通", weight = 7000, duplicateShards = 5, exchangeCost = 100, cardIds = new[] { "01121", "01122", "01123", "01124" } },
                    new GachaGroup { rarity = "稀有", weight = 2000, duplicateShards = 15, exchangeCost = 300, cardIds = new[] { "01225", "01226", "01227" } },
                    new GachaGroup { rarity = "史诗", weight = 400, duplicateShards = 40, exchangeCost = 800, cardIds = new[] { "01328" } },
                    new GachaGroup { rarity = "传说", weight = 48, duplicateShards = 100, exchangeCost = 1800, cardIds = new[] { "01429" } },
                    new GachaGroup { rarity = "特殊", weight = 552, duplicateShards = 50, exchangeCost = 1000, cardIds = new[] { "01530" } } },
                milestones = new[] { new GachaMilestone { spent = 300, uniqueCards = 8 }, new GachaMilestone { spent = 400, uniqueCards = 9 },
                    new GachaMilestone { spent = 500, uniqueCards = 9 }, new GachaMilestone { spent = 1000, uniqueCards = 10 } } };
        }
        private static void CheckCombinedPool(GachaConfig config, GachaConfig previous, CardDefinition[] catalog, Action<string> log)
        {
            var engine = new GachaDemo(config, catalog);
            var ids = config.groups.SelectMany(g => g.cardIds).ToArray();
            Check(engine.CardCount == 30 && ids.Distinct().Count() == 30, "one thirty-card pool");
            foreach (var camp in new[] { "三国~魏", "三国~蜀", "三国~吴" })
            {
                var selected = catalog.Where(c => ids.Contains(c.id) && c.camp == camp).ToArray();
                Check(selected.Length == 10 && selected.All(c => int.Parse(c.id.Substring(3)) >= 21), "only extra cards for " + camp);
                Check(selected.Count(c => c.rarity == "普通") == 4 && selected.Count(c => c.rarity == "稀有") == 3
                    && selected.Count(c => c.rarity == "史诗") == 1 && selected.Count(c => c.rarity == "传说") == 1
                    && selected.Count(c => c.rarity == "特殊") == 1, "each camp 4+3+1+1+1");
            }
            int threshold = 0;
            foreach (var group in config.groups)
            {
                for (int index = 0; index < group.cardIds.Length; index++)
                {
                    bool category = true;
                    var chosen = engine.Draw(engine.NewState(), bound => { int value = category ? threshold : index; category = !category; return value; });
                    Check(chosen.owned.Single().cardId == group.cardIds[index] && chosen.lastRewards.Skip(1).All(r => r.shards == group.duplicateShards),
                        "every card reachable from shared random pool: " + group.cardIds[index]);
                }
                threshold += group.weight;
            }
            var state = engine.NewState();
            while (engine.Remaining(state) > 0) state = engine.Draw(state, _ => 0);
            Check(state.lastRewards.Count == 5 && state.conversion == null && !engine.Complete(state), "fragments fund cards, never auto-collect");
            Check(engine.ShardBalance(state) >= ids.Where(id => state.owned.All(c => c.cardId != id)).Sum(engine.ExchangeCost), "final funding covers thirty-card pool");
            foreach (string id in ids.Where(id => state.owned.All(c => c.cardId != id)))
            {
                state = engine.Exchange(state, config.poolId, id);
                if (state.owned.Count < 30) Check(!engine.Complete(state) && state.conversion == null, "no settlement at ten, twenty or twenty-nine cards");
            }
            Check(engine.Complete(state) && state.conversion != null && engine.ShardBalance(state) == 0, "thirtieth card settles once");
            Check(engine.RestoreState(state).conversion.universalShards == state.conversion.universalShards, "thirty-card restore preserves settlement");
            var malformed = engine.RestoreState(state); malformed.poolCardCount = 10;
            Throws(() => engine.ValidateState(malformed), "pool size cannot shrink in save");
            malformed = engine.RestoreState(state); malformed.owned.RemoveAt(0);
            Throws(() => engine.ValidateState(malformed), "incomplete pool cannot have conversion");
            var oldEngine = new GachaDemo(previous, catalog);
            var profile = GachaProfiles.Open(GachaProfiles.New(), oldEngine, previous.poolId, CompleteFixture(previous, 1500), out _);
            var old = GachaProfiles.Current(profile, previous.poolId);
            profile = GachaProfiles.Open(profile, engine, config.poolId, null, out bool converted);
            Check(!converted && GachaProfiles.UniversalBalance(profile) == 150 && ReferenceEquals(old, GachaProfiles.Current(profile, previous.poolId)), "old pool and universal wallet retained");
            var current = GachaProfiles.Current(profile, config.poolId);
            Check(current.owned.Count == 0 && engine.ShardBalance(current) == 0 && current.poolCardCount == 30, "new shared pool does not duplicate old cards or shards");
            string wei = ids.First(id => id.StartsWith("02", StringComparison.Ordinal));
            profile = GachaProfiles.Exchange(profile, engine, config.poolId, wei, engine.ExchangeCost(wei));
            Check(GachaProfiles.UniversalBalance(profile) == 50 && GachaProfiles.Current(profile, config.poolId).owned.Single().cardId == wei, "shared wallet can redeem Wei card");
            Throws(() => engine.RestoreState(old), "old ten-card state cannot be silently reinterpreted");
            log("PASS combined pool: thirty extras, three camps, all random boundaries, shared fragments, thirty-card settlement, old pool isolation and universal wallet.");
        }
        private static void CheckCurrentEconomy(GachaConfig config, GachaConfig legacyConfig, CardDefinition[] catalog, Action<string> log)
        {
            var engine = new GachaDemo(config, catalog); var legacyEngine = new GachaDemo(legacyConfig, catalog);
            Check(config.bundlePrice == 20 && config.testCredit == 1000 && config.targetAverageCost == 500, "configured current economy");
            var orange = config.groups.Single(g => g.rarity == "传说");
            Check(orange.weight == 48 && orange.exchangeCost == 1800, "calibrated orange probability and exchange price");
            var state = engine.NewState();
            for (int i = 0; i < 25; i++) state = engine.Draw(state, _ => 0);
            Check(state.owned.Count == 1 && state.shardGrants.Count == 3 && engine.ShardBalance(state) == 3125,
                "500 no longer guarantees a full set");
            state = engine.Draw(state, _ => 0);
            Check(engine.Spent(state) == 520 && engine.Remaining(state) == 480, "can draw beyond former limit");
            while (engine.Remaining(state) > 0) state = engine.Draw(state, _ => 0);
            Check(state.bundles == 50 && engine.ShardBalance(state) == 4800 && state.owned.Count == 1, "1000 safety ceiling funds all remaining cards");
            foreach (string id in config.groups.SelectMany(g => g.cardIds).Where(id => state.owned.All(c => c.cardId != id)).ToArray())
                state = engine.Exchange(state, config.poolId, id);
            Check(engine.Complete(state) && state.conversion.universalShards == 0, "final safety funding redeemable without cash");
            var old = legacyEngine.NewState();
            for (int i = 0; i < 25; i++) old = legacyEngine.Draw(old, _ => 0);
            int oldBalance = legacyEngine.ShardBalance(old);
            var migrated = engine.RestoreState(old);
            Check(engine.ShardBalance(migrated) == oldBalance && migrated.owned.Count == old.owned.Count
                && migrated.shardGrants.Sum(g => g.amount) == old.shardGrants.Sum(g => g.amount), "existing checkpoint money is never revoked or replayed");
            string orangeId = orange.cardIds.Single();
            var oldPaid = legacyEngine.Exchange(old, legacyConfig.poolId, orangeId);
            Check(engine.RestoreState(oldPaid).exchanges.Single().cost == 1300
                && engine.ShardBalance(engine.RestoreState(oldPaid)) == legacyEngine.ShardBalance(oldPaid), "historic 1300 payment retained after price rises");
            var completeOld = legacyEngine.RestoreState(CompleteFixture(legacyConfig, 105));
            var completeNew = engine.RestoreState(completeOld);
            Check(completeNew.conversion.universalShards == 10 && completeNew.conversion.sourceShards == 105, "completed old wallet is unchanged");
            int threshold = config.groups.TakeWhile(g => g.rarity != "传说").Sum(g => g.weight); bool category = true;
            var early = engine.Draw(engine.NewState(), bound => { int value = category ? threshold : 0; category = !category; return value; });
            Check(early.owned.Single().cardId == orangeId && early.lastRewards.Skip(1).All(r => r.shards == 100), "first bundle orange and duplicate amount remain valid");
            log("PASS current economy: 20/five, 500 not a limit, 1000 fragment safety net, old balances/grants/payments/conversions preserved, first-bundle orange.");
        }
        private static void CheckLegacy(GachaConfig config, CardDefinition[] catalog, Action<string> log)
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
                Check(worst.lastRewards.Count == 5 && worst.lastRewards.All(r => !r.guarantee) && worst.owned.Count == 1, "exactly five draws, no guaranteed cards");
                if (i == 14) Check(worst.owned.Count == 1, "no early guaranteed cards");
                if (i == 15) Check(engine.ShardBalance(worst) == 2000 && worst.shardGrants.Single().amount == 1630, "first checkpoint funds seven cheapest missing cards");
                if (i == 16) Check(worst.shardGrants.Count == 1 && engine.ShardBalance(worst) == 2025, "no repeated top-up between checkpoints");
                if (i == 20) Check(engine.ShardBalance(worst) == 3000 && worst.shardGrants.Count == 2, "second checkpoint funds eight cheapest missing cards");
            }
            Check(!engine.Complete(worst) && engine.Spent(worst) == 500 && engine.ShardBalance(worst) == 4300 && worst.conversion == null, "500 funds all missing cards without auto-collection or conversion");
            Throws(() => engine.Draw(worst, bound => 0), "no overspending while awaiting exchange");
            var funded = engine.RestoreState(worst);
            Check(engine.ShardBalance(funded) == 4300 && funded.shardGrants.Count == 3, "reload does not repeat grants");
            funded.shardGrants[0].amount++;
            Check(worst.shardGrants[0].amount == 1630, "grant ledger deep copy");
            var malformed = engine.RestoreState(worst); malformed.shardGrants.Add(malformed.shardGrants[0]);
            Throws(() => engine.ValidateState(malformed), "duplicate grant rejected");
            malformed = engine.RestoreState(worst); malformed.shardGrants.RemoveAt(0);
            Throws(() => engine.ValidateState(malformed), "missing checkpoint rejected");
            malformed = engine.RestoreState(worst); malformed.shardGrants[0].amount = -1;
            Throws(() => engine.ValidateState(malformed), "negative grant rejected");
            malformed = engine.RestoreState(worst); malformed.shardGrants[2].amount--;
            Throws(() => engine.ValidateState(malformed), "final guarantee shortfall rejected");
            var paidAtCheckpoint = engine.NewState();
            for (int i = 0; i < 15; i++) paidAtCheckpoint = engine.Draw(paidAtCheckpoint, bound => 0);
            paidAtCheckpoint = engine.Exchange(paidAtCheckpoint, config.poolId, orangeId);
            var afterCheckpoint = engine.Draw(paidAtCheckpoint, bound => 0);
            Check(afterCheckpoint.shardGrants.Count == 1 && engine.ShardBalance(afterCheckpoint) == 725,
                "spending checkpoint fragments on orange does not retrigger top-up");
            foreach (var id in config.groups.SelectMany(g => g.cardIds).Where(id => worst.owned.All(c => c.cardId != id)).ToArray())
                worst = engine.Exchange(worst, config.poolId, id);
            Check(engine.Complete(worst) && engine.ShardBalance(worst) == 0 && worst.conversion.universalShards == 0, "funded final exchanges complete and settle exactly");
            Throws(() => engine.Draw(worst, bound => 0), "no spending after completion");
            Throws(() => engine.ValidateState(new GachaState { poolId = "wrong" }), "pool isolation");
            Throws(() => engine.ValidateState(new GachaState { poolId = config.poolId, bundles = 25 }), "corrupt milestone save");
            var resumed = engine.Draw(first, bound => 0);
            Check(resumed.owned[0].shards == 45 && first.owned[0].shards == 20 && resumed.revision == 2, "resume inventory and revision");
            int originalWeight = config.groups[0].weight;
            try { config.groups[0].weight = 0; Throws(() => new GachaDemo(config, catalog), "invalid config"); }
            finally { config.groups[0].weight = originalWeight; }
            CheckExchanges(config, catalog, engine);
            CheckUniversal(config, catalog, engine);
            log("PASS universal: conversion 10:1 floor, full-bundle settlement, final exchange, no repeat credits, mixed/local-first/full payments, cross-period wallet, reset no refund, confirmation checks.");
            log("PASS gacha: boundaries, first-bundle orange, duplicates, one-time fragment guarantees, save validation, completed stop.");
        }
        private static void CheckExchanges(GachaConfig config, CardDefinition[] catalog, GachaDemo engine)
        {
            var source = engine.NewState();
            for (int i = 0; i < 5; i++) source = engine.Draw(source, bound => 0);
            string target = config.groups[0].cardIds[1];
            Check(engine.ShardBalance(source) == 120, "earned pool fragments");
            source.schemaVersion = 1; source.exchanges = null;
            var restored = engine.RestoreState(source);
            Check(restored.schemaVersion == 5 && restored.poolCardCount == 10 && source.schemaVersion == 1 && source.exchanges == null, "legacy restore is copy only");
            Check(engine.ShardBalance(restored) == 120 && restored.bundles == 5 && restored.revision == 5, "legacy 1:1 balance and progress");
            Check(engine.ShardBalance(engine.RestoreState(restored)) == 120, "migration is idempotent");
            var exchanged = engine.Exchange(restored, config.poolId, target);
            Check(engine.ShardBalance(exchanged) == 20 && engine.ShardBalance(restored) == 120, "exchange charges once without mutating original");
            Check(exchanged.bundles == 5 && engine.Spent(exchanged) == 100 && exchanged.revision == 6, "exchange never advances spending or guarantee");
            Check(exchanged.owned.Count == 2 && exchanged.exchanges.Single().cost == 100, "exchange grants requested card and records price");
            Check(!ReferenceEquals(exchanged.owned[0], restored.owned[0]) && !ReferenceEquals(exchanged.lastRewards[0], restored.lastRewards[0]), "deep copy of inventory and replay");
            Check(exchanged.lastRewards.Count == restored.lastRewards.Count && exchanged.lastRewards.All(r => r.cardId == config.groups[0].cardIds[0] && !r.isNew), "exchange preserves draw replay");
            bool groupRoll = true;
            var nextDraw = engine.Draw(exchanged, bound => { int value = groupRoll ? 0 : 1; groupRoll = !groupRoll; return value; });
            Check(nextDraw.lastRewards.All(r => !r.isNew && r.shards == 5) && engine.ShardBalance(nextDraw) == 45, "exchanged cards become pool shards on subsequent duplicate");
            Check(nextDraw.exchanges.Single().cost == 100 && !ReferenceEquals(nextDraw.exchanges[0], exchanged.exchanges[0]), "draw preserves exchange ledger by copy");
            Throws(() => engine.Exchange(restored, "shu-demo-v2", target), "cross-period request rejected");
            Throws(() => engine.Exchange(restored, config.poolId, "unknown"), "unknown card rejected");
            Throws(() => engine.Exchange(restored, config.poolId, null), "missing card rejected");
            Throws(() => engine.Exchange(exchanged, config.poolId, target), "already owned rejected");
            Throws(() => engine.Exchange(engine.NewState(), config.poolId, target), "insufficient fragments rejected");
            int oldCost = config.groups[0].exchangeCost;
            try
            {
                config.groups[0].exchangeCost = 0; Throws(() => new GachaDemo(config, catalog), "zero price rejected");
                config.groups[0].exchangeCost = -1; Throws(() => new GachaDemo(config, catalog), "negative price rejected");
                config.groups[0].exchangeCost = 120;
                Check(engine.ShardBalance(engine.Exchange(restored, config.poolId, target)) == 0, "exact balance accepted");
                Check(engine.ShardBalance(exchanged) == 20, "historical cost not rewritten after price update");
            }
            finally { config.groups[0].exchangeCost = oldCost; }
            var bad = engine.RestoreState(exchanged); bad.exchanges[0].cost = -1;
            Throws(() => engine.ValidateState(bad), "negative ledger rejected");
            bad = engine.RestoreState(exchanged); bad.exchanges.Add(new GachaExchange { cardId = target, cost = 100 });
            Throws(() => engine.ValidateState(bad), "duplicate exchange ledger rejected");
            bad = engine.RestoreState(exchanged); bad.exchanges[0].cost = 121;
            Throws(() => engine.ValidateState(bad), "overspent balance rejected");
            bad = engine.RestoreState(exchanged); bad.schemaVersion = 1;
            Throws(() => engine.ValidateState(bad), "v1 with exchange ledger rejected");
            var otherConfig = new GachaConfig { schemaVersion = config.schemaVersion, poolId = "shu-demo-v2", title = config.title,
                shardName = "第二期碎片", bundlePrice = config.bundlePrice, bundleSize = config.bundleSize, testCredit = config.testCredit,
                targetAverageCost = config.targetAverageCost, groups = config.groups, milestones = config.milestones };
            var other = new GachaDemo(otherConfig, catalog);
            Check(other.ShardBalance(other.NewState()) == 0, "new period starts with separate balance even with same card IDs");
            Throws(() => other.RestoreState(exchanged), "cross-period restore rejected");
            Throws(() => other.Exchange(exchanged, otherConfig.poolId, target), "cross-period inventory rejected");
            string directory = System.IO.Path.GetTempPath();
            string originalPath = GachaSaveFile.PathForPool(directory, config.poolId, "browser-save.json");
            Check(originalPath == System.IO.Path.Combine(directory, "browser-save.json"), "legacy save path retained");
            Check(originalPath != GachaSaveFile.PathForPool(directory, otherConfig.poolId, "browser-save.json"), "separate period save paths");
            Throws(() => GachaSaveFile.PathForPool(directory, "../escape", "browser-save.json"), "unsafe pool ID rejected");
            var guaranteed = exchanged;
            while (engine.Remaining(guaranteed) > 0) guaranteed = engine.Draw(guaranteed, bound => 0);
            Check(guaranteed.bundles == 25 && guaranteed.exchanges.Count == 1
                && engine.ShardBalance(guaranteed) == config.groups.SelectMany(g => g.cardIds).Where(id => guaranteed.owned.All(c => c.cardId != id)).Sum(engine.ExchangeCost), "exchange then draws retain final funded guarantee");
        }
        private static GachaState CompleteFixture(GachaConfig config, int fragments)
        {
            // Use a rare card's historical earnings; this remains within the old per-card bound at 25 bundles.
            string rare = config.groups[1].cardIds[0];
            return new GachaState { schemaVersion = 2, poolId = config.poolId, bundles = 25, revision = 25,
                owned = config.groups.SelectMany(g => g.cardIds).Select(id => new GachaOwnedCard { cardId = id, shards = id == rare ? fragments : 0 }).ToList(),
                lastRewards = Enumerable.Range(0, 5).Select(_ => new GachaReward { cardId = rare, shards = 15 }).ToList() };
        }
        private static void CheckUniversal(GachaConfig config, CardDefinition[] catalog, GachaDemo engine)
        {
            foreach (int amount in new[] { 0, 9, 10, 15, 105, 1500 })
            {
                var legacy = CompleteFixture(config, amount);
                var restored = engine.RestoreState(legacy);
                Check(restored.conversion.sourceShards == amount && restored.conversion.universalShards == amount / 10, "conversion floor " + amount);
                Check(engine.ShardBalance(restored) == 0 && legacy.conversion == null, "conversion clears all local shards without mutating old save");
                var profile = GachaProfiles.Open(GachaProfiles.New(), engine, config.poolId, legacy, out bool converted);
                Check(converted && GachaProfiles.UniversalBalance(profile) == amount / 10, "profile gets conversion exactly once");
                int revision = profile.revision;
                profile = GachaProfiles.Open(profile, engine, config.poolId, legacy, out converted);
                Check(!converted && profile.revision == revision && GachaProfiles.UniversalBalance(profile) == amount / 10, "refresh never recredits");
            }
            string missingCommon = config.groups[0].cardIds[3];
            var near = CompleteFixture(config, 105); near.bundles = 20; near.revision = 20;
            near.owned.RemoveAll(c => c.cardId == missingCommon);
            var migrated = engine.RestoreState(near);
            Check(migrated.shardGrants.Count == 2 && migrated.shardGrants.All(g => g.amount == 0) && engine.ShardBalance(migrated) == 105,
                "past legacy card guarantees marked settled without duplicate shard grants");
            var richLegacy = CompleteFixture(config, 1000); richLegacy.bundles = 14; richLegacy.revision = 14;
            richLegacy.owned.RemoveAll(c => c.cardId == missingCommon || c.cardId == config.groups[0].cardIds[2] || c.cardId == config.groups[0].cardIds[1]);
            var richCheckpoint = engine.Draw(richLegacy, bound => 0);
            Check(richCheckpoint.shardGrants.Single().amount == 0 && richCheckpoint.owned.Count == 7,
                "sufficient existing fragments settle checkpoint at zero without extra cards");
            var byExchange = engine.Exchange(near, config.poolId, missingCommon);
            Check(byExchange.conversion.sourceShards == 5 && byExchange.conversion.universalShards == 0 && engine.ShardBalance(byExchange) == 0, "last-card exchange settles post-payment remainder");
            bool chooseGroup = true;
            var byDraw = engine.Draw(near, bound => { int value = chooseGroup ? 0 : 3; chooseGroup = !chooseGroup; return value; });
            Check(byDraw.lastRewards[0].isNew && byDraw.lastRewards.Skip(1).All(r => r.shards == 5)
                && byDraw.conversion.sourceShards == 125 && byDraw.conversion.universalShards == 12, "final-bundle duplicates included before settlement");
            Throws(() => engine.Draw(byDraw, bound => 0), "settled collection cannot draw again");
            var bad = engine.RestoreState(byDraw); bad.conversion.universalShards++;
            Throws(() => engine.ValidateState(bad), "invalid conversion amount rejected");
            bad = engine.RestoreState(near); bad.conversion = new GachaConversion();
            Throws(() => engine.ValidateState(bad), "early conversion rejected");

            var donor = CompleteFixture(config, 1500);
            var wallet = GachaProfiles.Open(GachaProfiles.New(), engine, config.poolId, donor, out _);
            var secondConfig = new GachaConfig { schemaVersion = config.schemaVersion, poolId = "shu-demo-v2", title = config.title,
                shardName = "第二期碎片", bundlePrice = config.bundlePrice, bundleSize = config.bundleSize, testCredit = config.testCredit,
                targetAverageCost = config.targetAverageCost, groups = config.groups, milestones = config.milestones };
            var second = new GachaDemo(secondConfig, catalog);
            var secondState = second.NewState();
            for (int i = 0; i < 4; i++) secondState = second.Draw(secondState, bound => 0); // 95 local shards.
            wallet = GachaProfiles.Open(wallet, second, secondConfig.poolId, secondState, out _);
            string target = config.groups[0].cardIds[1];
            var quote = second.Quote(GachaProfiles.Current(wallet, secondConfig.poolId), target, GachaProfiles.UniversalBalance(wallet));
            Check(quote.poolUsed == 95 && quote.universalUsed == 5 && quote.canAfford, "quote separates both balances and prioritizes local");
            Throws(() => GachaProfiles.Exchange(wallet, second, secondConfig.poolId, target, 0), "unconfirmed universal use rejected");
            var paid = GachaProfiles.Exchange(wallet, second, secondConfig.poolId, target, 5);
            var paidState = GachaProfiles.Current(paid, secondConfig.poolId);
            Check(second.ShardBalance(paidState) == 0 && GachaProfiles.UniversalBalance(paid) == 145, "mixed currency charged atomically");
            Check(GachaProfiles.UniversalBalance(wallet) == 150 && second.ShardBalance(secondState) == 95, "old profile stays unchanged");
            Check(paidState.bundles == 4 && paidState.lastRewards.Count == 5, "mixed payment keeps spending and replay");
            paid = GachaProfiles.Open(paid, engine, config.poolId, donor, out _);
            Check(GachaProfiles.UniversalBalance(paid) == 145, "returning to donor period does not restore spent currency");
            var reset = GachaProfiles.Reset(paid, second, secondConfig.poolId);
            Check(GachaProfiles.UniversalBalance(reset) == 145 && GachaProfiles.Current(reset, secondConfig.poolId).owned.Count == 0, "reset never refunds universal spending");
            var allUniversal = GachaProfiles.Exchange(reset, second, secondConfig.poolId, target, 100);
            var freshState = GachaProfiles.Current(allUniversal, secondConfig.poolId);
            Check(freshState.bundles == 0 && freshState.lastRewards.Count == 0 && freshState.owned.Count == 1
                && GachaProfiles.UniversalBalance(allUniversal) == 45, "full-universal exchange before first draw is valid");
            second.ValidateState(freshState);
            Throws(() => GachaProfiles.Exchange(allUniversal, second, secondConfig.poolId, missingCommon, 100), "combined balance insufficient");
            Check(!second.Quote(second.NewState(), missingCommon, 99).canAfford && second.Quote(second.NewState(), missingCommon, 100).canAfford, "exact universal balance boundary");
            var forged = GachaProfiles.New(); forged.pools.Add(freshState);
            Throws(() => GachaProfiles.Validate(forged), "unfunded universal spending rejected");
            var localEnough = second.Draw(secondState, bound => 0);
            Check(second.Quote(localEnough, target, 150).universalUsed == 0, "sufficient local shards never spend universal");
        }
        private static void Check(bool value, string name) { if (!value) throw new Exception("Gacha check failed: " + name); }
        private static void Throws(Action action, string name)
        {
            try { action(); } catch (ArgumentException) { return; } catch (InvalidOperationException) { return; }
            throw new Exception("Gacha invalid case accepted: " + name);
        }
    }
}
