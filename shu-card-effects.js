/* Shu V2 card effects. Display data is intentionally not imported here. */
(() => {
  const shu = {};

  shu["01101"] = {
    onTurnStart(ctx) { ctx.adjust(ctx.card, ctx.allies().length, true); }
  };

  shu["01102"] = {
    onTurnStart(ctx) { ctx.allies().forEach((target) => ctx.adjust(target, 1, true)); }
  };

  shu["01103"] = {
    onTurnStart(ctx) {
      const allies = ctx.allies();
      const highest = Math.max(...allies.map((target) => target.currentAttack), -1);
      const target = ctx.pickRandom(allies.filter((ally) => ally.currentAttack === highest));
      if (target) ctx.adjust(target, 1);
    }
  };

  shu["01104"] = {
    onTurnStart(ctx) {
      const allies = ctx.allies();
      const highest = Math.max(...allies.map((target) => target.currentAttack), -1);
      const tied = allies.filter((target) => target.currentAttack === highest);
      const threatened = tied.filter((target) => ctx.enemiesOf(target).length);
      const attacker = ctx.pickRandom(threatened.length ? threatened : tied);
      const defender = attacker && ctx.pickRandom(ctx.enemiesOf(attacker).filter((enemy) => ctx.canFight(attacker, enemy)));
      if (attacker && defender) ctx.skillAttack(attacker, defender);
    }
  };

  shu["01105"] = {
    onTurnStart(ctx) { if (ctx.enemies().length) ctx.adjust(ctx.card, 1); }
  };

  shu["01106"] = {
    onTurnStart(ctx) {
      const target = ctx.pickRandom(ctx.enemies());
      if (target) ctx.adjust(target, -2, true);
    }
  };

  shu["01107"] = {
    onTurnStart(ctx) { if (ctx.player.hand.length < 3) ctx.draw(ctx.player); }
  };

  shu["01208"] = {
    onPlace(ctx) {
      [...ctx.allies()]
        .sort((left, right) => ctx.board.indexOf(left) - ctx.board.indexOf(right))
        .forEach((target) => ctx.triggerTurnStart(target));
    }
  };

  shu["01209"] = {
    flags: { chargeMove: true },
    onTurnStart(ctx) {
      const enemyCount = ctx.board.filter((target) => (
        target.ownerId !== ctx.card.ownerId
        && (target.row === ctx.card.row || target.col === ctx.card.col)
      )).length;
      if (enemyCount) ctx.adjust(ctx.card, enemyCount, true);
    }
  };

  shu["01210"] = {
    onTurnStart(ctx) {
      const targets = ctx.board.filter((target) => target.ownerId !== ctx.card.ownerId
        && (target.row === ctx.card.row || target.col === ctx.card.col));
      const target = ctx.pickRandom(targets);
      if (target) ctx.adjust(target, -2, true);
    }
  };

  shu["01211"] = {
    onTurnStart(ctx) {
      const counts = ctx.controlCounts();
      const ownCount = counts[ctx.card.ownerId] || 0;
      const enemyCount = counts[ctx.otherPlayer.id] || 0;
      if (ownCount < enemyCount) ctx.adjust(ctx.card, 2, true);
      else ctx.allies().forEach((target) => ctx.adjust(target, 1, true));
    }
  };

  shu["01212"] = {
    baseAttack: 2,
    flags: { cannotMove: true },
    onTurnStart(ctx) { ctx.adjust(ctx.card, 1); }
  };

  shu["01313"] = {
    onTurnStart(ctx) {
      ctx.card.v2Protected = false;
      ctx.setAttack(ctx.card, 4, false);
    },
    onBeforeDestroy(ctx) {
      if (ctx.card.v2Protected) return;
      ctx.card.v2Protected = true;
      ctx.setAttack(ctx.card, 1, false);
      ctx.log("首次被摧毁时保留在原格，战力变为1。");
      return false;
    },
    onTurnEnd(ctx) { ctx.card.v2Protected = false; }
  };

  shu["01314"] = {
    flags: { avoidCombatWhenBehind: true },
    onTurnStart(ctx) {
      [...ctx.board]
        .filter((target) => target.ownerId === ctx.card.ownerId && target.uid !== ctx.card.uid)
        .forEach((target) => ctx.triggerTurnStart(target));
    }
  };

  shu["01315"] = {
    onTurnStart(ctx) {
      const ownCards = ctx.board.filter((target) => target.ownerId === ctx.card.ownerId);
      const enemyCards = ctx.board.filter((target) => target.ownerId === ctx.otherPlayer.id);
      if (ownCards.length < enemyCards.length) ctx.addActions(1);
      else if (ownCards.length > enemyCards.length) ownCards.forEach((target) => ctx.adjust(target, 1, true));
    }
  };

  shu["01416"] = {
    flags: { freeAction: true },
    onTurnStart(ctx) {
      ctx.adjust(ctx.card, 2, true);
      ctx.card.freeActionTurn = ctx.game.turn;
    },
    onCombatResolved(ctx) { if (ctx.opponentDestroyed) ctx.draw(ctx.player); }
  };

  shu["01517"] = {
    onTurnStart(ctx) {
      ctx.board
        .filter((target) => target.uid !== ctx.card.uid && (target.row === ctx.card.row || target.col === ctx.card.col))
        .forEach((target) => ctx.adjust(target, -1));
    }
  };

  shu["01518"] = {
    flags: { substituteAdjacent: true }
  };

  shu["01519"] = {
    onTurnStart(ctx) { ctx.draw(ctx.player); },
    onDrawFailed(ctx) {
      if (ctx.drawFailureReason !== "hand-full") return;
      const target = ctx.pickRandom(ctx.board.filter((ally) => ally.ownerId === ctx.card.ownerId && ally.uid !== ctx.card.uid));
      if (target) ctx.adjust(target, 2);
    }
  };

  shu["01520"] = {
    onTurnStart(ctx) {
      const cells = ctx.orthogonalCells().filter((cell) => (
        !ctx.board.some((target) => target.row === cell.row && target.col === cell.col)
        && !ctx.game.brokenCells.some((target) => target.row === cell.row && target.col === cell.col)
      ));
      ctx.replaceControlCells(cells, {
        ownerId: ctx.card.ownerId,
        untilTurn: Infinity,
        retainExisting: true,
        invalidateOnAnyEntry: true,
        invalidateOnAnyControl: true
      });
      if (cells.length) ctx.log("占领相邻空格，直至其他卡牌进入或触发占领。");
    }
  };

  window.CARD_EFFECTS_V2 = window.CARD_EFFECTS_V2 || {};
  window.CARD_EFFECTS_V2.shu = shu;
})();
