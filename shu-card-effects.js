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
    flags: { avoidCombatWhenBehind: true, repeatFriendlyTurnStart: true }
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
      for (let row = 0; row < ctx.board.rows; row++) {
        for (let col = 0; col < ctx.board.cols; col++) {
          const cell = ctx.board.get(row, col);
          if (!cell) ctx.board.control(row, col, ctx.card.ownerId);
        }
      }
    }
  };

  // 新增蜀卡 (01121-01530)

  shu["01121"] = {
    onTurnStart(ctx) {
      const adjacent = ctx.adjacent();  // 四方相邻（包括敌方和友方）
      if (adjacent.length) {
        const target = ctx.pickRandom(adjacent);
        if (target && ctx.canSwap(ctx.card, target)) {
          ctx.swap(ctx.card, target);
        }
      }
    }
  };

  shu["01122"] = {
    onTurnStart(ctx) {
      const enemies = ctx.enemies();
      const target = ctx.pickRandom(enemies);
      if (target && ctx.canFight(ctx.card, target)) {
        ctx.skillAttack(ctx.card, target);
        if (target.destroyed) {  // 成功摧毁
          ctx.adjust(ctx.card, 1);
        }
      }
    }
  };

  shu["01123"] = {
    onPlace(ctx) {
      ctx.player.cards.forEach((card) => {
        card.v2NoRest = true;
      });
    }
  };

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

  shu["01116"] = {
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

  shu["01117"] = {
    onTurnStart(ctx) {
      ctx.player.v2FirstPlaceThisTurn = null;  // 重置本回合第一张放置卡牌标记
    },
    onOtherCardPlace(ctx, placedCard) {
      // 当其他卡牌放置时
      if (placedCard.ownerId === ctx.card.ownerId && !ctx.player.v2FirstPlaceThisTurn) {
        ctx.player.v2FirstPlaceThisTurn = placedCard;
        ctx.adjust(placedCard, 2);  // 第一张放置卡牌战力+2
      }
    }
  };

  shu["01118"] = {
    onTurnStart(ctx) {
      // 获取四个方向（上下左右）
      const directions = [
        { row: ctx.card.row - 1, col: ctx.card.col },  // 上
        { row: ctx.card.row + 1, col: ctx.card.col },  // 下
        { row: ctx.card.row, col: ctx.card.col - 1 },  // 左
        { row: ctx.card.row, col: ctx.card.col + 1 }   // 右
      ];

      // 只检查战场内的有效方向
      const validDirections = directions.filter((dir) => {
        // 假设棋盘是5x5 (0-4)
        return dir.row >= 0 && dir.row < 5 && dir.col >= 0 && dir.col < 5;
      });

      // 所有有效方向都必须有友军
      const allValidDirectionsHaveAllies = validDirections.length > 0 && validDirections.every((dir) => {
        const card = ctx.board.find((c) => c.row === dir.row && c.col === dir.col);
        return card && card.ownerId === ctx.card.ownerId;
      });

      if (allValidDirectionsHaveAllies) {
        ctx.addActions(ctx.player, 1);
      }
    }
  };

  shu["01119"] = {
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

  shu["01120"] = {
    flags: { cannotMove: true },
    onTurnStart(ctx) {
      ctx.player.cards.forEach((card) => {
        ctx.adjust(card, 1, true);
      });
    },
    onBeforeAdjust(ctx, target, amount) {
      // 如果是敌方卡牌且是正数（增加），则阻止
      if (target.ownerId !== ctx.card.ownerId && amount > 0) {
        return 0;  // 阻止增加
      }
      // 允许其他调整
    }
  };

  shu["01115"] = {
    onBeforeAllyDestroy(ctx) {
      ctx.adjust(ctx.card, -3);
      return false;
    },
    onTurnEnd(ctx) {
      ctx.player.cards.forEach((card) => {
        if (card !== ctx.card && card.currentAttack === 0) {
          ctx.destroy(card);
        }
      });
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
