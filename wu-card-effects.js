/* Wu V2 card effects. Display data is intentionally not imported here. */
(() => {
  const wu = {};

  wu["03101"] = {
    onDestroy(ctx) {
      const target = ctx.pickRandom(ctx.otherAllies());
      if (target) ctx.adjust(target, 1);
    }
  };

  wu["03102"] = {
    onPlace(ctx) {
      const virtualTriggers = ctx.game.v2VirtualTriggers || (ctx.game.v2VirtualTriggers = new Set());
      if (virtualTriggers.has(ctx.card.uid)) return;
      virtualTriggers.add(ctx.card.uid);
      try {
        [...ctx.allies()]
          .sort((left, right) => ctx.board.indexOf(left) - ctx.board.indexOf(right))
          .forEach((target) => ctx.triggerDestroyEffect(target));
      } finally {
        virtualTriggers.delete(ctx.card.uid);
      }
    }
  };

  wu["03103"] = {
    onDestroy(ctx) {
      const target = ctx.pickRandom(ctx.allies());
      if (!target) return;
      const position = ctx.position(target);
      if (ctx.destroy(target)) ctx.reenter(target, position);
    }
  };

  wu["03104"] = {
    onDestroy(ctx) { ctx.allies().forEach((target) => ctx.adjust(target, 1)); }
  };

  wu["03105"] = {
    onDestroy(ctx) { if (ctx.causeCard && ctx.isOnBoard(ctx.causeCard)) ctx.adjust(ctx.causeCard, -2, true); }
  };

  wu["03106"] = {
    onPlace(ctx) {
      ctx.replaceControlCells(ctx.orthogonalCells(), {
        ownerId: ctx.card.ownerId,
        untilTurn: Infinity,
        invalidateOnEnemyEntry: true
      });
    }
  };

  wu["03107"] = {
    onDestroy(ctx) { ctx.discard(ctx.otherPlayer, 1); }
  };

  wu["03208"] = {
    onPlace(ctx) { ctx.drawFromEnemyDeck(1); },
    onDestroy(ctx) { ctx.drawFromEnemyDeck(1); }
  };

  wu["03209"] = {
    onDestroy(ctx) {
      const count = ctx.enemies().length;
      let drawn = 0;
      for (let index = 0; index < count; index += 1) {
        if (!ctx.draw(ctx.player)) break;
        drawn += 1;
      }
      if (drawn) ctx.log(`因四方相邻 ${count} 张敌方卡牌抽取 ${drawn} 张牌。`);
    }
  };

  wu["03210"] = {
    onDestroy(ctx) {
      const target = ctx.pickRandom(ctx.allies());
      if (!target) return;
      ctx.adjust(target, 2, true);
      if (ctx.causeCard && ctx.isOnBoard(ctx.causeCard)) ctx.skillAttack(target, ctx.causeCard);
    }
  };

  wu["03211"] = {
    onDestroy(ctx) {
      const allies = ctx.otherAllies();
      const enemies = ctx.board.filter((target) => target.ownerId === ctx.otherPlayer?.id);
      if (allies.length < enemies.length) allies.forEach((target) => ctx.adjust(target, 1));
    }
  };

  wu["03212"] = {
    onPlace(ctx) { ctx.card.ownerId = ctx.otherPlayer.id; ctx.card.v2CannotDestroyTurn = ctx.game.turn; },
    onBeforeDestroy(ctx) { if (ctx.card.v2CannotDestroyTurn === ctx.game.turn) return false; },
    onDestroy(ctx) { [...ctx.allies()].forEach((target) => ctx.destroy(target)); }
  };

  wu["03313"] = {
    onDestroy(ctx) {
      const enemies = ctx.board.filter((target) => target.ownerId !== ctx.card.ownerId);
      enemies.forEach((target) => ctx.adjust(target, -2, true));
      [...enemies].filter((target) => ctx.isOnBoard(target) && target.currentAttack === 0).forEach((target) => ctx.destroy(target));
      ctx.log("使所有敌方卡牌战力-2，并摧毁战力为0的敌方卡牌。");
    }
  };

  wu["03314"] = {
    onPlace(ctx) {
      let drawn = 0;
      for (let index = 0; index < 2; index += 1) {
        if (!ctx.draw(ctx.otherPlayer)) break;
        drawn += 1;
      }
      if (drawn) ctx.adjust(ctx.card, drawn);
    },
    onDestroy(ctx) { ctx.discard(ctx.otherPlayer, 2); }
  };

  wu["03315"] = {
    onPlace(ctx) {
      const ownCount = ctx.board.filter((target) => target.ownerId === ctx.card.ownerId).length;
      const enemyCount = ctx.board.filter((target) => target.ownerId !== ctx.card.ownerId).length;
      if (enemyCount >= ownCount) ctx.enemies().forEach((target) => ctx.adjust(target, -1));
      if (ownCount >= enemyCount) ctx.enemies().forEach((target) => ctx.adjust(target, -1));
    },
    onDestroy(ctx) {
      [...ctx.board]
        .filter((target) => target.ownerId !== ctx.card.ownerId && target.currentAttack < ctx.destroyedAttack)
        .forEach((target) => ctx.destroy(target));
    }
  };

  wu["03416"] = {
    onBeforeDestroy(ctx) {
      if (ctx.card.currentAttack <= 4) return;
      ctx.adjust(ctx.card, -3);
      ctx.log("战力大于4，保留在原格并永久战力-3。");
      return false;
    },
    onOtherDestroyed(ctx) { ctx.adjust(ctx.card, 1); },
    onCombatResolved(ctx) {
      if (ctx.isOnBoard(ctx.card) && ctx.isOnBoard(ctx.opponent)) ctx.adjust(ctx.opponent, -2);
    }
  };

  wu["03517"] = {
    onOtherDestroyed(ctx) {
      if (ctx.isOnBoard(ctx.destroyedCard)) return;
      const distance = Math.abs(ctx.original.row - ctx.card.row) + Math.abs(ctx.original.col - ctx.card.col);
      if (distance !== 1) return;
      const position = ctx.position(ctx.card);
      if (ctx.destroy(ctx.card, ctx.destroyedCard)) ctx.reenter(ctx.destroyedCard, position);
    }
  };

  wu["03518"] = {
    onDestroy(ctx) {
      [...ctx.board]
        .filter((target) => Math.abs(target.row - ctx.original.row) + Math.abs(target.col - ctx.original.col) <= 1)
        .forEach((target) => ctx.destroy(target));
      ctx.addBrokenCell(ctx.original);
    }
  };

  wu["03519"] = {
    onBeforeDestroy(ctx) { if (!ctx.card.v2AllowSelfDestroy) return false; },
    onTurnStart(ctx) {
      if (ctx.allies().length) return;
      ctx.card.v2AllowSelfDestroy = true;
      ctx.destroy(ctx.card);
      ctx.card.v2AllowSelfDestroy = false;
    }
  };

  wu["03520"] = {
    onPlace(ctx) {
      ctx.board.forEach((target) => ctx.adjust(target, -2, true));
      ctx.addActions(1);
    }
  };

  window.CARD_EFFECTS_V2 = window.CARD_EFFECTS_V2 || {};
  window.CARD_EFFECTS_V2.wu = wu;
})();
