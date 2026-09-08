/* Runtime adapter for the unified card information table. */
(() => {
  const expectedSchemaVersion = "card-info-v2-display-effect-isolation-20260908";
  const allowedCamps = new Map([["01", "三国~蜀"], ["02", "三国~魏"], ["03", "三国~吴"]]);
  const source = window.CARD_INFO;
  if (window.CARD_INFO_SCHEMA_VERSION !== expectedSchemaVersion || !Array.isArray(source)) {
    throw new Error("卡牌展示数据版本不匹配，请重新生成并刷新 card-info.js。");
  }

  const ids = new Set();
  const cardSlots = source.map((card) => {
    const id = String(card?.id || "");
    const baseAttack = Number(card?.baseAttack);
    const expectedCamp = allowedCamps.get(id.slice(0, 2));
    if (!/^0[1-3][1-5]\d{2}$/.test(id) || ids.has(id) || card.camp !== expectedCamp
      || !card.name || !card.skill || !card.rarity || !card.effect
      || !Number.isInteger(baseAttack) || baseAttack < 0 || !Array.isArray(card.effectTags)) {
      throw new Error(`卡牌展示数据无效：${id || "<missing-id>"}`);
    }
    ids.add(id);
    return Object.freeze({
      id,
      name: card.name,
      camp: card.camp,
      skill: card.skill,
      baseAttack,
      attack: baseAttack,
      rarity: card.rarity,
      effect: card.effect,
      effectTags: Object.freeze([...card.effectTags])
    });
  });

  window.CARD_LIBRARY = Object.freeze({
    version: expectedSchemaVersion,
    cardSlots: Object.freeze(cardSlots),
    cardInfoSource: "outputs/card-info-table-xlsx/card_info_v2.xlsx"
  });
})();
