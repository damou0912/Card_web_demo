using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    [Serializable] public sealed class GachaGroup
    {
        public string rarity;
        public int weight;
        public int duplicateShards;
        public string[] cardIds;
    }
    [Serializable] public sealed class GachaMilestone { public int spent; public int uniqueCards; }
    [Serializable] public sealed class GachaConfig
    {
        public int schemaVersion;
        public string poolId;
        public string title;
        public int bundlePrice;
        public int bundleSize;
        public int testCredit;
        public int targetAverageCost;
        public GachaGroup[] groups;
        public GachaMilestone[] milestones;
    }
    [Serializable] public sealed class GachaOwnedCard { public string cardId; public int shards; }
    [Serializable] public sealed class GachaReward
    {
        public string cardId;
        public bool isNew;
        public int shards;
        public bool guarantee;
    }
    [Serializable] public sealed class GachaState
    {
        public int schemaVersion = 1;
        public string poolId;
        public int revision;
        public int bundles;
        public List<GachaOwnedCard> owned = new List<GachaOwnedCard>();
        public List<GachaReward> lastRewards = new List<GachaReward>();
    }

    // Offline prototype only. Real-money balances, inventory and random draws require a trusted server.
    // Both the Unity page and the local browser preview execute THIS implementation.
    public sealed class GachaDemo
    {
        private readonly GachaConfig config;
        private readonly Dictionary<string, GachaGroup> groupsByCard = new Dictionary<string, GachaGroup>(StringComparer.Ordinal);
        public GachaDemo(GachaConfig config, IEnumerable<CardDefinition> catalog)
        {
            if (config == null || catalog == null) throw new ArgumentException("抽卡配置或卡牌资料缺失。");
            this.config = config;
            var cards = catalog.ToDictionary(c => c.id, StringComparer.Ordinal);
            if (config.schemaVersion != 1 || string.IsNullOrWhiteSpace(config.poolId) || string.IsNullOrWhiteSpace(config.title)
                || config.bundleSize != 5 || config.bundlePrice <= 0 || config.testCredit <= 0 || config.testCredit > 100000
                || config.testCredit % config.bundlePrice != 0 || config.groups == null || config.groups.Length != 5)
                throw new ArgumentException("抽卡参数无效，Demo 仅支持五连抽和完整测试额度。");
            var counts = new Dictionary<string, int> { { "普通", 4 }, { "稀有", 3 }, { "史诗", 1 }, { "传说", 1 }, { "特殊", 1 } };
            var rarities = new HashSet<string>();
            long weight = 0;
            foreach (var group in config.groups)
            {
                int count;
                if (group == null || group.rarity == null || !counts.TryGetValue(group.rarity, out count) || !rarities.Add(group.rarity)
                    || group.cardIds == null || group.cardIds.Length != count || group.weight <= 0 || group.weight > 10000
                    || group.duplicateShards < 0 || group.duplicateShards > 10000)
                    throw new ArgumentException("奖池必须为 4 普通 + 3 稀有 + 1 史诗 + 1 传说 + 1 特殊。");
                weight += group.weight;
                foreach (var id in group.cardIds)
                {
                    CardDefinition card;
                    if (id == null || groupsByCard.ContainsKey(id) || !cards.TryGetValue(id, out card) || card.rarity != group.rarity)
                        throw new ArgumentException("奖池卡牌缺失、重复或品质不匹配：" + id);
                    groupsByCard.Add(id, group);
                }
            }
            if (weight != 10000 || config.milestones == null || config.milestones.Length == 0)
                throw new ArgumentException("抽卡权重之和必须为 10000，且必须有整套保底。");
            int lastCost = 0, lastCount = 0;
            foreach (var milestone in config.milestones)
            {
                if (milestone == null || milestone.spent <= lastCost || milestone.spent % config.bundlePrice != 0
                    || milestone.spent > config.testCredit || milestone.uniqueCards <= lastCount || milestone.uniqueCards > 10)
                    throw new ArgumentException("保底里程碑必须依次递增，并对齐五连抽金额。");
                lastCost = milestone.spent; lastCount = milestone.uniqueCards;
            }
            if (lastCost != config.testCredit || lastCount != 10) throw new ArgumentException("最终保底必须补齐 10 张卡。");
        }

        public GachaState NewState(int revision = 0)
        {
            if (revision < 0) throw new ArgumentException("存档版本无效。");
            return new GachaState { poolId = config.poolId, revision = revision };
        }
        public int Spent(GachaState state) { return state.bundles * config.bundlePrice; }
        public int Remaining(GachaState state) { return config.testCredit - Spent(state); }
        public bool Complete(GachaState state) { return state.owned.Count == 10; }
        public void ValidateState(GachaState state)
        {
            if (state == null || state.schemaVersion != 1 || state.poolId != config.poolId || state.revision < 0
                || state.bundles < 0 || state.bundles > config.testCredit / config.bundlePrice
                || state.owned == null || state.lastRewards == null || state.owned.Count > 10 || state.lastRewards.Count > 15)
                throw new ArgumentException("抽卡存档不兼容或损坏，请明确重置此 Demo 后再试。");
            var ids = new HashSet<string>();
            foreach (var entry in state.owned)
            {
                if (entry == null || entry.cardId == null || !groupsByCard.ContainsKey(entry.cardId) || !ids.Add(entry.cardId)
                    || entry.shards < 0 || (long)entry.shards > (long)state.bundles * config.bundleSize * groupsByCard[entry.cardId].duplicateShards)
                    throw new ArgumentException("抽卡存档卡牌或碎片无效。");
            }
            foreach (var reward in state.lastRewards)
                if (reward == null || reward.cardId == null || !ids.Contains(reward.cardId) || reward.shards < 0
                    || (reward.isNew && reward.shards != 0) || (reward.guarantee && !reward.isNew)
                    || (!reward.isNew && reward.shards != groupsByCard[reward.cardId].duplicateShards))
                    throw new ArgumentException("抽卡存档奖励无效。");
            int minimum = config.milestones.Where(m => m.spent <= Spent(state)).Select(m => m.uniqueCards).DefaultIfEmpty(0).Max();
            if ((state.bundles == 0 && (ids.Count != 0 || state.lastRewards.Count != 0))
                || (state.bundles > 0 && (ids.Count == 0 || state.lastRewards.Count < 5)) || ids.Count < minimum)
                throw new ArgumentException("抽卡存档收集进度无效。");
        }

        public GachaState Draw(GachaState previous, Func<int, int> nextInt)
        {
            ValidateState(previous);
            if (nextInt == null) throw new ArgumentNullException("nextInt");
            if (Complete(previous) || Remaining(previous) < config.bundlePrice) throw new InvalidOperationException("本期 Demo 已完成，请重置测试再体验。");
            // Construct a new transaction result. A random or save failure never mutates the old inventory.
            var result = new GachaState { poolId = previous.poolId, revision = checked(previous.revision + 1), bundles = previous.bundles + 1,
                owned = previous.owned.Select(c => new GachaOwnedCard { cardId = c.cardId, shards = c.shards }).ToList() };
            for (int i = 0; i < config.bundleSize; i++)
            {
                int roll = Roll(nextInt, 10000);
                var group = config.groups[0];
                foreach (var candidate in config.groups)
                {
                    group = candidate;
                    if (roll < candidate.weight) break;
                    roll -= candidate.weight;
                }
                Award(result, group.cardIds[Roll(nextInt, group.cardIds.Length)], false);
            }
            int minimum = config.milestones.Where(m => m.spent <= Spent(result)).Select(m => m.uniqueCards).DefaultIfEmpty(0).Max();
            while (result.owned.Count < minimum)
            {
                // Extra rewards, not replacements of the five draws. Missing cards retain their relative base weights.
                var missing = groupsByCard.Keys.Where(id => result.owned.All(c => c.cardId != id)).ToArray();
                int total = missing.Sum(id => groupsByCard[id].weight * (12 / groupsByCard[id].cardIds.Length));
                int roll = Roll(nextInt, total);
                foreach (var id in missing)
                {
                    int weight = groupsByCard[id].weight * (12 / groupsByCard[id].cardIds.Length);
                    if (roll < weight) { Award(result, id, true); break; }
                    roll -= weight;
                }
            }
            return result;
        }
        private static int Roll(Func<int, int> nextInt, int bound)
        {
            int value = nextInt(bound);
            if (value < 0 || value >= bound) throw new ArgumentException("随机数超出范围。");
            return value;
        }
        private void Award(GachaState state, string id, bool guarantee)
        {
            var owned = state.owned.FirstOrDefault(c => c.cardId == id);
            int shards = owned == null ? 0 : groupsByCard[id].duplicateShards;
            state.lastRewards.Add(new GachaReward { cardId = id, isNew = owned == null, shards = shards, guarantee = guarantee });
            if (owned == null) state.owned.Add(new GachaOwnedCard { cardId = id });
            else owned.shards = checked(owned.shards + shards);
        }
    }
}
