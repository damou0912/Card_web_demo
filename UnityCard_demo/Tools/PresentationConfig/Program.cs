using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Collections.Generic;
using CardDemo.Core;
using CardDemo.Tests;
using CardDemo.ConfigTools;

internal static class Program
{
    private static int Main(string[] args)
    {
        try
        {
            Console.OutputEncoding = new UTF8Encoding(false);
            if (args.Length < 1 || args.Length > 2 || (args[0] != "export" && args[0] != "check"))
                throw new ArgumentException("Usage: dotnet run --project Tools/PresentationConfig -- export|check [workbook.xlsx]");
            PresentationChecks.RunAll(Console.WriteLine);
            WorkbookChecks.RunAll(Console.WriteLine);
            ContentChecks.RunAll(Console.WriteLine);
            var root = new DirectoryInfo(AppContext.BaseDirectory);
            while (root != null && !Directory.Exists(Path.Combine(root.FullName, "ConfigTables"))) root = root.Parent;
            if (root == null) throw new DirectoryNotFoundException("Cannot locate ConfigTables.");
            string resources = Path.Combine(root.FullName, "Assets/Resources");
            var options = new JsonSerializerOptions { IncludeFields = true };
            var plan = CardConfigExportPlan.Build(root.FullName,
                path => JsonSerializer.Deserialize<CardCatalog>(File.ReadAllText(path), options),
                path => File.Exists(Path.Combine(resources, path + ".png"))
                    && File.Exists(Path.Combine(resources, path + ".png.meta"))
                    && File.ReadAllText(Path.Combine(resources, path + ".png.meta")).Contains("spriteMode: 1"),
                args.Length == 2 ? Path.GetFullPath(args[1]) : null);
            foreach (var output in plan.Outputs)
                if (args[0] == "export")
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(output.Key));
                    File.WriteAllText(output.Key, output.Value, new UTF8Encoding(false));
                }
                else if (!File.Exists(output.Key) || Normalize(File.ReadAllText(output.Key)) != Normalize(output.Value))
                    throw new InvalidOperationException("导出文件缺失或与 Excel 不一致，请重新导出：" + output.Key);
            Console.WriteLine("PASS " + args[0] + ": " + plan.CardCount + " cards / " + plan.BadgeCount + " factions / attributes + skill display + badges.");
            Console.WriteLine("编辑源目录：" + Path.Combine(root.FullName, "ConfigTables"));
            Console.WriteLine("读取 Card Basics.xlsx + Faction Icons.xlsx；卡牌数值和中文文案保持原样。");
            if (args[0] == "export") Console.WriteLine("已生成卡牌、势力角标两份 Lua 及现有界面读取的卡牌 JSON，不再生成 CSV。");
            return 0;
        }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }

    private static string Normalize(string text) { return text.TrimStart('\uFEFF').Replace("\r\n", "\n"); }
}
