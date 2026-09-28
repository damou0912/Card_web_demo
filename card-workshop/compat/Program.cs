using System;
using System.IO;
using System.Text.Json;
using System.Text;
using CardDemo.Core;

internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            Console.InputEncoding = new UTF8Encoding(false);
            Console.OutputEncoding = new UTF8Encoding(false);
            var json = args.Length == 0 ? Console.In.ReadToEnd() : File.ReadAllText(args[0]);
            var library = JsonSerializer.Deserialize<WorkshopLibrary>(json, new JsonSerializerOptions { IncludeFields = true, IgnoreReadOnlyProperties = true });
            WorkshopValidation.ThrowIfInvalid(library);
            foreach (var card in library.cards) SkillText.Describe(card);
            Console.WriteLine("PASS Unity WorkshopValidation: " + library.cards.Length + " cards, " + library.decks.Length + " decks.");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
