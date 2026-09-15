/* Wu V2 card effects. Display data is intentionally not imported here. */
(() => {
  const wu = {};

  wu["03101"] = {
    onDestroy(ctx) {
      ctx.board
        .filter((target) => target.ownerId === ctx.card.ownerId)
        .forEach((target) => ctx.adjust(target, 1));
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
    onPlace(ctx) {
      ctx.orthogonalCells().forEach((position) => ctx.spawnNeutralGuard(position, 2));
    },
    onBeforeDestroy(ctx) {
      const targets = ctx.adjacent().filter((target) => target.currentAttack < ctx.card.currentAttack);
      if (!targets.length) return;
      destroyLowerAdjacent(ctx, ctx.card.currentAttack);
      ctx.log("阻止自身被摧毁，并随机摧毁一张战力低于自身的四方相邻卡牌。");
      return false;
    },
    onDestroy(ctx) {
      destroyLowerAdjacent(ctx, ctx.destroyedAttack ?? ctx.card.currentAttack);
    }
  };

  function destroyLowerAdjacent(ctx, attack) {
    const targets = ctx.adjacent().filter((target) => target.currentAttack < attack);
    const target = ctx.pickRandom(targets);
    if (!target) return false;
    ctx.destroy(target, ctx.card);
    return true;
  }

  wu["03104"] = {
    onDestroy(ctx) { ctx.allies().forEach((target) => ctx.adjust(target, 3, true)); }
  };

  wu["03105"] = {
    onDestroy(ctx) { if (ctx.causeCard && ctx.isOnBoard(ctx.causeCard)) ctx.adjust(ctx.causeCard, -2, true); }
  };

  wu["03106"] = {
    onPlace(ctx) {
      const target = ctx.pickRandom(ctx.otherAllies());
      if (target) ctx.adjust(target, 1);
    },
    onDestroy(ctx) {
      const target = ctx.pickRandom(ctx.otherAllies());
      if (target) ctx.adjust(target, 1);
    }
  };

  wu["03107"] = {
    onDestroy(ctx) {
      ctx.draw(ctx.otherPlayer);
      ctx.discard(ctx.otherPlayer, 2);
    }
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
      const allies = [...ctx.allies()];
      allies.forEach((target) => ctx.adjust(target, 2, true));
      allies.forEach((target) => {
        if (!ctx.isOnBoard(target)) return;
        const enemies = ctx.enemies(target).filter((enemy) => ctx.canFight(target, enemy));
        const enemy = ctx.pickRandom(enemies);
        if (enemy) ctx.skillAttack(target, enemy);
      });
    }
  };

  wu["03211"] = {
    onDestroy(ctx) {
      const allies = ctx.otherAllies();
      const enemyPlayers = ctx.board.filter((target) => target.ownerId === ctx.otherPlayer?.id);
      if (allies.length < enemyPlayers.length) {
        ctx.board
          .filter((target) => target.ownerId !== ctx.card.ownerId)
          .forEach((target) => ctx.adjust(target, -1));
      } else if (allies.length > enemyPlayers.length) {
        allies.forEach((target) => ctx.adjust(target, 1));
      }
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
      for (let index = 0; index < 1; index += 1) {
        if (!ctx.draw(ctx.otherPlayer)) break;
      }
    },
    onOtherDrawn(ctx) {
      if (ctx.drawingPlayer?.id === ctx.otherPlayer?.id) ctx.adjust(ctx.card, 1);
    },
    onDestroy(ctx) { ctx.discard(ctx.otherPlayer, 1); }
  };

  wu["03315"] = {
    onPlace(ctx) {
      const ownCount = ctx.board.filter((target) => target.ownerId === ctx.card.ownerId).length;
      const enemyCount = ctx.board.filter((target) => target.ownerId === ctx.otherPlayer?.id).length;
      const delta = ownCount === enemyCount ? -2 : -1;
      ctx.board
        .filter((target) => target.ownerId !== ctx.card.ownerId)
        .forEach((target) => ctx.adjust(target, delta));
    },
    onDestroy(ctx) {
      [...ctx.board]
        .filter((target) => target.ownerId !== ctx.card.ownerId && target.currentAttack < ctx.destroyedAttack)
        .forEach((target) => ctx.destroy(target));
    }
  };

  wu["03416"] = {
    flags: { watchAllDestroyed: true },
    onTurnStart(ctx) { ctx.grantExtraMoves(1); },
    onOtherDestroyed(ctx) {
      if (ctx.destroyedCard.currentAttack <= ctx.card.currentAttack) ctx.adjust(ctx.card, 1);
    },
    onBeforeAttack(ctx) {
      ctx.adjust(ctx.card, 3, true);
    }
  };

  wu["03517"] = {
    onBeforeAdjacentAllyDestroy(ctx) {
      const protectedCard = ctx.protectedCard;
      const position = ctx.position(ctx.card);
      if (!ctx.destroy(ctx.card, protectedCard)) return false;
      protectedCard.row = position.row;
      protectedCard.col = position.col;
      ctx.emitMoved(protectedCard, { row: ctx.original.row, col: ctx.original.col }, position);
      return false;
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
    },
    onUnderAttack(ctx) {
      ctx.adjacent().forEach((target) => {
        if (target.ownerId === ctx.card.ownerId) ctx.adjust(target, -1);
      });
    }
  };

  wu["03520"] = {
    onPlace(ctx) {
      ctx.board.forEach((target) => ctx.adjust(target, -2, true));
      ctx.addActions(1);
    }
  };

  wu["03121"] = {
    onDestroy(ctx) {
      if (!ctx.causeCard || !ctx.isOnBoard(ctx.causeCard)) return;
      ctx.setPermanentAttack(ctx.causeCard, 1);
      ctx.log("摧毁此卡的卡牌战力永久变为1。");
    }
  };

  wu["03122"] = {
    onDestroy(ctx) {
      const target = ctx.pickRandom(ctx.allies());
      if (!target || !ctx.moveTo(target, ctx.original, "断后移位")) return;
      ctx.adjust(target, 1);
      ctx.log("随机一张四方相邻友军移动至原位置，并永久战力+1。");
    }
  };

  wu["03123"] = {
    onDestroy(ctx) {
      if (ctx.discard(ctx.player, 1)) ctx.log("随机弃置1张手牌。");
    }
  };

  function resolveAnMin(ctx) {
    if (ctx.draw(ctx.player)) {
      ctx.log("抽取1张卡牌。");
      return;
    }
    const target = ctx.pickRandom(ctx.otherAllies());
    if (!target) return;
    ctx.adjust(target, 1);
    ctx.log("抽牌失败，使一张随机其他友军永久战力+1。");
  }

  wu["03124"] = {
    onPlace: resolveAnMin,
    onDestroy: resolveAnMin
  };

  wu["03225"] = {
    onPlace(ctx) {
      let successes = 0;
      if (ctx.draw(ctx.player)) successes += 1;
      if (ctx.draw(ctx.otherPlayer)) successes += 1;
      if (!successes) return;
      ctx.adjust(ctx.card, successes);
      ctx.log(`双方共成功抽取${successes}张牌，自身永久战力+${successes}。`);
    }
  };

  wu["03226"] = {
    onPlace(ctx) {
      if (ctx.discard(ctx.otherPlayer, 1)) ctx.log("使敌方随机弃置1张手牌。");
    },
    onDestroy(ctx) {
      let drawn = 0;
      for (let index = 0; index < 2; index += 1) {
        if (!ctx.draw(ctx.otherPlayer)) break;
        drawn += 1;
      }
      if (drawn) ctx.log(`使敌方抽取${drawn}张牌。`);
    }
  };

  wu["03227"] = {
    onOtherMoved(ctx) {
      const moved = ctx.movedCard;
      if (!moved || moved.ownerId !== ctx.card.ownerId || moved.uid === ctx.card.uid) return;
      const distance = Math.abs(moved.row - ctx.card.row) + Math.abs(moved.col - ctx.card.col);
      if (distance !== 1) return;
      ctx.adjust(moved, 1);
      ctx.log("移动至此卡四方相邻的友军永久战力+1。");
    }
  };

  wu["03328"] = {
    onPlace(ctx) {
      let drawn = 0;
      for (let index = 0; index < 2; index += 1) {
        if (!ctx.draw(ctx.player)) break;
        drawn += 1;
      }
      if (drawn) ctx.log(`抽取${drawn}张牌。`);
    },
    onTurnStart(ctx) {
      ctx.grantFirstFriendlyMoveFree();
      ctx.log("本回合第一次友方主动移动不消耗行动数。");
    },
    onDestroy(ctx) {
      let drawn = 0;
      while (ctx.otherPlayer.hand.length < ctx.handLimit && ctx.otherPlayer.drawPile.length) {
        if (!ctx.draw(ctx.otherPlayer)) break;
        drawn += 1;
      }
      if (drawn) ctx.log(`敌方抽取${drawn}张牌至手牌上限。`);
    }
  };

  function randomDestroyEffectTarget(ctx) {
    return ctx.pickRandom(ctx.otherAllies().filter((target) => ctx.hasDestroyEffect(target)));
  }

  wu["03429"] = {
    onOtherDestroyed(ctx) {
      ctx.adjust(ctx.card, 1);
      ctx.draw(ctx.player);
      ctx.log("其他友军被摧毁，自身永久战力+1并抽取1张牌。");
    },
    onDestroy(ctx) {
      const target = randomDestroyEffectTarget(ctx);
      if (!target) return;
      ctx.triggerDestroyEffect(target);
      ctx.log("随机触发一张其他友军的遗志。");
    },
    onTurnStart(ctx) {
      const alliedCount = ctx.otherAllies().length;
      const enemyCount = ctx.board.filter((target) => target.ownerId === ctx.otherPlayer?.id).length;
      if (alliedCount >= enemyCount) return;
      ctx.addActions(1);
      ctx.log("其他友军少于敌方，本回合行动数+1。");
    }
  };

  wu["03530"] = {
    flags: { cannotMove: true },
    onTurnStart(ctx) {
      const target = randomDestroyEffectTarget(ctx);
      if (!target) return;
      ctx.triggerDestroyEffect(target);
      ctx.log("随机触发一张其他友军的遗志。");
    },
    onDestroy(ctx) {
      const discarded = ctx.discard(ctx.player, ctx.player.hand.length);
      let drawn = 0;
      for (let index = 0; index < discarded; index += 1) {
        if (!ctx.draw(ctx.player)) break;
        drawn += 1;
      }
      ctx.log(`弃置${discarded}张手牌，并抽取${drawn}张牌。`);
    }
  };

  window.CARD_EFFECTS_V2 = window.CARD_EFFECTS_V2 || {};
  window.CARD_EFFECTS_V2.wu = wu;
})();
