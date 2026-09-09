/* Display-only text for randomized elite AI traits. The workbook is authoritative. */
(() => {
  window.ELITE_AI_EFFECT_INFO_V2 = Object.freeze({
    "1001": Object.freeze({ name: "鼓舞", description: "回合开始时，我方随机一张卡牌战力+1。", level: "beginner", levelLabel: "初级" }),
    "1002": Object.freeze({ name: "冷箭", description: "回合开始时，对方随机一张卡牌战力-1。", level: "beginner", levelLabel: "初级" }),
    "1003": Object.freeze({ name: "厚葬", description: "我方卡牌被摧毁时，抽一张卡牌。", level: "beginner", levelLabel: "初级" }),
    "1004": Object.freeze({ name: "军备", description: "回合开始时，我方抽一张卡。", level: "beginner", levelLabel: "初级" }),
    "1005": Object.freeze({ name: "援军", description: "卡组抽光后，将会抽出一张战力为1的“援兵”。", level: "beginner", levelLabel: "初级" }),
    "1006": Object.freeze({ name: "当先", description: "每回合放置的第一张卡牌，额外触发一次“入阵效果”。", level: "beginner", levelLabel: "初级" }),
    "1007": Object.freeze({ name: "慎行", description: "每回合放置第一张卡牌，直至下一个我方回合开始前战力+3。", level: "beginner", levelLabel: "初级" }),
    "1008": Object.freeze({ name: "断粮", description: "手牌始终为1张。", level: "beginner", levelLabel: "初级" }),
    "1009": Object.freeze({ name: "野望", description: "回合开始时，敌方卡牌本回合战力-1。", level: "beginner", levelLabel: "初级" }),
    "1010": Object.freeze({ name: "急奔", description: "我方卡牌被放置后，将不会进入休整。", level: "beginner", levelLabel: "初级" }),
    "1011": Object.freeze({ name: "无言", description: "此条无效果", level: "beginner", levelLabel: "初级" }),
    "2001": Object.freeze({ name: "战鼓擂", description: "回合开始时，我方战力最低的卡牌战力+2。", level: "intermediate", levelLabel: "中级" }),
    "2002": Object.freeze({ name: "羽林列", description: "我方卡牌放置时，战力+1。", level: "intermediate", levelLabel: "中级" }),
    "2003": Object.freeze({ name: "烽火起", description: "本场敌方的“起势”效果无效。", level: "intermediate", levelLabel: "中级" }),
    "2004": Object.freeze({ name: "关山急", description: "我方卡牌战力不能低于2。敌方卡牌战力不能高于5。", level: "intermediate", levelLabel: "中级" }),
    "2005": Object.freeze({ name: "鸿门宴", description: "敌方卡牌放置时战力+1。回合开始时，非我方卡牌战力-1。", level: "intermediate", levelLabel: "中级" }),
    "2006": Object.freeze({ name: "丹书诏", description: "敌方抽卡时我方抽一张；若手牌已满则随机一张我方卡牌战力+1。", level: "intermediate", levelLabel: "中级" }),
    "2007": Object.freeze({ name: "古道尘", description: "敌方战力最高的卡牌无法移动。", level: "intermediate", levelLabel: "中级" }),
    "2008": Object.freeze({ name: "城下盟", description: "我方回合内，我方卡牌无法被摧毁。", level: "intermediate", levelLabel: "中级" }),
    "3001": Object.freeze({ name: "振奋人心", description: "回合开始时，我方卡牌战力+1。", level: "advanced", levelLabel: "高级" }),
    "3002": Object.freeze({ name: "虚弱无力", description: "敌方卡牌放置时，战力-2。", level: "advanced", levelLabel: "高级" }),
    "3003": Object.freeze({ name: "灵动迅捷", description: "我方基础行动数+1。", level: "advanced", levelLabel: "高级" }),
    "3004": Object.freeze({ name: "凤鸣九霄", description: "我方每回合放置的第一张卡牌不消耗行动数，且战力+3。", level: "advanced", levelLabel: "高级" }),
    "3005": Object.freeze({ name: "勇冠三军", description: "我方卡牌移动时，战力+2。", level: "advanced", levelLabel: "高级" }),
    "3006": Object.freeze({ name: "破釜沉舟", description: "我方卡牌被摧毁后，使其他我方卡牌战力+1。", level: "advanced", levelLabel: "高级" }),
    "3007": Object.freeze({ name: "关山暮雪", description: "敌方无法放置战力低于1的卡牌。", level: "advanced", levelLabel: "高级" }),
    "3008": Object.freeze({ name: "暗度陈仓", description: "每次放置卡牌后，我方手牌中卡牌战力+1。", level: "advanced", levelLabel: "高级" })
  });
  window.ELITE_AI_EFFECT_ID_ALIASES_V2 = Object.freeze({});
})();
