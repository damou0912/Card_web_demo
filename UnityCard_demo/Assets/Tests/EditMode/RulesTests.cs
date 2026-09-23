using NUnit.Framework;

namespace CardDemo.Tests
{
    public sealed class RulesTests
    {
        [Test] public void CoreRegressionChecks() { CoreChecks.RunAll(TestContext.WriteLine); }
        [Test] public void PresentationConfigChecks() { PresentationChecks.RunAll(TestContext.WriteLine); }
        [Test] public void GachaDemoChecks()
        {
            var config = UnityEngine.JsonUtility.FromJson<CardDemo.Core.GachaConfig>(UnityEngine.Resources.Load<UnityEngine.TextAsset>("Config/gacha-demo").text);
            var cards = UnityEngine.JsonUtility.FromJson<CardDemo.Core.CardCatalog>(UnityEngine.Resources.Load<UnityEngine.TextAsset>("Data/web-card-catalog").text);
            GachaChecks.RunAll(config, cards.cards, TestContext.WriteLine);
        }
    }
}
