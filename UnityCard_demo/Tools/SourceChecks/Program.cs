using System;
using System.IO;
using System.Linq;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

internal static class Program
{
    private static int Main()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !Directory.Exists(Path.Combine(root.FullName, "Assets/Scripts"))) root = root.Parent;
        if (root == null) { Console.Error.WriteLine("Unity project not found."); return 1; }
        int failures = 0;
        var files = Directory.GetFiles(Path.Combine(root.FullName, "Assets"), "*.cs", SearchOption.AllDirectories);
        foreach (string file in files)
        {
            var tree = CSharpSyntaxTree.ParseText(File.ReadAllText(file), new CSharpParseOptions(LanguageVersion.CSharp9), file);
            foreach (var diagnostic in tree.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error))
            { Console.Error.WriteLine(diagnostic); failures++; }
        }
        Console.WriteLine("C# 9 syntax check: " + files.Length + " files, " + failures + " errors. This is NOT Unity API compilation.");
        return failures == 0 ? 0 : 1;
    }
}
