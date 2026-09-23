using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    // Card definitions are not ownership. Only saved acquisition records unlock extra cards.
    public static class GachaInventory
    {
        public static string[] OwnedExtraCardIds(GachaProfile profile, GachaConfig config)
        {
            GachaProfiles.Validate(profile);
            var extras = new HashSet<string>(config.groups.SelectMany(group => group.cardIds));
            return profile.pools.Concat(profile.archivedRuns).SelectMany(pool => pool.owned)
                .Select(card => card.cardId).Where(extras.Contains).Distinct().ToArray();
        }

        public static void ValidatePlayerDeck(IEnumerable<CardDefinition> deck, GachaProfile profile, GachaConfig config)
        {
            var extras = new HashSet<string>(config.groups.SelectMany(group => group.cardIds));
            var owned = new HashSet<string>(OwnedExtraCardIds(profile, config));
            var locked = deck.Where(card => extras.Contains(card.id) && !owned.Contains(card.id)).ToArray();
            if (locked.Length > 0) throw new InvalidOperationException("卡组包含尚未获得的额外卡：" + string.Join("、", locked.Select(card => card.name)) + "。请先招募或兑换。");
        }
    }
}
