using System;
using System.Collections.Generic;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class PresentationChecks
    {
        private const string Badges = "camp,displayName,spritePath\n三国~魏,三国-魏,UI/FactionBadges/sanguo_wei\n三国~蜀,三国-蜀,UI/FactionBadges/sanguo_shu\n";
        private const string Cards = "cardId,cardName,camp\n01101,廖化,三国~蜀\ncustom_one,自定义,三国~魏\n";
        private static Dictionary<string, string> Catalog()
        { return new Dictionary<string, string> { { "01101", "三国~蜀" }, { "custom_one", "三国~魏" }, { "demo_1", "演示" } }; }
        private static CompiledPresentationTables Compile(string badges = Badges, string cards = Cards)
        { return PresentationTableCompiler.Compile(badges, cards, p => true, Catalog()); }
        private static void Check(bool condition, string name)
        { if (!condition) throw new InvalidOperationException("Presentation check failed: " + name); }
        private static void Reject(Action action, string name)
        {
            try { action(); } catch (FormatException) { return; }
            throw new InvalidOperationException("Expected rejected input: " + name);
        }

        public static void RunAll(Action<string> report)
        {
            var compiled = Compile();
            var tables = new CardPresentationTables(compiled.BadgeLua, compiled.CardLua);
            CountryBadgeDefinition badge;
            Check(tables.TryGetBadge("01101", "三国~蜀", out badge) && badge.Camp == "三国~蜀"
                && badge.SpritePath.EndsWith("sanguo_shu", StringComparison.Ordinal), "Shu card loads Shu image");
            Check(!tables.TryGetBadge("01101", "三国~魏", out badge) && badge == null, "runtime mismatch never displays wrong badge");
            Check(!tables.TryGetBadge("01101", "蜀", out badge) && badge == null, "display alias is not authoritative camp");
            Check(!tables.TryGetBadge("1101", "三国~蜀", out badge) && badge == null, "leading zero remains significant");
            Check(tables.TryGetBadge("custom_one", "三国~魏", out badge), "ID prefix is not a faction rule");
            Check(!tables.TryGetBadge("demo_1", "演示", out badge) && badge == null, "unsupported faction fallback");
            Check(!tables.TryGetBadge("missing", "三国~魏", out badge) && badge == null, "missing presentation fallback");
            Check(!tables.TryGetBadge(null, "三国~魏", out badge) && badge == null, "null ID fallback");
            Check(!tables.TryGetBadge("01101", null, out badge) && badge == null, "missing actual faction fallback");
            Reject(() => Compile(cards: Cards.Replace("01101,廖化,三国~蜀", "01101,廖化,三国~魏")), "cannot independently remap Shu to Wei");
            var changedCatalog = Catalog(); changedCatalog["01101"] = "三国~魏";
            var changed = PresentationTableCompiler.Compile(Badges, Cards.Replace("01101,廖化,三国~蜀", "01101,廖化,三国~魏"), p => true, changedCatalog);
            Check(changed.Tables.TryGetBadge("01101", "三国~魏", out badge) && badge.Camp == "三国~魏", "real faction change and synchronized table");
            var sameFaction = Catalog(); sameFaction.Add("another_shu", "三国~蜀");
            var shared = PresentationTableCompiler.Compile(Badges, Cards + "another_shu,同势力,三国~蜀\n", p => true, sameFaction);
            Check(shared.Tables.TryGetBadge("another_shu", "三国~蜀", out badge) && badge.SpritePath == "UI/FactionBadges/sanguo_shu", "same faction shares path");
            Reject(() => Compile(cards: Cards + "01101,重复,三国~蜀\n"), "duplicate card");
            Reject(() => Compile(badges: Badges + "三国~蜀,重复,UI/FactionBadges/other\n"), "one mapping per faction");
            Reject(() => Compile(cards: Cards.Replace("三国~蜀", "三国~吴")), "unconfigured faction");
            Reject(() => Compile(cards: Cards + "unknown,新增,三国~魏\n"), "unknown card");
            Reject(() => Compile(cards: "cardId,cardName,camp\n01101,廖化,三国~蜀\n"), "missing supported card mapping");
            Reject(() => Compile(cards: Cards.Replace("01101,廖化,三国~蜀", "01101,廖化,")), "empty camp cannot bypass validation");
            Reject(() => PresentationTableCompiler.Compile(Badges, Cards, p => false, Catalog()), "missing sprite");
            foreach (string path in new[] { "../secret", "UI/../secret", "/UI/icon", "C:/icon", "UI\\icon", "UI/icon.png", "https://host/icon", "Assets/Resources/icon" })
                Reject(() => CardPresentationTables.RequireResourcePath(path), "unsafe path " + path);
            Reject(() => Compile(badges: Badges.Replace("displayName", "typo")), "bad header");
            Reject(() => Compile(cards: Cards + "truncated,only-two"), "bad CSV columns");
            Reject(() => Compile(cards: Cards + "\"unclosed"), "CSV quote");
            Reject(() => new CardPresentationTables(compiled.BadgeLua + "os.execute(\"run\")", compiled.CardLua), "no Lua executable suffix");
            Reject(() => LuaStringTable.Read("return {[\"a\"]={id=os.getenv(\"X\")}}"), "no Lua expressions");
            Reject(() => LuaStringTable.Read("return {[\"a\"]={id=\"a\",id=\"b\"}}"), "duplicate Lua field");
            Reject(() => LuaStringTable.Read("return {} return {}"), "second statement");
            Reject(() => new CardPresentationTables(compiled.BadgeLua.Replace("camp = \"三国~蜀\"", "camp = \"三国~魏\""), compiled.CardLua), "row index mismatch");
            string quotedCsv = "cardId,cardName,camp\r\n\"0001\",\"名,称\"\"引号\r\n换行\\路径\",三国~魏\r\n";
            var escaped = PresentationTableCompiler.Compile("\uFEFF" + Badges, quotedCsv, p => true, new Dictionary<string, string> { { "0001", "三国~魏" } });
            Check(LuaStringTable.Read(escaped.CardLua)["0001"]["cardName"] == "名,称\"引号\r\n换行\\路径", "Unicode CSV/Lua escaping roundtrip");
            Check(LuaStringTable.Read("-- comment\nreturn {} -- end").Count == 0, "empty Lua data");
            Check(compiled.BadgeLua == Compile().BadgeLua, "deterministic export");
            report("PASS presentation: faction-bound images, source/runtime mismatch rejection, synchronized faction changes, string IDs, fallback, CSV/Lua validation");
        }
    }
}
