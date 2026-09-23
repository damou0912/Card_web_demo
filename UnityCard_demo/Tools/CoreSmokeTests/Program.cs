using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using CardDemo.Core;
using CardDemo.Tests;

internal static class Program
{
    private static int Main()
    {
        try
        {
            CoreChecks.RunAll(Console.WriteLine);
            PresentationChecks.RunAll(Console.WriteLine);
            // Verify the actual shipped JSON against the same pure runtime, not just test fixtures.
            var root = new DirectoryInfo(AppContext.BaseDirectory);
            while (root != null && !File.Exists(Path.Combine(root.FullName, "Assets/Resources/Data/workshop-library.json"))) root = root.Parent;
            if (root == null) throw new InvalidOperationException("Cannot locate the project data.");
            var options = new JsonSerializerOptions { IncludeFields = true, IgnoreReadOnlyProperties = true };
            var gacha = JsonSerializer.Deserialize<GachaConfig>(File.ReadAllText(Path.Combine(root.FullName, "Assets/Resources/Config/gacha-demo.json")), options);
            var reference = JsonSerializer.Deserialize<CardCatalog>(File.ReadAllText(Path.Combine(root.FullName, "Assets/Resources/Data/web-card-catalog.json")), options);
            GachaChecks.RunAll(gacha, reference.cards, Console.WriteLine);
            var library = JsonSerializer.Deserialize<WorkshopLibrary>(File.ReadAllText(Path.Combine(root.FullName, "Assets/Resources/Data/workshop-library.json")), options);
            var config = JsonSerializer.Deserialize<GameConfig>(File.ReadAllText(Path.Combine(root.FullName, "Assets/Resources/Config/game-config.json")), options);
            WorkshopValidation.ThrowIfInvalid(library);
            new GameEngine(config, library.cards, 42,
                config.useWorkshopCards ? library.ResolveDeck(config.playerDeckId, config.deckSize) : null,
                config.useWorkshopCards ? library.ResolveDeck(config.aiDeckId, config.deckSize) : null);
            foreach (var deck in library.decks) library.ResolveDeck(deck.id, deck.cardIds.Length);
            foreach (string file in Directory.GetFiles(Path.Combine(root.FullName, "Documentation/Examples"), "*.json"))
            {
                var scenario = JsonSerializer.Deserialize<BattleScenario>(File.ReadAllText(file), options);
                GameEngine.FromScenario(new GameConfig { boardSize = scenario.boardSize }, library.cards, scenario);
            }
            Console.WriteLine("PASS shipped workshop JSON, configured decks and example scenarios");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
