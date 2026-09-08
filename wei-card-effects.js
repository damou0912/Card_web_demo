/* Wei V2 card effects. Display data is intentionally not imported here. */
(() => {
  const wei = {};

  wei["02101"] = {
    onPlace(ctx) {
      const enemy = ctx.otherPlayer;
      if (ctx.player.hand.length < ctx.handLimit && ctx.player.hand.length <= (enemy?.hand.length || 0)) {
        ctx.draw(ctx.player);
        ctx.log("抽取 1 张牌。");
      }
    }
  };

  wei["02102"] = {
    onPlace(ctx) {
      const target = ctx.pickRandom(ctx.enemies());
      if (target) {
        ctx.adjust(target, -1);
        ctx.log("使一张相邻敌方卡牌永久战力-1。");
      }
    }
  };

  wei["02103"] = {
    onPlace(ctx) {
      const target = ctx.pickRandom(ctx.allies());
      if (target) {
        ctx.adjust(target, 1);
        ctx.log("使一张相邻友军永久战力+1。");
      }
    }
  };

  wei["02104"] = {
    onPlace(ctx) {
      const targets = ctx.allies();
      targets.forEach((target) => ctx.adjust(target, 1, true));
      if (targets.length) ctx.log("使相邻友军本回合战力+1。");
    }
  };

  wei["02105"] = {
    onPlace(ctx) {
      const drawCount = ctx.player.hand.length === 0 ? 2 : (ctx.player.hand.length < ctx.handLimit ? 1 : 0);
      let drawn = 0;
      for (let index = 0; index < drawCount; index += 1) {
        if (ctx.draw(ctx.player)) drawn += 1;
      }
      if (drawn) ctx.log(`抽取 ${drawn} 张牌。`);
    }
  };

  wei["02106"] = {
    onPlace(ctx) {
      if (ctx.isEdge(ctx.card)) {
        ctx.adjust(ctx.card, 1);
        ctx.log("位于边缘，战力永久+1。");
      }
    }
  };

  wei["02107"] = {
    onPlace(ctx) {
      const connected = ctx.connectedAllies();
      connected.forEach((target) => ctx.adjust(target, 1, true));
      if (connected.length) ctx.log("使相连友军本回合战力+1。");
    }
  };

  wei["02208"] = {
    onPlace(ctx) {
      if (ctx.discard(ctx.otherPlayer, 1)) ctx.log("使敌方随机弃置 1 张手牌。");
    }
  };

  wei["02209"] = {
    onPlace(ctx) {
      const target = ctx.pickRandom(ctx.allies());
      if (!target) return;
      const cardFrom = ctx.position(ctx.card);
      const targetFrom = ctx.position(target);
      ctx.swapPositions(ctx.card, target);
      ctx.adjust(ctx.card, 1);
      ctx.adjust(target, 1);
      ctx.emitMoved(ctx.card, cardFrom, ctx.position(ctx.card));
      ctx.emitMoved(target, targetFrom, ctx.position(target));
      ctx.log("与一张相邻友军交换位置，双方战力永久+1。");
    }
  };

  wei["02210"] = {
    onBeforeAdjacentAllyDestroy(ctx) {
      if (ctx.card.currentAttack <= 1) return;
      ctx.adjust(ctx.card, -1);
      ctx.log("使相邻友军免于摧毁，自身战力永久-1。");
      return false;
    }
  };

  wei["02211"] = {
    flags: { longMove: true }
  };

  wei["02212"] = {
    onTurnStart(ctx) {
      ctx.player.v2NextPlacementExtra = ctx.card.uid;
      ctx.player.v2NextPlacementExtraTurn = ctx.game.turn;
      ctx.log("回合开始时，使本回合下一张友军的放置技能额外结算1次。");
    }
  };

  wei["02313"] = {
    onPlace(ctx) {
      ctx.adjust(ctx.card, 5);
      ctx.log("放置时自身永久战力+5。");
    },
    onTurnStart(ctx) {
      if (ctx.card.currentAttack < 2) {
        ctx.destroy(ctx.card);
        ctx.log("回合开始时战力不足2，自我摧毁。");
        return;
      }
      ctx.adjust(ctx.card, -2);
      ctx.log("回合开始时自身永久战力-2。");
    }
  };

  wei["02314"] = {
    onPlace(ctx) {
      if (!ctx.board.some((target) => target.uid !== ctx.card.uid && target.currentAttack === 0)) {
        ctx.board.filter((target) => target.uid !== ctx.card.uid).forEach((target) => ctx.adjust(target, -1));
      }
    },
    onTurnEnd(ctx) {
      ctx.board.filter((target) => (
        target.uid !== ctx.card.uid
        && target.v2StartTurn === ctx.game.turn
        && target.v2EnteredTurn !== ctx.game.turn
        && target.currentAttack !== target.v2StartAttack
      )).forEach((target) => ctx.adjust(target, -1));
      let destroyedCount = 0;
      [...ctx.board]
        .filter((target) => target.uid !== ctx.card.uid && target.currentAttack === 0)
        .forEach((target) => { if (ctx.destroy(target)) destroyedCount += 1; });
      if (destroyedCount) {
        ctx.adjust(ctx.card, destroyedCount);
        ctx.log(`在回合结束时摧毁 ${destroyedCount} 张战力为0的其他卡牌，自身永久战力+${destroyedCount}。`);
      }
    }
  };

  wei["02315"] = {
    flags: { preventReduction: true },
    onPlace(ctx) {
      ctx.card.v2PowerGainWatchTurn = ctx.game.turn;
      ctx.log("本回合我方卡牌增加战力时，其战力永久+1。");
    },
    onOwnCardAttackIncreased(ctx) {
      if (ctx.card.v2PowerGainWatchTurn !== ctx.game.turn) return;
      ctx.adjust(ctx.increasedCard, 1);
      ctx.log("使该友方卡牌额外永久战力+1。");
    }
  };

  wei["02416"] = {
    onPlace(ctx) {
      const targets = ctx.board.filter((target) => target.ownerId === ctx.player.id && target.uid !== ctx.card.uid);
      targets.forEach((target) => ctx.adjust(target, 1));
      if (ctx.player.hand.length >= (ctx.otherPlayer?.hand.length || 0)) ctx.addActions(1);
      if (targets.length) ctx.log("使所有其他友军永久战力+1。");
      if (ctx.player.hand.length >= (ctx.otherPlayer?.hand.length || 0)) ctx.log("因手牌不少于敌方，行动数+1。");
    },
    onOtherPlaced(ctx) {
      ctx.adjust(ctx.card, 1);
      ctx.log("因其他友军放置，战力永久+1。");
    }
  };

  wei["02517"] = {
    onPlace(ctx) {
      const target = ctx.pickRandom(ctx.enemies());
      if (!target) return;
      [ctx.card, target]
        .sort((left, right) => ctx.game.boardCards.indexOf(left) - ctx.game.boardCards.indexOf(right))
        .forEach((participant) => ctx.destroy(participant, ctx.card));
    }
  };

  wei["02518"] = {
    onPlace(ctx) {
      const before = ctx.player.hand.length;
      while (ctx.player.hand.length < ctx.handLimit && ctx.player.drawPile.length) ctx.draw(ctx.player);
      if (ctx.player.hand.length > before) ctx.log(`抽取 ${ctx.player.hand.length - before} 张牌。`);
    }
  };

  wei["02519"] = {
    onPlace(ctx) {
      const allies = ctx.allies();
      allies.forEach((target) => ctx.adjust(target, 1, true));
      [...allies]
        .sort((left, right) => ctx.game.boardCards.indexOf(left) - ctx.game.boardCards.indexOf(right))
        .forEach((ally) => {
          if (!ctx.game.boardCards.includes(ally)) return;
          const target = ctx.pickRandom(ctx.enemiesOf(ally).filter((enemy) => ctx.canFight(ally, enemy)));
          if (target) {
            ctx.log("令一张相邻友军自动攻击相邻敌方卡牌。");
            ctx.skillAttack(ally, target);
          }
        });
      if (allies.length) ctx.log("使相邻友军本回合战力+1，并按放置顺序自动攻击。");
    }
  };

  wei["02520"] = {
    onOtherPlaced(ctx) {
      const placedCard = ctx.placedCard;
      if (!placedCard || placedCard.uid === ctx.card.uid || placedCard.ownerId !== ctx.card.ownerId) return;
      if (!ctx.eightAdjacent(ctx.card).some((target) => target.uid === placedCard.uid)) return;
      ctx.adjust(placedCard, 1);
      ctx.preventRest(placedCard);
      ctx.log("使八方相邻友军永久战力+1，且本回合不进入休整。");
    }
  };

  window.CARD_EFFECTS_V2 = window.CARD_EFFECTS_V2 || {};
  window.CARD_EFFECTS_V2.wei = wei;
})();
