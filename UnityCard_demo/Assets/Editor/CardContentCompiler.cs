using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using CardDemo.Core;

namespace CardDemo.ConfigTools
{
    public sealed class CompiledCardContent
    {
        public string CardLua;
        public string CatalogJson;
        public CardCatalog Catalog;
        public Dictionary<string, string> Camps;
        public int Count;
    }

    public static class CardContentCompiler
    {
        // Provenance of the original migration, not another editable source of card data.
        private const string SourceSchema = "card-info-v2-description-effects-20260916";
        private const string Usage = "Reference only. Production skills are not implemented in this demo.";

        public static CompiledCardContent Compile(string cardsCsv)
        {
            var rows = PresentationTableCompiler.ReadCsv(cardsCsv, PresentationWorkbook.CardHeaders);
            if (rows.Count == 0) throw new FormatException("卡牌表不能为空。");
            var camps = new Dictionary<string, string>(StringComparer.Ordinal);
            var defaults = new SortedDictionary<int, string>();
            var cards = new List<CardDefinition>();
            var defaultOrders = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var row in rows)
            {
                if (row.Any(string.IsNullOrWhiteSpace)) throw new FormatException("卡牌表存在空字段。");
                // This project uses fixed five-digit formal card IDs. Never guess lost leading zeros.
                if (!Regex.IsMatch(row[0], @"\A0[1-3][1-5][0-9]{2}\z")) throw new FormatException("正式卡牌 ID 格式错误（需保留前导零）：" + row[0]);
                if (camps.ContainsKey(row[0])) throw new FormatException("重复卡牌 ID：" + row[0]);
                int power, order;
                if (!int.TryParse(row[4], NumberStyles.None, CultureInfo.InvariantCulture, out power) || power < 0 || power > 99)
                    throw new FormatException(row[0] + "：基础战力必须是 0~99 的整数。");
                if (!int.TryParse(row[7], NumberStyles.None, CultureInfo.InvariantCulture, out order) || order < 0 || order > 50000)
                    throw new FormatException(row[0] + "：默认顺序必须是 0~50000 的整数。");
                if (order > 0)
                {
                    if (defaults.ContainsKey(order)) throw new FormatException("默认卡组顺序重复：" + order);
                    defaults.Add(order, row[0]);
                }
                if (!new[] { "普通", "稀有", "史诗", "传说", "特殊" }.Contains(row[3]))
                    throw new FormatException(row[0] + "：未知品质 " + row[3]);
                if (row[2] != row[2].Trim() || row[2].Any(char.IsControl)) throw new FormatException(row[0] + "：势力标识格式错误。");
                camps.Add(row[0], row[2]); defaultOrders.Add(row[0], order);
                cards.Add(new CardDefinition { id = row[0], name = row[1], camp = row[2], rarity = row[3], baseAttack = power,
                    skill = row[5], effect = row[6].Replace("\r\n", "\n").Replace("\n", "\r\n") });
            }
            if (!defaults.Keys.SequenceEqual(Enumerable.Range(1, defaults.Count)))
                throw new FormatException("默认卡组顺序应从 1 连续编号；不属于默认卡组的卡填 0。");
            var catalog = new CardCatalog { schemaVersion = 1, sourceSchema = SourceSchema, usage = Usage,
                defaultCardIds = defaults.Values.ToArray(), cards = cards.ToArray() };
            var lua = new StringBuilder("-- Generated from ConfigTables/Card Basics.xlsx. Schema: 1\nreturn {\n");
            foreach (var card in cards.OrderBy(c => c.id, StringComparer.Ordinal))
                lua.Append("  [").Append(Quote(card.id)).Append("] = { cardId = ").Append(Quote(card.id))
                    .Append(", cardName = ").Append(Quote(card.name)).Append(", camp = ").Append(Quote(card.camp))
                    .Append(", rarity = ").Append(Quote(card.rarity)).Append(", baseAttack = ").Append(card.baseAttack)
                    .Append(", skill = ").Append(Quote(card.skill)).Append(", effect = ").Append(Quote(card.effect))
                    .Append(", defaultOrder = ").Append(defaultOrders[card.id]).Append(", },\n");
            var json = new StringBuilder("{\n  \"schemaVersion\": 1,\n  \"sourceSchema\": ").Append(Quote(SourceSchema))
                .Append(",\n  \"usage\": ").Append(Quote(Usage)).Append(",\n  \"defaultCardIds\": [\n    ")
                .Append(string.Join(",\n    ", catalog.defaultCardIds.Select(Quote))).Append("\n  ],\n  \"cards\": [\n");
            for (int i = 0; i < cards.Count; i++)
            {
                var c = cards[i];
                json.Append("    {\n      \"id\": ").Append(Quote(c.id)).Append(",\n      \"name\": ").Append(Quote(c.name))
                    .Append(",\n      \"camp\": ").Append(Quote(c.camp)).Append(",\n      \"rarity\": ").Append(Quote(c.rarity))
                    .Append(",\n      \"baseAttack\": ").Append(c.baseAttack).Append(",\n      \"skill\": ").Append(Quote(c.skill))
                    .Append(",\n      \"effect\": ").Append(Quote(c.effect)).Append("\n    }").Append(i + 1 < cards.Count ? ",\n" : "\n");
            }
            return new CompiledCardContent { CardLua = lua.Append("}\n").ToString(), CatalogJson = json.Append("  ]\n}\n").ToString(),
                Catalog = catalog, Camps = camps, Count = cards.Count };
        }

        private static string Quote(string text)
        {
            if (text.Any(c => c < ' ' && c != '\n' && c != '\r' && c != '\t')) throw new FormatException("配置含不允许的控制字符。");
            return "\"" + text.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n").Replace("\t", "\\t") + "\"";
        }
    }
}
