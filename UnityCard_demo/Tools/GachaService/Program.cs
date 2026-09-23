using System.Security.Cryptography;
using System.Text.Json;
using CardDemo.Core;

// Private stdio worker: no network listener, filesystem saves, account selection or reset.
// Node owns authentication and the database transaction. Unity and Web share the rules below.
var json = new JsonSerializerOptions { IncludeFields = true };
var root = Path.GetFullPath(args[0]);
var config = JsonSerializer.Deserialize<GachaConfig>(File.ReadAllText(Path.Combine(root, "Assets/Resources/Config/gacha-demo.json")), json);
var catalog = JsonSerializer.Deserialize<CardCatalog>(File.ReadAllText(Path.Combine(root, "Assets/Resources/Data/web-card-catalog.json")), json);
var engine = new GachaDemo(config, catalog.cards);
var ids = config.groups.SelectMany(g => g.cardIds).ToHashSet();
string line;
while ((line = Console.ReadLine()) != null)
{
    try
    {
        using var input = JsonDocument.Parse(line);
        var data = input.RootElement;
        var profile = data.TryGetProperty("profile", out var saved) && saved.ValueKind != JsonValueKind.Null
            ? saved.Deserialize<GachaProfile>(json) : GachaProfiles.New();
        profile = GachaProfiles.Open(profile, engine, config.poolId, null, out _);
        var state = GachaProfiles.Current(profile, config.poolId);
        var action = data.GetProperty("action").GetString();
        if (action != "session")
        {
            var body = data.GetProperty("body");
            if (body.GetProperty("poolId").GetString() != config.poolId
                || body.GetProperty("revision").GetInt32() != state.revision
                || body.GetProperty("profileRevision").GetInt32() != profile.revision)
                throw new InvalidOperationException("进度已更新，请刷新后重试。");
            if (action == "draw") profile = GachaProfiles.Draw(profile, engine, config.poolId, RandomNumberGenerator.GetInt32);
            else if (action == "exchange" && body.GetProperty("confirm").GetBoolean())
                profile = GachaProfiles.Exchange(profile, engine, config.poolId, body.GetProperty("cardId").GetString(), body.GetProperty("confirmedUniversal").GetInt32());
            else throw new ArgumentException("不支持此操作。账号招募不可重置。");
            state = GachaProfiles.Current(profile, config.poolId);
        }
        Console.WriteLine(JsonSerializer.Serialize(new { profile, snapshot = new {
            config, cards = catalog.cards.Where(c => ids.Contains(c.id)).Select(c => new { c.id, c.name, c.camp, c.rarity, c.baseAttack, c.skill, c.effect }),
            state, profileRevision = profile.revision, shardBalance = engine.ShardBalance(state),
            universalBalance = GachaProfiles.UniversalBalance(profile), accountMode = true,
            ownedCardIds = GachaInventory.OwnedExtraCardIds(profile, config)
        } }, json));
    }
    catch (Exception error)
    {
        Console.WriteLine(JsonSerializer.Serialize(new { error = error.Message }));
    }
}
