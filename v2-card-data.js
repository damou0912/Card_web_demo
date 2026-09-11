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
      || !Number.isInteger(baseAttack) || baseAttack < 0) {
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
      effect: card.effect
    });
  });

  // 立即添加替换卡牌到卡牌库（如果已加载）
  if (window.REPLACEMENT_CARDS && Array.isArray(window.REPLACEMENT_CARDS)) {
    window.REPLACEMENT_CARDS.forEach((card) => {
      const id = String(card?.id || "");
      const baseAttack = Number(card?.baseAttack);
      const expectedCamp = allowedCamps.get(id.slice(0, 2));
      if (!/^0[1-3][1-5]\d{2}$/.test(id) || ids.has(id) || card.camp !== expectedCamp
        || !card.name || !card.skill || !card.rarity || !card.effect
        || !Number.isInteger(baseAttack) || baseAttack < 0) {
        console.warn(`替换卡牌展示数据无效：${id || "<missing-id>"}`);
        return;
      }
      ids.add(id);
      cardSlots.push(Object.freeze({
        id,
        name: card.name,
        camp: card.camp,
        skill: card.skill,
        baseAttack,
        attack: baseAttack,
        rarity: card.rarity,
        effect: card.effect
      }));
    });
  }

  window.CARD_LIBRARY = Object.freeze({
    version: expectedSchemaVersion,
    cardSlots: Object.freeze(cardSlots),
    cardInfoSource: "outputs/card-info-table-xlsx/card_info_v2.xlsx"
  });

  // 监听replacement-cards加载，如果晚于v2-card-data加载
  const checkReplacementCards = () => {
    if (window.REPLACEMENT_CARDS && Array.isArray(window.REPLACEMENT_CARDS)) {
      const newSlots = [];
      window.REPLACEMENT_CARDS.forEach((card) => {
        const id = String(card?.id || "");
        if (!ids.has(id)) {
          const baseAttack = Number(card?.baseAttack);
          const expectedCamp = allowedCamps.get(id.slice(0, 2));
          if (!/^0[1-3][1-5]\d{2}$/.test(id) || card.camp !== expectedCamp
            || !card.name || !card.skill || !card.rarity || !card.effect
            || !Number.isInteger(baseAttack) || baseAttack < 0) {
            console.warn(`替换卡牌展示数据无效：${id || "<missing-id>"}`);
            return;
          }
          ids.add(id);
          newSlots.push(Object.freeze({
            id,
            name: card.name,
            camp: card.camp,
            skill: card.skill,
            baseAttack,
            attack: baseAttack,
            rarity: card.rarity,
            effect: card.effect
          }));
        }
      });
      if (newSlots.length > 0) {
        // 更新卡牌库（通过重新定义cardSlots数组）
        const updatedSlots = Object.freeze([...window.CARD_LIBRARY.cardSlots, ...newSlots]);
        window.CARD_LIBRARY = Object.freeze({
          version: window.CARD_LIBRARY.version,
          cardSlots: updatedSlots,
          cardInfoSource: window.CARD_LIBRARY.cardInfoSource
        });
        console.log(`✓ 替换卡牌已添加到卡牌库，总计 ${window.CARD_LIBRARY.cardSlots.length} 张卡牌`);
      }
    }
  };

  // 在document ready时检查
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkReplacementCards);
  } else {
    checkReplacementCards();
  }
})();
