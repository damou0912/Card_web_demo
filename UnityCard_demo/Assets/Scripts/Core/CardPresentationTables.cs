using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace CardDemo.Core
{
    public sealed class CountryBadgeDefinition
    {
        public string Camp { get; private set; }
        public string DisplayName { get; private set; }
        public string SpritePath { get; private set; }
        internal CountryBadgeDefinition(string camp, string name, string path)
        { Camp = camp; DisplayName = name; SpritePath = path; }
    }

    // Card ID locates presentation data. The actual faction determines the image.
    // A stale/conflicting presentation faction must never display a different country's badge.
    public sealed class CardPresentationTables
    {
        public const string BadgeResource = "Config/CardPresentation/country-badges";
        public const string CardResource = "Data/web-card-catalog";
        internal static readonly string[] BadgeColumns = { "camp", "displayName", "spritePath" };
        internal static readonly string[] CardColumns = { "cardId", "cardName", "camp" };
        private readonly Dictionary<string, CountryBadgeDefinition> badges = new Dictionary<string, CountryBadgeDefinition>(StringComparer.Ordinal);
        private readonly Dictionary<string, string> cardCamps = new Dictionary<string, string>(StringComparer.Ordinal);
        public int BadgeCount { get { return badges.Count; } }
        public int CardCount { get { return cardCamps.Count; } }

        public CardPresentationTables(string badgeLua, string cardLua) : this(badgeLua,
            LuaStringTable.Read(cardLua).Select(row => {
                ValidateRow(row, CardColumns);
                return new CardDefinition { id = row.Key, camp = row.Value["camp"] };
            })) { }

        public CardPresentationTables(string badgeLua, IEnumerable<CardDefinition> cards)
        {
            var badgeRows = LuaStringTable.Read(badgeLua);
            foreach (var row in badgeRows)
            {
                ValidateRow(row, BadgeColumns);
                string id = row.Key;
                RequireCamp(id);
                string name = row.Value["displayName"], path = row.Value["spritePath"];
                if (string.IsNullOrWhiteSpace(name)) throw new FormatException("角标名称不能为空：" + id);
                RequireResourcePath(path);
                badges.Add(id, new CountryBadgeDefinition(id, name, path));
            }
            foreach (var card in cards)
            {
                RequireId(card.id, "卡牌 ID");
                string camp = card.camp;
                RequireCamp(camp);
                if (!badges.ContainsKey(camp))
                    throw new FormatException("卡牌 " + card.id + " 的势力没有对应的国度角标：" + camp);
                if (cardCamps.ContainsKey(card.id)) throw new FormatException("重复卡牌 ID：" + card.id);
                cardCamps.Add(card.id, camp);
            }
        }

        public bool TryGetBadge(string cardId, string actualCamp, out CountryBadgeDefinition badge)
        {
            badge = null;
            string configuredCamp;
            return cardId != null && !string.IsNullOrWhiteSpace(actualCamp)
                && cardCamps.TryGetValue(cardId, out configuredCamp)
                && string.Equals(configuredCamp, actualCamp, StringComparison.Ordinal)
                && badges.TryGetValue(actualCamp, out badge);
        }

        public void ValidateAgainstCatalog(IDictionary<string, string> actualCardCamps)
        {
            if (actualCardCamps == null) throw new ArgumentNullException("actualCardCamps");
            foreach (var card in cardCamps)
            {
                string actual;
                if (!actualCardCamps.TryGetValue(card.Key, out actual))
                    throw new FormatException("表现表中的卡牌 ID 不在卡牌资料中：" + card.Key);
                if (!string.Equals(actual, card.Value, StringComparison.Ordinal))
                    throw new FormatException("势力不一致：卡牌 " + card.Key + " 实际为「" + actual
                        + "」，表现表却为「" + card.Value + "」。请同步正确的势力。");
            }
            foreach (var card in actualCardCamps)
                if (card.Value != null && badges.ContainsKey(card.Value) && !cardCamps.ContainsKey(card.Key))
                    throw new FormatException("该势力已有角标，但卡牌缺少表现记录：" + card.Key);
        }

        internal static void RequireCamp(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value != value.Trim() || value.Any(char.IsControl))
                throw new FormatException("势力标识不能为空或含首尾空格／控制字符。");
        }

        private static void ValidateRow(KeyValuePair<string, Dictionary<string, string>> row, string[] columns)
        {
            if (row.Value.Count != columns.Length || columns.Any(c => !row.Value.ContainsKey(c)))
                throw new FormatException("字段不符合配表格式：" + row.Key);
            if (row.Value[columns[0]] != row.Key) throw new FormatException("表索引与行 ID 不一致：" + row.Key);
        }

        internal static void RequireId(string value, string label)
        {
            if (string.IsNullOrEmpty(value) || !Regex.IsMatch(value, @"\A[A-Za-z0-9_][A-Za-z0-9_-]*\z"))
                throw new FormatException(label + " 只能含英文字母、数字、下划线和短横线：" + value);
        }

        public static void RequireResourcePath(string value)
        {
            if (string.IsNullOrEmpty(value) || value.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("Resources/", StringComparison.OrdinalIgnoreCase)
                || !Regex.IsMatch(value, @"\A[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*\z"))
                throw new FormatException("图片路径必须为 Resources 内部路径，不含扩展名、反斜杠或上级路径：" + value);
        }
    }

    // A deliberately small data-only Lua subset: return { ["id"] = { field = "value", }, }.
    // No Lua VM, eval, statements, function calls, expressions, metatables or executable input.
    public static class LuaStringTable
    {
        public static Dictionary<string, Dictionary<string, string>> Read(string text)
        { return new Reader(text).Read(); }

        private sealed class Reader
        {
            private readonly string text;
            private int position;
            public Reader(string source)
            {
                if (source == null || source.Length > 4 * 1024 * 1024) throw new FormatException("Lua 配置为空或超出 4MB 限制。");
                text = source.TrimStart('\uFEFF');
            }
            private FormatException Error(string message) { return new FormatException(message + "（字符位置 " + position + "）"); }
            private void Space()
            {
                while (position < text.Length)
                {
                    if (char.IsWhiteSpace(text[position])) { position++; continue; }
                    if (position + 1 < text.Length && text[position] == '-' && text[position + 1] == '-')
                    { while (position < text.Length && text[position] != '\n') position++; continue; }
                    break;
                }
            }
            private bool Take(char token)
            {
                Space();
                if (position >= text.Length || text[position] != token) return false;
                position++; return true;
            }
            private void Need(char token) { if (!Take(token)) throw Error("需要符号 " + token); }
            private string Word()
            {
                Space(); int start = position;
                while (position < text.Length && (char.IsLetterOrDigit(text[position]) || text[position] == '_')) position++;
                if (start == position) throw Error("需要字段名");
                return text.Substring(start, position - start);
            }
            private string Quoted()
            {
                Need('"'); var result = new StringBuilder();
                while (position < text.Length)
                {
                    char c = text[position++];
                    if (c == '"') return result.ToString();
                    if (c == '\\')
                    {
                        if (position >= text.Length) throw Error("不完整的字符串转义");
                        switch (text[position++])
                        {
                            case '\\': result.Append('\\'); break;
                            case '"': result.Append('"'); break;
                            case 'n': result.Append('\n'); break;
                            case 'r': result.Append('\r'); break;
                            case 't': result.Append('\t'); break;
                            default: throw Error("不支持的转义，配置只接受导出器的数据格式");
                        }
                    }
                    else { if (c < ' ') throw Error("字符串中不能含未转义控制字符"); result.Append(c); }
                }
                throw Error("未闭合的字符串");
            }
            public Dictionary<string, Dictionary<string, string>> Read()
            {
                if (Word() != "return") throw Error("配置必须以 return 开始");
                Need('{'); var rows = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal);
                if (!Take('}'))
                {
                    while (true)
                    {
                        Need('['); string key = Quoted(); Need(']'); Need('='); Need('{');
                        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
                        if (!Take('}'))
                        {
                            while (true)
                            {
                                string field = Word(); Need('='); string value = Quoted();
                                if (fields.ContainsKey(field)) throw Error("重复字段 " + field);
                                fields.Add(field, value);
                                if (Take('}')) break;
                                Need(','); if (Take('}')) break;
                            }
                        }
                        if (rows.ContainsKey(key)) throw Error("重复 ID " + key);
                        rows.Add(key, fields);
                        if (Take('}')) break;
                        Need(','); if (Take('}')) break;
                    }
                }
                Space(); if (position != text.Length) throw Error("配置不允许包含可执行代码或额外文本");
                return rows;
            }
        }
    }

    public sealed class CompiledPresentationTables
    {
        public string BadgeLua { get; internal set; }
        public string CardLua { get; internal set; }
        public CardPresentationTables Tables { get; internal set; }
    }

    public static class PresentationTableCompiler
    {
        public static CompiledPresentationTables CompileForCatalog(string badgeCsv, IEnumerable<CardDefinition> cards, Func<string, bool> spriteExists)
        {
            var badges = ReadCsv(badgeCsv, CardPresentationTables.BadgeColumns);
            string lua = ToLua(badges, CardPresentationTables.BadgeColumns);
            var tables = new CardPresentationTables(lua, cards);
            foreach (var row in badges)
                if (!spriteExists(row[2])) throw new FormatException("图片不存在或不是 Sprite：" + row[2]);
            return new CompiledPresentationTables { BadgeLua = lua, Tables = tables };
        }

        public static CompiledPresentationTables Compile(string badgeCsv, string cardCsv, Func<string, bool> spriteExists,
            IDictionary<string, string> actualCardCamps)
        {
            var badges = ReadCsv(badgeCsv, CardPresentationTables.BadgeColumns);
            var cards = ReadCsv(cardCsv, CardPresentationTables.CardColumns);
            string badgeLua = ToLua(badges, CardPresentationTables.BadgeColumns);
            string cardLua = ToLua(cards, CardPresentationTables.CardColumns);
            var tables = new CardPresentationTables(badgeLua, cardLua);
            tables.ValidateAgainstCatalog(actualCardCamps);
            if (spriteExists == null) throw new ArgumentNullException("spriteExists");
            foreach (var row in badges)
                if (!spriteExists(row[2])) throw new FormatException("图片不存在或不是 Sprite：" + row[2]);
            return new CompiledPresentationTables { BadgeLua = badgeLua, CardLua = cardLua, Tables = tables };
        }

        public static List<string[]> ReadCsv(string source, string[] columns)
        {
            if (source == null || source.Length > 4 * 1024 * 1024) throw new FormatException("CSV 为空或超出大小限制。");
            string csv = source.TrimStart('\uFEFF');
            var rows = new List<string[]>(); var row = new List<string>(); var cell = new StringBuilder();
            bool quoted = false, closed = false;
            for (int i = 0; i < csv.Length; i++)
            {
                char c = csv[i];
                if (quoted)
                {
                    if (c == '"')
                    {
                        if (i + 1 < csv.Length && csv[i + 1] == '"') { cell.Append('"'); i++; }
                        else { quoted = false; closed = true; }
                    }
                    else cell.Append(c);
                }
                else if (c == ',' || c == '\r' || c == '\n')
                {
                    row.Add(cell.ToString()); cell.Clear(); closed = false;
                    if (c != ',')
                    {
                        if (c == '\r' && i + 1 < csv.Length && csv[i + 1] == '\n') i++;
                        if (row.Any(value => value.Length > 0)) rows.Add(row.ToArray());
                        row.Clear();
                    }
                }
                else if (c == '"' && cell.Length == 0 && !closed) quoted = true;
                else { if (closed || c == '"') throw new FormatException("CSV 引号格式不正确。"); cell.Append(c); }
            }
            if (quoted) throw new FormatException("CSV 引号未闭合。");
            if (closed || cell.Length > 0 || row.Count > 0)
            { row.Add(cell.ToString()); if (row.Any(value => value.Length > 0)) rows.Add(row.ToArray()); }
            if (rows.Count == 0 || !rows[0].SequenceEqual(columns)) throw new FormatException("CSV 表头必须是：" + string.Join(",", columns));
            rows.RemoveAt(0);
            foreach (var data in rows)
                if (data.Length != columns.Length) throw new FormatException("CSV 行列数与表头不符。");
            return rows;
        }

        private static string Escape(string text)
        {
            var result = new StringBuilder("\"");
            foreach (char c in text)
            {
                switch (c)
                {
                    case '\\': result.Append("\\\\"); break;
                    case '"': result.Append("\\\""); break;
                    case '\n': result.Append("\\n"); break;
                    case '\r': result.Append("\\r"); break;
                    case '\t': result.Append("\\t"); break;
                    default: if (c < ' ') throw new FormatException("不允许的控制字符。"); result.Append(c); break;
                }
            }
            return result.Append('"').ToString();
        }

        private static string ToLua(List<string[]> rows, string[] columns)
        {
            var result = new StringBuilder("-- Generated from ConfigTables workbook. Faction-bound badge data. Schema: 2\nreturn {\n");
            foreach (var row in rows.OrderBy(r => r[0], StringComparer.Ordinal))
            {
                result.Append("  [").Append(Escape(row[0])).Append("] = { ");
                for (int i = 0; i < columns.Length; i++)
                    result.Append(columns[i]).Append(" = ").Append(Escape(row[i])).Append(", ");
                result.Append("},\n");
            }
            return result.Append("}\n").ToString();
        }
    }
}
