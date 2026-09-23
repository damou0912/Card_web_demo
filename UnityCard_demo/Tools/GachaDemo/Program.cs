using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CardDemo.Core;
using CardDemo.Tests;

internal static class Program
{
    private static readonly JsonSerializerOptions Json = new() { IncludeFields = true };
    private static readonly string Token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private static async Task<int> Main(string[] args)
    {
        try
        {
            var directory = new DirectoryInfo(AppContext.BaseDirectory);
            while (directory != null && !File.Exists(Path.Combine(directory.FullName, "Assets/Resources/Config/gacha-demo.json"))) directory = directory.Parent;
            if (directory == null) throw new InvalidOperationException("Cannot locate Unity project.");
            string root = directory.FullName;
            var config = JsonSerializer.Deserialize<GachaConfig>(File.ReadAllText(Path.Combine(root, "Assets/Resources/Config/gacha-demo.json")), Json);
            var catalog = JsonSerializer.Deserialize<CardCatalog>(File.ReadAllText(Path.Combine(root, "Assets/Resources/Data/web-card-catalog.json")), Json);
            var engine = new GachaDemo(config, catalog.cards);
            if (args.Length > 0 && args[0] == "simulate")
            {
                if (args.Length > 2) config = JsonSerializer.Deserialize<GachaConfig>(File.ReadAllText(Path.GetFullPath(args[2])), Json);
                GachaChecks.SimulateEconomy(config, catalog.cards, Console.WriteLine, args.Length > 1 ? int.Parse(args[1]) : 100000, verifyTarget: false); return 0;
            }
            if (args.Length == 1 && args[0] == "check") { GachaChecks.RunAll(config, catalog.cards, Console.WriteLine, 100000); return 0; }
            if (args.Length > 0 && args[0] != "serve") throw new ArgumentException("Usage: check | simulate [samples] [config-path] | serve [port] [profile-path] [config-path]");
            if (args.Length > 3)
            {
                config = JsonSerializer.Deserialize<GachaConfig>(File.ReadAllText(Path.GetFullPath(args[3])), Json);
                engine = new GachaDemo(config, catalog.cards);
            }
            int port = args.Length > 1 ? int.Parse(args[1]) : 5186;
            if (port < 1024 || port > 65535) throw new ArgumentException("Invalid local port.");
            string origin = "http://127.0.0.1:" + port;
            string saveDirectory = Path.Combine(root, "Artifacts/GachaDemo");
            string save = args.Length > 2 ? Path.GetFullPath(args[2]) : Path.Combine(saveDirectory, "browser-profile.json");
            string legacySave = args.Length > 2 ? save : GachaSaveFile.PathForPool(saveDirectory, config.poolId, "browser-save.json");
            Directory.CreateDirectory(Path.GetDirectoryName(save));
            using var saveLock = new FileStream(save + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            GachaProfile profile; string loadError = null;
            try
            {
                profile = GachaSaveFile.LoadProfile(save, legacySave, config.poolId, engine,
                    text => JsonSerializer.Deserialize<GachaProfile>(text, Json), text => JsonSerializer.Deserialize<GachaState>(text, Json), value => JsonSerializer.Serialize(value, Json));
            }
            catch (Exception error) when (error is JsonException || error is ArgumentException || error is IOException || error is UnauthorizedAccessException)
            {
                Console.Error.WriteLine(error.Message);
                profile = GachaProfiles.Open(GachaProfiles.New(), engine, config.poolId, null, out _);
                loadError = "存档读取或结算失败，原文件未覆盖。为保护其他期进度与通用碎片，已暂停操作，请修复存档后重启。";
            }
            GachaState state = GachaProfiles.Current(profile, config.poolId);
            using var listener = new HttpListener(); listener.Prefixes.Add(origin + "/"); listener.Start();
            Console.WriteLine("Gacha Demo: " + origin + "/ — local test credit only, no payments. Ctrl+C to stop.");
            var ids = config.groups.SelectMany(g => g.cardIds).ToHashSet();
            object Snapshot() => new { config, cards = catalog.cards.Where(c => ids.Contains(c.id)).Select(c => new {
                c.id, c.name, c.camp, c.rarity, c.baseAttack, c.skill, c.effect }), state, profileRevision = profile.revision,
                shardBalance = engine.ShardBalance(state), universalBalance = GachaProfiles.UniversalBalance(profile), token = Token, loadError };
            // Serialized requests + expected revision stop double-submission and stale tabs.
            while (listener.IsListening)
            {
                var context = await listener.GetContextAsync();
                try
                {
                    var request = context.Request; var response = context.Response;
                    response.Headers["Cache-Control"] = "no-store";
                    response.Headers["X-Content-Type-Options"] = "nosniff";
                    response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'";
                    if (request.Headers["Host"] != "127.0.0.1:" + port) { await Reply(response, 403, new { error = "Local host only." }); continue; }
                    string path = request.Url.AbsolutePath;
                    if (request.HttpMethod == "GET" && path == "/api/session") { await Reply(response, 200, Snapshot()); continue; }
                    if (request.HttpMethod == "POST" && (path == "/api/draw" || path == "/api/reset" || path == "/api/exchange"))
                    {
                        if (request.Headers["Origin"] != origin || request.Headers["X-Demo-Token"] != Token
                            || request.ContentLength64 < 0 || request.ContentLength64 > 2048 || request.ContentType != "application/json")
                        { await Reply(response, 403, new { error = "请从本地 Demo 页面操作。" }); continue; }
                        using var reader = new StreamReader(request.InputStream, Encoding.UTF8);
                        using var body = JsonDocument.Parse(await reader.ReadToEndAsync());
                        if (body.RootElement.ValueKind != JsonValueKind.Object
                            || !body.RootElement.TryGetProperty("poolId", out var poolId) || poolId.ValueKind != JsonValueKind.String || poolId.GetString() != config.poolId)
                        { await Reply(response, 409, new { error = "奖池期数不匹配，请刷新页面；不同期碎片不能混用。" }); continue; }
                        if (!body.RootElement.TryGetProperty("revision", out var revision) || !revision.TryGetInt32(out int expected) || expected != state.revision
                            || !body.RootElement.TryGetProperty("profileRevision", out var profileRevision) || !profileRevision.TryGetInt32(out int expectedProfile) || expectedProfile != profile.revision)
                        { await Reply(response, 409, new { error = "另一个页面已更新存档，请刷新后重试。" }); continue; }
                        if (loadError != null) { await Reply(response, 409, new { error = loadError }); continue; }
                        if (path == "/api/reset" && (!body.RootElement.TryGetProperty("confirm", out var confirm) || confirm.ValueKind != JsonValueKind.True))
                        { await Reply(response, 400, new { error = "请确认仅重置此 Demo。" }); continue; }
                        GachaProfile next;
                        if (path == "/api/exchange")
                        {
                            if (!body.RootElement.TryGetProperty("confirm", out var exchangeConfirm) || exchangeConfirm.ValueKind != JsonValueKind.True
                                || !body.RootElement.TryGetProperty("cardId", out var cardId) || cardId.ValueKind != JsonValueKind.String
                                || !body.RootElement.TryGetProperty("confirmedUniversal", out var universalUsed) || !universalUsed.TryGetInt32(out int confirmedUniversal))
                            { await Reply(response, 400, new { error = "请确认兑换的本期卡牌。" }); continue; }
                            // Client-provided prices or balances are never trusted.
                            next = GachaProfiles.Exchange(profile, engine, poolId.GetString(), cardId.GetString(), confirmedUniversal);
                        }
                        else next = path == "/api/draw" ? GachaProfiles.Draw(profile, engine, config.poolId, RandomNumberGenerator.GetInt32) : GachaProfiles.Reset(profile, engine, config.poolId);
                        GachaSaveFile.Write(save, JsonSerializer.Serialize(next, Json));
                        profile = next; state = GachaProfiles.Current(profile, config.poolId);
                        await Reply(response, 200, Snapshot()); continue;
                    }
                    var files = new Dictionary<string, (string name, string mime)> {
                        ["/"] = ("index.html", "text/html; charset=utf-8"),
                        ["/app.js"] = ("app.js", "text/javascript; charset=utf-8"),
                        ["/reveal.js"] = ("reveal.js", "text/javascript; charset=utf-8"),
                        ["/style.css"] = ("style.css", "text/css; charset=utf-8") };
                    if (request.HttpMethod == "GET" && files.TryGetValue(path, out var file))
                    {
                        byte[] bytes = await File.ReadAllBytesAsync(Path.Combine(root, "Tools/GachaDemo/wwwroot", file.name));
                        response.ContentType = file.mime; response.ContentLength64 = bytes.Length;
                        await response.OutputStream.WriteAsync(bytes); response.Close(); continue;
                    }
                    await Reply(response, 404, new { error = "Not found." });
                }
                catch (Exception error)
                {
                    Console.Error.WriteLine(error.Message);
                    try { await Reply(context.Response, error is IOException || error is UnauthorizedAccessException ? 500 : 400, new { error = error is IOException || error is UnauthorizedAccessException ? "存档写入失败，卡牌、测试额度和两种碎片均未变更。" : error.Message }); }
                    catch (Exception) { context.Response.Abort(); }
                }
            }
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
    private static async Task Reply(HttpListenerResponse response, int code, object value)
    {
        byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(value, Json);
        response.StatusCode = code; response.ContentType = "application/json; charset=utf-8"; response.ContentLength64 = bytes.Length;
        await response.OutputStream.WriteAsync(bytes); response.Close();
    }
}
