/* Runtime-only implementations for randomized elite AI traits. */
(() => {
  const own = (context) => context.ai;
  const allies = (context) => context.boardCards.filter((card) => card.ownerId === own(context).id && !card.isGuard);
  const enemies = (context) => context.boardCards.filter((card) => card.ownerId !== own(context).id && card.ownerId);
  const random = (context, cards) => context.operations.pickRandom(cards);

  window.ELITE_AI_EFFECTS_V2 = Object.freeze({
    "1001": Object.freeze({
      onTurnStart(context) {
        const cards = context.boardCards.filter((card) => card.ownerId === context.player?.id && !card.isGuard);
        const target = random(context, cards);
        if (target) context.operations.adjust(target, 1);
      }
    }),
    "1002": Object.freeze({
      onTurnStart(context) { const target = random(context, enemies(context)); if (target) context.operations.adjust(target, -1); }
    }),
    "1003": Object.freeze({
      onCardDestroyed(context) { if (context.destroyedCard?.ownerId === own(context).id) context.operations.drawCard(own(context)); }
    }),
    "1004": Object.freeze({
      onTurnStart(context) { context.operations.drawCard(own(context)); }
    }),
    "1005": Object.freeze({
      onDrawFailed(context) {
        if (context.player?.id === own(context).id && context.drawFailureReason === "deck-empty") context.operations.drawReinforcement();
      }
    }),
    "1006": Object.freeze({
      onCardPlaced(context) {
        const card = context.card;
        if (context.player?.id !== own(context).id || !card || !context.operations.claimFirstPlacement("1006")) return;
        if (context.game.boardCards.includes(card)) context.operations.applyPlacementSkill(card);
      }
    }),
    "1007": Object.freeze({
      onCardPlaced(context) {
        const card = context.card;
        if (context.player?.id !== own(context).id || !card || !context.operations.claimFirstPlacement("1007")) return;
        context.operations.adjustScoped(card, 3, false);
      }
    }),
    "1008": Object.freeze({
      handLimit(context) { return context.player?.id === own(context).id ? 1 : null; },
      onCardDrawn(context) { if (context.player?.id === own(context).id) context.operations.trimHandToOne(); },
      onCardPlaced(context) { if (context.player?.id === own(context).id) context.operations.trimHandToOne(); },
      handState(context) {
        if (context.player?.id !== own(context).id) return;
        context.operations.trimHandToOne();
        if (!context.player.hand.length) {
          context.operations.setPlayerState(context.player, "waitingForDrawPileRefill", !context.player.drawPile.length);
          context.operations.drawCard(context.player);
          if (context.player.hand.length) context.operations.setPlayerState(context.player, "waitingForDrawPileRefill", false);
        } else {
          context.operations.setPlayerState(context.player, "waitingForDrawPileRefill", false);
        }
        context.operations.trimHandToOne();
      },
      onDrawPileChanged(context) {
        const player = context.player;
        if (player?.id !== own(context).id || !player.eliteTraitState?.waitingForDrawPileRefill || !player.drawPile.length || player.hand.length) return;
        context.operations.drawCard(player);
        context.operations.setPlayerState(player, "waitingForDrawPileRefill", false);
      }
    }),
    "1009": Object.freeze({
      onTurnStart(context) { enemies(context).forEach((card) => context.operations.adjust(card, -1, true)); }
    }),
    "1010": Object.freeze({
      onCardPlaced(context) { if (context.player?.id === own(context).id && context.card) context.operations.preventRest(context.card); }
    }),
    "1011": Object.freeze({}),
    "2001": Object.freeze({
      onTurnStart(context) { const cards = allies(context); const lowest = Math.min(...cards.map((card) => Number(card.currentAttack ?? card.attack) || 0), Infinity); cards.filter((card) => (Number(card.currentAttack ?? card.attack) || 0) === lowest).slice(0, 1).forEach((card) => context.operations.adjust(card, 2)); }
    }),
    "2002": Object.freeze({
      onCardPlaced(context) { if (context.player?.id === own(context).id && context.card) context.operations.adjust(context.card, 1); }
    }),
    "2003": Object.freeze({
      allowCardStartSkill(context) { return context.card?.ownerId === own(context).id; }
    }),
    "2004": Object.freeze({
      powerBounds(context) {
        const ai = own(context);
        context.boardCards.forEach((card) => {
          if (card.isGuard) return;
          const current = Number(card.currentAttack ?? card.attack) || 0;
          if (card.ownerId === ai.id && current < 2) card.currentAttack = 2;
          if (card.ownerId !== ai.id && card.ownerId && current > 5) card.currentAttack = 5;
        });
      }
    }),
    "2005": Object.freeze({
      onCardPlaced(context) { if (context.player?.id !== own(context).id && context.card) context.operations.adjust(context.card, 1); },
      onTurnStart(context) {
        context.boardCards
          .filter((card) => card.ownerId !== own(context).id)
          .forEach((card) => context.operations.adjust(card, -1));
      }
    }),
    "2006": Object.freeze({
      onCardDrawn(context) {
        if (context.player?.id === own(context).id) return;
        const before = own(context).hand.length;
        context.operations.drawCard(own(context));
        if (own(context).hand.length === before && own(context).hand.length >= context.operations.handLimit) {
          const target = random(context, allies(context));
          if (target) context.operations.adjust(target, 1);
        }
      }
    }),
    "2007": Object.freeze({
      allowMovement(context) {
        const card = context.card;
        if (!card || card.ownerId === own(context).id) return true;
        const enemyCards = context.boardCards.filter((target) => target.ownerId === card.ownerId && !target.isGuard);
        const highest = Math.max(...enemyCards.map((target) => Number(target.currentAttack ?? target.attack) || 0), -Infinity);
        return (Number(card.currentAttack ?? card.attack) || 0) !== highest;
      }
    }),
    "2008": Object.freeze({
      onBeforeDestroy(context) { if (context.card?.ownerId === own(context).id && context.game.activePlayerId === own(context).id) return false; }
    }),
    "3001": Object.freeze({
      onTurnStart(context) { allies(context).forEach((card) => context.operations.adjust(card, 1)); }
    }),
    "3002": Object.freeze({
      onCardPlaced(context) { if (context.player?.id !== own(context).id && context.card) context.operations.adjust(context.card, -2); }
    }),
    "3003": Object.freeze({
      actionLimit(context) { return context.player?.id === own(context).id ? 1 : 0; }
    }),
    "3004": Object.freeze({
      freeAction(context) {
        const card = context.card;
        return context.player?.id === own(context).id && card?.ownerId === own(context).id
          && !context.game.boardCards.includes(card) && !context.operations.hasFirstPlacementClaim("3004");
      },
      onCardPlaced(context) {
        if (context.player?.id !== own(context).id || !context.card || !context.operations.claimFirstPlacement("3004")) return;
        context.operations.setCardState(context.card, "freePlacementTurn", context.game.turn);
        context.operations.adjust(context.card, 3);
      },
      consumeAction(context) {
        if (context.action?.type !== "place" || context.card?.ownerId !== own(context).id) return true;
        return context.operations.getCardState(context.card, "freePlacementTurn") !== context.game.turn;
      }
    }),
    "3005": Object.freeze({
      onCardMoved(context) { if (context.card?.ownerId === own(context).id) context.operations.adjust(context.card, 2); }
    }),
    "3006": Object.freeze({
      onCardDestroyed(context) { if (context.destroyedCard?.ownerId === own(context).id) allies(context).filter((card) => card.uid !== context.destroyedCard.uid).forEach((card) => context.operations.adjust(card, 1)); }
    }),
    "3007": Object.freeze({
      allowPlacement(context) {
        const card = context.card;
        return !card || card.ownerId === own(context).id || (Number(card.currentAttack ?? card.attack) || 0) >= 1;
      }
    }),
    "3008": Object.freeze({
      onCardPlaced(context) { if (context.game.players.some((player) => player.id === own(context).id)) own(context).hand.forEach((card) => context.operations.adjust(card, 1)); }
    })
  });
})();
