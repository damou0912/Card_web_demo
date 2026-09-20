using System;
using System.Collections.Generic;
using System.Linq;

namespace CardDemo.Core
{
    // A small, deterministic demonstration runtime, NOT a port of all web V2 skills.
    // No Unity, filesystem, network or clock dependencies: commands can be tested headlessly.
    public sealed partial class GameEngine
    {
        private readonly Random random;
        private int nextUid;
        public GameConfig Config { get; private set; }
        public GameState State { get; private set; }
        public int Seed { get; private set; }
        public int VictoryThreshold { get { return State.Board.Length / 2 + 1; } }

        public GameEngine(GameConfig config, CardDefinition[] catalog, int seed, CardDefinition[] playerDeck = null, CardDefinition[] aiDeck = null)
        {
            if (config == null) throw new ArgumentNullException("config");
            config.Validate();
            if (catalog == null || catalog.Length == 0) throw new ArgumentException("演示卡表不能为空。");
            var ids = new HashSet<string>();
            foreach (var card in catalog)
            {
                if (card == null || string.IsNullOrWhiteSpace(card.id) || !ids.Add(card.id)
                    || string.IsNullOrWhiteSpace(card.name) || card.baseAttack < 0)
                    throw new ArgumentException("演示卡牌 ID、名称或战力无效。");
                var validated = card.ParsedEffect;
                WorkshopValidation.ValidateAbilities(card);
            }
            Config = config;
            Seed = seed;
            random = new Random(seed);
            State = new GameState { Board = new Piece[config.boardSize * config.boardSize] };
            for (int owner = 1; owner <= 2; owner++)
            {
                var explicitDeck = owner == 1 ? playerDeck : aiDeck;
                if (explicitDeck != null)
                {
                    if (explicitDeck.Length != config.deckSize || explicitDeck.Any(c => c == null || !ids.Contains(c.id)))
                        throw new ArgumentException("测试卡组数量或卡牌引用无效。");
                    foreach (var card in explicitDeck) State.Decks[owner].Add(catalog.First(c => c.id == card.id));
                }
                else for (int i = 0; i < config.deckSize; i++) State.Decks[owner].Add(catalog[i % catalog.Length]);
                Shuffle(State.Decks[owner]);
            }
            for (int i = 0; i < 2; i++)
            {
                int cell;
                do { cell = random.Next(State.Board.Length); } while (State.Board[cell] != null);
                State.Board[cell] = new Piece { Uid = ++nextUid, Owner = 0, Power = random.Next(2, 4) };
            }
            State.ActivePlayer = random.Next(1, 3);
            Log("start", "系统", "双方", "创建演示", "对局开始；随机种子 " + seed + "；先手 ID：" + PlayerName(State.ActivePlayer));
            Draw(State.ActivePlayer, 2);
            Draw(3 - State.ActivePlayer, 3);
            BeginTurn();
        }

        private void Shuffle<T>(IList<T> list)
        {
            for (int i = list.Count - 1; i > 0; i--)
            {
                int j = random.Next(i + 1);
                T temp = list[i]; list[i] = list[j]; list[j] = temp;
            }
        }

        public string PlayerName(int owner) { return owner == 1 ? Config.playerId : owner == 2 ? Config.aiId : "中立"; }
        public int Score(int owner) { return State.Board.Count(p => p != null && p.Owner == owner); }
        private bool InBoard(int cell) { return cell >= 0 && cell < State.Board.Length; }
        private bool CanAct(int owner) { return !State.Finished && (owner == 1 || owner == 2) && State.ActivePlayer == owner && State.Actions > 0; }
        public string CellName(int cell) { return "(" + (cell / Config.boardSize + 1) + "," + (cell % Config.boardSize + 1) + ")"; }
        private string Label(Piece piece) { return PlayerName(piece.Owner) + " / " + piece.Name + "#" + piece.Uid; }

        public IEnumerable<int> Neighbours(int cell)
        {
            int size = Config.boardSize;
            if (cell >= size) yield return cell - size;
            if (cell / size < size - 1) yield return cell + size;
            if (cell % size > 0) yield return cell - 1;
            if (cell % size < size - 1) yield return cell + 1;
        }

        private void Draw(int owner, int count)
        {
            for (int i = 0; i < count; i++)
            {
                if (State.Hands[owner].Count >= Config.handLimit)
                { Log("draw-skipped", PlayerName(owner), "手牌", "手牌已满", PlayerName(owner) + " 手牌已满，跳过抽牌。"); break; }
                if (State.Decks[owner].Count == 0)
                { Log("draw-skipped", PlayerName(owner), "牌库", "牌库已空", PlayerName(owner) + " 牌库已空，不生成额外卡牌。"); break; }
                var card = State.Decks[owner][State.Decks[owner].Count - 1];
                State.Decks[owner].RemoveAt(State.Decks[owner].Count - 1);
                State.Hands[owner].Add(card);
                // Public flow never reveals an opponent's hidden hand card name.
                Log("draw", PlayerName(owner), "手牌", "抽牌", PlayerName(owner) + " 抽取 1 张卡牌。");
            }
        }

        private void BeginTurn()
        {
            State.Turn++;
            State.Actions = State.Turn == 1 ? 1 : 2;
            foreach (var piece in State.Board)
                if (piece != null && piece.Owner == State.ActivePlayer) { piece.Resting = false; piece.Moved = false; }
            Log("turn", PlayerName(State.ActivePlayer), "回合", "准备阶段", PlayerName(State.ActivePlayer) + " 开始回合，行动数 " + State.Actions + "。");
            Draw(State.ActivePlayer, 1);
            TriggerOwnerSkills(SkillTrigger.OnOwnTurnStart);
        }

        public bool CanPlace(int owner, int handIndex, int cell)
        {
            return CanAct(owner) && InBoard(cell) && State.Board[cell] == null && handIndex >= 0 && handIndex < State.Hands[owner].Count;
        }

        public bool Place(int owner, int handIndex, int cell)
        {
            if (!CanPlace(owner, handIndex, cell)) return false;
            StartSkillCommand();
            var definition = State.Hands[owner][handIndex];
            var piece = new Piece { Uid = ++nextUid, Definition = definition, Owner = owner, Power = definition.baseAttack, Resting = true };
            State.Hands[owner].RemoveAt(handIndex);
            State.Board[cell] = piece;
            State.Actions--;
            Log("place", Label(piece), CellName(cell), "放置", Label(piece) + " 放置于 " + CellName(cell) + "，进入休整。");
            if (CheckVictory()) return true;
            switch (definition.ParsedEffect)
            {
                case DemoEffect.BoostAdjacent:
                    foreach (int neighbour in Neighbours(cell))
                        if (State.Board[neighbour] != null && State.Board[neighbour].Owner == owner)
                            ChangePower(piece, State.Board[neighbour], 1, "鼓舞 / 入阵");
                    break;
                case DemoEffect.WeakenEnemy:
                    var target = Neighbours(cell).Where(n => State.Board[n] != null && State.Board[n].Owner != owner)
                        .OrderByDescending(n => State.Board[n].Power).ThenBy(n => n).Select(n => State.Board[n]).FirstOrDefault();
                    if (target != null) ChangePower(piece, target, -1, "压制 / 入阵");
                    else Log("no-target", Label(piece), "无", "压制", Label(piece) + " 的压制没有合法目标。");
                    break;
                case DemoEffect.Shield:
                    piece.Shield = true;
                    Log("shield", Label(piece), Label(piece), "护盾 / 入阵", Label(piece) + " 获得一次交战保护。");
                    break;
            }
            RunSkills(piece, cell, SkillTrigger.OnPlace);
            return true;
        }

        public bool CanMove(int owner, int from, int to)
        {
            if (!CanAct(owner) || !InBoard(from) || !InBoard(to)) return false;
            var piece = State.Board[from];
            return piece != null && piece.Owner == owner && !piece.Resting && !piece.Moved
                && Neighbours(from).Contains(to) && (State.Board[to] == null || State.Board[to].Owner != owner);
        }

        public bool Move(int owner, int from, int to)
        {
            if (!CanMove(owner, from, to)) return false;
            StartSkillCommand();
            var attacker = State.Board[from];
            var defender = State.Board[to];
            State.Actions--;
            attacker.Moved = true;
            if (defender == null)
            {
                State.Board[from] = null;
                State.Board[to] = attacker;
                Log("move", Label(attacker), CellName(to), "主动移动", Label(attacker) + " 从 " + CellName(from) + " 移至 " + CellName(to) + "。");
                if (!CheckVictory()) RunSkills(attacker, to, SkillTrigger.OnMove);
                return true;
            }

            int attackPower = attacker.Power, defensePower = defender.Power;
            Log("combat", Label(attacker), Label(defender), "战力比较", Label(attacker) + "（" + attackPower + "）攻击 " + Label(defender) + "（" + defensePower + "）。");
            // Fix casualties before death effects; equal-power destruction is simultaneous.
            bool killAttacker = attackPower <= defensePower && !Absorb(attacker, defender);
            bool killDefender = attackPower >= defensePower && !Absorb(defender, attacker);
            if (killAttacker) Remove(from, attacker, defender);
            if (killDefender) Remove(to, defender, attacker);
            if (attackPower > defensePower && killDefender && !killAttacker)
            {
                State.Board[from] = null;
                State.Board[to] = attacker;
                Log("advance", Label(attacker), CellName(to), "交战获胜", Label(attacker) + " 进入 " + CellName(to) + "。");
            }
            if (CheckVictory()) return true;
            if (killAttacker) LastWill(attacker, from);
            if (killDefender) LastWill(defender, to);
            if (!State.Finished && Array.IndexOf(State.Board, attacker) >= 0)
                RunSkills(attacker, Array.IndexOf(State.Board, attacker), SkillTrigger.AfterCombat);
            if (!State.Finished && Array.IndexOf(State.Board, defender) >= 0)
                RunSkills(defender, Array.IndexOf(State.Board, defender), SkillTrigger.AfterCombat);
            return true;
        }

        private bool Absorb(Piece target, Piece source, string reason = "交战")
        {
            if (!target.Shield) return false;
            target.Shield = false;
            Log("protected", Label(source), Label(target), "护盾抵挡" + reason + "摧毁", Label(target) + " 因护盾抵挡了来自 " + Label(source) + " 的「" + reason + "」摧毁，消耗护盾并留在原格。");
            return true;
        }

        private void Remove(int cell, Piece target, Piece source)
        {
            State.Board[cell] = null;
            Log("destroyed", Label(source), Label(target), "交战战力不高于对手", Label(target) + " 因与 " + Label(source) + " 交战被摧毁，离开 " + CellName(cell) + "。");
        }

        private void LastWill(Piece source, int oldCell)
        {
            if (State.Finished || source.Definition == null) return;
            RunSkills(source, oldCell, SkillTrigger.OnDestroyed);
            if (State.Finished || source.Definition.ParsedEffect != DemoEffect.LastWill) return;
            var targets = Neighbours(oldCell).Select(n => State.Board[n]).Where(p => p != null && p.Owner == source.Owner).ToArray();
            foreach (var target in targets) ChangePower(source, target, 1, "遗志 / 被摧毁后");
            if (targets.Length == 0) Log("no-target", Label(source), "无", "遗志", Label(source) + " 的遗志没有合法目标。");
        }

        private void ChangePower(Piece source, Piece target, int delta, string reason, bool temporary = false)
        {
            int before = target.Power;
            if (temporary) target.TemporaryPower += delta;
            else target.PermanentPower = Math.Max(0, target.PermanentPower + delta);
            Log("power", Label(source), Label(target), reason, Label(source) + " 因「" + reason + "」使 " + Label(target) + " 战力 " + before + " → " + target.Power + "。");
        }

        public bool EndTurn(int owner, string reason = "主动结束")
        {
            if (State.Finished || owner != State.ActivePlayer) return false;
            StartSkillCommand();
            ClearTemporaryPower();
            TriggerOwnerSkills(SkillTrigger.OnOwnTurnEnd);
            if (State.Finished) return true;
            ClearTemporaryPower();
            Log("end-turn", PlayerName(owner), "回合", reason, PlayerName(owner) + " 结束回合（" + reason + "）。");
            if (State.Turn >= Config.maxTurns)
            {
                int first = Score(1), second = Score(2);
                Finish(first == second ? 0 : first > second ? 1 : 2, "达到回合上限");
            }
            else { State.ActivePlayer = 3 - owner; StartSkillCommand(); BeginTurn(); }
            return true;
        }

        public bool Surrender(int owner)
        {
            if (State.Finished || (owner != 1 && owner != 2)) return false;
            Finish(3 - owner, PlayerName(owner) + " 认输");
            return true;
        }

        private bool CheckVictory()
        {
            if (State.Finished) return true;
            for (int owner = 1; owner <= 2; owner++)
                if (Score(owner) >= VictoryThreshold) { Finish(owner, "达到占领胜利阈值"); return true; }
            return false;
        }

        private void Finish(int winner, string reason)
        {
            State.Finished = true; State.Winner = winner; State.FinishReason = reason;
            Log("finished", "系统", winner == 0 ? "平局" : PlayerName(winner), reason,
                (winner == 0 ? "平局" : "获胜者 ID：" + PlayerName(winner)) + "；比分 " + Score(1) + " : " + Score(2) + "；回合数 " + State.Turn + "；" + reason + "。");
        }

        public List<DemoAction> LegalActions(int owner)
        {
            var result = new List<DemoAction>();
            if (!CanAct(owner)) return result;
            for (int cell = 0; cell < State.Board.Length; cell++)
            {
                for (int hand = 0; hand < State.Hands[owner].Count; hand++)
                    if (CanPlace(owner, hand, cell)) result.Add(new DemoAction { IsPlacement = true, From = hand, To = cell });
                foreach (int to in Neighbours(cell))
                    if (CanMove(owner, cell, to)) result.Add(new DemoAction { From = cell, To = to });
            }
            return result;
        }

        public bool StepAi()
        {
            if (State.Finished || State.ActivePlayer != 2) return false;
            var actions = LegalActions(2);
            if (actions.Count == 0) return EndTurn(2, "AI 无可执行操作");
            // Starter heuristic only; production AI and all production skill predictions are not ported.
            var action = actions.OrderByDescending(ActionValue).First();
            return action.IsPlacement ? Place(2, action.From, action.To) : Move(2, action.From, action.To);
        }

        private double ActionValue(DemoAction action)
        {
            if (action.IsPlacement)
            {
                var card = State.Hands[2][action.From];
                return 10 + card.baseAttack * 0.1 + (card.ParsedEffect == DemoEffect.BoostAdjacent
                    ? Neighbours(action.To).Count(n => State.Board[n] != null && State.Board[n].Owner == 2) : 0);
            }
            var attacker = State.Board[action.From]; var defender = State.Board[action.To];
            if (defender == null) return 0;
            if (attacker.Power > defender.Power)
                return defender.Shield ? 2 : (defender.Owner == 0 ? 11 : 15) - (defender.Definition != null && defender.Definition.ParsedEffect == DemoEffect.LastWill ? 4 : 0);
            return attacker.Shield ? -1 : -10;
        }

        private void Log(string kind, string source, string target, string reason, string message)
        {
            State.Events.Add(new FlowEvent { Sequence = State.Events.Count + 1, Turn = State.Turn, Kind = kind,
                Source = source, Target = target, Reason = reason, Message = message });
        }
    }
}
