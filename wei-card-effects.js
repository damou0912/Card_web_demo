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
      targets.forEach((target) => ctx.adjust(target, 1));
      if (targets.length) ctx.log("使相邻友军战力永久+1。");
    }
  };

  wei["02105"] = {
    onPlace(ctx) {
      if (ctx.player.hand.length < ctx.handLimit && ctx.draw(ctx.player)) {
        ctx.log("抽取 1 张牌。");
      }
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
    flags: { protectAdjacent: true }
  };

  wei["02211"] = {
    flags: { longMove: true }
  };

  wei["02212"] = {
    onPlace(ctx) {
      ctx.player.v2NextPlacementExtra = ctx.card.uid;
      ctx.log("使本回合下一张友军的放置技能额外结算1次。");
    }
  };

  wei["02313"] = {
    onPlace(ctx) {
      let zeroedCount = 0;
      const targets = ctx.enemies();
      targets.forEach((target) => {
        const before = target.currentAttack;
        ctx.adjust(target, -2, true);
        if (before > 0 && target.currentAttack === 0) {
          ctx.adjust(ctx.card, 1);
          zeroedCount += 1;
        }
      });
      if (targets.length) ctx.log(`使 ${targets.length} 张相邻敌军本回合战力-2${zeroedCount ? `，自身永久战力+${zeroedCount}` : ""}。`);
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
    flags: { replacementWatcher: true },
    onPlace(ctx) {
      ctx.card.v2ReplacedThisTurn = new Set();
      ctx.log("本回合将尝试重新放置被摧毁的其他友军。");
    },
    onOtherPlaced(ctx) { if (ctx.card.currentAttack < 3) ctx.adjust(ctx.card, 2); },
    onOtherDestroyed(ctx) {
      const target = ctx.destroyedCard;
      if (!target || target.uid === ctx.card.uid || target.ownerId !== ctx.card.ownerId || target.isGuard) return;
      if (!(ctx.card.v2ReplacedThisTurn instanceof Set)) ctx.card.v2ReplacedThisTurn = new Set();
      if (ctx.card.v2ReplacedThisTurn.has(target.uid)) return;
      const cell = ctx.pickRandom(ctx.placementCells(target.ownerId));
      if (!cell) return;
      ctx.card.v2ReplacedThisTurn.add(target.uid);
      if (ctx.reenter(target, cell)) ctx.log("使被摧毁的友军先结算摧毁技能，再恢复基础战力重新放置。");
    }
  };

  wei["02416"] = {
    flags: { preventReduction: true, commander: true },
    onPlace(ctx) {
      const targets = ctx.board.filter((target) => target.ownerId === ctx.player.id && target.uid !== ctx.card.uid);
      targets.forEach((target) => ctx.adjust(target, 1));
      ctx.card.v2Commander = true;
      if (targets.length) ctx.log("使所有其他友军战力永久+1。");
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
    flags: { movementWatcher: true },
    onPlace(ctx) { ctx.card.v2AdjacencyWatcher = true; },
    onOtherPlaced(ctx) {
      if (Math.abs(ctx.card.row - ctx.placedCard.row) <= 1 && Math.abs(ctx.card.col - ctx.placedCard.col) <= 1) ctx.adjust(ctx.card, 1);
    },
    onOtherMoved(ctx) {
      const wasAdjacent = Math.abs(ctx.source.row - ctx.card.row) <= 1 && Math.abs(ctx.source.col - ctx.card.col) <= 1;
      if (wasAdjacent) ctx.adjust(ctx.card, -1);
    }
  };

  window.CARD_EFFECTS_V2 = window.CARD_EFFECTS_V2 || {};
  window.CARD_EFFECTS_V2.wei = wei;
})();
