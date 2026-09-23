using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    [Serializable] public sealed class GachaProfile
    {
        public int schemaVersion = 1;
        public int revision;
        // Null distinguishes a legacy single-period save from the new profile during deserialization.
        public List<GachaState> pools;
        public List<GachaState> archivedRuns;
    }

    // One profile owns every pool and the shared wallet. Persist the whole transaction atomically.
    public static class GachaProfiles
    {
        public static GachaProfile New() { return new GachaProfile { pools = new List<GachaState>(), archivedRuns = new List<GachaState>() }; }
        public static GachaState Current(GachaProfile profile, string poolId) { return profile.pools.Single(p => p.poolId == poolId); }
        private static IEnumerable<GachaState> All(GachaProfile profile) { return profile.pools.Concat(profile.archivedRuns); }
        public static int UniversalBalance(GachaProfile profile)
        {
            Validate(profile);
            return checked((int)All(profile).Sum(p => (long)(p.conversion == null ? 0 : p.conversion.universalShards)
                - (p.exchanges ?? new List<GachaExchange>()).Sum(e => (long)e.universalUsed)));
        }
        public static void Validate(GachaProfile profile)
        {
            if (profile == null || profile.schemaVersion != 1 || profile.revision < 0 || profile.pools == null || profile.archivedRuns == null
                || profile.pools.Count > 1000 || profile.archivedRuns.Count > 10000)
                throw new ArgumentException("通用碎片存档无效。");
            var ids = new HashSet<string>();
            foreach (var state in profile.pools)
                if (state == null || !ids.Add(state.poolId)) throw new ArgumentException("奖池存档重复或缺失。");
            long balance = 0;
            foreach (var state in All(profile))
            {
                GachaDemo.ValidateLedger(state);
                balance += state.conversion == null ? 0 : state.conversion.universalShards;
                balance -= (state.exchanges ?? new List<GachaExchange>()).Sum(e => (long)e.universalUsed);
            }
            if (balance < 0 || balance > int.MaxValue) throw new ArgumentException("通用碎片余额无效。");
        }
        private static GachaProfile Copy(GachaProfile profile)
        {
            Validate(profile);
            // Period states are immutable transactions. Retain inactive snapshots; only replace the active one.
            return new GachaProfile { revision = profile.revision, pools = profile.pools.ToList(), archivedRuns = profile.archivedRuns.ToList() };
        }
        public static GachaProfile Open(GachaProfile previous, GachaDemo engine, string poolId, GachaState legacy, out bool converted)
        {
            var result = Copy(previous);
            var old = result.pools.SingleOrDefault(p => p.poolId == poolId);
            var restored = engine.RestoreState(old ?? legacy ?? engine.NewState());
            converted = restored.conversion != null && (old ?? legacy)?.conversion == null;
            if (old == null) result.pools.Add(restored);
            else result.pools[result.pools.IndexOf(old)] = restored;
            if (converted) result.revision = checked(result.revision + 1);
            Validate(result); return result;
        }
        public static GachaProfile Draw(GachaProfile previous, GachaDemo engine, string poolId, Func<int, int> random)
        {
            var result = Copy(previous);
            int index = result.pools.FindIndex(p => p.poolId == poolId);
            if (index < 0) throw new ArgumentException("奖池不存在。");
            result.pools[index] = engine.Draw(result.pools[index], random);
            result.revision = checked(result.revision + 1); Validate(result); return result;
        }
        public static GachaProfile Exchange(GachaProfile previous, GachaDemo engine, string poolId, string cardId, int confirmedUniversal)
        {
            var result = Copy(previous);
            int index = result.pools.FindIndex(p => p.poolId == poolId);
            if (index < 0) throw new ArgumentException("奖池不存在。");
            int universal = UniversalBalance(previous);
            var quote = engine.Quote(result.pools[index], cardId, universal);
            if (quote.universalUsed != confirmedUniversal) throw new InvalidOperationException("碎片构成已变化，请重新确认兑换。");
            result.pools[index] = engine.Exchange(result.pools[index], poolId, cardId, universal);
            result.revision = checked(result.revision + 1); Validate(result); return result;
        }
        public static GachaProfile Reset(GachaProfile previous, GachaDemo engine, string poolId)
        {
            var result = Copy(previous);
            int index = result.pools.FindIndex(p => p.poolId == poolId);
            if (index < 0) throw new ArgumentException("奖池不存在。");
            // Keep the old wallet debits/credits: resetting a demo must not refund spent universal shards.
            var old = result.pools[index]; result.archivedRuns.Add(old);
            result.pools[index] = engine.NewState(checked(old.revision + 1));
            result.revision = checked(result.revision + 1); Validate(result); return result;
        }
    }
}
