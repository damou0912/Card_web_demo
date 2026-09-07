/* Runtime adapter for the unified card information table. */
(() => {
  const source = Array.isArray(window.CARD_INFO) ? window.CARD_INFO : [];
  const cardSlots = source.map((card) => {
    const baseAttack = Number(card.baseAttack ?? card.attack) || 0;
    return {
    id: String(card.id),
    name: card.name,
    camp: card.camp,
    skill: card.skill,
    baseAttack,
    attack: baseAttack,
    rarity: card.rarity || "普通",
    effect: card.effect || "无技能效果。",
    effectTags: Array.isArray(card.effectTags) ? [...card.effectTags] : []
    };
  });

  window.CARD_LIBRARY = window.CARD_LIBRARY || {};
  window.CARD_LIBRARY.cardSlots = cardSlots;
  window.CARD_LIBRARY.cardInfoSource = "outputs/card-info-table-xlsx/card_info_v2.xlsx";
})();
