using System;
using System.Text.Json;
using CardDemo.ConfigTools;
using CardDemo.Core;

internal static class ContentChecks
{
    private const string Header = "cardId,cardName,camp,rarity,baseAttack,skill,effect,defaultOrder\n";
    private const string Row = "01101,廖化,三国~蜀,普通,2,整军,原说明,1\n";
    public static void RunAll(Action<string> log)
    {
        var result = CardContentCompiler.Compile(Header + Row);
        using (var json = JsonDocument.Parse(result.CatalogJson))
        {
            var card = json.RootElement.GetProperty("cards")[0];
            Require(card.GetProperty("id").GetString() == "01101", "leading zero");
            Require(card.GetProperty("baseAttack").GetInt32() == 2, "numeric JSON");
            Require(card.GetProperty("effect").GetString() == "原说明", "display consumer data");
            Require(json.RootElement.GetProperty("defaultCardIds")[0].GetString() == "01101", "default deck membership");
        }
        Require(result.CardLua.Contains("baseAttack = 2,") && result.CardLua.Contains("skill = \"整军\""), "merged Lua");
        var changed = CardContentCompiler.Compile(Header + Row.Replace(",2,", ",9,").Replace("原说明", "新说明"));
        Require(changed.Catalog.cards[0].baseAttack == 9 && changed.Catalog.cards[0].effect == "新说明", "edits reach consumers");
        Require(CardContentCompiler.Compile(Header + Row.Replace(",2,", ",0,")).Catalog.cards[0].baseAttack == 0, "zero preserved");
        var escaped = CardContentCompiler.Compile(Header + "01101,廖化,三国~蜀,普通,2,整军,\"第一行,\"\"引号\"\"\n第二行\\路径\",1\n");
        Require(escaped.Catalog.cards[0].effect == "第一行,\"引号\"\r\n第二行\\路径", "text and CRLF preservation");
        foreach (string row in new[] { Row.Replace(",2,", ",-1,"), Row.Replace(",2,", ",2.5,"), Row.Replace(",2,", ",100,"),
            Row.Replace("普通", "神话"), Row.Replace("01101", "1101"), Row.Replace("廖化", ""), Row + Row,
            Row.Replace(",1\n", ",2\n"), Row.Replace(",1\n", ",-1\n") })
            Fail(() => CardContentCompiler.Compile(Header + row));
        Fail(() => CardContentCompiler.Compile(Header));
        var multiple = CardContentCompiler.Compile(Header + Row.Replace(",1\n", ",2\n") + "01102,王平,三国~蜀,普通,1,固守,说明,1\n");
        Require(multiple.Catalog.defaultCardIds[0] == "01102" && multiple.Catalog.cards[0].id == "01101", "default order independent of row sort");
        var backup = CardContentCompiler.Compile(Header + Row.Replace(",1\n", ",0\n"));
        Require(backup.Catalog.defaultCardIds.Length == 0, "replacement card marker");
        const string badges = "camp,displayName,spritePath\n三国~蜀,蜀,UI/shu\n三国~魏,魏,UI/wei\n";
        var newCamp = CardContentCompiler.Compile(Header + Row.Replace("三国~蜀", "三国~魏"));
        var compiled = PresentationTableCompiler.CompileForCatalog(badges, newCamp.Catalog.cards, path => true);
        Require(compiled.Tables.TryGetBadge("01101", "三国~魏", out var badge) && badge.SpritePath == "UI/wei", "one faction edit updates badge");
        Require(!compiled.Tables.TryGetBadge("01101", "三国~蜀", out badge), "stale runtime faction fallback");
        Fail(() => PresentationTableCompiler.CompileForCatalog(badges, newCamp.Catalog.cards, path => false));
        log("PASS unified content: single-source attributes/skills/faction, Lua/JSON, deck order, additions, validation.");
    }
    private static void Require(bool ok, string name) { if (!ok) throw new Exception("Content test failed: " + name); }
    private static void Fail(Action action) { try { action(); } catch (FormatException) { return; } throw new Exception("Invalid content was accepted."); }
}
