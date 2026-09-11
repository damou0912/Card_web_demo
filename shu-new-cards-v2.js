/* 新增蜀卡技能实现 (10张) */

// 01121 - 李恢 - 回驰 - 起势：随机交换自身与四方相邻一张卡牌的位置。
shu["01121"] = {
  onTurnStart(ctx) {
    const allies = ctx.allies();
    if (allies.length) {
      const target = ctx.pickRandom(allies);
      if (target && ctx.canSwap(ctx.card, target)) {
        ctx.swap(ctx.card, target);
      }
    }
  }
};

// 01122 - 张任 - 锐进 - 起势：向四方相邻一张敌方卡牌发起攻击；若成功发起战斗永久+1。
shu["01122"] = {
  onTurnStart(ctx) {
    const enemies = ctx.enemies();
    const target = ctx.pickRandom(enemies);
    if (target && ctx.canFight(ctx.card, target)) {
      ctx.skillAttack(ctx.card, target);
      if (!target.destroyed) {
        ctx.adjust(ctx.card, 1);
      }
    }
  }
};

// 01123 - 陈到 - 白毦 - 入阵：本回合我方卡牌不会进入休整状态。
shu["01123"] = {
  onPlace(ctx) {
    // 标记当前玩家的卡牌本回合不进入休整
    ctx.player.cards.forEach((card) => {
      card.v2NoRest = true;
    });
  }
};

// 01124 - 刘封 - 鼎力 - 起势：战力-1；摧毁四方相邻战力低于此卡的非我方卡牌。
shu["01124"] = {
  onTurnStart(ctx) {
    ctx.adjust(ctx.card, -1);
    ctx.enemies().forEach((enemy) => {
      if (enemy.currentAttack < ctx.card.currentAttack) {
        ctx.destroy(enemy);
      }
    });
  }
};

// 01225 - 刘琦 - 继任 - 入阵：此卡无法被移动；四方相邻敌方卡牌无法移动。遗志：锁定的卡牌可以移动。
shu["01225"] = {
  flags: { cannotMove: true },
  onPlace(ctx) {
    ctx.card.v2Locked = true;
    ctx.enemies().forEach((enemy) => {
      enemy.v2Locked = true;
    });
  },
  onDestroy(ctx) {
    ctx.enemies().forEach((enemy) => {
      enemy.v2Locked = false;
    });
  }
};

// 01226 - 法正 - 密策 - 起势：本回合合第一张放置的卡牌战力+2。
shu["01226"] = {
  onTurnStart(ctx) {
    // 标记本回合第一张放置的卡牌获得+2
    ctx.player.v2FirstPlaceBonus = 2;
  }
};

// 01227 - 蒋琬 - 安国 - 起势：若四方相邻的合法格子内都为友军则行动数+1。
shu["01227"] = {
  onTurnStart(ctx) {
    const allies = ctx.allies();
    const adjacentCount = ctx.board.filter((card) => (
      ctx.isAdjacent(ctx.card, card) && card.ownerId === ctx.card.ownerId
    )).length;
    // 四方最多4个相邻
    if (adjacentCount === 4 || (adjacentCount > 0 && adjacentCount === ctx.enemies().length)) {
      ctx.addActions(ctx.player, 1);
    }
  }
};

// 01328 - 张飞 - 万夫莫当 - 入阵：攻击四方相邻的随机一张敌方卡牌。攻击后，若成功摧毁敌方卡牌，则再攻击四方相邻的随机一张敌方卡牌。起势：战力-2。
shu["01328"] = {
  onPlace(ctx) {
    let target = ctx.pickRandom(ctx.enemies());
    if (target) {
      ctx.skillAttack(ctx.card, target);
      if (target.destroyed) {
        target = ctx.pickRandom(ctx.enemies());
        if (target) ctx.skillAttack(ctx.card, target);
      }
    }
  },
  onTurnStart(ctx) {
    ctx.adjust(ctx.card, -2, true);
  }
};

// 01429 - 刘备（传说） - 汉室中兴 - 起势：我方卡牌战力+1。敌方卡牌战力无法增加。无法移动。
shu["01429"] = {
  flags: { cannotMove: true },
  onTurnStart(ctx) {
    ctx.player.cards.forEach((card) => {
      ctx.adjust(card, 1, true);
    });
  },
  onBeforeAdjust(ctx, target) {
    if (target.ownerId !== ctx.card.ownerId) {
      return 0; // 敌方卡牌无法增加战力
    }
  }
};

// 01530 - 七星灯 - 星落五丈原 - 我方其他卡牌被摧毁时，此卡牌战力-3，免疫此次摧毁。收势：摧毁我方其他战力为0的卡牌。
shu["01530"] = {
  onBeforeAllyDestroy(ctx) {
    ctx.adjust(ctx.card, -3);
    return false; // 代替被摧毁
  },
  onTurnEnd(ctx) {
    // 收势：摧毁所有友方战力为0的卡牌
    ctx.player.cards.forEach((card) => {
      if (card !== ctx.card && card.currentAttack === 0) {
        ctx.destroy(card);
      }
    });
  }
};
