using System;
using System.Collections.Generic;

namespace CardDemo.Core
{
    [Serializable]
    public sealed class GameConfig
    {
        public string title = "Unity Card Demo";
        public string playerId = "Player_001";
        public string aiId = "AI_Demo";
        public int boardSize = 4;
        public int deckSize = 20;
        public int handLimit = 5;
        public int maxTurns = 30;
        public int turnSeconds = 300;
        public int seed;
        public float aiDelaySeconds = 0.65f;
        public bool useWorkshopCards;
        public string playerDeckId = "workshop_player";
        public string aiDeckId = "workshop_ai";
        // Reserved connection settings, not a working network client. Never store secrets here.
        public string serverUrl = "";
        public string wechatAppId = "";

        public void Validate()
        {
            if (boardSize != 4 && boardSize != 5) throw new ArgumentException("棋盘尺寸仅支持 4 或 5。");
            if (deckSize < 5 || deckSize > 100) throw new ArgumentException("牌库数量必须在 5 到 100 之间。");
            if (handLimit < 3 || handLimit > 10) throw new ArgumentException("手牌上限必须在 3 到 10 之间。");
            if (maxTurns < 2 || maxTurns > 100) throw new ArgumentException("总回合数必须在 2 到 100 之间。");
            if (turnSeconds < 10 || turnSeconds > 1800) throw new ArgumentException("回合时间必须在 10 到 1800 秒之间。");
            if (float.IsNaN(aiDelaySeconds) || float.IsInfinity(aiDelaySeconds) || aiDelaySeconds < 0.1f || aiDelaySeconds > 5)
                throw new ArgumentException("AI 行动间隔必须在 0.1 到 5 秒之间。");
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(playerId) || string.IsNullOrWhiteSpace(aiId))
                throw new ArgumentException("标题和玩家 ID 不能为空。");
            if (playerId == aiId) throw new ArgumentException("玩家和 AI 的 ID 必须不同。");
            if (useWorkshopCards && (string.IsNullOrWhiteSpace(playerDeckId) || string.IsNullOrWhiteSpace(aiDeckId)))
                throw new ArgumentException("使用制作库时必须指定双方测试卡组 ID。");
            if (!string.IsNullOrEmpty(serverUrl))
            {
                Uri uri;
                if (!Uri.TryCreate(serverUrl, UriKind.Absolute, out uri) || (uri.Scheme != "https" && uri.Scheme != "wss"))
                    throw new ArgumentException("预留服务器地址必须为 HTTPS 或 WSS。");
            }
        }
    }

    public enum DemoEffect { None, BoostAdjacent, WeakenEnemy, Shield, LastWill }

    [Serializable]
    public sealed class CardDefinition
    {
        public string id;
        public string name;
        public string camp;
        public string rarity;
        public int baseAttack;
        public string skill;
        public string effect;
        public string demoEffect;
        public SkillDefinition[] abilities;

        public DemoEffect ParsedEffect
        {
            get
            {
                DemoEffect value;
                if (!Enum.TryParse(demoEffect, out value) || !Enum.IsDefined(typeof(DemoEffect), value))
                    throw new ArgumentException("未知演示技能：" + demoEffect);
                return value;
            }
        }
    }

    [Serializable]
    public sealed class CardCatalog
    {
        public int schemaVersion;
        public string sourceSchema;
        public string usage;
        public string[] defaultCardIds;
        public CardDefinition[] cards;
    }

    public sealed class Piece
    {
        public int Uid;
        public CardDefinition Definition;
        public int Owner; // 0 = neutral, 1 = human, 2 = AI; never follows turn perspective.
        public int PermanentPower;
        public int Power { get { return Math.Max(0, PermanentPower + TemporaryPower); } set { PermanentPower = Math.Max(0, value); } }
        public bool Resting;
        public bool Moved;
        public bool Shield;
        public int TemporaryPower;
        public string Name { get { return Definition == null ? "中立守军" : Definition.name; } }
    }

    public sealed class FlowEvent
    {
        public int Sequence;
        public int Turn;
        public string Kind;
        public string Source;
        public string Target;
        public string Reason;
        public string Message;
        public override string ToString() { return "[" + Sequence + " · 回合 " + Turn + "] " + Message; }
    }

    public sealed class GameState
    {
        public Piece[] Board;
        public readonly List<CardDefinition>[] Hands = { new List<CardDefinition>(), new List<CardDefinition>(), new List<CardDefinition>() };
        public readonly List<CardDefinition>[] Decks = { new List<CardDefinition>(), new List<CardDefinition>(), new List<CardDefinition>() };
        public readonly List<FlowEvent> Events = new List<FlowEvent>();
        public int ActivePlayer;
        public int Turn;
        public int Actions;
        public bool Finished;
        public int Winner; // 0 = draw
        public string FinishReason;
    }

    public sealed class DemoAction
    {
        public bool IsPlacement;
        public int From;
        public int To;
    }
}
