using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    public sealed partial class GameEngine
    {
        private sealed class SkillInvocation
        {
            public Piece Source;
            public int Cell;
            public SkillTrigger Trigger;
            public SkillDefinition Skill;
        }

        private readonly Queue<SkillInvocation> skillQueue = new Queue<SkillInvocation>();
        private bool processingSkills;
        private int skillCount;
        private const int SkillLimit = 10;

        private void StartSkillCommand() { skillCount = 0; skillQueue.Clear(); }

        private void TriggerOwnerSkills(SkillTrigger trigger)
        {
            var snapshot = State.Board.Where(p => p != null && p.Owner == State.ActivePlayer).OrderBy(p => p.Uid).ToArray();
            foreach (var piece in snapshot)
            {
                if (State.Finished) break;
                int cell = Array.IndexOf(State.Board, piece);
                if (cell >= 0) RunSkills(piece, cell, trigger);
            }
        }

        private void RunSkills(Piece source, int cell, SkillTrigger trigger)
        {
            if (State.Finished || source.Definition == null || source.Definition.abilities == null) return;
            foreach (var skill in source.Definition.abilities)
                if (WorkshopValidation.Parse<SkillTrigger>(skill.trigger) == trigger)
                    skillQueue.Enqueue(new SkillInvocation { Source = source, Cell = cell, Trigger = trigger, Skill = skill });
            if (processingSkills) return;
            processingSkills = true;
            try
            {
                while (skillQueue.Count > 0 && !State.Finished)
                {
                    var invocation = skillQueue.Dequeue();
                    if (invocation.Trigger != SkillTrigger.OnDestroyed && Array.IndexOf(State.Board, invocation.Source) < 0) continue;
                    if (!ConditionMet(invocation))
                    {
                        Log("condition-skipped", Label(invocation.Source), "无", invocation.Skill.name,
                            Label(invocation.Source) + "「" + invocation.Skill.name + "」条件不成立，跳过。");
                        continue;
                    }
                    if (skillCount >= SkillLimit)
                    {
                        Log("chain-limit", Label(invocation.Source), "技能队列", "安全上限",
                            "本次操作最多执行 " + SkillLimit + " 个组合技能，剩余触发已中止。");
                        skillQueue.Clear(); break;
                    }
                    skillCount++;
                    Log("skill", Label(invocation.Source), "技能", SkillText.Label(invocation.Skill.trigger),
                        Label(invocation.Source) + " 触发「" + invocation.Skill.name + "」（" + SkillText.Label(invocation.Skill.trigger) + "）。");
                    foreach (var step in invocation.Skill.steps)
                    {
                        if (State.Finished) break;
                        if (invocation.Trigger != SkillTrigger.OnDestroyed && Array.IndexOf(State.Board, invocation.Source) < 0) break;
                        ResolveStep(invocation, step);
                    }
                }
            }
            finally { processingSkills = false; skillQueue.Clear(); }
        }

        private bool ConditionMet(SkillInvocation invocation)
        {
            int owner = invocation.Source.Owner;
            switch (WorkshopValidation.Parse<SkillCondition>(invocation.Skill.condition))
            {
                case SkillCondition.HandBelow: return State.Hands[owner].Count < invocation.Skill.conditionValue;
                case SkillCondition.BehindOnScore: return Score(owner) < Score(3 - owner);
                case SkillCondition.HasAdjacentEnemy:
                    return Neighbours(invocation.Cell).Any(n => State.Board[n] != null && State.Board[n].Owner != owner);
                default: return true;
            }
        }

        private Piece[] SelectTargets(SkillInvocation invocation, SkillStep step)
        {
            var source = invocation.Source;
            int cell = invocation.Trigger == SkillTrigger.OnDestroyed ? invocation.Cell : Array.IndexOf(State.Board, source);
            if (!InBoard(cell)) return new Piece[0];
            var target = WorkshopValidation.Parse<SkillTarget>(step.target);
            var candidates = new List<Piece>();
            for (int i = 0; i < State.Board.Length; i++)
            {
                var piece = State.Board[i];
                if (piece == null) continue;
                bool ally = piece.Owner == source.Owner, adjacent = Neighbours(cell).Contains(i);
                bool include = target == SkillTarget.Self ? piece == source
                    : target == SkillTarget.AdjacentAllies ? ally && piece != source && adjacent
                    : target == SkillTarget.AdjacentEnemies ? !ally && adjacent
                    : target == SkillTarget.AllAllies ? ally && piece != source
                    : target == SkillTarget.AllEnemies ? !ally
                    : !ally && (i / Config.boardSize == cell / Config.boardSize || i % Config.boardSize == cell % Config.boardSize);
                if (include) candidates.Add(piece);
            }
            if (candidates.Count == 0) return candidates.ToArray();
            var selection = WorkshopValidation.Parse<TargetSelection>(step.selection);
            if (selection == TargetSelection.All) return candidates.OrderBy(p => p.Uid).ToArray();
            if (selection == TargetSelection.HighestPower) candidates = candidates.Where(p => p.Power == candidates.Max(t => t.Power)).ToList();
            if (selection == TargetSelection.LowestPower) candidates = candidates.Where(p => p.Power == candidates.Min(t => t.Power)).ToList();
            return new[] { candidates[random.Next(candidates.Count)] };
        }

        private void ResolveStep(SkillInvocation invocation, SkillStep step)
        {
            var source = invocation.Source;
            var operation = WorkshopValidation.Parse<SkillOperation>(step.operation);
            string reason = invocation.Skill.name + " / " + SkillText.Label(invocation.Skill.trigger);
            if (operation == SkillOperation.DrawCards)
            {
                Log("skill-draw", Label(source), PlayerName(source.Owner), reason, Label(source) + " 因「" + reason + "」尝试抽取 " + step.amount + " 张牌。");
                Draw(source.Owner, step.amount); return;
            }
            if (operation == SkillOperation.AddActions)
            {
                bool inActionPhase = invocation.Trigger != SkillTrigger.OnOwnTurnEnd && State.ActivePlayer == source.Owner;
                if (inActionPhase)
                {
                    int before = State.Actions; State.Actions = Math.Min(10, before + step.amount);
                    Log("actions", Label(source), PlayerName(source.Owner), reason, Label(source) + " 因「" + reason + "」使行动数 " + before + " → " + State.Actions + "（上限 10）。");
                }
                else Log("no-target", Label(source), "行动位", reason, "「" + reason + "」不在所属玩家行动阶段，额外行动不结转。");
                return;
            }
            var targets = SelectTargets(invocation, step); // Fixed snapshot per step.
            if (targets.Length == 0) Log("no-target", Label(source), "无", reason, Label(source) + "「" + reason + "」没有合法目标。");
            foreach (var target in targets)
            {
                if (State.Finished) break;
                int cell = Array.IndexOf(State.Board, target);
                if (cell < 0) continue;
                switch (operation)
                {
                    case SkillOperation.ModifyPower:
                        ChangePower(source, target, step.amount, reason, step.duration == "CurrentTurn"); break;
                    case SkillOperation.GrantShield:
                        bool already = target.Shield;
                        target.Shield = true;
                        Log("shield", Label(source), Label(target), reason,
                            Label(source) + " 因「" + reason + "」给 " + Label(target) + (already ? " 刷新护盾（不叠加）。" : " 赋予一次护盾。")); break;
                    case SkillOperation.Destroy:
                        if (Absorb(target, source, reason)) break;
                        State.Board[cell] = null;
                        Log("destroyed", Label(source), Label(target), reason, Label(target) + " 因 " + Label(source) + " 的「" + reason + "」被摧毁，离开 " + CellName(cell) + "。");
                        if (!CheckVictory()) LastWill(target, cell);
                        break;
                }
            }
        }

        private void ClearTemporaryPower()
        {
            foreach (var piece in State.Board.Where(p => p != null && p.TemporaryPower != 0))
            {
                int before = piece.Power; piece.TemporaryPower = 0;
                Log("expired", "系统", Label(piece), "当前回合结束",
                    Label(piece) + " 的本回合战力效果到期：" + before + " → " + piece.Power + "。");
            }
        }
    }
}
