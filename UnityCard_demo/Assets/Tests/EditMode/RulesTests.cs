using NUnit.Framework;

namespace CardDemo.Tests
{
    public sealed class RulesTests
    {
        [Test] public void CoreRegressionChecks() { CoreChecks.RunAll(TestContext.WriteLine); }
    }
}
