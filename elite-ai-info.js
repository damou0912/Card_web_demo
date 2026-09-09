/* Display-only text for randomized elite AI traits. */
(() => {
  window.ELITE_AI_EFFECT_INFO_V2 = Object.freeze({
    "iron-command": Object.freeze({
      name: "铁壁军势",
      description: "每个精英 AI 回合开始时，AI 场上卡牌本回合战力 +1。",
      level: "intermediate",
      levelLabel: "中级",
      color: "purple"
    }),
    "supply-reserve": Object.freeze({
      name: "战备补给",
      description: "每个精英 AI 回合开始时，AI 额外抽取 1 张牌。",
      level: "beginner",
      levelLabel: "初级",
      color: "blue"
    }),
    "hunter-mark": Object.freeze({
      name: "猎杀标记",
      description: "每个精英 AI 回合开始时，敌方当前战力最高的卡牌本回合战力 -1。",
      level: "advanced",
      levelLabel: "高级",
      color: "orange"
    }),
    "tactical-reserve": Object.freeze({
      name: "战术储备",
      description: "精英 AI 每个自己的回合再额外获得 1 个行动位。",
      level: "beginner",
      levelLabel: "初级",
      color: "blue"
    })
  });
})();
