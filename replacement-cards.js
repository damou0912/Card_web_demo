/* Generated from outputs/card-info-table-xlsx/card_info_v2.xlsx. */
/* 这些卡牌可用于在修改卡组页面中替换默认卡组中相同品质的卡牌 */
/* Run: npm run generate:card-info */
const REPLACEMENT_CARDS = [
  {
    "id": "01121",
    "name": "李恢",
    "camp": "三国~蜀",
    "skill": "回驰",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "普通",
    "effect": "起势：随机交换自身与四方相邻一张卡牌的位置。"
  },
  {
    "id": "01122",
    "name": "张任",
    "camp": "三国~蜀",
    "skill": "锐进",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "普通",
    "effect": "起势：向四方相邻一张敌方卡牌发起攻击；若成功发起战力永久+1。"
  },
  {
    "id": "01123",
    "name": "陈到",
    "camp": "三国~蜀",
    "skill": "白毦",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "普通",
    "effect": "入阵：本回合我方卡牌不会进入休整状态。解除我方卡牌的休整状态。"
  },
  {
    "id": "01124",
    "name": "刘封",
    "camp": "三国~蜀",
    "skill": "鼎力",
    "baseAttack": 3,
    "attack": 3,
    "rarity": "普通",
    "effect": "起势：战力-1；摧毁四方相邻一张战力低于此卡的非我方卡牌。"
  },
  {
    "id": "01225",
    "name": "刘琦",
    "camp": "三国~蜀",
    "skill": "继任",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "稀有",
    "effect": "1、入阵：此卡无法被移动；四方相邻敌方卡牌无法移动。\r\n2、遗志：锁定的卡牌可以移动。"
  },
  {
    "id": "01226",
    "name": "法正",
    "camp": "三国~蜀",
    "skill": "密策",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "稀有",
    "effect": "起势：本回合第一张放置的卡牌战力+2。"
  },
  {
    "id": "01227",
    "name": "蒋琬",
    "camp": "三国~蜀",
    "skill": "安国",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "稀有",
    "effect": "起势：若四方相邻的合法格子内都为友军则行动数+1。"
  },
  {
    "id": "01328",
    "name": "张飞",
    "camp": "三国~蜀",
    "skill": "万夫莫当",
    "baseAttack": 4,
    "attack": 4,
    "rarity": "史诗",
    "effect": "1、入阵：攻击四方相邻的随机一张敌方卡牌。\r\n2、攻击后，若成功摧毁敌方卡牌，则攻击四方相邻的随机一张敌方卡牌。\r\n3、起势：战力-2。攻击四方相邻的随机一张地方卡牌。"
  },
  {
    "id": "01429",
    "name": "刘备",
    "camp": "三国~蜀",
    "skill": "汉室中兴",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "传说",
    "effect": "1、起势：我方卡牌本回合战力+1。此卡牌战力变为1。\r\n2、敌方回合结束时，敌方卡牌回到回合开始时的战力。\r\n3、无法移动。"
  },
  {
    "id": "01530",
    "name": "七星灯",
    "camp": "三国~蜀",
    "skill": "星落五丈原",
    "baseAttack": 0,
    "attack": 0,
    "rarity": "特殊",
    "effect": "1、我方其他卡牌被摧毁时，该卡牌战力-3，免疫此次摧毁。\r\n2、收势：摧毁我方其他战力为0的卡牌。"
  },
  {
    "id": "02121",
    "name": "文聘",
    "camp": "三国~魏",
    "skill": "坚守江夏",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "普通",
    "effect": "入阵：四方相邻无非友军卡牌，则战力+1。"
  },
  {
    "id": "02122",
    "name": "牛金",
    "camp": "三国~魏",
    "skill": "奋勇突围",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "普通",
    "effect": "入阵：四方相邻存在非友方卡牌，本回合战力+2，并随机攻击一张卡牌。"
  },
  {
    "id": "02123",
    "name": "王异",
    "camp": "三国~魏",
    "skill": "坚城励军",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "普通",
    "effect": "入阵：最低战力的我方卡牌战力+1。"
  },
  {
    "id": "02124",
    "name": "陈群",
    "camp": "三国~魏",
    "skill": "九品铨选",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "普通",
    "effect": "入阵：我方有手牌时，我方随机手牌战力+1。否则抽取一张卡牌。"
  },
  {
    "id": "02225",
    "name": "郭淮",
    "camp": "三国~魏",
    "skill": "御边",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "稀有",
    "effect": "起势：此卡在战场边缘时，使我方所有位于战场边缘的卡牌本回合战力+1。"
  },
  {
    "id": "02226",
    "name": "满宠",
    "camp": "三国~魏",
    "skill": "坚守合肥",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "稀有",
    "effect": "被攻击时，本回合战力+2，四方相邻友方卡牌本回合战力+1。"
  },
  {
    "id": "02227",
    "name": "邓艾",
    "camp": "三国~魏",
    "skill": "暗度阴平",
    "baseAttack": 3,
    "attack": 3,
    "rarity": "稀有",
    "effect": "可以斜向移动，但斜向移动不能攻击。"
  },
  {
    "id": "02328",
    "name": "张辽",
    "camp": "三国~魏",
    "skill": "威震逍遥津",
    "baseAttack": 3,
    "attack": 3,
    "rarity": "史诗",
    "effect": "1、主动攻击时，本回合战力+2。\r\n2、摧毁敌方卡牌，本回合行动数+1。"
  },
  {
    "id": "02429",
    "name": "曹丕",
    "camp": "三国~魏",
    "skill": "受禅",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "传说",
    "effect": "1、入阵：随机一张其他我方卡牌战力+1。\r\n2、其他我方卡牌战力永久增加时，此卡战力+1。\r\n3、起势：若此卡战力不低于其他我方卡牌，本回合行动数+1。"
  },
  {
    "id": "02530",
    "name": "魏武虎符",
    "camp": "三国~魏",
    "skill": "调兵遣将",
    "baseAttack": 0,
    "attack": 0,
    "rarity": "特殊",
    "effect": "1、此卡无法主动移动。\r\n2、此卡在场时，每回合放置的第一张其他我方卡牌不消耗行动次数。"
  },
  {
    "id": "03121",
    "name": "朱桓",
    "camp": "三国~吴",
    "skill": "奋命",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "普通",
    "effect": "遗志：摧毁此卡的卡牌，战力变为1点。"
  },
  {
    "id": "03122",
    "name": "董袭",
    "camp": "三国~吴",
    "skill": "断后",
    "baseAttack": 3,
    "attack": 3,
    "rarity": "普通",
    "effect": "遗志：随机将1张四方相邻的其他我方卡牌移动至此卡原位置，并使其战力永久+1。"
  },
  {
    "id": "03123",
    "name": "贺齐",
    "camp": "三国~吴",
    "skill": "整舟",
    "baseAttack": 4,
    "attack": 4,
    "rarity": "普通",
    "effect": "遗志：弃一张手牌。"
  },
  {
    "id": "03124",
    "name": "步骘",
    "camp": "三国~吴",
    "skill": "安民",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "普通",
    "effect": "入阵、遗志：抽取1张卡牌；若抽牌失败，随机使场上1张其他我方卡牌战力永久+1。"
  },
  {
    "id": "03225",
    "name": "鲁肃",
    "camp": "三国~吴",
    "skill": "榻上策",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "稀有",
    "effect": "入阵：双方各抽取1张卡牌；每有一方成功抽牌，此卡战力永久+1。"
  },
  {
    "id": "03226",
    "name": "周鲂",
    "camp": "三国~吴",
    "skill": "诈降书",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "稀有",
    "effect": "1、入阵：敌方随机弃置1张手牌。\r\n2、遗志：敌方抽取2张卡牌。"
  },
  {
    "id": "03227",
    "name": "陆抗",
    "camp": "三国~吴",
    "skill": "固守江陵",
    "baseAttack": 3,
    "attack": 3,
    "rarity": "稀有",
    "effect": "其他我方卡牌移动后，若位于此卡四方相邻，该卡战力永久+1。"
  },
  {
    "id": "03328",
    "name": "孙坚",
    "camp": "三国~吴",
    "skill": "举兵江东",
    "baseAttack": 4,
    "attack": 4,
    "rarity": "史诗",
    "effect": "1、遗志：敌方抽卡至手牌上限。\r\n2、入阵：抽2张牌。\r\n3、起势：本回合第一次友方卡牌的主动移动不消耗行动数。"
  },
  {
    "id": "03429",
    "name": "孙权",
    "camp": "三国~吴",
    "skill": "坐断东南",
    "baseAttack": 2,
    "attack": 2,
    "rarity": "传说",
    "effect": "1、其他我方卡牌被摧毁时，此卡战力永久+1，并抽取1张卡牌。\r\n2、遗志：随机触发场上1张其他我方卡牌的遗志。\r\n3、起势：场上其他我方卡牌数量少于敌方卡牌数量时，本回合行动数+1。"
  },
  {
    "id": "03530",
    "name": "传国玉玺",
    "camp": "三国~吴",
    "skill": "江东正统",
    "baseAttack": 0,
    "attack": 0,
    "rarity": "特殊",
    "effect": "1、此卡无法主动移动。\r\n2、起势：随机触发场上1张其他我方卡牌的遗志。\r\n3、遗志：弃置所有手牌，并抽取等量手牌。"
  }
];
window.REPLACEMENT_CARDS = REPLACEMENT_CARDS;
