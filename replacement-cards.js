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
    "effect": "入阵：本回合我方卡牌不会进入休整状态。"
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
    "effect": "1、入阵：攻击四方相邻的随机一张敌方卡牌。\r\n2、攻击后，若成功摧毁敌方卡牌，则攻击四方相邻的随机一张敌方卡牌。\r\n3、起势：战力-2。"
  },
  {
    "id": "01429",
    "name": "刘备",
    "camp": "三国~蜀",
    "skill": "汉室中兴",
    "baseAttack": 1,
    "attack": 1,
    "rarity": "传说",
    "effect": "1、起势：我方卡牌战力+1。\r\n2、敌方卡牌战力无法增加。\r\n3、无法移动。"
  },
  {
    "id": "01530",
    "name": "七星灯",
    "camp": "三国~蜀",
    "skill": "星落五丈原",
    "baseAttack": 0,
    "attack": 0,
    "rarity": "特殊",
    "effect": "1、我方其他卡牌被摧毁时，此卡牌战力-3，免疫此次摧毁。\r\n2、收势：摧毁我方其他战力为0的卡牌。"
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
    "effect": "1、入阵：我方有手牌时，我方随机手牌战力+1。否则抽取一张卡牌。"
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
  }
];
window.REPLACEMENT_CARDS = REPLACEMENT_CARDS;
