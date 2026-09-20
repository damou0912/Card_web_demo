using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace CardDemo.Core
{
    public enum SkillTrigger { OnPlace, OnOwnTurnStart, OnOwnTurnEnd, OnMove, OnDestroyed, AfterCombat }
    public enum SkillCondition { Always, HandBelow, BehindOnScore, HasAdjacentEnemy }
    public enum SkillTarget { Self, AdjacentAllies, AdjacentEnemies, AllAllies, AllEnemies, RowColumnEnemies }
    public enum TargetSelection { All, RandomOne, HighestPower, LowestPower }
    public enum SkillOperation { ModifyPower, GrantShield, DrawCards, Destroy, AddActions }
    public enum PowerDuration { Permanent, CurrentTurn }

    [Serializable]
    public sealed class SkillStep
    {
        public string operation = "ModifyPower";
        public string target = "Self";
        public string selection = "All";
        public int amount = 1;
        public string duration = "Permanent";
    }

    [Serializable]
    public sealed class SkillDefinition
    {
        public string name = "新技能";
        public string trigger = "OnPlace";
        public string condition = "Always";
        public int conditionValue = 3;
        public SkillStep[] steps = { new SkillStep() };
    }

    [Serializable]
    public sealed class WorkshopDeck
    {
        public string id;
        public string name;
        public string[] cardIds = new string[0];
    }

    [Serializable]
    public sealed class WorkshopLibrary
    {
        public int schemaVersion = 1;
        public CardDefinition[] cards = new CardDefinition[0];
        public WorkshopDeck[] decks = new WorkshopDeck[0];

        public CardDefinition[] ResolveDeck(string deckId, int requiredSize)
        {
            WorkshopValidation.ThrowIfInvalid(this);
            var deck = decks.FirstOrDefault(d => d.id == deckId);
            if (deck == null) throw new ArgumentException("找不到测试卡组：" + deckId);
            if (deck.cardIds.Length != requiredSize)
                throw new ArgumentException("测试卡组「" + deck.name + "」需要 " + requiredSize + " 张，实际 " + deck.cardIds.Length + " 张。");
            var byId = cards.ToDictionary(c => c.id);
            return deck.cardIds.Select(id => byId[id]).ToArray();
        }
    }

    public static class WorkshopValidation
    {
        // Strings keep JSON readable and do not silently coerce misspelled values into enum zero.
        public static T Parse<T>(string value) where T : struct
        {
            T result;
            if (string.IsNullOrWhiteSpace(value) || !Enum.TryParse(value, false, out result)
                || !Enum.IsDefined(typeof(T), result) || result.ToString() != value)
                throw new ArgumentException("不支持的 " + typeof(T).Name + "：" + value);
            return result;
        }

        public static void ValidateAbilities(CardDefinition card)
        {
            if (card.abilities == null || card.abilities.Length == 0) return;
            if (card.demoEffect != "None") throw new ArgumentException(card.id + " 不能同时使用旧演示技能和组合技能。");
            if (card.abilities.Length > 8) throw new ArgumentException(card.id + " 最多配置 8 个技能。");
            foreach (var skill in card.abilities)
            {
                if (skill == null || string.IsNullOrWhiteSpace(skill.name)) throw new ArgumentException(card.id + " 技能名称不能为空。");
                Parse<SkillTrigger>(skill.trigger); Parse<SkillCondition>(skill.condition);
                if (skill.conditionValue < 0 || skill.conditionValue > 10) throw new ArgumentException(card.id + " 条件阈值范围为 0~10。");
                if (skill.steps == null || skill.steps.Length < 1 || skill.steps.Length > 8)
                    throw new ArgumentException(card.id + " 每个技能需要 1~8 个效果步骤。");
                foreach (var step in skill.steps)
                {
                    if (step == null) throw new ArgumentException(card.id + " 不能包含空步骤。");
                    var operation = Parse<SkillOperation>(step.operation);
                    Parse<SkillTarget>(step.target); Parse<TargetSelection>(step.selection); Parse<PowerDuration>(step.duration);
                    if (operation == SkillOperation.ModifyPower && (step.amount == 0 || step.amount < -20 || step.amount > 20))
                        throw new ArgumentException(card.id + " 战力变化必须为 -20~20 的非零整数。");
                    if ((operation == SkillOperation.DrawCards || operation == SkillOperation.AddActions) && (step.amount < 1 || step.amount > 5))
                        throw new ArgumentException(card.id + " 抽牌／额外行动范围为 1~5。");
                    if (operation != SkillOperation.ModifyPower && step.duration != "Permanent")
                        throw new ArgumentException(card.id + " 仅战力变化支持本回合持续时间。");
                    if ((operation == SkillOperation.DrawCards || operation == SkillOperation.AddActions)
                        && (step.target != "Self" || step.selection != "All"))
                        throw new ArgumentException(card.id + " 抽牌／额外行动作用于技能所属玩家，请选择自身／全部。");
                    if ((operation == SkillOperation.Destroy || operation == SkillOperation.GrantShield) && step.amount != 1)
                        throw new ArgumentException(card.id + " 摧毁／护盾的数值必须为 1。");
                }
            }
        }

        public static List<string> Errors(WorkshopLibrary library)
        {
            var errors = new List<string>();
            if (library == null) { errors.Add("制作库为空。"); return errors; }
            if (library.schemaVersion != 1) errors.Add("不支持的制作库版本。");
            if (library.cards == null || library.cards.Length == 0) { errors.Add("制作库至少需要 1 张卡牌。"); return errors; }
            var ids = new HashSet<string>();
            foreach (var card in library.cards)
            {
                if (card == null) { errors.Add("卡表中存在空项。"); continue; }
                if (string.IsNullOrEmpty(card.id) || !Regex.IsMatch(card.id, @"^workshop_[a-zA-Z0-9_]+$") || !ids.Add(card.id))
                    errors.Add("卡牌 ID 无效或重复：" + card.id + "（需要 workshop_ 前缀）。");
                if (string.IsNullOrWhiteSpace(card.name) || string.IsNullOrWhiteSpace(card.camp) || string.IsNullOrWhiteSpace(card.rarity))
                    errors.Add(card.id + " 名称、势力和品质不能为空。");
                else if (!new[] { "普通", "稀有", "史诗", "传说", "特殊" }.Contains(card.rarity)) errors.Add(card.id + " 品质不在支持列表内。");
                if (card.baseAttack < 0 || card.baseAttack > 99) errors.Add(card.id + " 基础战力范围为 0~99。");
                if (card.demoEffect != "None") errors.Add(card.id + " 制作库只允许 None 旧技能类型，请通过技能步骤制作效果。");
                try { ValidateAbilities(card); } catch (ArgumentException error) { errors.Add(error.Message); }
            }
            if (library.decks == null) { errors.Add("测试卡组列表不能为空值。"); return errors; }
            var deckIds = new HashSet<string>();
            foreach (var deck in library.decks)
            {
                if (deck == null) { errors.Add("卡组列表存在空项。"); continue; }
                if (string.IsNullOrWhiteSpace(deck.id) || !Regex.IsMatch(deck.id, @"^[a-zA-Z0-9_]+$") || !deckIds.Add(deck.id)) errors.Add("卡组 ID 无效或重复：" + deck.id);
                if (string.IsNullOrWhiteSpace(deck.name)) errors.Add(deck.id + " 卡组名称不能为空。");
                if (deck.cardIds == null) { errors.Add(deck.id + " 卡组列表缺失。"); continue; }
                if (deck.cardIds.Length > 100) errors.Add(deck.id + " 最多保存 100 张测试卡。");
                foreach (string id in deck.cardIds)
                    if (id == null || !ids.Contains(id)) errors.Add(deck.id + " 引用了不存在的卡牌：" + id);
            }
            return errors;
        }

        public static void ThrowIfInvalid(WorkshopLibrary library)
        {
            var errors = Errors(library);
            if (errors.Count > 0) throw new ArgumentException(string.Join("\n", errors));
        }
    }

    public static class SkillText
    {
        public static string Label(string value)
        {
            switch (value)
            {
                case "OnPlace": return "入阵（放置后）";
                case "OnOwnTurnStart": return "起势（我方回合开始）";
                case "OnOwnTurnEnd": return "收势（我方回合结束）";
                case "OnMove": return "行军（主动移至空格后）";
                case "OnDestroyed": return "遗志（被摧毁离场后）";
                case "AfterCombat": return "交战后（自身存活）";
                case "Always": return "无条件";
                case "HandBelow": return "我方手牌数小于阈值";
                case "BehindOnScore": return "我方占领数少于对方";
                case "HasAdjacentEnemy": return "四方相邻存在非我方卡";
                case "Self": return "自身";
                case "AdjacentAllies": return "四方相邻其他己方卡";
                case "AdjacentEnemies": return "四方相邻非我方卡（含守军）";
                case "AllAllies": return "全部其他己方卡";
                case "AllEnemies": return "全场非我方卡（含守军）";
                case "RowColumnEnemies": return "同行或同列非我方卡（含守军）";
                case "All": return "全部目标";
                case "RandomOne": return "随机 1 张";
                case "HighestPower": return "战力最高 1 张（并列随机）";
                case "LowestPower": return "战力最低 1 张（并列随机）";
                case "ModifyPower": return "调整战力";
                case "GrantShield": return "赋予一次护盾（不叠加）";
                case "DrawCards": return "所属玩家抽牌";
                case "Destroy": return "摧毁目标（可被护盾抵挡）";
                case "AddActions": return "本行动回合增加行动数";
                case "Permanent": return "永久";
                case "CurrentTurn": return "当前全局回合结束时清除";
                default: return "未知：" + value;
            }
        }

        public static string Describe(CardDefinition card)
        {
            if (card.abilities == null || card.abilities.Length == 0) return "无技能。";
            return string.Join("\n", card.abilities.Select(skill => skill == null ? "无效技能" :
                "「" + skill.name + "」" + Label(skill.trigger) + "；" + Label(skill.condition)
                + (skill.condition == "HandBelow" ? " " + skill.conditionValue : "") + "：\n"
                + string.Join("\n", (skill.steps ?? new SkillStep[0]).Select((step, i) => step == null ? "无效步骤" :
                    (i + 1) + ". " + Label(step.operation) + " / " + Label(step.target) + " / " + Label(step.selection)
                    + " / 数值 " + (step.amount > 0 ? "+" : "") + step.amount
                    + (step.operation == "ModifyPower" ? " / " + Label(step.duration) : "")))));
        }
    }
}
