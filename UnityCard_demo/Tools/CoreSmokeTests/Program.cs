using System;
using CardDemo.Tests;

internal static class Program
{
    private static int Main()
    {
        try { CoreChecks.RunAll(Console.WriteLine); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error); return 1; }
    }
}
