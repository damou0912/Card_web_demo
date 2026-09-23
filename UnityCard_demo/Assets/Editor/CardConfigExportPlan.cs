using System;
using System.Collections.Generic;
using System.IO;
using CardDemo.Core;

namespace CardDemo.ConfigTools
{
    // Build the entire plan before writing. Excel is authoritative; Resources are outputs.
    public sealed class CardConfigExportPlan
    {
        public readonly Dictionary<string, string> Outputs = new Dictionary<string, string>(StringComparer.Ordinal);
        public int CardCount;
        public int BadgeCount;

        public static CardConfigExportPlan Build(string root, Func<string, CardCatalog> readCatalog,
            Func<string, bool> spriteExists, string overrideWorkbook = null)
        {
            string tables = Path.Combine(root, "ConfigTables");
            var replacement = overrideWorkbook == null ? null : PresentationWorkbook.Read(overrideWorkbook);
            var cards = replacement != null && replacement.IsCardWorkbook ? replacement
                : PresentationWorkbook.Read(Path.Combine(tables, PresentationWorkbook.CardFileName));
            var icons = replacement != null && !replacement.IsCardWorkbook ? replacement
                : PresentationWorkbook.Read(Path.Combine(tables, PresentationWorkbook.BadgeFileName));
            if (!cards.IsCardWorkbook || icons.IsCardWorkbook)
                throw new FormatException("Card Basics.xlsx 必须含 Card Basics 工作表；Faction Icons.xlsx 必须含 Faction Icons 工作表。");
            var content = CardContentCompiler.Compile(cards.CardsCsv);
            var camps = new Dictionary<string, string>(content.Camps, StringComparer.Ordinal);
            foreach (string name in new[] { "demo-cards", "workshop-library" })
            {
                var catalog = readCatalog(Path.Combine(root, "Assets/Resources/Data/" + name + ".json"));
                foreach (var card in catalog.cards)
                {
                    if (camps.ContainsKey(card.id)) throw new FormatException("卡牌资料中存在重复 ID：" + card.id);
                    camps.Add(card.id, card.camp);
                }
            }
            var badges = PresentationTableCompiler.CompileForCatalog(icons.BadgeCsv, content.Catalog.cards, spriteExists);
            var result = new CardConfigExportPlan { CardCount = content.Count, BadgeCount = badges.Tables.BadgeCount };
            string directory = Path.Combine(root, "Assets/Resources/Config/CardPresentation");
            result.Outputs.Add(Path.Combine(directory, "country-badges.lua"), badges.BadgeLua);
            result.Outputs.Add(Path.Combine(directory, "cards.lua"), content.CardLua);
            result.Outputs.Add(Path.Combine(root, "Assets/Resources/Data/web-card-catalog.json"), content.CatalogJson);
            return result;
        }
    }
}
