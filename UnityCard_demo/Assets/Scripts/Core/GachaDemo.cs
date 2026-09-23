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
        public int exchangeCost;
        public string[] cardIds;
    }
    [Serializable] public sealed class GachaMilestone { public int spent; public int uniqueCards; }
    [Serializable] public sealed class GachaConfig
    {
        public int schemaVersion;
        public string poolId;
        public string title;
        public string shardName;
        public int bundlePrice;
        public int bundleSize;
        public int testCredit;
        public int targetAverageCost;
        public GachaGroup[] groups;
        public GachaMilestone[] milestones;
    }
    [Serializable] public sealed class GachaOwnedCard { public string cardId; public int shards; }
    [Serializable] public sealed class GachaExchange { public string cardId; public int cost; public int universalUsed; }
    [Serializable] public sealed class GachaConversion { public int sourceShards; public int universalShards; }
    [Serializable] public sealed class GachaShardGrant { public int bundles; public int amount; }
    [Serializable] public sealed class GachaQuote { public string cardId; public int cost; public int poolUsed; public int universalUsed; public bool canAfford; }
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
        // Schema 1-4 always describe ten-card pools. New pools retain their own size in the ledger.
        public int poolCardCount;
        public int revision;
        public int bundles;
        public List<GachaOwnedCard> owned = new List<GachaOwnedCard>();
        public List<GachaReward> lastRewards = new List<GachaReward>();
        public List<GachaExchange> exchanges = new List<GachaExchange>();
        public List<GachaShardGrant> shardGrants = new List<GachaShardGrant>();
        // Unity's inline class serialization can materialize null as a zero-valued object.
        public bool conversionDone;
        public GachaConversion conversion;
    }

    // Free prototype rules. Web runs this inside a private server worker; Unity runs it locally.
    // Real payments are not implemented. Every frontend uses this implementation, not client-supplied odds.
    public sealed class GachaDemo
    {
        private readonly GachaConfig config;
        private readonly Dictionary<string, GachaGroup> groupsByCard = new Dictionary<string, GachaGroup>(StringComparer.Ordinal);
        public int CardCount { get { return groupsByCard.Count; } }
        public GachaDemo(GachaConfig config, IEnumerable<CardDefinition> catalog)
        {
            if (config == null || catalog == null) throw new ArgumentException("抽卡配置或卡牌资料缺失。");
            this.config = config;
            var cards = catalog.ToDictionary(c => c.id, StringComparer.Ordinal);
            if (config.schemaVersion != 1 || !GachaSaveFile.IsPoolId(config.poolId) || string.IsNullOrWhiteSpace(config.title)
                || string.IsNullOrWhiteSpace(config.shardName)
                || config.bundleSize != 5 || config.bundlePrice <= 0 || config.testCredit <= 0 || config.testCredit > 100000
                || config.testCredit % config.bundlePrice != 0 || config.groups == null || config.groups.Length != 5)
                throw new ArgumentException("抽卡参数无效，Demo 仅支持五连抽和完整测试额度。");
            var counts = new Dictionary<string, int> { { "普通", 4 }, { "稀有", 3 }, { "史诗", 1 }, { "传说", 1 }, { "特殊", 1 } };
            int cardCount = config.groups.Sum(g => g == null || g.cardIds == null ? 0 : g.cardIds.Length);
            int sets = cardCount / 10;
            if (cardCount % 10 != 0 || sets < 1 || sets > 3) throw new ArgumentException("奖池须包含 1～3 组完整的十张额外卡。");
            var rarities = new HashSet<string>();
            long weight = 0;
            foreach (var group in config.groups)
            {
                int count;
                if (group == null || group.rarity == null || !counts.TryGetValue(group.rarity, out count) || !rarities.Add(group.rarity)
                    || group.cardIds == null || group.cardIds.Length != count * sets || group.weight <= 0 || group.weight > 10000
                    || group.duplicateShards < 0 || group.duplicateShards > 10000 || group.exchangeCost <= 0 || group.exchangeCost > 1000000)
                    throw new ArgumentException("奖池各品质数量须同比例为 4 普通 + 3 稀有 + 1 史诗 + 1 传说 + 1 特殊。");
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
                    || milestone.spent > config.testCredit || milestone.uniqueCards < lastCount || milestone.uniqueCards < 1 || milestone.uniqueCards > CardCount)
                    throw new ArgumentException("保底金额必须递增，目标卡数不能递减，并对齐五连抽金额。");
                lastCost = milestone.spent; lastCount = milestone.uniqueCards;
            }
            if (lastCost != config.testCredit || lastCount != CardCount) throw new ArgumentException("最终保底必须补齐本期全部 " + CardCount + " 张卡。");
        }

        public GachaState NewState(int revision = 0)
        {
            if (revision < 0) throw new ArgumentException("存档版本无效。");
            return new GachaState { schemaVersion = 5, poolId = config.poolId, poolCardCount = CardCount, revision = revision };
        }
        public int Spent(GachaState state) { return state.bundles * config.bundlePrice; }
        public int Remaining(GachaState state) { return config.testCredit - Spent(state); }
        public bool Complete(GachaState state) { return state.owned.Count == CardCount; }
        // Per-card shards retain lifetime earnings for legacy compatibility; only this pool's ledger is spendable.
        public int ShardBalance(GachaState state)
        {
            ValidateState(state);
            return checked((int)PoolBalance(state));
        }
        private static long PoolBalance(GachaState state)
        {
            return state.owned.Sum(c => (long)c.shards) + (state.shardGrants ?? new List<GachaShardGrant>()).Sum(g => (long)g.amount)
                - (state.exchanges ?? new List<GachaExchange>()).Sum(e => (long)e.cost - e.universalUsed)
                - (state.conversion == null ? 0 : state.conversion.sourceShards);
        }
        public int ExchangeCost(string cardId)
        {
            GachaGroup group;
            if (cardId == null || !groupsByCard.TryGetValue(cardId, out group)) throw new ArgumentException("卡牌不属于本期奖池。");
            return group.exchangeCost;
        }
        public GachaState RestoreState(GachaState previous)
        {
            ValidateState(previous);
            var result = Copy(previous); Settle(result); return result;
        }
        private GachaState Copy(GachaState previous)
        {
            return new GachaState { schemaVersion = 5, poolId = previous.poolId, poolCardCount = CardCount, revision = previous.revision, bundles = previous.bundles,
                owned = previous.owned.Select(c => new GachaOwnedCard { cardId = c.cardId, shards = c.shards }).ToList(),
                lastRewards = previous.lastRewards.Select(r => new GachaReward { cardId = r.cardId, isNew = r.isNew, shards = r.shards, guarantee = r.guarantee }).ToList(),
                exchanges = (previous.exchanges ?? new List<GachaExchange>()).Select(e => new GachaExchange { cardId = e.cardId, cost = e.cost, universalUsed = e.universalUsed }).ToList(),
                // Old milestones already awarded cards. Mark them settled without awarding fragments again.
                shardGrants = previous.schemaVersion < 4
                    ? config.milestones.Where(m => m.spent <= Spent(previous)).Select(m => new GachaShardGrant { bundles = m.spent / config.bundlePrice }).ToList()
                    : previous.shardGrants.Select(g => new GachaShardGrant { bundles = g.bundles, amount = g.amount }).ToList(),
                conversionDone = previous.conversion != null,
                conversion = previous.conversion == null ? null : new GachaConversion { sourceShards = previous.conversion.sourceShards, universalShards = previous.conversion.universalShards } };
        }
        public GachaQuote Quote(GachaState state, string cardId, int universalAvailable)
        {
            ValidateState(state);
            if (universalAvailable < 0) throw new ArgumentException("通用碎片余额无效。");
            int cost = ExchangeCost(cardId), poolUsed = Math.Min(cost, ShardBalance(state));
            return new GachaQuote { cardId = cardId, cost = cost, poolUsed = poolUsed, universalUsed = cost - poolUsed,
                canAfford = !state.owned.Any(c => c.cardId == cardId) && (long)poolUsed + universalAvailable >= cost };
        }
        public GachaState Exchange(GachaState previous, string poolId, string cardId, int universalAvailable = 0)
        {
            ValidateState(previous);
            if (poolId != config.poolId) throw new ArgumentException("不能使用其他期的碎片兑换本期卡牌。");
            var quote = Quote(previous, cardId, universalAvailable);
            if (previous.owned.Any(c => c.cardId == cardId)) throw new InvalidOperationException("已拥有该卡牌，无需重复兑换。");
            if (!quote.canAfford) throw new InvalidOperationException("本期碎片与通用碎片合计不足。");
            var result = Copy(previous);
            result.revision = checked(result.revision + 1);
            result.owned.Add(new GachaOwnedCard { cardId = cardId });
            result.exchanges.Add(new GachaExchange { cardId = cardId, cost = quote.cost, universalUsed = quote.universalUsed });
            // An exchange is not a draw: preserve bundle count, milestones and the replayable last draw.
            Settle(result); ValidateState(result);
            return result;
        }
        public void ValidateState(GachaState state)
        {
            ValidateLedger(state);
            if (state.poolId != config.poolId || LedgerCardCount(state) != CardCount || state.revision < 0
                || state.bundles < 0 || state.bundles > config.testCredit / config.bundlePrice
                || state.owned == null || state.lastRewards == null || state.owned.Count > CardCount || state.lastRewards.Count > config.bundleSize + CardCount
                || (state.schemaVersion >= 2 && state.exchanges == null)
                || (state.schemaVersion == 1 && state.exchanges != null && state.exchanges.Count != 0))
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
            var exchangedIds = new HashSet<string>();
            long spentShards = 0, earnedShards = state.owned.Sum(c => (long)c.shards)
                + (state.shardGrants ?? new List<GachaShardGrant>()).Sum(g => (long)g.amount);
            foreach (var exchange in state.exchanges ?? new List<GachaExchange>())
            {
                if (exchange == null || exchange.cardId == null || !ids.Contains(exchange.cardId) || !exchangedIds.Add(exchange.cardId)
                    || exchange.cost <= 0 || exchange.cost > 1000000)
                    throw new ArgumentException("本期碎片兑换记录无效。");
                // Store the paid price so a future price change never rewrites historical spending.
                spentShards += exchange.cost - exchange.universalUsed;
            }
            if (spentShards > earnedShards || earnedShards > int.MaxValue)
                throw new ArgumentException("本期碎片余额无效。");
            int minimum = config.milestones.Where(m => m.spent <= Spent(state)).Select(m => m.uniqueCards).DefaultIfEmpty(0).Max();
            if (state.schemaVersion >= 4 && (state.shardGrants.Count != config.milestones.Count(m => m.spent <= Spent(state))
                || state.shardGrants.Any(g => !config.milestones.Any(m => m.spent == g.bundles * (long)config.bundlePrice)
                    || g.amount > groupsByCard.Values.Sum(group => (long)group.exchangeCost))))
                throw new ArgumentException("保底碎片记录无效。");
            if ((state.bundles == 0 && (ids.Count != exchangedIds.Count || state.lastRewards.Count != 0 || earnedShards != 0))
                || (state.bundles > 0 && (ids.Count == 0 || state.lastRewards.Count < 5)) || (state.schemaVersion < 4 && ids.Count < minimum))
                throw new ArgumentException("抽卡存档收集进度无效。");
            if (state.schemaVersion >= 4 && Spent(state) == config.testCredit && !Complete(state)
                && PoolBalance(state) < groupsByCard.Keys.Where(id => !ids.Contains(id)).Sum(ExchangeCost))
                throw new ArgumentException("最终保底碎片不足以兑换全部缺卡。");
        }

        public GachaState Draw(GachaState previous, Func<int, int> nextInt)
        {
            ValidateState(previous);
            if (nextInt == null) throw new ArgumentNullException("nextInt");
            if (Complete(previous) || Remaining(previous) < config.bundlePrice) throw new InvalidOperationException("本期抽取已结束，请使用碎片兑换缺卡或重置测试。");
            // Construct a new transaction result. A random or save failure never mutates the old inventory.
            var result = Copy(previous);
            result.revision = checked(result.revision + 1); result.bundles++;
            result.lastRewards.Clear();
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
            foreach (var milestone in config.milestones.Where(m => m.spent == Spent(result)))
            {
                // Settle each checkpoint once, AFTER the five draws. Fund the cheapest missing cards
                // up to the internal collection target; never auto-award a card or touch universal currency.
                int needed = Math.Max(0, milestone.uniqueCards - result.owned.Count);
                int cost = groupsByCard.Keys.Where(id => result.owned.All(c => c.cardId != id))
                    .Select(ExchangeCost).OrderBy(value => value).Take(needed).Sum();
                int amount = checked((int)Math.Max(0, cost - PoolBalance(result)));
                result.shardGrants.Add(new GachaShardGrant { bundles = result.bundles, amount = amount });
            }
            // The final checkpoint funds ALL remaining cards. Actual collection still requires exchange.
            Settle(result);
            ValidateState(result);
            return result;
        }
        private void Settle(GachaState state)
        {
            if (!Complete(state) || state.conversion != null) return;
            int remaining = ShardBalance(state);
            state.conversion = new GachaConversion { sourceShards = remaining, universalShards = remaining / 10 };
            state.conversionDone = true;
        }
        // Configuration-independent ledger checks also protect saved, currently inactive periods.
        private static int LedgerCardCount(GachaState state) { return state.schemaVersion >= 5 ? state.poolCardCount : 10; }
        public static void ValidateLedger(GachaState state)
        {
            if (state == null || state.schemaVersion < 1 || state.schemaVersion > 5 || !GachaSaveFile.IsPoolId(state.poolId)
                || state.revision < 0 || state.bundles < 0 || state.owned == null || state.lastRewards == null
                || LedgerCardCount(state) < 10 || LedgerCardCount(state) > 30 || LedgerCardCount(state) % 10 != 0
                || state.owned.Count > LedgerCardCount(state) || state.lastRewards.Count > LedgerCardCount(state) + 5
                || (state.schemaVersion >= 2 && state.exchanges == null))
                throw new ArgumentException("奖池账本无效。");
            var ids = new HashSet<string>();
            long earned = 0, localSpent = 0;
            if ((state.schemaVersion >= 4 && state.shardGrants == null)
                || (state.schemaVersion < 4 && state.shardGrants != null && state.shardGrants.Count != 0))
                throw new ArgumentException("保底碎片账本不兼容。");
            var grantBundles = new HashSet<int>();
            foreach (var grant in state.shardGrants ?? new List<GachaShardGrant>())
            {
                if (grant == null || grant.bundles <= 0 || grant.bundles > state.bundles || !grantBundles.Add(grant.bundles)
                    || grant.amount < 0 || grant.amount > 10000000) throw new ArgumentException("保底碎片账本无效。");
                earned += grant.amount;
            }
            foreach (var card in state.owned)
            {
                if (card == null || string.IsNullOrEmpty(card.cardId) || !ids.Add(card.cardId) || card.shards < 0) throw new ArgumentException("奖池卡牌账本无效。");
                earned += card.shards;
            }
            var exchanged = new HashSet<string>();
            foreach (var entry in state.exchanges ?? new List<GachaExchange>())
            {
                if (entry == null || entry.cardId == null || !ids.Contains(entry.cardId) || !exchanged.Add(entry.cardId)
                    || entry.cost <= 0 || entry.cost > 1000000 || entry.universalUsed < 0 || entry.universalUsed > entry.cost
                    || (state.schemaVersion < 3 && entry.universalUsed != 0) || state.schemaVersion == 1)
                    throw new ArgumentException("碎片支付记录无效。");
                localSpent += entry.cost - entry.universalUsed;
            }
            long remaining = earned - localSpent;
            if (remaining < 0 || earned > int.MaxValue) throw new ArgumentException("本期碎片余额无效。");
            if (state.conversion != null && (state.schemaVersion < 3 || state.owned.Count != LedgerCardCount(state)
                || state.conversion.sourceShards != remaining || state.conversion.universalShards != remaining / 10))
                throw new ArgumentException("集齐转化记录无效。");
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
