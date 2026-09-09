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
      onCardDrawn(context) { if (context.player?.id === own(context).id) context.operations.trimHandToOne(); },
      onCardPlaced(context) { if (context.player?.id === own(context).id) context.operations.trimHandToOne(); }
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
    "2003": Object.freeze({}),
    "2004": Object.freeze({}),
    "2005": Object.freeze({
      onCardPlaced(context) { if (context.player?.id !== own(context).id && context.card) context.operations.adjust(context.card, 1); },
      onTurnStart(context) { enemies(context).forEach((card) => context.operations.adjust(card, -1)); }
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
    "2007": Object.freeze({}),
    "2008": Object.freeze({
      onBeforeDestroy(context) { if (context.card?.ownerId === own(context).id && context.game.activePlayerId === own(context).id) return false; }
    }),
    "3001": Object.freeze({
      onTurnStart(context) { allies(context).forEach((card) => context.operations.adjust(card, 1)); }
    }),
    "3002": Object.freeze({
      onCardPlaced(context) { if (context.player?.id !== own(context).id && context.card) context.operations.adjust(context.card, -2); }
    }),
    "3003": Object.freeze({}),
    "3004": Object.freeze({
      onCardPlaced(context) { if (context.player?.id === own(context).id && context.card && context.operations.claimFirstPlacement("3004")) { context.operations.markFreePlacement(context.card); context.operations.adjust(context.card, 3); } }
    }),
    "3005": Object.freeze({
      onCardMoved(context) { if (context.card?.ownerId === own(context).id) context.operations.adjust(context.card, 2); }
    }),
    "3006": Object.freeze({
      onCardDestroyed(context) { if (context.destroyedCard?.ownerId === own(context).id) allies(context).filter((card) => card.uid !== context.destroyedCard.uid).forEach((card) => context.operations.adjust(card, 1)); }
    }),
    "3007": Object.freeze({}),
    "3008": Object.freeze({
      onCardPlaced(context) { if (context.game.players.some((player) => player.id === own(context).id)) own(context).hand.forEach((card) => context.operations.adjust(card, 1)); }
    })
  });
})();
