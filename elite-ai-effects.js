/* Runtime-only implementations for randomized elite AI traits. */
(() => {
  window.ELITE_AI_EFFECTS_V2 = Object.freeze({
    "iron-command": Object.freeze({
      onTurnStart(context) {
        const cards = context.boardCards.filter((card) => card.ownerId === context.ai.id && !card.isGuard);
        cards.forEach((card) => context.operations.adjustTemporary(card, 1));
        if (cards.length) context.log.push(`精英特性【铁壁军势】使 ${cards.length} 张 AI 卡牌本回合战力 +1。`);
      }
    }),
    "supply-reserve": Object.freeze({
      onTurnStart(context) {
        const result = context.operations.drawCard(context.ai);
        if (result.status === "drawn") context.log.push("精英特性【战备补给】使 AI 额外抽取 1 张牌。");
      }
    }),
    "hunter-mark": Object.freeze({
      onTurnStart(context) {
        const targets = context.boardCards
          .filter((card) => !card.isGuard && card.ownerId !== context.ai.id)
          .sort((a, b) => (Number(b.currentAttack ?? b.attack) || 0) - (Number(a.currentAttack ?? a.attack) || 0));
        const target = targets[0];
        if (!target) return;
        context.operations.adjustTemporary(target, -1);
        context.log.push(`精英特性【猎杀标记】使 ${context.operations.cardName(target)} 本回合战力 -1。`);
      }
    }),
    "tactical-reserve": Object.freeze({
      onTurnStart(context) {
        context.operations.addActions(1);
        context.log.push("精英特性【战术储备】使 AI 本回合额外获得 1 个行动位。");
      }
    })
  });
})();
