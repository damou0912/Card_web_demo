namespace CardDemo.Core
{
    public static class SkillTemplates
    {
        public static readonly string[] Names = { "入阵鼓舞（相邻友军临时 +2）", "起势补给（少于 3 手牌时抽 1）",
            "入阵护盾（自身一次保护）", "遗志削弱（相邻敌军随机 -2）", "入阵处决（最低战力相邻敌军）", "行军奖励（增加 1 行动）" };

        // New instances on each use: editing one template does not alter any other card.
        public static SkillDefinition Create(int index)
        {
            switch (index)
            {
                case 0: return new SkillDefinition { name = "鼓舞", trigger = "OnPlace", steps = new[] {
                    new SkillStep { operation = "ModifyPower", target = "AdjacentAllies", amount = 2, duration = "CurrentTurn" } } };
                case 1: return new SkillDefinition { name = "补给", trigger = "OnOwnTurnStart", condition = "HandBelow", conditionValue = 3,
                    steps = new[] { new SkillStep { operation = "DrawCards" } } };
                case 2: return new SkillDefinition { name = "护盾", trigger = "OnPlace", steps = new[] { new SkillStep { operation = "GrantShield" } } };
                case 3: return new SkillDefinition { name = "遗志", trigger = "OnDestroyed", steps = new[] {
                    new SkillStep { operation = "ModifyPower", target = "AdjacentEnemies", amount = -2, selection = "RandomOne" } } };
                case 4: return new SkillDefinition { name = "处决", trigger = "OnPlace", steps = new[] {
                    new SkillStep { operation = "Destroy", target = "AdjacentEnemies", selection = "LowestPower" } } };
                case 5: return new SkillDefinition { name = "行军奖励", trigger = "OnMove", steps = new[] { new SkillStep { operation = "AddActions" } } };
                default: throw new System.ArgumentOutOfRangeException("index");
            }
        }
    }
}
