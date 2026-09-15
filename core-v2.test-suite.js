(function() {
  const api = window.__CARD_DEMO_CORE_V2_TEST_API__;
  if (!api) throw new Error("V2 test API is unavailable. Load core-v2.js first.");
  const { cloneCard, coreActionLimit, coreAddCardsToDrawPile, coreAdjustAttack, coreAiPlacementScore, coreApplyEliteAiTrait, coreApplyEliteAiTraitEvent, coreApplyV2PlacementSkill, coreBuildPendingAction, coreCanPlaceCard, coreCanUseAction, coreCanViewerInteract, coreControlMap, coreCreateGame, coreDestroyV2Card, coreDrawOneCard, coreEliteAiTraitIds, coreEliteAiTraitInfo, coreChallengeTraitPlan, corePickChallengeTraits, coreEnforceElitePowerBounds, coreFormatTurnTime, coreHandLimitForPlayer, coreHasFreeAction, coreIsGauntlet, coreIsOpponentTurn, coreIsSpectator, coreLoadCardTestSetup, coreMaintainEliteAiHand, corePlanAiAction, corePlayer, coreResolveSkillAttack, coreRunV2EndSkills, coreRunV2MoveEffects, coreRunV2StartSkill, coreSimulateActionOutcome, coreStartTurn, coreStartTurnTimer, coreTriggerOtherV2PlacementEffects, coreTurnSecondsRemaining, coreValidMoves, coreVictoryTarget, coreViewerPlayerId, coreBuildGauntletAiOption, coreGauntletCardCount, coreGauntletDifficultyInfo, coreGrantGauntletReward, coreReplaceGauntletRewardCard, coreAbandonGauntletReward, corePickGauntletPlayerOptions, corePickGauntletAiOptions, CORE_GAUNTLET_MAX_DECK_SIZE, CORE_TURN_TIME_LIMIT_SECONDS, HAND_LIMIT, state } = api;
  function coreRunV2RegressionTests() {
    const previousGame = state.game;
    const previousGauntlet = state.gauntlet;
    const results = [];
    const check = (name, condition) => results.push({ name, passed: Boolean(condition) });
    const makeCard = (id, ownerId, row, col) => {
      const template = window.CARD_LIBRARY?.cardSlots?.find((card) => card.id === id);
      const card = cloneCard(template || { id, attack: 0 });
      Object.assign(card, { ownerId, row, col, currentAttack: Number(card.attack) || 0, v2PermanentBonus: 0, v2TempBonus: 0 });
      return card;
    };
    const makeGame = (boardCards = []) => ({
      turn: 1, activePlayerId: 1, boardCards, brokenCells: [], v2ControlCells: [], v2PlacementLocks: [], moveLocks: {}, pendingAnimations: [], players: [
        { id: 1, hand: [], drawPile: [], lastControlCount: 0 }, { id: 2, hand: [], drawPile: [], lastControlCount: 0 }
      ]
    });
    const traitGame = (id, boardCards = []) => {
      const game = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1);
      game.eliteAiEffectIds = [String(id)];
      game.eliteAiEffectId = String(id);
      game.eliteAiFirstPlacementClaims = {};
      game.currentPhase = "行动阶段";
      game.boardCards = boardCards;
      game.activePlayerId = 2;
      game.players.forEach((player) => { player.hand = []; player.drawPile = []; });
      state.game = game;
      return game;
    };
    try {
      const challengeTraitIds = coreEliteAiTraitIds();
      const expectedNames = ["鼓舞", "冷箭", "厚葬", "军备", "援军", "当先", "慎行", "断粮", "野望", "急奔", "无言", "战鼓擂", "羽林列", "烽火起", "关山急", "鸿门宴", "丹书诏", "古道尘", "城下盟", "振奋人心", "虚弱无力", "灵动迅捷", "凤鸣九霄", "勇冠三军", "破釜沉舟", "关山暮雪", "暗度陈仓"];
      check("Excel 中的 27 个数字词条 ID 均已载入", challengeTraitIds.length === 27
        && challengeTraitIds.every((id) => /^\d{4}$/.test(id))
        && expectedNames.every((name) => Object.values(window.ELITE_AI_EFFECT_INFO_V2).some((trait) => trait.name === name))
        && Object.keys(window.ELITE_AI_EFFECT_ID_ALIASES_V2).length === 0);

      { const ally = makeCard("01101", 1, 0, 0), aiCard = makeCard("02101", 2, 1, 0); const game = traitGame("1001", [ally, aiCard]); game.eliteAiTraitOwnerId = 1; coreApplyEliteAiTrait(game, game.players[0], []); check("1001 鼓舞", ally.currentAttack === ally.attack + 1 && aiCard.currentAttack === aiCard.attack); }
      { const enemy = makeCard("01101", 1, 0, 0); const game = traitGame("1002", [enemy]); coreApplyEliteAiTrait(game, game.players[1], []); check("1002 冷箭", enemy.currentAttack === Math.max(0, enemy.attack - 1)); }
      { const dead = makeCard("02101", 2, 0, 0); const game = traitGame("1003", [dead]); game.players[1].drawPile = [makeCard("02102", 2, null, null)]; coreDestroyV2Card(game, dead, []); check("1003 厚葬", game.players[1].hand.length === 1); }
      { const game = traitGame("1004"); game.players[1].drawPile = [makeCard("02102", 2, null, null)]; coreApplyEliteAiTrait(game, game.players[1], []); check("1004 军备", game.players[1].hand.length === 1); }
      { const game = traitGame("1005"); coreDrawOneCard(game, game.players[1], []); check("1005 援军", game.players[1].hand.length === 1 && game.players[1].hand[0].customName === "援兵" && game.players[1].hand[0].currentAttack === 1); }
      { const game = traitGame("1008"); const ai = game.players[1]; ai.hand = []; ai.drawPile = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null)]; coreMaintainEliteAiHand(game, ai, []); const limited = ai.hand.length === 1 && coreHandLimitForPlayer(game, ai) === 1; ai.hand = []; ai.drawPile = []; coreMaintainEliteAiHand(game, ai, []); const waiting = ai.hand.length === 0 && ai.eliteTraitState?.waitingForDrawPileRefill === true; coreAddCardsToDrawPile(game, ai, [makeCard("02103", 2, null, null)], []); const refilled = ai.hand.length === 1 && ai.eliteTraitState?.waitingForDrawPileRefill === false; check("1008 断粮", limited && waiting && refilled); }
      { const placed = makeCard("02106", 2, 0, 0); const game = traitGame("1006", [placed]); coreApplyV2PlacementSkill(game, game.players[1], placed, []); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); check("1006 当先", placed.currentAttack === placed.attack + 2); }
      { const placed = makeCard("02101", 2, 0, 0); const game = traitGame("1007", [placed]); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); const gained = placed.currentAttack === placed.attack + 3; coreRunV2EndSkills(game, game.players[1], []); const persisted = placed.currentAttack === placed.attack + 3; game.turn = 3; coreStartTurn(game); check("1007 慎行", gained && persisted && placed.currentAttack === placed.attack); }
      { const rested = makeCard("02101", 2, 1, 1); const game = traitGame("1011", [rested]); game.currentPhase = "行动阶段"; game.activePlayerId = 2; rested.restedTurn = game.turn; game.players[1].hand = []; game.players[1].drawPile = []; const blocked = coreValidMoves(game, rested).length === 0 && corePlanAiAction(game, game.players[1]) === null; rested.restedTurn = String(game.turn); const stringStateBlocked = coreValidMoves(game, rested).length === 0; check("AI 普通行动遵守卡牌休整", blocked && stringStateBlocked); }
      { const watcher = makeCard("02315", 2, 1, 0), placed = makeCard("02101", 2, 0, 0); const game = traitGame("1007", [watcher, placed]); coreApplyV2PlacementSkill(game, game.players[1], watcher, []); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); const isolated = placed.currentAttack === placed.attack + 3 && placed.v2PermanentBonus === 3 && placed.v2TempBonus === 0; game.turn = 2; coreStartTurn(game); check("1007 慎行词条调整与卡牌增益监听隔离", isolated && placed.currentAttack === placed.attack && placed.v2PermanentBonus === 0); }
      { const enemy = makeCard("01101", 1, 0, 0); const game = traitGame("1009", [enemy]); coreApplyEliteAiTrait(game, game.players[1], []); check("1009 野望", enemy.currentAttack === Math.max(0, enemy.attack - 1) && enemy.v2TempBonus === -1); }
      { const placed = makeCard("02101", 2, 0, 0); const game = traitGame("1010", [placed]); placed.restedTurn = 1; coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); check("1010 急奔", placed.restedTurn === null); }
      { const ally = makeCard("02101", 2, 0, 0); const game = traitGame("1011", [ally]); coreApplyEliteAiTrait(game, game.players[1], []); check("1011 无言", ally.currentAttack === ally.attack); }

      { const low = makeCard("02101", 2, 0, 0), high = makeCard("02102", 2, 1, 0); high.currentAttack += 2; const game = traitGame("2001", [low, high]); coreApplyEliteAiTrait(game, game.players[1], []); check("2001 战鼓擂", low.currentAttack === low.attack + 2 && high.currentAttack === high.attack + 2); }
      { const placed = makeCard("02101", 2, 0, 0); const game = traitGame("2002", [placed]); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); check("2002 羽林列", placed.currentAttack === placed.attack + 1); }
      { const starter = makeCard("01107", 1, 0, 0); const game = traitGame("2003", [starter]); game.players[0].drawPile = [makeCard("01101", 1, null, null)]; coreRunV2StartSkill(game, game.players[0], starter); check("2003 烽火起", game.players[0].hand.length === 0); }
      { const ally = makeCard("02101", 2, 0, 0), enemy = makeCard("01101", 1, 1, 0); ally.currentAttack = 0; enemy.currentAttack = 8; const game = traitGame("2004", [ally, enemy]); coreEnforceElitePowerBounds(game); check("2004 关山急", ally.currentAttack === 2 && enemy.currentAttack === 5); }
      { const enemy = makeCard("01101", 1, 0, 0), guard = { uid: "guard-2005", attack: 2, currentAttack: 2, ownerId: null, isGuard: true }; const game = traitGame("2005", [enemy, guard]); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[0], card: enemy }, []); const placed = enemy.currentAttack === enemy.attack + 1; coreApplyEliteAiTrait(game, game.players[1], []); check("2005 鸿门宴", placed && enemy.currentAttack === enemy.attack && guard.currentAttack === guard.attack - 1); }
      { const ally = makeCard("02101", 2, 0, 0); const game = traitGame("2006", [ally]); game.players[1].drawPile = [makeCard("02102", 2, null, null)]; coreApplyEliteAiTraitEvent(game, "cardDrawn", { player: game.players[0], card: makeCard("01101", 1, null, null) }, []); const drew = game.players[1].hand.length === 1; game.players[1].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("02103", 2, null, null)); coreApplyEliteAiTraitEvent(game, "cardDrawn", { player: game.players[0], card: makeCard("01102", 1, null, null) }, []); check("2006 丹书诏", drew && ally.currentAttack === ally.attack + 1); }
      { const highA = makeCard("01101", 1, 1, 1), highB = makeCard("01102", 1, 2, 2), low = makeCard("01103", 1, 3, 3); highA.currentAttack = 5; highB.currentAttack = 5; low.currentAttack = 2; const game = traitGame("2007", [highA, highB, low]); game.activePlayerId = 1; check("2007 古道尘", coreValidMoves(game, highA).length === 0 && coreValidMoves(game, highB).length === 0 && coreValidMoves(game, low).length > 0); }
      { const ally = makeCard("02101", 2, 0, 0); const game = traitGame("2008", [ally]); game.activePlayerId = 2; check("2008 城下盟", !coreDestroyV2Card(game, ally, []) && game.boardCards.includes(ally)); }

      { const a = makeCard("02101", 2, 0, 0), b = makeCard("02102", 2, 1, 0); const game = traitGame("3001", [a, b]); coreApplyEliteAiTrait(game, game.players[1], []); check("3001 振奋人心", a.currentAttack === a.attack + 1 && b.currentAttack === b.attack + 1); }
      { const enemy = makeCard("01101", 1, 0, 0); const game = traitGame("3002", [enemy]); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[0], card: enemy }, []); check("3002 虚弱无力", enemy.currentAttack === Math.max(0, enemy.attack - 2)); }
      { const game = traitGame("3003"); check("3003 灵动迅捷", coreActionLimit(game) === 2); }
      { const placed = makeCard("02101", 2, null, null); const game = traitGame("3004"); game.players[1].hand = [placed]; game.actionsUsed = coreActionLimit(game); const allowed = coreCanUseAction(game, placed); placed.row = 0; placed.col = 0; game.boardCards.push(placed); coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[1], card: placed }, []); check("3004 凤鸣九霄", allowed && placed.currentAttack === placed.attack + 3 && placed.eliteTraitState?.freePlacementTurn === game.turn); }
      { const ally = makeCard("02101", 2, 0, 0); const game = traitGame("3005", [ally]); coreApplyEliteAiTraitEvent(game, "cardMoved", { card: ally, source: { row: 0, col: 0 }, target: { row: 0, col: 1 } }, []); check("3005 勇冠三军", ally.currentAttack === ally.attack + 2); }
      { const dead = makeCard("02101", 2, 0, 0), ally = makeCard("02102", 2, 1, 0); const game = traitGame("3006", [dead, ally]); coreDestroyV2Card(game, dead, []); check("3006 破釜沉舟", ally.currentAttack === ally.attack + 1); }
      { const weak = makeCard("01101", 1, null, null), valid = makeCard("01102", 1, null, null); weak.currentAttack = 0; valid.currentAttack = 1; const game = traitGame("3007"); check("3007 关山暮雪", !coreCanPlaceCard(game, weak) && coreCanPlaceCard(game, valid)); }
      { const placed = makeCard("01101", 1, 0, 0); const handA = makeCard("02101", 2, null, null), handB = makeCard("02102", 2, null, null); const game = traitGame("3008", [placed]); game.players[1].hand = [handA, handB]; coreApplyEliteAiTraitEvent(game, "cardPlaced", { player: game.players[0], card: placed }, []); check("3008 暗度陈仓", handA.currentAttack === handA.attack + 1 && handB.currentAttack === handB.attack + 1); }

      const previousOnlinePlayerId = state.online?.playerId;
      const previousOnlineRole = state.online?.role;
      const cardTestViewGame = makeGame(); cardTestViewGame.mode = "card-test";
      cardTestViewGame.activePlayerId = 2;
      const cardTestViewerId = coreViewerPlayerId(cardTestViewGame);
      const cardTestOpponentTurn = coreIsOpponentTurn(cardTestViewGame);
      const onlineViewGame = makeGame(); onlineViewGame.mode = "online";
      state.online.playerId = 2;
      onlineViewGame.activePlayerId = 1;
      const onlineViewerDuringOpponentTurn = coreViewerPlayerId(onlineViewGame);
      const onlineOpponentTurn = coreIsOpponentTurn(onlineViewGame);
      onlineViewGame.activePlayerId = 2;
      const onlineViewerDuringOwnTurn = coreViewerPlayerId(onlineViewGame);
      const onlineOwnTurn = !coreIsOpponentTurn(onlineViewGame);
      state.online.role = "player";
      const playerCanActOnOwnTurn = coreCanViewerInteract(onlineViewGame);
      onlineViewGame.activePlayerId = 1;
      const playerCannotActOnOpponentTurn = !coreCanViewerInteract(onlineViewGame);
      state.online.role = "spectator";
      const spectatorIsReadOnly = coreIsSpectator() && !coreCanViewerInteract(onlineViewGame);
      state.online.playerId = previousOnlinePlayerId;
      state.online.role = previousOnlineRole;
      check("左侧玩家信息固定为本机视角", cardTestViewerId === 1
        && onlineViewerDuringOpponentTurn === 2
        && onlineViewerDuringOwnTurn === 2);
      check("行动数颜色按固定视角区分敌我回合", cardTestOpponentTurn && onlineOpponentTurn && onlineOwnTurn);
      check("观战模式始终为只读", playerCanActOnOwnTurn && playerCannotActOnOpponentTurn && spectatorIsReadOnly);

      const removedMode = ["p", "vp"].join("");
      let removedLocalModeRejected = false;
      try {
        coreCreateGame(removedMode, { 1: "三国~蜀", 2: "三国~魏" }, 5);
      } catch (_error) {
        removedLocalModeRejected = true;
      }
      const selectedModeBeforeInvalidStart = state.selectedMode;
      const hiddenLocalStartRejected = window.startRandomGame(removedMode) === false
        && state.selectedMode === selectedModeBeforeInvalidStart;
      check("已移除的旧双人模式无法创建或从隐藏路径启动", removedLocalModeRejected && hiddenLocalStartRejected);

      const timerGame = makeGame();
      const deadline = coreStartTurnTimer(timerGame, 1000);
      check("每回合计时固定为 300 秒", CORE_TURN_TIME_LIMIT_SECONDS === 300
        && deadline === 301000
        && coreTurnSecondsRemaining(timerGame, 1000) === 300
        && coreTurnSecondsRemaining(timerGame, 241000) === 60
        && coreTurnSecondsRemaining(timerGame, 301000) === 0
        && coreTurnSecondsRemaining({ turnDeadlineAt: null }, 301000) === null
        && coreFormatTurnTime(300) === "05:00"
        && coreFormatTurnTime(9) === "00:09");

      const challengeGame = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1001"]);
      challengeGame.activePlayerId = 2;
      const suppliedTraitGame = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1001"]);
      const famineOpeningGame = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1008"]);
      check("PVE 挑战模式", challengeGame.challengeMode
        && challengeGame.players[1].isAI
        && challengeGame.players[1].name === "精英 AI"
        && challengeGame.eliteAiTraitOwnerId === 2
        && challengeGame.players[1].hand.length === (challengeGame.firstPlayerId === 2 ? 2 : 3)
        && coreActionLimit(challengeGame) === 1
        && suppliedTraitGame.eliteAiEffectIds.length === 1
        && suppliedTraitGame.eliteAiEffectIds[0] === "1001"
        && famineOpeningGame.players[1].hand.length === 1
        && coreHandLimitForPlayer(famineOpeningGame, famineOpeningGame.players[1]) === 1);
      state.game = challengeGame;
      window.render();
      check("挑战模式AI回合不显示AI手牌", document.getElementById("hand-title").textContent === `${challengeGame.players[0].name} 的手牌`
        && document.getElementById("hand-cards").children.length === challengeGame.players[0].hand.length);

      const gauntletPlayerOptions = corePickGauntletPlayerOptions();
      check("过关斩将玩家初始卡组三国三选一且固定为4普通1稀有", gauntletPlayerOptions.length === 3
        && new Set(gauntletPlayerOptions.map((option) => option.campKey)).size === 3
        && gauntletPlayerOptions.every((option) => {
          const cards = option.cardIds.map((id) => window.CARD_LIBRARY.cardSlots.find((card) => String(card.id) === String(id)));
          return option.cardIds.length === 5
            && new Set(option.cardIds).size === 5
            && cards.every((card) => card?.camp === option.campKey)
            && cards.filter((card) => card?.rarity === "普通").length === 4
            && cards.filter((card) => card?.rarity === "稀有").length === 1;
        }));

      const gauntletAiSamples = Array.from({ length: 60 }, () => corePickGauntletAiOptions(5));
      check("过关斩将AI三选一的末项难度严格更高且卡量随难度变化", gauntletAiSamples.every((options) => options.length === 3
        && options[2].level > options[0].level
        && options[2].level > options[1].level
        && options.every((option) => ["三国~蜀", "三国~魏", "三国~吴", "混沌"].includes(option.campKey)
          && option.count === coreGauntletCardCount(5, option.level)
          && option.cardIds.length === option.count
          && new Set(option.cardIds).size === option.cardIds.length))
        && coreGauntletCardCount(5, 1) === 4
        && coreGauntletCardCount(5, 2) === 5
        && coreGauntletCardCount(5, 3) === 6
        && coreGauntletCardCount(5, 4) === 7
        && coreGauntletCardCount(5, 5) === 8);

      const playerGauntletOption = gauntletPlayerOptions[0];
      const aiGauntletOption = gauntletAiSamples[0][0];
      const gauntletGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: aiGauntletOption.campKey },
        5,
        1,
        aiGauntletOption.level,
        null,
        null,
        { 1: playerGauntletOption.cardIds, 2: aiGauntletOption.cardIds }
      );
      check("过关斩将以独立PVE小卡组创建对局", coreIsGauntlet(gauntletGame)
        && gauntletGame.gauntletMode
        && !gauntletGame.challengeMode
        && gauntletGame.players[0].deckCatalog.length === 5
        && gauntletGame.players[1].deckCatalog.length === aiGauntletOption.count
        && gauntletGame.players[1].isAI);

      const cardSlotById = (id) => window.CARD_LIBRARY.cardSlots.find((card) => String(card.id) === String(id));
      const rewardSamples = [1, 2, 3, 4, 5].flatMap((level) =>
        ["三国~蜀", "三国~魏", "三国~吴", "混沌"].map((campKey) => coreBuildGauntletAiOption(campKey, level, playerGauntletOption.cardIds))
      );
      check("过关斩将奖励来自AI实际卡组且稀有度符合难度", rewardSamples.every((option) => {
        const rewardCard = cardSlotById(option.rewardCardId);
        const allowedRarities = Object.keys(coreGauntletDifficultyInfo(option.level).rewardWeights);
        return option.cardIds.includes(option.rewardCardId)
          && !playerGauntletOption.cardIds.includes(option.rewardCardId)
          && allowedRarities.includes(rewardCard?.rarity)
          && (option.campKey === "混沌" || rewardCard?.camp === option.campKey);
      }));

      const rewardCamp = playerGauntletOption.campKey === "三国~魏" ? "三国~吴" : "三国~魏";
      const rewardAiOption = coreBuildGauntletAiOption(rewardCamp, 4, playerGauntletOption.cardIds);
      const rewardGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: rewardAiOption.campKey },
        5,
        1,
        rewardAiOption.level,
        null,
        null,
        { 1: playerGauntletOption.cardIds, 2: rewardAiOption.cardIds }
      );
      rewardGame.gauntletRewardCardId = rewardAiOption.rewardCardId;
      rewardGame.winner = { playerId: 1, text: "玩家 1 获胜" };
      state.gauntlet = {
        playerOptions: [playerGauntletOption],
        selectedPlayerOption: { ...playerGauntletOption, cardIds: [...playerGauntletOption.cardIds] },
        playerDeckCardIds: [...playerGauntletOption.cardIds],
        aiOptions: [rewardAiOption],
        selectedAiOption: rewardAiOption,
        lastReward: null
      };
      const rewardDeckSizeBefore = state.gauntlet.playerDeckCardIds.length;
      const grantedReward = coreGrantGauntletReward(rewardGame);
      const grantedAgain = coreGrantGauntletReward(rewardGame);
      check("过关斩将胜利奖励一张卡且重复结算不会重复发放", grantedReward?.cardId === rewardAiOption.rewardCardId
        && grantedAgain === grantedReward
        && rewardGame.gauntletRewardGranted
        && rewardGame.players[1].deckCatalog.some((card) => card.id === grantedReward.cardId)
        && state.gauntlet.playerDeckCardIds.length === rewardDeckSizeBefore + 1
        && state.gauntlet.playerDeckCardIds.filter((id) => id === grantedReward.cardId).length === 1);

      const nextRewardAiOption = coreBuildGauntletAiOption("混沌", 3, state.gauntlet.playerDeckCardIds);
      const nextGauntletGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: nextRewardAiOption.campKey },
        5,
        1,
        nextRewardAiOption.level,
        null,
        null,
        { 1: state.gauntlet.playerDeckCardIds, 2: nextRewardAiOption.cardIds }
      );
      check("过关斩将奖励可跨国度加入玩家卡组并用于后续对局", cardSlotById(grantedReward?.cardId)?.camp === rewardCamp
        && nextGauntletGame.players[0].deckCatalog.length === rewardDeckSizeBefore + 1
        && nextGauntletGame.players[0].deckCatalog.some((card) => card.id === grantedReward.cardId));

      const losingGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: rewardAiOption.campKey },
        5,
        1,
        rewardAiOption.level,
        null,
        null,
        { 1: playerGauntletOption.cardIds, 2: rewardAiOption.cardIds }
      );
      losingGame.gauntletRewardCardId = rewardAiOption.rewardCardId;
      losingGame.winner = { playerId: 2, text: "AI 获胜" };
      state.gauntlet.playerDeckCardIds = [...playerGauntletOption.cardIds];
      check("过关斩将失败不发放卡牌", coreGrantGauntletReward(losingGame) === null
        && state.gauntlet.playerDeckCardIds.length === playerGauntletOption.cardIds.length
        && !losingGame.gauntletRewardGranted);

      const fullDeckIds = window.CARD_LIBRARY.cardSlots
        .filter((card) => card.camp === playerGauntletOption.campKey)
        .slice(0, CORE_GAUNTLET_MAX_DECK_SIZE)
        .map((card) => String(card.id));
      const fullDeckAiOption = coreBuildGauntletAiOption(rewardCamp, 5, fullDeckIds);
      const fullDeckRewardGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: fullDeckAiOption.campKey },
        5,
        1,
        fullDeckAiOption.level,
        null,
        null,
        { 1: fullDeckIds, 2: fullDeckAiOption.cardIds }
      );
      fullDeckRewardGame.gauntletRewardCardId = fullDeckAiOption.rewardCardId;
      fullDeckRewardGame.winner = { playerId: 1, text: "玩家 1 获胜" };
      state.gauntlet = {
        playerOptions: [],
        selectedPlayerOption: { campKey: playerGauntletOption.campKey, cardIds: [...fullDeckIds] },
        playerDeckCardIds: [...fullDeckIds],
        aiOptions: [fullDeckAiOption],
        selectedAiOption: fullDeckAiOption,
        pendingReward: null,
        lastReward: null
      };
      const pendingFullDeckReward = coreGrantGauntletReward(fullDeckRewardGame);
      const pendingFullDeckRewardAgain = coreGrantGauntletReward(fullDeckRewardGame);
      check("过关斩将卡组满20张时奖励等待替换且不会直接超出上限", pendingFullDeckReward?.cardId === fullDeckAiOption.rewardCardId
        && pendingFullDeckReward?.pendingReplacement
        && pendingFullDeckRewardAgain === pendingFullDeckReward
        && fullDeckRewardGame.gauntletRewardPendingReplacement
        && !fullDeckRewardGame.gauntletRewardGranted
        && state.gauntlet.pendingReward === pendingFullDeckReward
        && state.gauntlet.playerDeckCardIds.length === CORE_GAUNTLET_MAX_DECK_SIZE);

      const removedCardId = fullDeckIds[0];
      const invalidReplacementRejected = coreReplaceGauntletRewardCard(fullDeckRewardGame, "missing-card") === null;
      const replacedFullDeckReward = coreReplaceGauntletRewardCard(fullDeckRewardGame, removedCardId);
      const deckAfterReplacement = [...state.gauntlet.playerDeckCardIds];
      const replacedFullDeckRewardAgain = coreReplaceGauntletRewardCard(fullDeckRewardGame, fullDeckIds[1]);
      check("过关斩将满卡组一换一后保持20张且重复替换无效", invalidReplacementRejected
        && replacedFullDeckReward?.replacedCardId === removedCardId
        && replacedFullDeckReward?.replacedCardName === cardSlotById(removedCardId)?.name
        && replacedFullDeckRewardAgain === replacedFullDeckReward
        && !fullDeckRewardGame.gauntletRewardPendingReplacement
        && fullDeckRewardGame.gauntletRewardGranted
        && state.gauntlet.pendingReward === null
        && state.gauntlet.lastReward === replacedFullDeckReward
        && state.gauntlet.playerDeckCardIds.length === CORE_GAUNTLET_MAX_DECK_SIZE
        && !state.gauntlet.playerDeckCardIds.includes(removedCardId)
        && state.gauntlet.playerDeckCardIds.includes(fullDeckAiOption.rewardCardId)
        && JSON.stringify(state.gauntlet.playerDeckCardIds) === JSON.stringify(deckAfterReplacement)
        && JSON.stringify(state.gauntlet.selectedPlayerOption.cardIds) === JSON.stringify(deckAfterReplacement));

      const abandonRewardGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: fullDeckAiOption.campKey },
        5,
        1,
        fullDeckAiOption.level,
        null,
        null,
        { 1: fullDeckIds, 2: fullDeckAiOption.cardIds }
      );
      abandonRewardGame.gauntletRewardCardId = fullDeckAiOption.rewardCardId;
      abandonRewardGame.winner = { playerId: 1, text: "玩家 1 获胜" };
      state.gauntlet = {
        playerOptions: [],
        selectedPlayerOption: { campKey: playerGauntletOption.campKey, cardIds: [...fullDeckIds] },
        playerDeckCardIds: [...fullDeckIds],
        aiOptions: [fullDeckAiOption],
        selectedAiOption: fullDeckAiOption,
        pendingReward: null,
        lastReward: null
      };
      const pendingAbandonReward = coreGrantGauntletReward(abandonRewardGame);
      const deckBeforeAbandon = [...state.gauntlet.playerDeckCardIds];
      const abandonedReward = coreAbandonGauntletReward(abandonRewardGame);
      const grantAfterAbandon = coreGrantGauntletReward(abandonRewardGame);
      const abandonedAgain = coreAbandonGauntletReward(abandonRewardGame);
      check("过关斩将满卡组可放弃奖励且重复结算不会重新发放", pendingAbandonReward?.pendingReplacement
        && abandonedReward?.abandoned
        && abandonedAgain === abandonedReward
        && grantAfterAbandon === abandonedReward
        && abandonRewardGame.gauntletRewardAbandoned
        && abandonRewardGame.gauntletRewardResolved
        && !abandonRewardGame.gauntletRewardPendingReplacement
        && !abandonRewardGame.gauntletRewardGranted
        && state.gauntlet.pendingReward === null
        && state.gauntlet.lastReward === null
        && JSON.stringify(state.gauntlet.playerDeckCardIds) === JSON.stringify(deckBeforeAbandon)
        && JSON.stringify(state.gauntlet.selectedPlayerOption.cardIds) === JSON.stringify(deckBeforeAbandon));

      let oversizedGauntletDeckRejected = false;
      try {
        coreCreateGame(
          "pve-gauntlet",
          { 1: playerGauntletOption.campKey, 2: fullDeckAiOption.campKey },
          5,
          1,
          fullDeckAiOption.level,
          null,
          null,
          { 1: window.CARD_LIBRARY.cardSlots.slice(0, CORE_GAUNTLET_MAX_DECK_SIZE + 1).map((card) => String(card.id)), 2: fullDeckAiOption.cardIds }
        );
      } catch (error) {
        oversizedGauntletDeckRejected = error instanceof RangeError;
      }
      const cappedNextGame = coreCreateGame(
        "pve-gauntlet",
        { 1: playerGauntletOption.campKey, 2: fullDeckAiOption.campKey },
        5,
        1,
        fullDeckAiOption.level,
        null,
        null,
        { 1: state.gauntlet.playerDeckCardIds, 2: fullDeckAiOption.cardIds }
      );
      check("过关斩将拒绝超过20张的玩家卡组并允许替换后的卡组继续对局", CORE_GAUNTLET_MAX_DECK_SIZE === 20
        && oversizedGauntletDeckRejected
        && cappedNextGame.players[0].deckCatalog.length === CORE_GAUNTLET_MAX_DECK_SIZE);
      const challengePlansValid = JSON.stringify(coreChallengeTraitPlan(1)) === JSON.stringify(["beginner"])
        && JSON.stringify(coreChallengeTraitPlan(2)) === JSON.stringify(["intermediate"])
        && JSON.stringify(coreChallengeTraitPlan(3)) === JSON.stringify(["advanced"])
        && JSON.stringify(coreChallengeTraitPlan(4)) === JSON.stringify(["advanced", "beginner"])
        && JSON.stringify(coreChallengeTraitPlan(12)) === JSON.stringify(["advanced", "advanced", "advanced", "advanced"]);
      const sampledTraitIds = corePickChallengeTraits(12);
      check("挑战关卡词条等级规划与抽取去重", challengePlansValid
        && sampledTraitIds.length === new Set(sampledTraitIds).size
        && sampledTraitIds.length === 4
        && sampledTraitIds.every((id) => window.ELITE_AI_EFFECT_INFO_V2[id]?.level === "advanced"));
      const excludedTraitSample = corePickChallengeTraits(4, ["3001", "1001"]);
      check("下一关 AI 词条排除上一关词条", !excludedTraitSample.includes("3001") && !excludedTraitSample.includes("1001"));

      {
        const previousGame = state.game;
        const previousLevel = state.challengeLevel;
        const previousPlayerTraits = state.challengePlayerTraitIds;
        const levelOne = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1001"]);
        levelOne.winner = { playerId: 1, text: "玩家 1 获胜" };
        state.game = levelOne;
        state.challengeLevel = 1;
        state.challengePlayerTraitIds = ["1008"];
        const advanced = window.beginNextChallengeLevel();
        const levelTwo = state.game;
        check("进入下一关时 AI 不继承上一关词条", advanced
          && levelTwo?.challengeLevel === 2
          && levelTwo.eliteAiEffectIds.length === 1
          && !levelTwo.eliteAiEffectIds.some((id) => levelOne.eliteAiEffectIds.includes(id))
          && levelTwo.challengePlayerTraitIds.includes("1008"));
        state.game = previousGame;
        state.challengeLevel = previousLevel;
        state.challengePlayerTraitIds = previousPlayerTraits;
      }

      {
        const previousEffects = window.ELITE_AI_EFFECTS_V2;
        window.ELITE_AI_EFFECTS_V2 = {
          ...previousEffects,
          // Simulate a stale cached 1008 implementation from before it was removed.
          "1008": { onCardDrawn(context) { context.operations.trimHandToOne(); } }
        };
        const openingGame = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1001"]);
        openingGame.eliteAiEffectIds = ["1008"];
        openingGame.eliteAiEffectId = "1008";
        const openingAi = openingGame.players[1];
        openingAi.hand.push(makeCard("02101", 2, null, null));
        const handBeforeOpeningTraitEvent = openingAi.hand.length;
        coreApplyEliteAiTraitEvent(openingGame, "cardDrawn", { player: openingAi }, []);
        check("开局展示阶段不会触发旧版1008弃牌", openingAi.hand.length === handBeforeOpeningTraitEvent);
        window.ELITE_AI_EFFECTS_V2 = previousEffects;
      }

      {
        const playerTraitGame = coreCreateGame("pve-challenge", { 1: "三国~蜀", 2: "三国~魏" }, 5, 1, 1, ["1001"], ["1006"]);
        playerTraitGame.activePlayerId = 1;
        playerTraitGame.eliteAiFirstPlacementClaims = { "1:1006": playerTraitGame.turn };
        coreStartTurn(playerTraitGame);
        check("玩家奖励词条的每回合首次放置状态会重置", !playerTraitGame.eliteAiFirstPlacementClaims["1:1006"]);
      }

      const occupiedA = makeCard("01101", 1, 0, 0);
      const occupiedB = makeCard("01102", 2, 0, 1);
      const controlGame = makeGame([occupiedA, occupiedB]);
      controlGame.v2ControlCells = [
        { row: 1, col: 1, ownerId: 1, sourceUid: "a", untilTurn: 9 },
        { row: 1, col: 1, ownerId: 1, sourceUid: "b", untilTurn: 9 },
        { row: 1, col: 2, ownerId: 1, sourceUid: "c", untilTurn: 9 },
        { row: 1, col: 2, ownerId: 2, sourceUid: "d", untilTurn: 9 }
      ];
      check("占领格重复与争议去重", coreControlMap(controlGame).counts[1] === 2 && coreControlMap(controlGame).counts[2] === 1);

      const caoCao = makeCard("02416", 1, 0, 0);
      const placed = makeCard("02105", 1, 1, 1);
      const placementGame = makeGame([caoCao, placed]); state.game = placementGame;
      coreTriggerOtherV2PlacementEffects(placementGame, placementGame.players[0], placed, []);
      check("曹操在友军放置后永久加一", caoCao.currentAttack === 1);

      // 回合自动结束超时机制测试
      const autoEndGame = makeGame();
      autoEndGame.mode = "card-test";
      autoEndGame.currentPhase = "行动阶段";
      autoEndGame.activePlayerId = 1;
      autoEndGame.players[0].name = "玩家 1";
      state.game = autoEndGame;
      const autoEndDeadline = coreStartTurnTimer(autoEndGame, 1000);
      const autoEndSecsAtStart = coreTurnSecondsRemaining(autoEndGame, 1000);
      const autoEndSecsAtEnd = coreTurnSecondsRemaining(autoEndGame, autoEndDeadline);
      check("回合计时：起点 300 秒，终点 0 秒", autoEndSecsAtStart === 300 && autoEndSecsAtEnd === 0);

      const noAnimationGame = makeGame();
      noAnimationGame.mode = "card-test";
      noAnimationGame.currentPhase = "行动阶段";
      noAnimationGame.activePlayerId = 1;
      noAnimationGame.isAnimating = false;
      noAnimationGame.winner = null;
      noAnimationGame.players[0].name = "玩家 1";
      state.game = noAnimationGame;
      const noAnimDeadline = coreStartTurnTimer(noAnimationGame, 1000);
      const shouldAutoEnd = coreTurnSecondsRemaining(noAnimationGame, noAnimDeadline) === 0 && !noAnimationGame.isAnimating;
      check("无技能/动画时：倒计时 0 应自动结束", shouldAutoEnd);

      const withAnimationGame = makeGame();
      withAnimationGame.mode = "card-test";
      withAnimationGame.currentPhase = "行动阶段";
      withAnimationGame.activePlayerId = 1;
      withAnimationGame.isAnimating = true;
      withAnimationGame.winner = null;
      withAnimationGame.players[0].name = "玩家 1";
      state.game = withAnimationGame;
      const withAnimDeadline = coreStartTurnTimer(withAnimationGame, 1000);
      const shouldWaitAnimation = coreTurnSecondsRemaining(withAnimationGame, withAnimDeadline) === 0 && withAnimationGame.isAnimating === true;
      check("有技能/动画时：倒计时 0 应等待结算完成再自动结束", shouldWaitAnimation);

      // 移动与交战边界情况测试
      const attacker = makeCard("01101", 1, 0, 0);
      attacker.currentAttack = 2;
      const defender = makeCard("02101", 2, 1, 0);
      defender.currentAttack = 4;
      const combatGame = makeGame([attacker, defender]);
      combatGame.activePlayerId = 1;
      state.game = combatGame;
      const lowAttackWins = attacker.currentAttack > defender.currentAttack;
      check("低战力主动攻击高战力：攻击方仍被摧毁", !lowAttackWins && attacker.currentAttack === 2 && defender.currentAttack === 4);

      const protectedDefender = makeCard("01518", 2, 1, 0);
      protectedDefender.currentAttack = 2;
      const strongAttacker = makeCard("02102", 1, 0, 0);
      strongAttacker.currentAttack = 3;
      const protectionGame = makeGame([protectedDefender, strongAttacker]);
      protectionGame.activePlayerId = 1;
      state.game = protectionGame;
      const defenderProtected = protectedDefender.currentAttack === 2;
      check("防守方被保护时：攻击方应退回相邻位置", defenderProtected && strongAttacker.row === 0 && strongAttacker.col === 0);

      const winnerAttacker = makeCard("02103", 1, 0, 0);
      winnerAttacker.currentAttack = 5;
      const loserDefender = makeCard("01105", 2, 1, 0);
      loserDefender.currentAttack = 2;
      const winGame = makeGame([winnerAttacker, loserDefender]);
      winGame.activePlayerId = 1;
      state.game = winGame;
      coreResolveSkillAttack(winGame, winnerAttacker, loserDefender, winGame.players[0], []);
      const attackerInTarget = winnerAttacker.currentAttack > loserDefender.currentAttack;
      check("攻击方获胜时：攻击方进入目标格", attackerInTarget && winnerAttacker.row === 1 && winnerAttacker.col === 0);

      const remoteAlly = makeCard("02105", 1, 3, 3);
      const commanderGame = makeGame([caoCao, placed, remoteAlly]); state.game = commanderGame;
      coreApplyV2PlacementSkill(commanderGame, commanderGame.players[0], caoCao, []);
      check("曹操放置时强化所有其他友军", placed.currentAttack === placed.attack + 1 && remoteAlly.currentAttack === remoteAlly.attack + 1);
      coreAdjustAttack(remoteAlly, -1);
      check("曹操在场时我方减益正常生效", remoteAlly.currentAttack === remoteAlly.attack);

      const grain = makeCard("01107", 1, 0, 0);
      const grainGame = makeGame([grain]); grainGame.players[0].drawPile = [makeCard("01101", 1, null, null)]; state.game = grainGame;
      coreRunV2StartSkill(grainGame, grainGame.players[0], grain);
      check("糜芳手牌少于三张时抽牌", grainGame.players[0].hand.length === 1);

      const charge = makeCard("01209", 1, 1, 1);
      const threat = makeCard("01101", 2, 0, 1);
      const chargeGame = makeGame([charge, threat]); chargeGame.activePlayerId = 1;
      check("马超相邻敌军时获得两格移动", coreValidMoves(chargeGame, charge).some((cell) => cell.row === 3 && cell.col === 1));

      const raider = makeCard("02211", 1, 0, 0);
      const raiderGame = makeGame([raider]); raiderGame.activePlayerId = 1;
      check("夏侯渊首次可远袭", coreValidMoves(raiderGame, raider).some((cell) => cell.row === 0 && cell.col === 2));
      raider.v2LongMoveUsed = true;
      check("夏侯渊远袭使用后恢复一格移动", !coreValidMoves(raiderGame, raider).some((cell) => cell.row === 0 && cell.col === 2));

      const commander = makeCard("02314", 1, 0, 0);
      const zero = makeCard("02105", 2, 0, 1); zero.currentAttack = 0;
      const zeroGame = makeGame([commander, zero]); state.game = zeroGame;
      coreRunV2EndSkills(zeroGame, zeroGame.players[0], []);
      check("司马懿仅在回合结束摧毁归零卡牌后永久加一", commander.currentAttack === 1 && !zeroGame.boardCards.includes(zero));

      const order = makeCard("02519", 1, 0, 0);
      const ally = makeCard("01101", 1, 0, 1);
      const enemy = makeCard("01102", 2, 0, 2);
      const attackGame = makeGame([order, ally, enemy]); state.game = attackGame;
      coreApplyV2PlacementSkill(attackGame, attackGame.players[0], order, []);
      check("奉诏征伐触发相邻友军自动攻击非我方卡牌", !attackGame.boardCards.includes(enemy));

      const firstArray = makeCard("01518", 1, 0, 0);
      const secondArray = makeCard("01518", 1, 0, 1);
      const arrayGame = makeGame([firstArray, secondArray]); state.game = arrayGame;
      coreDestroyV2Card(arrayGame, firstArray, [], null);
      check("八阵图不会代替另一张八阵图被摧毁", !arrayGame.boardCards.includes(firstArray) && arrayGame.boardCards.includes(secondArray));

      const wangPing = makeCard("01102", 1, 1, 1);
      const movementGame = makeGame([wangPing]); movementGame.activePlayerId = 1;
      check("王平保留基础四向移动", coreValidMoves(movementGame, wangPing).some((cell) => cell.row === 1 && cell.col === 2));

      const jiangWei = makeCard("01211", 1, 1, 1); jiangWei.currentAttack = 3;
      const jiangWeiGame = makeGame([jiangWei]); jiangWeiGame.activePlayerId = 1;
      check("姜维不保留旧版斜向移动", !coreValidMoves(jiangWeiGame, jiangWei).some((cell) => cell.row === 0 && cell.col === 0));

      const zhuge = makeCard("01314", 1, 0, 0);
      const zhugeAttacker = makeCard("02105", 2, 0, 1);
      const secondEnemy = makeCard("02101", 2, 1, 1);
      const zhugeGame = makeGame([zhuge, zhugeAttacker, secondEnemy]); zhugeGame.activePlayerId = 2;
      check("诸葛亮占领落后时双方不能主动与其交战", !coreValidMoves(zhugeGame, zhugeAttacker).some((cell) => cell.row === 0 && cell.col === 0));
      coreResolveSkillAttack(zhugeGame, zhugeAttacker, zhuge, zhugeGame.players[1], []);
      check("诸葛亮不可交战状态同样阻止技能攻击", zhugeGame.boardCards.includes(zhuge) && zhugeGame.boardCards.includes(zhugeAttacker));

      const edict = makeCard("01520", 1, 1, 1);
      const edictGame = makeGame([edict]); edictGame.activePlayerId = 1; state.game = edictGame;
      coreApplyV2PlacementSkill(edictGame, edictGame.players[0], edict, []);
      const noPlacementControl = edictGame.v2ControlCells.length === 0;
      coreRunV2StartSkill(edictGame, edictGame.players[0], edict);
      check("昭烈仁德令仅在回合开始立即占领相邻空格", noPlacementControl && edictGame.v2ControlCells.length === 4 && edictGame.v2ControlCells.every((entry) => entry.startsAtTurn === undefined));

      const activeCard = makeCard("01101", 1, 0, 0);
      const offTurnCard = makeCard("03101", 2, 0, 1); offTurnCard.v2TempBonus = 2; offTurnCard.currentAttack += 2;
      const expiryGame = makeGame([activeCard, offTurnCard]); state.game = expiryGame;
      coreRunV2EndSkills(expiryGame, expiryGame.players[0], []);
      check("敌方回合获得的临时战力在本回合结束时清除", offTurnCard.currentAttack === offTurnCard.attack);

      const zhenJi = makeCard("02315", 1, 2, 2);
      const wuAlly = makeCard("01101", 1, 0, 1);
      const enemyForReduction = makeCard("02101", 2, 0, 0);
      const zhenJiGame = makeGame([zhenJi, wuAlly, enemyForReduction]); state.game = zhenJiGame;
      coreApplyV2PlacementSkill(zhenJiGame, zhenJiGame.players[0], zhenJi, []);
      coreAdjustAttack(wuAlly, 1, true);
      const gainIsAmplified = wuAlly.currentAttack === wuAlly.attack + 2 && wuAlly.v2PermanentBonus === 1;
      const ownReductionWorks = (() => { const before = wuAlly.currentAttack; coreAdjustAttack(wuAlly, -1); return wuAlly.currentAttack === before - 1; })();
      const enemyReductionStillWorks = (() => { const before = enemyForReduction.currentAttack; coreAdjustAttack(enemyForReduction, -1); return enemyForReduction.currentAttack === before - 1; })();
      coreRunV2EndSkills(zhenJiGame, zhenJiGame.players[0], []);
      const gainWatcherExpires = wuAlly.currentAttack === wuAlly.attack;
      zhenJiGame.turn = 2;
      coreAdjustAttack(wuAlly, 1, true);
      const nextTurnGainNotAmplified = wuAlly.currentAttack === wuAlly.attack + 1 && wuAlly.v2PermanentBonus === 0;
      check("甄姬只在放置当回合放大战力增加且不阻止己方减益", gainIsAmplified && ownReductionWorks
        && enemyReductionStillWorks && gainWatcherExpires && nextTurnGainNotAmplified);

      const simaYi = makeCard("02314", 1, 0, 0);
      const fragileTarget = makeCard("02105", 2, 0, 1);
      const zeroTriggerGame = makeGame([simaYi, fragileTarget]); state.game = zeroTriggerGame;
      coreAdjustAttack(fragileTarget, -1, true);
      const remainsBeforeEnd = zeroTriggerGame.boardCards.includes(fragileTarget) && simaYi.currentAttack === 0;
      coreRunV2EndSkills(zeroTriggerGame, zeroTriggerGame.players[0], []);
      check("司马懿不会即时摧毁归零卡牌，只在回合结束结算", remainsBeforeEnd && !zeroTriggerGame.boardCards.includes(fragileTarget) && simaYi.currentAttack === 1);

      const supply = makeCard("01519", 1, 0, 0);
      const remoteSupplyAlly = makeCard("01101", 1, 3, 3);
      const supplyGame = makeGame([supply, remoteSupplyAlly]); supplyGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null)); state.game = supplyGame;
      coreRunV2StartSkill(supplyGame, supplyGame.players[0], supply);
      check("木牛流马满手时可强化非相邻友军", remoteSupplyAlly.currentAttack === remoteSupplyAlly.attack + 2);

      const pangTong = makeCard("01315", 1, 0, 0);
      const equalEnemy = makeCard("02101", 2, 0, 1);
      const pangTongGame = makeGame([pangTong, equalEnemy]); state.game = pangTongGame;
      coreRunV2StartSkill(pangTongGame, pangTongGame.players[0], pangTong);
      check("庞统双方卡牌数相同时不触发强化", pangTong.currentAttack === pangTong.attack && !pangTongGame.extraActions);

      const zhaoYun = makeCard("01313", 1, 0, 0);
      const zhaoYunGame = makeGame([zhaoYun]); state.game = zhaoYunGame;
      zhaoYun.v2Protected = true;
      coreRunV2EndSkills(zhaoYunGame, zhaoYunGame.players[0], []);
      check("赵云的免毁次数在己方回合结束时失效", zhaoYun.v2Protected === false);

      const leJin = makeCard("02212", 1, 0, 0);
      const leJinGame = makeGame([leJin]); leJinGame.players[0].v2NextPlacementExtra = leJin.uid; leJinGame.players[0].v2NextPlacementExtraTurn = leJinGame.turn; state.game = leJinGame;
      coreRunV2EndSkills(leJinGame, leJinGame.players[0], []);
      check("乐进的额外放置结算不会跨回合保留", !leJinGame.players[0].v2NextPlacementExtra
        && !leJinGame.players[0].v2NextPlacementExtraTurn && !leJinGame.players[0].v2NextPlacementExtraCount);

      const endSimaYi = makeCard("02314", 1, 0, 0);
      const changedEnemy = makeCard("02101", 2, 0, 1); changedEnemy.v2StartTurn = 1; changedEnemy.v2StartAttack = changedEnemy.attack; changedEnemy.v2TempBonus = 1; changedEnemy.currentAttack += 1;
      const simaEndGame = makeGame([endSimaYi, changedEnemy]); state.game = simaEndGame;
      coreRunV2EndSkills(simaEndGame, simaEndGame.players[0], []);
      check("司马懿回合结束时会削弱满足条件的敌方卡牌", changedEnemy.currentAttack === changedEnemy.attack - 1);

      const fireBoat = makeCard("03518", 1, 1, 1);
      const brokenLimitGame = makeGame([fireBoat]); brokenLimitGame.brokenCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 0 }]; state.game = brokenLimitGame;
      coreDestroyV2Card(brokenLimitGame, fireBoat, [], null);
      check("破坏格达到上限后不再生成", brokenLimitGame.brokenCells.length === 5);

      const river = makeCard("03519", 1, 1, 1);
      const guardedRiver = makeCard("01101", 1, 1, 2);
      const riverGame = makeGame([river, guardedRiver]); riverGame.turn = 1; riverGame.activePlayerId = 1; state.game = riverGame;
      coreStartTurn(riverGame);
      const staysWithAlly = riverGame.boardCards.includes(river);
      const isolatedRiver = makeCard("03519", 1, 1, 1);
      const isolatedGame = makeGame([isolatedRiver]); isolatedGame.turn = 1; isolatedGame.activePlayerId = 1; state.game = isolatedGame;
      coreStartTurn(isolatedGame);
      check("长江天险有相邻友军时保留且孤立时自毁", staysWithAlly && !isolatedGame.boardCards.includes(isolatedRiver));

      const weiYan = makeCard("01208", 1, 1, 1);
      const zhugeLiang = makeCard("01314", 1, 1, 2);
      const reentryGuardGame = makeGame([weiYan, zhugeLiang]); state.game = reentryGuardGame;
      coreApplyV2PlacementSkill(reentryGuardGame, reentryGuardGame.players[0], weiYan, []);
      check("魏延与诸葛亮相邻时不会无限递归", reentryGuardGame.v2ResolvingStartSkills.size === 0);

      const aiWinningCards = [];
      for (let index = 0; index < 8; index += 1) aiWinningCards.push(makeCard("02105", 2, Math.floor(index / 4), index % 4));
      const aiWinGame = makeGame(aiWinningCards); aiWinGame.activePlayerId = 2; aiWinGame.actionsUsed = 0; aiWinGame.players[1].hand = [makeCard("02105", 2, null, null)];
      const aiWinningAction = corePlanAiAction(aiWinGame, aiWinGame.players[1]);
      check("AI优先选择可立即达成占领胜利的放置", aiWinningAction?.type === "place");

      { const placed = makeCard("02103", 1, null, null), ally = makeCard("01101", 1, 1, 0); const game = makeGame([ally]);
        game.players[0].hand = [placed]; state.game = game;
        const outcome = coreSimulateActionOutcome(game, game.players[0], { type: "place", playerId: 1, cardUid: placed.uid, target: { row: 1, col: 1 } });
        const simulatedAlly = outcome?.game?.boardCards.find((card) => card.uid === ally.uid);
        check("AI放置模拟执行真实技能结算", simulatedAlly?.currentAttack === ally.attack + 1
          && game.boardCards.length === 1 && game.players[0].hand.includes(placed)); }

      { const attacker = makeCard("03416", 1, 1, 0), defender = makeCard("02101", 2, 1, 1); const game = makeGame([attacker, defender]);
        attacker.currentAttack = 1; defender.currentAttack = 3; state.game = game;
        const outcome = coreSimulateActionOutcome(game, game.players[0], { type: "move", playerId: 1, cardUid: attacker.uid, source: { row: 1, col: 0 }, target: { row: 1, col: 1 } });
        const simulatedAttacker = outcome?.game?.boardCards.find((card) => card.uid === attacker.uid);
        check("AI移动模拟执行攻击前技能并结算战斗", simulatedAttacker?.row === 1 && simulatedAttacker?.col === 1
          && simulatedAttacker?.currentAttack === attacker.attack + 4 && !outcome?.game?.boardCards.some((card) => card.uid === defender.uid)
          && attacker.row === 1 && attacker.col === 0 && game.boardCards.includes(defender)); }

      { const skillCard = makeCard("02313", 1, null, null), plainCard = makeCard("02106", 1, null, null); const game = makeGame();
        game.players[0].hand = [skillCard, plainCard]; state.game = game;
        const action = corePlanAiAction(game, game.players[0]);
        check("AI候选排序采用技能结算后的局面", action?.type === "place" && action.cardUid === skillCard.uid); }

      const tigerCavalry = makeCard("02517", 1, null, null);
      const weakTarget = makeCard("02105", 2, 1, 2);
      const strongTarget = makeCard("03416", 2, 1, 2);
      const weakTradeGame = makeGame([weakTarget]);
      const strongTradeGame = makeGame([strongTarget]);
      check("AI虎豹骑更愿意交换高战力敌军", coreAiPlacementScore(strongTradeGame, strongTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }) > coreAiPlacementScore(weakTradeGame, weakTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }));

      const imported = coreLoadCardTestSetup({
        version: 2,
        cardDataVersion: "card-info-v2-wu-replacements-20260915",
        cards: [
          { id: "01101", ownerId: 1, row: 1, col: 1, attack: 6 },
          { id: "02101", ownerId: 2, row: 2, col: 2, attack: 2 },
          { id: "03101", ownerId: 1, row: 1, col: 1, attack: 2 }
        ],
        brokenCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 0 }, { row: 1, col: 3 }]
      });
      check("Card Test 场景会以 V2 核心导入并过滤非法重叠", imported && state.game.ruleset === "core-v2" && state.game.boardCards.length === 2 && state.game.boardCards[0].attack === 6 && state.game.brokenCells.length === 5);
      check("旧版 Card Test 场景不会进入当前对局", !coreLoadCardTestSetup({ version: 1, cards: [], brokenCells: [] }));

      const winningCards = [];
      for (let index = 0; index < 9; index += 1) winningCards.push(makeCard("02518", 1, Math.floor(index / 4), index % 4));
      const startVictoryGame = makeGame(winningCards); startVictoryGame.boardSize = 4; state.game = startVictoryGame;
      check("回合开始技能阶段会立即检查占领胜负", coreStartTurn(startVictoryGame) && startVictoryGame.winner?.playerId === 1);

      const mapSizes = [3, 4, 5].map((size) => coreCreateGame("card-test", { 1: "三国~蜀", 2: "三国~魏" }, size));
      check("3x3、4x4、5x5 地图尺寸与胜利阈值正确", mapSizes.every((map, index) => map.boardSize === index + 3 && map.boardCards.length === 2 && coreVictoryTarget(map) === [5, 9, 13][index]));
    } catch (error) {
      results.push({ name: "回归测试执行", passed: false, error: String(error) });
    } finally {
      state.game = previousGame;
      state.gauntlet = previousGauntlet;
    }
    return { passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length, results };
  }

  function coreRunV2CardBoundaryTests() {
    const previousGame = state.game;
    const results = [];
    const check = (id, name, condition) => results.push({ id, name, passed: Boolean(condition) });
    const makeCard = (id, ownerId, row, col) => {
      const template = window.CARD_LIBRARY?.cardSlots?.find((card) => card.id === id)
        || window.REPLACEMENT_CARDS?.find((card) => card.id === id);
      const card = cloneCard(template);
      Object.assign(card, { ownerId, row, col, currentAttack: Number(card.attack) || 0, v2PermanentBonus: 0, v2TempBonus: 0 });
      return card;
    };
    const makeGame = (boardCards = [], activePlayerId = 1) => ({
      turn: 1, activePlayerId, boardCards, brokenCells: [], v2ControlCells: [], v2PlacementLocks: [], moveLocks: {}, pendingAnimations: [], roundLog: [], players: [
        { id: 1, hand: [], drawPile: [], lastControlCount: 0 }, { id: 2, hand: [], drawPile: [], lastControlCount: 0 }
      ]
    });
    const start = (game, card) => { state.game = game; coreRunV2StartSkill(game, corePlayer(game, card.ownerId), card); };
    const place = (game, card) => { state.game = game; coreApplyV2PlacementSkill(game, corePlayer(game, card.ownerId), card, []); };
    const destroy = (game, card, cause = null) => { state.game = game; return coreDestroyV2Card(game, card, [], cause); };
    try {
      // Shu: turn-start and reactive boundaries.
      { const a = makeCard("01101", 1, 1, 1), ally = makeCard("01102", 1, 1, 2), g = makeGame([a, ally]); start(g, a); check("01101", "相邻友军提供临时战力", a.currentAttack === a.attack + 1); }
      {
        const a = makeCard("01102", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]);
        start(g, a);
        const boostedThisTurn = ally.currentAttack === ally.attack + 1 && ally.v2TempBonus === 1;
        coreRunV2EndSkills(g, g.players[0], []);
        check("01102", "相邻友军仅在本回合强化", boostedThisTurn && ally.currentAttack === ally.attack && ally.v2TempBonus === 0);
      }
      { const a = makeCard("01103", 1, 1, 1), weak = makeCard("01101", 1, 1, 0), high = makeCard("01210", 1, 1, 2), g = makeGame([a, weak, high]); start(g, a); check("01103", "仅最高相邻友军获得强化", high.currentAttack === high.attack + 1 && weak.currentAttack === weak.attack); }
      { const a = makeCard("01104", 1, 1, 1), ally = makeCard("01210", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), g = makeGame([a, ally, enemy]); start(g, a); check("01104", "相邻最高友军自动攻击", !g.boardCards.includes(enemy)); }
      { const a = makeCard("01105", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("01105", "相邻敌军触发永久强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("01106", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); const enemyReduced = enemy.currentAttack === 0; const guard = { uid: "guard-01106", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 }; const guardGame = makeGame([makeCard("01106", 1, 1, 1), guard]); start(guardGame, guardGame.boardCards[0]); check("01106", "随机相邻非我方卡牌含中立守军获得本回合减益", enemyReduced && guard.currentAttack === 0 && guard.v2TempBonus === -2); }
      {
        const belowThree = makeCard("01107", 1, 1, 1), belowThreeGame = makeGame([belowThree]);
        belowThreeGame.players[0].hand = Array.from({ length: 2 }, () => makeCard("01101", 1, null, null));
        belowThreeGame.players[0].drawPile = [makeCard("01101", 1, null, null)];
        start(belowThreeGame, belowThree);
        const drewBelowThree = belowThreeGame.players[0].hand.length === 3;
        const atThree = makeCard("01107", 1, 1, 1), atThreeGame = makeGame([atThree]);
        atThreeGame.players[0].hand = Array.from({ length: 3 }, () => makeCard("01101", 1, null, null));
        atThreeGame.players[0].drawPile = [makeCard("01101", 1, null, null)];
        start(atThreeGame, atThree);
        check("01107", "手牌少于三张时才抽牌", drewBelowThree && atThreeGame.players[0].hand.length === 3 && atThreeGame.players[0].drawPile.length === 1);
      }
      { const a = makeCard("01208", 1, 1, 1), ally = makeCard("01102", 1, 1, 2), target = makeCard("01101", 1, 1, 3), g = makeGame([a, ally, target]); place(g, a); check("01208", "放置时触发相邻友军的开始技能", target.currentAttack === target.attack + 1); }
      {
        const placement = makeCard("01208", 1, 1, 1), watcher = makeCard("01314", 1, 1, 2);
        const target = makeCard("01105", 1, 1, 0), enemy = makeCard("02105", 2, 0, 0);
        const g = makeGame([placement, watcher, target, enemy]);
        place(g, placement);
        check("01208", "放置触发友方回合开始技能时被01314额外结算", target.currentAttack === target.attack + 2);
      }
      {
        const a = makeCard("01209", 1, 1, 1);
        const rowEnemy = makeCard("02105", 2, 1, 0), distantRowEnemy = makeCard("02105", 2, 1, 3);
        const guard = { uid: "guard-01209", ownerId: null, row: 1, col: 2, currentAttack: 2, attack: 2, isGuard: true };
        const diagonalEnemy = makeCard("02105", 2, 2, 2), sameColumnAlly = makeCard("01101", 1, 0, 1);
        const g = makeGame([a, rowEnemy, distantRowEnemy, guard, diagonalEnemy, sameColumnAlly]);
        start(g, a);
        const countedLineEnemies = a.currentAttack === a.attack + 3 && a.v2TempBonus === 3;
        const retainedChargeMove = coreValidMoves(g, a).some((cell) => cell.row === 3 && cell.col === 1);
        coreRunV2EndSkills(g, g.players[0], []);
        check("01209", "同行同列敌军与守军提供等量临时强化且保留冲锋移动", countedLineEnemies && retainedChargeMove && a.currentAttack === a.attack);
      }
      { const a = makeCard("01210", 1, 1, 1), diagonal = makeCard("02105", 2, 0, 0), other = makeCard("02105", 2, 2, 1), g = makeGame([a, diagonal, other]); start(g, a); check("01210", "同行或同列敌军会被烈弓选中", diagonal.currentAttack === diagonal.attack && other.currentAttack === 0); }
      {
        const behind = makeCard("01211", 1, 1, 1), behindAlly = makeCard("01101", 1, 1, 2), behindEnemy = makeCard("02101", 2, 3, 3);
        const behindGame = makeGame([behind, behindAlly, behindEnemy]);
        behindGame.v2ControlCells = [
          { row: 0, col: 0, ownerId: 2, sourceUid: "enemy-control-a", untilTurn: Infinity },
          { row: 0, col: 1, ownerId: 2, sourceUid: "enemy-control-b", untilTurn: Infinity }
        ];
        start(behindGame, behind);
        const behindByControl = behind.currentAttack === behind.attack + 2 && behindAlly.currentAttack === behindAlly.attack;

        const ahead = makeCard("01211", 1, 1, 1), aheadAlly = makeCard("01101", 1, 1, 2);
        const aheadEnemies = [makeCard("02101", 2, 3, 0), makeCard("02101", 2, 3, 1), makeCard("02101", 2, 3, 2)];
        const aheadGame = makeGame([ahead, aheadAlly, ...aheadEnemies]);
        aheadGame.v2ControlCells = [
          { row: 0, col: 0, ownerId: 1, sourceUid: "ally-control-a", untilTurn: Infinity },
          { row: 0, col: 1, ownerId: 1, sourceUid: "ally-control-b", untilTurn: Infinity }
        ];
        start(aheadGame, ahead);
        const aheadByControl = ahead.currentAttack === ahead.attack && aheadAlly.currentAttack === aheadAlly.attack + 1 && aheadAlly.v2TempBonus === 1;
        coreRunV2EndSkills(aheadGame, aheadGame.players[0], []);
        check("01211", "按包含技能控制格的占领区域数选择临时强化分支", behindByControl && aheadByControl && aheadAlly.currentAttack === aheadAlly.attack);
      }
      {
        const a = cloneCard({ id: "01212", attack: 99 });
        Object.assign(a, { ownerId: 1, row: 1, col: 1, v2PermanentBonus: 0, v2TempBonus: 0 });
        const g = makeGame([a]);
        start(g, a);
        const permanentGrowth = a.attack === 2 && a.currentAttack === 3 && a.v2PermanentBonus === 1;
        const activeMoveBlocked = coreValidMoves(g, a).length === 0;
        coreRunV2EndSkills(g, g.players[0], []);
        const growthSurvivedTurnEnd = a.currentAttack === 3;
        const swapper = makeCard("02209", 1, 1, 2);
        g.boardCards.push(swapper);
        place(g, swapper);
        const forcedMoveAllowed = a.row === 1 && a.col === 2 && swapper.row === 1 && swapper.col === 1;
        check("01212", "基础战力二且永久成长，禁止主动移动但允许效果强制移动", permanentGrowth && activeMoveBlocked && growthSurvivedTurnEnd && forcedMoveAllowed);
      }
      {
        const a = makeCard("01313", 1, 1, 1), g = makeGame([a]);
        a.v2PermanentBonus = 6 - a.attack;
        a.currentAttack = 6;
        start(g, a);
        const forcedToPermanentFour = a.currentAttack === 4 && a.v2PermanentBonus === 4 - a.attack && a.v2TempBonus === 0;
        const protectedFirst = !destroy(g, a) && a.currentAttack === 1 && a.v2PermanentBonus === 1 - a.attack && a.v2TempBonus === 0;
        const destroyedSecond = destroy(g, a) && !g.boardCards.includes(a);

        const survivor = makeCard("01313", 1, 2, 2), survivorGame = makeGame([survivor]);
        start(survivorGame, survivor);
        const survivorProtected = !destroy(survivorGame, survivor) && survivor.currentAttack === 1;
        coreRunV2EndSkills(survivorGame, survivorGame.players[0], []);
        const oneSurvivedTurnEnd = survivor.currentAttack === 1 && survivor.v2PermanentBonus === 1 - survivor.attack;
        survivorGame.turn = 3;
        start(survivorGame, survivor);
        const nextTurnResetToFour = survivor.currentAttack === 4 && survivor.v2PermanentBonus === 4 - survivor.attack;
        check("01313", "回合开始永久设为四且首次免毁永久设为一", forcedToPermanentFour && protectedFirst && destroyedSecond && survivorProtected && oneSurvivedTurnEnd && nextTurnResetToFour);
      }
      {
        const a = makeCard("01314", 1, 1, 1), ally = makeCard("01105", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), g = makeGame([a, ally, enemy]);
        state.game = g;
        coreStartTurn(g);
        check("01314", "友方回合开始技能额外结算一次", ally.currentAttack === ally.attack + 2);
      }
      {
        const guard = { uid: "guard-01315", ownerId: null, row: 0, col: 0, currentAttack: 2, attack: 2, isGuard: true };
        const equal = makeCard("01315", 1, 1, 1), equalEnemy = makeCard("02101", 2, 3, 3);
        const equalGame = makeGame([equal, equalEnemy, guard]);
        start(equalGame, equal);
        const guardIgnoredAtEquality = !equalGame.extraActions && equal.currentAttack === equal.attack;

        const behind = makeCard("01315", 1, 1, 1), behindEnemies = [makeCard("02101", 2, 3, 2), makeCard("02101", 2, 3, 3)];
        const behindGame = makeGame([behind, ...behindEnemies, { ...guard, uid: "guard-01315-behind" }]);
        start(behindGame, behind);
        const fewerAddsAction = behindGame.extraActions === 1;

        const ahead = makeCard("01315", 1, 1, 1), aheadAlly = makeCard("01101", 1, 1, 2), aheadEnemy = makeCard("02101", 2, 3, 3);
        const aheadGame = makeGame([ahead, aheadAlly, aheadEnemy, { ...guard, uid: "guard-01315-ahead" }]);
        start(aheadGame, ahead);
        const moreBuffsOwnCards = ahead.currentAttack === ahead.attack + 1 && aheadAlly.currentAttack === aheadAlly.attack + 1;
        coreRunV2EndSkills(aheadGame, aheadGame.players[0], []);
        check("01315", "仅比较双方玩家卡牌数并忽略中立守军", guardIgnoredAtEquality && fewerAddsAction && moreBuffsOwnCards && ahead.currentAttack === ahead.attack && aheadAlly.currentAttack === aheadAlly.attack);
      }
      {
        const a = makeCard("01416", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), drawn = makeCard("01101", 1, null, null), g = makeGame([a, enemy]);
        g.players[0].drawPile = [drawn];
        start(g, a);
        const startEffectApplied = a.currentAttack === a.attack + 2 && a.freeActionTurn === g.turn;
        coreResolveSkillAttack(g, a, enemy, g.players[0], []);
        const drewAfterDestroyingOpponent = g.players[0].hand.includes(drawn);

        const freeMover = makeCard("01416", 1, 1, 1), freeGame = makeGame([freeMover]);
        start(freeGame, freeMover);
        freeGame.actionsUsed = 1;
        freeGame.selection = { handCardUid: null, boardCardUid: freeMover.uid, targetCell: { row: 1, col: 2 } };
        const freeMoveAfterLimit = coreBuildPendingAction(freeGame);

        const normalMover = makeCard("01101", 1, 1, 1), normalGame = makeGame([normalMover]);
        normalGame.actionsUsed = 1;
        normalGame.selection = { handCardUid: null, boardCardUid: normalMover.uid, targetCell: { row: 1, col: 2 } };
        const normalMoveAfterLimit = coreBuildPendingAction(normalGame);
        check("01416", "行动数耗尽后仅本回合免费卡仍可移动", startEffectApplied && drewAfterDestroyingOpponent && freeMoveAfterLimit?.type === "move" && normalMoveAfterLimit === null);
      }
      { const a = makeCard("01517", 1, 1, 1), row = makeCard("02101", 2, 1, 3), col = makeCard("02101", 2, 3, 1), diagonal = makeCard("02101", 2, 2, 2), g = makeGame([a, row, col, diagonal]); start(g, a); check("01517", "仅同行同列卡牌被永久削弱", row.currentAttack === row.attack - 1 && col.currentAttack === col.attack - 1 && diagonal.currentAttack === diagonal.attack); }
      { const a = makeCard("01518", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); const saved = !destroy(g, ally); check("01518", "代替相邻友军被摧毁", saved && !g.boardCards.includes(a) && g.boardCards.includes(ally)); }
      {
        const a = makeCard("01519", 1, 0, 0), ally = makeCard("02101", 1, 3, 3), g = makeGame([a, ally]);
        g.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        g.players[0].drawPile = [makeCard("01101", 1, null, null)];
        coreStartTurn(g);
        const twoFullHandFailures = ally.currentAttack === ally.attack + 4 && ally.v2PermanentBonus === 4;

        const watcher = makeCard("01519", 1, 1, 1), enemyDeckDrawer = makeCard("03208", 1, 1, 2), drawGame = makeGame([watcher, enemyDeckDrawer]);
        drawGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        drawGame.players[1].drawPile = [makeCard("02101", 2, null, null)];
        place(drawGame, enemyDeckDrawer);
        const otherDrawFailureTriggered = enemyDeckDrawer.currentAttack === enemyDeckDrawer.attack + 2;

        const emptyWatcher = makeCard("01519", 1, 0, 0), emptyAlly = makeCard("02101", 1, 3, 3), emptyGame = makeGame([emptyWatcher, emptyAlly]);
        start(emptyGame, emptyWatcher);
        const deckEmptyIgnored = emptyAlly.currentAttack === emptyAlly.attack;
        check("01519", "己方任意抽牌因满手失败时强化其他友军", twoFullHandFailures && otherDrawFailureTriggered && deckEmptyIgnored);
      }
      {
        const a = makeCard("01520", 1, 2, 2), blocker = makeCard("02101", 2, 2, 3), g = makeGame([a, blocker]);
        place(g, a);
        const placementDoesNothing = g.v2ControlCells.length === 0;
        start(g, a);
        const firstStartControlsOpenCells = g.v2ControlCells.filter((entry) => entry.sourceUid === a.uid).length === 3;

        g.boardCards.splice(g.boardCards.indexOf(blocker), 1);
        start(g, a);
        const secondStartRetainsAndAdds = g.v2ControlCells.filter((entry) => entry.sourceUid === a.uid).length === 4;

        const ally = makeCard("01101", 1, 2, 3);
        g.boardCards.push(ally);
        coreRunV2MoveEffects(g, ally, { row: 2, col: 4 }, { row: 2, col: 3 }, true);
        const friendlyEntryInvalidates = !g.v2ControlCells.some((entry) => entry.sourceUid === a.uid && entry.row === 2 && entry.col === 3);
        ally.row = 2; ally.col = 4;
        coreRunV2MoveEffects(g, ally, { row: 2, col: 3 }, { row: 2, col: 4 }, true);
        const leavingDoesNotRestore = !g.v2ControlCells.some((entry) => entry.sourceUid === a.uid && entry.row === 2 && entry.col === 3);
        start(g, a);
        const nextStartReoccupies = g.v2ControlCells.some((entry) => entry.sourceUid === a.uid && entry.row === 2 && entry.col === 3);

        const otherController = makeCard("01520", 1, 1, 1);
        g.boardCards.push(otherController);
        start(g, otherController);
        const otherControlInvalidates = !g.v2ControlCells.some((entry) => (
          entry.sourceUid === a.uid
          && ((entry.row === 1 && entry.col === 2) || (entry.row === 2 && entry.col === 1))
        ));
        const retainedBeforeLeaving = g.v2ControlCells.filter((entry) => entry.sourceUid === a.uid).map((entry) => `${entry.row},${entry.col}`).sort().join("|");
        destroy(g, a);
        const survivesSourceLeaving = g.v2ControlCells.filter((entry) => entry.sourceUid === a.uid).map((entry) => `${entry.row},${entry.col}`).sort().join("|") === retainedBeforeLeaving;

        check("01520", "回合开始占领会保留、失效、恢复并在来源离场后继续存在", placementDoesNothing && firstStartControlsOpenCells && secondStartRetainsAndAdds && friendlyEntryInvalidates && leavingDoesNotRestore && nextStartReoccupies && otherControlInvalidates && survivesSourceLeaving);
      }

      {
        const allySource = makeCard("01121", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), allyGame = makeGame([allySource, ally]);
        start(allyGame, allySource);
        const swapsWithAlly = allySource.row === 1 && allySource.col === 2 && ally.row === 1 && ally.col === 1;

        const enemySource = makeCard("01121", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2), enemyGame = makeGame([enemySource, enemy]);
        start(enemyGame, enemySource);
        const swapsWithEnemy = enemySource.row === 1 && enemySource.col === 2 && enemy.row === 1 && enemy.col === 1;

        const guardSource = makeCard("01121", 1, 1, 1);
        const guard = { uid: "guard-01121", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true };
        const guardGame = makeGame([guardSource, guard]);
        start(guardGame, guardSource);
        const swapsWithGuard = guardSource.row === 1 && guardSource.col === 2 && guard.row === 1 && guard.col === 1;

        const isolated = makeCard("01121", 1, 2, 2), isolatedGame = makeGame([isolated]);
        start(isolatedGame, isolated);
        const noTargetDoesNothing = isolated.row === 2 && isolated.col === 2;
        check("01121", "回合开始随机交换任一四方相邻卡牌且包含友军敌军与守军", swapsWithAlly && swapsWithEnemy && swapsWithGuard && noTargetDoesNothing);
      }

      {
        const winner = makeCard("01122", 1, 1, 1), weaker = makeCard("02101", 2, 1, 2), winGame = makeGame([winner, weaker]);
        start(winGame, winner);
        const winGainsOne = winGame.boardCards.includes(winner) && !winGame.boardCards.includes(weaker)
          && winner.currentAttack === winner.attack + 1 && winner.v2PermanentBonus === 1 && winner.v2TempBonus === 0;
        coreRunV2EndSkills(winGame, winGame.players[0], []);
        check("01122", "合法攻击获胜后永久加一且回合结束保留", winGainsOne && winner.currentAttack === winner.attack + 1);

        const loser = makeCard("01122", 1, 1, 1), stronger = makeCard("02101", 2, 1, 2), loseGame = makeGame([loser, stronger]);
        stronger.currentAttack = stronger.attack + 2; stronger.v2PermanentBonus = 2;
        start(loseGame, loser);
        check("01122", "合法攻击失败仍永久加一但不免除摧毁", !loseGame.boardCards.includes(loser)
          && loseGame.boardCards.includes(stronger) && loser.currentAttack === loser.attack + 1 && loser.v2PermanentBonus === 1);

        const equalAttacker = makeCard("01122", 1, 1, 1), equalDefender = makeCard("02103", 2, 1, 2), equalGame = makeGame([equalAttacker, equalDefender]);
        start(equalGame, equalAttacker);
        check("01122", "合法攻击平局仍永久加一但双方正常摧毁", !equalGame.boardCards.includes(equalAttacker)
          && !equalGame.boardCards.includes(equalDefender) && equalAttacker.v2PermanentBonus === 1);

        const noTarget = makeCard("01122", 1, 1, 1), friend = makeCard("01101", 1, 1, 2), diagonal = makeCard("02101", 2, 2, 2), noTargetGame = makeGame([noTarget, friend, diagonal]);
        start(noTargetGame, noTarget);
        check("01122", "无四方相邻非己方目标时不攻击也不加战力", noTargetGame.boardCards.length === 3
          && noTarget.currentAttack === noTarget.attack && noTarget.v2PermanentBonus === 0);

        const blocked = makeCard("01122", 1, 1, 1), locked = makeCard("01314", 2, 1, 2), ownAlly = makeCard("01101", 1, 2, 2), blockedGame = makeGame([blocked, locked, ownAlly]);
        start(blockedGame, blocked);
        check("01122", "目标禁止交战时不攻击也不加战力", blockedGame.boardCards.length === 3
          && blocked.row === 1 && blocked.col === 1 && blocked.currentAttack === blocked.attack && blocked.v2PermanentBonus === 0);
      }

      {
        const a = makeCard("01123", 1, 1, 1), g = makeGame([a]);
        a.restedTurn = g.turn;
        const existing = makeCard("01101", 1, 1, 2); existing.restedTurn = g.turn; g.boardCards.push(existing);
        let error = null;
        try { place(g, a); } catch (caught) { error = String(caught); }
        const currentCardsReady = a.restedTurn === null && existing.restedTurn === null && g.players[0].v2NoRestTurn === g.turn;
        results.push({ id: "01123", name: "放置时自身与当前己方卡牌不进入休整", passed: error === null && currentCardsReady, ...(error ? { error } : {}) });
      }
      {
        const a = makeCard("01124", 1, 1, 1), lowA = makeCard("02101", 2, 1, 0), lowB = makeCard("02101", 2, 1, 2), high = makeCard("02101", 2, 0, 1);
        const g = makeGame([a, lowA, lowB, high]);
        a.currentAttack = a.attack;
        lowA.currentAttack = 0; lowB.currentAttack = 0; high.currentAttack = 3;
        start(g, a);
        const oneLowerDestroyed = [lowA, lowB].filter((target) => !g.boardCards.includes(target)).length === 1;
        const highUntouched = g.boardCards.includes(high) && high.currentAttack === 3;
        const selfReduced = a.currentAttack === a.attack - 1;
        const noTarget = makeCard("01124", 1, 1, 1), noTargetGame = makeGame([noTarget]);
        start(noTargetGame, noTarget);
        check("01124", "回合开始自身减一并随机摧毁一张低于自身的四方相邻非己方卡牌", oneLowerDestroyed && highUntouched && selfReduced
          && noTargetGame.boardCards.includes(noTarget) && noTarget.currentAttack === noTarget.attack - 1);
      }
      {
        const lock = makeCard("01225", 1, 1, 1), adjacentEnemy = makeCard("02101", 2, 1, 2), remoteEnemy = makeCard("02101", 2, 3, 3);
        const g = makeGame([lock, adjacentEnemy, remoteEnemy], 2);
        place(g, lock);
        const sourceCannotMove = coreValidMoves({ ...g, activePlayerId: 1 }, lock).length === 0;
        const adjacentLocked = adjacentEnemy.v2Locked === true && coreValidMoves(g, adjacentEnemy).length === 0;
        const remoteUnlocked = !remoteEnemy.v2Locked;
        destroy(g, lock);
        const adjacentUnlockedAfterSourceLeaves = !adjacentEnemy.v2Locked;
        const movedLock = makeCard("01225", 1, 1, 1), movedEnemy = makeCard("02101", 2, 1, 2), shifter = makeCard("01121", 2, 1, 3);
        const movedGame = makeGame([movedLock, movedEnemy, shifter], 2);
        place(movedGame, movedLock);
        start(movedGame, shifter);
        destroy(movedGame, movedLock);
        const movedEnemyRemainsLocked = movedEnemy.row === 1 && movedEnemy.col === 3
          && movedEnemy.v2Locked === true && coreValidMoves(movedGame, movedEnemy).length === 0;
        const firstLock = makeCard("01225", 1, 1, 1), secondLock = makeCard("01225", 1, 2, 2), sharedEnemy = makeCard("02101", 2, 1, 2);
        const sharedGame = makeGame([firstLock, secondLock, sharedEnemy], 2);
        place(sharedGame, firstLock);
        place(sharedGame, secondLock);
        destroy(sharedGame, firstLock);
        const oneDestroyedSourceUnlocksSharedEnemy = sharedGame.boardCards.includes(secondLock)
          && !sharedEnemy.v2Locked && coreValidMoves(sharedGame, sharedEnemy).length > 0;
        check("01225", "自身无法移动并锁定四方相邻敌方，按当前相邻关系解除锁定", sourceCannotMove
          && adjacentLocked && remoteUnlocked && adjacentUnlockedAfterSourceLeaves
          && movedEnemyRemainsLocked && oneDestroyedSourceUnlocksSharedEnemy);
      }
      {
        const source = makeCard("01226", 1, 1, 1), first = makeCard("01101", 1, 1, 2), second = makeCard("01102", 1, 2, 1);
        const g = makeGame([source, first, second]);
        start(g, source);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], first, []);
        const firstBoosted = first.currentAttack === first.attack + 2 && first.v2PermanentBonus === 2;
        coreTriggerOtherV2PlacementEffects(g, g.players[0], second, []);
        const secondUnchanged = second.currentAttack === second.attack && second.v2PermanentBonus === 0;
        g.turn += 1;
        start(g, source);
        const third = makeCard("01103", 1, 2, 2);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], third, []);
        const nextTurnResets = third.currentAttack === third.attack + 2 && third.v2PermanentBonus === 2;
        check("01226", "每回合第一张其他己方放置卡牌永久加二", firstBoosted && secondUnchanged && nextTurnResets);
      }
      {
        const center = makeCard("01227", 1, 1, 1), allies = [
          makeCard("01101", 1, 0, 1), makeCard("01101", 1, 2, 1), makeCard("01101", 1, 1, 0), makeCard("01101", 1, 1, 2)
        ];
        const fullGame = makeGame([center, ...allies]);
        start(fullGame, center);
        const allOccupiedByAllies = fullGame.extraActions === 1;
        const missingGame = makeGame([center, ...allies.slice(0, 3)]);
        start(missingGame, center);
        const missingNeighborNoAction = !missingGame.extraActions;
        const edge = makeCard("01227", 1, 0, 0), edgeAllyA = makeCard("01101", 1, 0, 1), edgeAllyB = makeCard("01101", 1, 1, 0);
        const edgeGame = makeGame([edge, edgeAllyA, edgeAllyB]);
        start(edgeGame, edge);
        const edgeUsesOnlyLegalDirections = edgeGame.extraActions === 1;
        check("01227", "四方合法格均为友军时增加行动数并适配棋盘边缘", allOccupiedByAllies && missingNeighborNoAction && edgeUsesOnlyLegalDirections);
      }
      {
        const attacker = makeCard("01328", 1, 1, 1), first = makeCard("02101", 2, 1, 0), second = makeCard("02101", 2, 0, 0);
        attacker.currentAttack = 4; first.currentAttack = 1; second.currentAttack = 1;
        const g = makeGame([attacker, first, second]);
        place(g, attacker);
        const firstAndSecondDestroyed = !g.boardCards.includes(first) && !g.boardCards.includes(second);
        const attackerSurvivesAndNoExtraPermanentLoss = g.boardCards.includes(attacker) && attacker.v2PermanentBonus === 0;
        const isolated = makeCard("01328", 1, 1, 1), isolatedGame = makeGame([isolated]);
        place(isolatedGame, isolated);
        check("01328", "入阵攻击并在首次成功摧毁后再次攻击", firstAndSecondDestroyed && attackerSurvivesAndNoExtraPermanentLoss && isolatedGame.boardCards.includes(isolated));
      }
      {
        const commander = makeCard("01429", 1, 1, 1);
        const ally = makeCard("01101", 1, 2, 2);
        const enemy = makeCard("02101", 2, 1, 2);
        const guard = { uid: "guard-01429", ownerId: null, row: 0, col: 0, attack: 2, currentAttack: 2, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 };
        const g = makeGame([commander, ally, enemy, guard]);
        start(g, commander);
        const alliesGainPermanently = commander.currentAttack === commander.attack + 1
          && ally.currentAttack === ally.attack + 1
          && commander.v2PermanentBonus === 1
          && ally.v2PermanentBonus === 1;
        coreAdjustAttack(enemy, 1);
        const enemyIncreaseBlocked = enemy.currentAttack === enemy.attack;
        coreAdjustAttack(enemy, -1);
        const enemyReductionAllowed = enemy.currentAttack === enemy.attack - 1;
        coreAdjustAttack(guard, 1);
        const neutralIncreaseAllowed = guard.currentAttack === guard.attack + 1;
        const cannotMove = coreValidMoves(g, commander).length === 0;
        check("01429", "起势我方全体永久加一且阻止敌方增加战力，不影响敌方减益与中立守军", alliesGainPermanently
          && enemyIncreaseBlocked && enemyReductionAllowed && neutralIncreaseAllowed && cannotMove);
      }
      {
        const lamp = makeCard("01530", 1, 1, 1);
        const remoteAlly = makeCard("01101", 1, 3, 3);
        const zeroAlly = makeCard("01102", 1, 0, 0);
        zeroAlly.currentAttack = 0;
        zeroAlly.v2PermanentBonus = -zeroAlly.attack;
        const g = makeGame([lamp, remoteAlly, zeroAlly]);
        const protectedDestroy = !destroy(g, remoteAlly);
        const protectionApplied = g.boardCards.includes(remoteAlly)
          && lamp.currentAttack === Math.max(0, lamp.attack - 3)
          && lamp.v2PermanentBonus === -3;
        coreRunV2EndSkills(g, g.players[0], []);
        const endSkillDestroyedZeroCards = !g.boardCards.includes(zeroAlly) && g.boardCards.includes(lamp);
        check("01530", "全场保护其他友军并在回合结束摧毁其他归零友军", protectedDestroy && protectionApplied && endSkillDestroyedZeroCards);
      }

      // Wei: placement, protection and movement boundaries.
      {
        const equal = makeCard("02101", 1, 1, 1), equalGame = makeGame([equal]);
        equalGame.players[0].hand = [makeCard("01101", 1, null, null)];
        equalGame.players[1].hand = [makeCard("02101", 2, null, null)];
        equalGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(equalGame, equal);
        const drawsAtEquality = equalGame.players[0].hand.length === 2 && equalGame.players[0].drawPile.length === 0;

        const ahead = makeCard("02101", 1, 1, 1), aheadGame = makeGame([ahead]);
        aheadGame.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)];
        aheadGame.players[1].hand = [makeCard("02101", 2, null, null)];
        aheadGame.players[0].drawPile = [makeCard("01103", 1, null, null)];
        place(aheadGame, ahead);
        const doesNotDrawWhenAhead = aheadGame.players[0].hand.length === 2 && aheadGame.players[0].drawPile.length === 1;

        const full = makeCard("02101", 1, 1, 1), fullGame = makeGame([full]);
        fullGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        fullGame.players[1].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("02101", 2, null, null));
        fullGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(fullGame, full);
        const doesNotDrawAtLimit = fullGame.players[0].hand.length === HAND_LIMIT && fullGame.players[0].drawPile.length === 1;
        check("02101", "放置后手牌不多于敌方且未满时才抽一张牌", drawsAtEquality && doesNotDrawWhenAhead && doesNotDrawAtLimit);
      }
      {
        const a = makeCard("02102", 1, 1, 1), enemy = makeCard("01101", 2, 1, 2), ally = makeCard("01101", 1, 1, 0);
        const diagonalEnemy = makeCard("01101", 2, 2, 2), g = makeGame([a, enemy, ally, diagonalEnemy]);
        place(g, a);
        const adjacentEnemyReduced = enemy.currentAttack === enemy.attack - 1 && enemy.v2PermanentBonus === -1;
        coreRunV2EndSkills(g, g.players[0], []);
        const reductionIsPermanent = enemy.currentAttack === enemy.attack - 1;
        const invalidTargetsUntouched = ally.currentAttack === ally.attack && diagonalEnemy.currentAttack === diagonalEnemy.attack;

        const guardSource = makeCard("02102", 1, 1, 1);
        const guard = { uid: "guard-02102", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true };
        const guardGame = makeGame([guardSource, guard]);
        place(guardGame, guardSource);
        const guardCanBeSelected = guard.currentAttack === 1 && guard.v2PermanentBonus === -1;
        check("02102", "放置时随机永久削弱一张四向非己方卡牌且包含守军", adjacentEnemyReduced && reductionIsPermanent && invalidTargetsUntouched && guardCanBeSelected);
      }
      {
        const a = makeCard("02103", 1, 1, 1), left = makeCard("01101", 1, 1, 0), right = makeCard("01102", 1, 1, 2);
        const diagonal = makeCard("01103", 1, 2, 2), enemy = makeCard("02101", 2, 0, 1), g = makeGame([a, left, right, diagonal, enemy]);
        place(g, a);
        const adjacentBoosts = [left, right].filter((card) => card.currentAttack === card.attack + 1 && card.v2PermanentBonus === 1);
        const exactlyOneAdjacentAllyBoosted = adjacentBoosts.length === 1;
        const invalidTargetsUntouched = diagonal.currentAttack === diagonal.attack && enemy.currentAttack === enemy.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        const boostIsPermanent = adjacentBoosts[0]?.currentAttack === adjacentBoosts[0]?.attack + 1;
        check("02103", "放置时仅随机一张四向相邻友军永久加一", exactlyOneAdjacentAllyBoosted && invalidTargetsUntouched && boostIsPermanent);
      }
      {
        const a = makeCard("02104", 1, 1, 1), left = makeCard("01101", 1, 1, 0), right = makeCard("01101", 1, 1, 2);
        const diagonal = makeCard("01101", 1, 2, 2), enemy = makeCard("02101", 2, 0, 1), g = makeGame([a, left, right, diagonal, enemy]);
        place(g, a);
        const adjacentAlliesBoostedThisTurn = [left, right].every((card) => card.currentAttack === card.attack + 1 && card.v2TempBonus === 1);
        const invalidTargetsUntouched = diagonal.currentAttack === diagonal.attack && enemy.currentAttack === enemy.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        const boostExpires = [left, right].every((card) => card.currentAttack === card.attack && card.v2TempBonus === 0);
        check("02104", "放置时全部四向相邻友军仅本回合加一", adjacentAlliesBoostedThisTurn && invalidTargetsUntouched && boostExpires);
      }
      {
        const empty = makeCard("02105", 1, 1, 1), emptyGame = makeGame([empty]);
        emptyGame.players[0].drawPile = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)];
        place(emptyGame, empty);
        const emptyHandDrawsTwo = emptyGame.players[0].hand.length === 2 && emptyGame.players[0].drawPile.length === 0;

        const partial = makeCard("02105", 1, 1, 1), partialGame = makeGame([partial]);
        partialGame.players[0].hand = [makeCard("01101", 1, null, null)];
        partialGame.players[0].drawPile = [makeCard("01102", 1, null, null), makeCard("01103", 1, null, null)];
        place(partialGame, partial);
        const partialHandDrawsOne = partialGame.players[0].hand.length === 2 && partialGame.players[0].drawPile.length === 1;

        const full = makeCard("02105", 1, 1, 1), fullGame = makeGame([full]);
        fullGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        fullGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(fullGame, full);
        const fullHandDrawsNone = fullGame.players[0].hand.length === HAND_LIMIT && fullGame.players[0].drawPile.length === 1;
        check("02105", "放置时空手抽二、未满抽一、满手不抽", emptyHandDrawsTwo && partialHandDrawsOne && fullHandDrawsNone);
      }
      {
        const edge = makeCard("02106", 1, 0, 2), edgeGame = makeGame([edge]);
        place(edgeGame, edge);
        const edgeBoosted = edge.currentAttack === edge.attack + 1 && edge.v2PermanentBonus === 1;
        coreRunV2EndSkills(edgeGame, edgeGame.players[0], []);
        const edgeBoostIsPermanent = edge.currentAttack === edge.attack + 1;

        const inner = makeCard("02106", 1, 2, 2), innerGame = makeGame([inner]);
        place(innerGame, inner);
        const innerNotBoosted = inner.currentAttack === inner.attack && inner.v2PermanentBonus === 0;
        check("02106", "仅放置在棋盘外圈时自身永久加一", edgeBoosted && edgeBoostIsPermanent && innerNotBoosted);
      }
      {
        const a = makeCard("02107", 1, 2, 2), allyA = makeCard("01101", 1, 2, 3), allyB = makeCard("01102", 1, 2, 4);
        const branch = makeCard("01103", 1, 3, 3), diagonal = makeCard("01104", 1, 1, 1), disconnected = makeCard("01105", 1, 0, 4);
        const enemy = makeCard("02101", 2, 3, 2), g = makeGame([a, allyA, allyB, branch, diagonal, disconnected, enemy]);
        place(g, a);
        const connectedAlliesBoosted = [allyA, allyB, branch].every((card) => card.currentAttack === card.attack + 1 && card.v2TempBonus === 1);
        const otherCardsUntouched = [a, diagonal, disconnected, enemy].every((card) => card.currentAttack === card.attack && card.v2TempBonus === 0);
        coreRunV2EndSkills(g, g.players[0], []);
        const boostsExpire = [allyA, allyB, branch].every((card) => card.currentAttack === card.attack && card.v2TempBonus === 0);
        check("02107", "放置时仅连续四向相连的其他友军本回合加一", connectedAlliesBoosted && otherCardsUntouched && boostsExpire);
      }
      {
        const a = makeCard("02208", 1, 1, 1), g = makeGame([a]);
        g.players[0].hand = [makeCard("01101", 1, null, null)];
        g.players[1].hand = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null), makeCard("02103", 2, null, null)];
        place(g, a);
        const discardsExactlyOneEnemyCard = g.players[1].hand.length === 2;
        const ownHandUntouched = g.players[0].hand.length === 1;

        const emptyTarget = makeCard("02208", 1, 1, 1), emptyGame = makeGame([emptyTarget]);
        place(emptyGame, emptyTarget);
        const emptyEnemyHandUnchanged = emptyGame.players[1].hand.length === 0;
        check("02208", "放置时仅随机弃置敌方一张手牌且空手时无效果", discardsExactlyOneEnemyCard && ownHandUntouched && emptyEnemyHandUnchanged);
      }
      {
        const a = makeCard("02209", 1, 1, 1), ally = makeCard("01101", 1, 1, 2);
        const g = makeGame([a, ally]);
        place(g, a);
        const positionsSwapped = a.row === 1 && a.col === 2 && ally.row === 1 && ally.col === 1;
        const bothPermanentlyBoosted = [a, ally].every((card) => card.currentAttack === card.attack + 1 && card.v2PermanentBonus === 1);
        coreRunV2EndSkills(g, g.players[0], []);
        const boostsSurviveTurnEnd = [a, ally].every((card) => card.currentAttack === card.attack + 1);

        const isolated = makeCard("02209", 1, 2, 2), diagonal = makeCard("01101", 1, 3, 3), isolatedGame = makeGame([isolated, diagonal]);
        place(isolatedGame, isolated);
        const noAdjacentAllyDoesNothing = isolated.row === 2 && isolated.col === 2 && isolated.currentAttack === isolated.attack && diagonal.currentAttack === diagonal.attack;
        check("02209", "放置时与随机四向友军交换且双方永久加一", positionsSwapped && bothPermanentlyBoosted && boostsSurviveTurnEnd && noAdjacentAllyDoesNothing);
      }
      {
        const protector = makeCard("02210", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([protector, ally]);
        protector.v2PermanentBonus = 2 - protector.attack; protector.currentAttack = 2;
        ally.v2PermanentBonus = 1 - ally.attack; ally.currentAttack = 1;
        const allyAttackBefore = ally.currentAttack;
        const saved = !destroy(g, ally);
        const allyUnchanged = g.boardCards.includes(ally) && ally.currentAttack === allyAttackBefore;
        const protectorPaidPermanentCost = protector.currentAttack === 1 && protector.v2PermanentBonus === 1 - protector.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        const costSurvivesTurnEnd = protector.currentAttack === 1;
        const destroyedAfterProtectorReachesOne = destroy(g, ally) && !g.boardCards.includes(ally);

        const distantProtector = makeCard("02210", 1, 0, 0), distantAlly = makeCard("01101", 1, 2, 2), distantGame = makeGame([distantProtector, distantAlly]);
        distantProtector.v2PermanentBonus = 3 - distantProtector.attack; distantProtector.currentAttack = 3;
        const distantAllyDestroyed = destroy(distantGame, distantAlly) && distantProtector.currentAttack === 3;
        check("02210", "自身战力大于一时保护四向友军并永久失去一点战力", saved && allyUnchanged && protectorPaidPermanentCost && costSurvivesTurnEnd && destroyedAfterProtectorReachesOne && distantAllyDestroyed);
      }
      {
        const a = makeCard("02211", 1, 0, 0), g = makeGame([a]);
        const firstMoveAllowsDistance = coreValidMoves(g, a).some((cell) => cell.row === 0 && cell.col === 3);
        a.v2LongMoveUsed = true;
        const laterMoveReturnsToOneStep = coreValidMoves(g, a).some((cell) => cell.row === 0 && cell.col === 1)
          && !coreValidMoves(g, a).some((cell) => cell.row === 0 && cell.col === 2);

        const blocked = makeCard("02211", 1, 0, 0), blocker = makeCard("01101", 1, 0, 2), blockedGame = makeGame([blocked, blocker]);
        const blockedPathRejectsLongMove = !coreValidMoves(blockedGame, blocked).some((cell) => cell.row === 0 && cell.col === 3);
        check("02211", "首次主动移动可远距直线移动且不可穿过障碍，之后恢复一格", firstMoveAllowsDistance && laterMoveReturnsToOneStep && blockedPathRejectsLongMove);
      }
      {
        const a = makeCard("02212", 1, 1, 1), g = makeGame([a]);
        place(g, a);
        const placementDoesNotSetMarker = !g.players[0].v2NextPlacementExtra && !g.players[0].v2NextPlacementExtraTurn;
        start(g, a);
        const markerIsForCurrentTurn = g.players[0].v2NextPlacementExtra === a.uid
          && g.players[0].v2NextPlacementExtraTurn === g.turn && g.players[0].v2NextPlacementExtraCount === 1;
        coreRunV2EndSkills(g, g.players[0], []);
        const markerClearedAtTurnEnd = !g.players[0].v2NextPlacementExtra
          && !g.players[0].v2NextPlacementExtraTurn && !g.players[0].v2NextPlacementExtraCount;
        const stale = makeCard("02212", 1, 1, 1), staleGame = makeGame([stale]);
        staleGame.players[0].v2NextPlacementExtra = stale.uid;
        staleGame.players[0].v2NextPlacementExtraTurn = staleGame.turn - 1;
        const staleMarkerIgnored = staleGame.players[0].v2NextPlacementExtraTurn !== staleGame.turn;
        const repeated = makeCard("02212", 1, 0, 0), repeater = makeCard("01314", 1, 0, 1);
        const repeatedPlacement = makeCard("02106", 1, null, null), repeatedGame = makeGame([repeated, repeater]);
        repeatedGame.players[0].hand = [repeatedPlacement];
        start(repeatedGame, repeated);
        const repeatedOutcome = coreSimulateActionOutcome(repeatedGame, repeatedGame.players[0], {
          type: "place", playerId: 1, cardUid: repeatedPlacement.uid, target: { row: 4, col: 4 }
        });
        const resolvedPlacement = repeatedOutcome?.game.boardCards.find((card) => card.uid === repeatedPlacement.uid);
        const repeatedStartStacksExtras = resolvedPlacement?.currentAttack === repeatedPlacement.attack + 3
          && !repeatedOutcome.game.players[0].v2NextPlacementExtra
          && !repeatedOutcome.game.players[0].v2NextPlacementExtraCount;

        const nestedSource = makeCard("02212", 1, 1, 1), nestedTrigger = makeCard("01208", 1, null, null);
        const nestedFollowup = makeCard("02106", 1, null, null), nestedGame = makeGame([nestedSource]);
        nestedGame.players[0].hand = [nestedTrigger, nestedFollowup];
        start(nestedGame, nestedSource);
        const nestedFirstOutcome = coreSimulateActionOutcome(nestedGame, nestedGame.players[0], {
          type: "place", playerId: 1, cardUid: nestedTrigger.uid, target: { row: 1, col: 2 }
        });
        const nestedPlayer = nestedFirstOutcome && corePlayer(nestedFirstOutcome.game, 1);
        if (nestedFirstOutcome) nestedFirstOutcome.game.actionsUsed = 0;
        const nestedSecondOutcome = nestedPlayer && coreSimulateActionOutcome(nestedFirstOutcome.game, nestedPlayer, {
          type: "place", playerId: 1, cardUid: nestedFollowup.uid, target: { row: 4, col: 4 }
        });
        const nestedResolvedFollowup = nestedSecondOutcome?.game.boardCards.find((card) => card.uid === nestedFollowup.uid);
        const newlyGrantedExtrasSurvivePriorResolution = nestedFirstOutcome?.game.players[0].v2NextPlacementExtraCount === 2
          && nestedResolvedFollowup?.currentAttack === nestedFollowup.attack + 3;
        check("02212", "回合开始标记可累加、作用于下一张友军且跨回合清除", placementDoesNotSetMarker
          && markerIsForCurrentTurn && markerClearedAtTurnEnd && staleMarkerIgnored && repeatedStartStacksExtras
          && newlyGrantedExtrasSurvivePriorResolution);
      }
      {
        const a = makeCard("02313", 1, 1, 1), g = makeGame([a]);
        a.attack = 1; a.currentAttack = 1; a.v2PermanentBonus = 0;
        place(g, a);
        const placementAddsEightPermanently = a.currentAttack === 9 && a.v2PermanentBonus === 8;

        coreStartTurn(g);
        const firstStartReducesToSeven = a.currentAttack === 7 && a.v2PermanentBonus === 6;
        g.turn = 2; coreStartTurn(g);
        const secondStartReducesToFive = a.currentAttack === 5 && a.v2PermanentBonus === 4;
        g.turn = 3; coreStartTurn(g);
        const thirdStartReducesToThree = g.boardCards.includes(a) && a.currentAttack === 3 && a.v2PermanentBonus === 2;
        g.turn = 4; coreStartTurn(g);
        const fourthStartReducesToOne = g.boardCards.includes(a) && a.currentAttack === 1 && a.v2PermanentBonus === 0;
        g.turn = 5; coreStartTurn(g);
        const belowTwoSelfDestructs = !g.boardCards.includes(a);
        check("02313", "放置永久加八，回合开始战力不足二自毁否则永久减二", placementAddsEightPermanently && firstStartReducesToSeven && secondStartReducesToFive && thirdStartReducesToThree && fourthStartReducesToOne && belowTwoSelfDestructs);
      }
      {
        const a = makeCard("02314", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02102", 2, 1, 0), guard = { uid: "guard-02314", ownerId: null, row: 0, col: 1, attack: 2, currentAttack: 2, isGuard: true };
        const g = makeGame([a, ally, enemy, guard]);
        place(g, a);
        const placementDebuffedAllOthers = [ally, enemy, guard].every((card) => card.currentAttack === card.attack - 1 && card.v2PermanentBonus === -1);
        start(g, a);
        const placementDoesNotRepeatAtStart = [ally, enemy, guard].every((card) => card.currentAttack === card.attack - 1);

        const blocked = makeCard("02314", 1, 1, 1), zero = makeCard("01101", 2, 1, 2), untouched = makeCard("01102", 2, 1, 0);
        zero.currentAttack = 0; zero.v2PermanentBonus = -zero.attack;
        const blockedGame = makeGame([blocked, zero, untouched]);
        place(blockedGame, blocked);
        const zeroBlocksPlacementDebuff = untouched.currentAttack === untouched.attack && untouched.v2PermanentBonus === 0;

        const finisher = makeCard("02314", 1, 0, 0), changed = makeCard("01101", 2, 0, 1), newCard = makeCard("01102", 2, 1, 1), endZero = makeCard("01103", 2, 2, 2);
        changed.attack = 3; changed.v2PermanentBonus = 0;
        newCard.attack = 3; newCard.v2PermanentBonus = 0;
        endZero.attack = 3; endZero.v2PermanentBonus = -3;
        changed.currentAttack = 3; changed.v2StartTurn = 1; changed.v2StartAttack = 2; changed.v2EnteredTurn = 0;
        newCard.currentAttack = 3; newCard.v2StartTurn = 1; newCard.v2StartAttack = 2; newCard.v2EnteredTurn = 1;
        endZero.currentAttack = 0; endZero.v2StartTurn = 1; endZero.v2StartAttack = 0; endZero.v2EnteredTurn = 0;
        const endGame = makeGame([finisher, changed, newCard, endZero]);
        coreRunV2EndSkills(endGame, endGame.players[0], []);
        const changedCardDebuffed = changed.currentAttack === 2 && changed.v2PermanentBonus === -1;
        const newCardExcluded = newCard.currentAttack === 3 && newCard.v2PermanentBonus === 0;
        const zeroDestroyedAndCounted = !endGame.boardCards.includes(endZero) && finisher.currentAttack === finisher.attack + 1;
        check("02314", "放置条件、回合结束变动减益与归零摧毁结算正确", placementDebuffedAllOthers && placementDoesNotRepeatAtStart && zeroBlocksPlacementDebuff && changedCardDebuffed && newCardExcluded && zeroDestroyedAndCounted);
      }
      {
        const a = makeCard("02315", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02101", 2, 1, 3), g = makeGame([a, ally, enemy]);
        place(g, a);
        coreAdjustAttack(ally, 1);
        const increasedAllyAmplified = ally.currentAttack === ally.attack + 2 && ally.v2PermanentBonus === 2;
        const friendlyReductionAllowed = (() => { const before = ally.currentAttack; coreAdjustAttack(ally, -1); return ally.currentAttack === before - 1; })();
        const enemyCanStillDecrease = (() => { const before = enemy.currentAttack; coreAdjustAttack(enemy, -1); return enemy.currentAttack === before - 1; })();
        check("02315", "放置当回合放大战力增加但不阻止己方减益", increasedAllyAmplified && friendlyReductionAllowed && enemyCanStillDecrease);
      }
      {
        const a = makeCard("02416", 1, 1, 1), ally = makeCard("01101", 1, 3, 3), g = makeGame([a, ally]);
        g.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)];
        g.players[1].hand = [makeCard("02101", 2, null, null)];
        place(g, a);
        const placementBoostedAlly = ally.currentAttack === ally.attack + 1;
        const ownPlacementDoesNotBoostCommander = a.currentAttack === a.attack;
        const handComparisonAddsAction = g.extraActions === 1;
        coreAdjustAttack(ally, -1);
        const reductionIsAllowed = ally.currentAttack === ally.attack;
        const newlyPlaced = makeCard("01102", 1, 2, 2);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], newlyPlaced, []);
        const placementWatcherBoostedCommander = a.currentAttack === a.attack + 1;
        const enemyPlacementIgnored = makeCard("02101", 2, 2, 3);
        coreTriggerOtherV2PlacementEffects(g, g.players[1], enemyPlacementIgnored, []);
        const enemyPlacementDoesNotBoost = a.currentAttack === a.attack + 1;

        const behind = makeCard("02416", 1, 1, 1), behindGame = makeGame([behind]);
        behindGame.players[0].hand = [makeCard("01101", 1, null, null)];
        behindGame.players[1].hand = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null)];
        place(behindGame, behind);
        const fewerHandDoesNotAddAction = !behindGame.extraActions;
        check("02416", "自身放置不加战力，其他我方卡牌放置时永久加一", placementBoostedAlly && ownPlacementDoesNotBoostCommander && handComparisonAddsAction && reductionIsAllowed && placementWatcherBoostedCommander && enemyPlacementDoesNotBoost && fewerHandDoesNotAddAction && behind.currentAttack === behind.attack);
      }
      {
        const a = makeCard("02517", 1, 1, 1), enemy = makeCard("01101", 2, 1, 2), g = makeGame([a, enemy]);
        place(g, a);
        const adjacentEnemyAndSelfDestroyed = !g.boardCards.includes(a) && !g.boardCards.includes(enemy);

        const guardSource = makeCard("02517", 1, 1, 1), guard = { uid: "guard-02517", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true };
        const guardGame = makeGame([guardSource, guard]);
        place(guardGame, guardSource);
        const guardCanBeTargeted = !guardGame.boardCards.includes(guardSource) && !guardGame.boardCards.includes(guard);

        const isolated = makeCard("02517", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), diagonalEnemy = makeCard("01102", 2, 2, 2);
        const isolatedGame = makeGame([isolated, ally, diagonalEnemy]);
        place(isolatedGame, isolated);
        const noEligibleTargetLeavesCard = isolatedGame.boardCards.includes(isolated) && isolatedGame.boardCards.includes(ally) && isolatedGame.boardCards.includes(diagonalEnemy);
        check("02517", "放置时与随机四向非己方卡牌同时摧毁", adjacentEnemyAndSelfDestroyed && guardCanBeTargeted && noEligibleTargetLeavesCard);
      }
      {
        const a = makeCard("02518", 1, 1, 1), g = makeGame([a]);
        g.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01101", 1, null, null)];
        g.players[0].drawPile = [makeCard("01101", 1, null, null), makeCard("01101", 1, null, null), makeCard("01101", 1, null, null)];
        place(g, a);
        const drawsToHandLimit = g.players[0].hand.length === HAND_LIMIT && g.players[0].drawPile.length === 0;

        const full = makeCard("02518", 1, 1, 1), fullGame = makeGame([full]);
        fullGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        fullGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(fullGame, full);
        const fullHandDoesNotDraw = fullGame.players[0].hand.length === HAND_LIMIT && fullGame.players[0].drawPile.length === 1;

        const short = makeCard("02518", 1, 1, 1), shortGame = makeGame([short]);
        shortGame.players[0].hand = [makeCard("01101", 1, null, null)];
        shortGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(shortGame, short);
        const shortDeckDrawsUntilEmpty = shortGame.players[0].hand.length === 2 && shortGame.players[0].drawPile.length === 0;
        check("02518", "放置时抽牌直至手牌上限或牌库为空", drawsToHandLimit && fullHandDoesNotDraw && shortDeckDrawsUntilEmpty);
      }
      {
        const a = makeCard("02519", 1, 1, 1), ally = makeCard("01210", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), diagonalEnemy = makeCard("02101", 2, 2, 3);
        const g = makeGame([a, ally, enemy, diagonalEnemy]);
        place(g, a);
        const allyBoostedAndAttacked = !g.boardCards.includes(enemy) && ally.row === 1 && ally.col === 3 && ally.currentAttack === ally.attack + 1 && ally.v2TempBonus === 1;
        const diagonalEnemyUntouched = g.boardCards.includes(diagonalEnemy);
        coreRunV2EndSkills(g, g.players[0], []);
        const boostExpires = ally.currentAttack === ally.attack && ally.v2TempBonus === 0;

        const isolated = makeCard("02519", 1, 2, 2), isolatedAlly = makeCard("01210", 1, 2, 3), isolatedGame = makeGame([isolated, isolatedAlly]);
        place(isolatedGame, isolated);
        const noTargetAllyDoesNotAttack = isolatedGame.boardCards.includes(isolatedAlly) && isolatedAlly.row === 2 && isolatedAlly.col === 3;
        const guardOrder = makeCard("02519", 1, 1, 1), guardAlly = makeCard("01210", 1, 1, 2);
        const guard = { uid: "guard-02519", ownerId: null, row: 1, col: 3, attack: 2, currentAttack: 2, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 };
        const guardGame = makeGame([guardOrder, guardAlly, guard]);
        place(guardGame, guardOrder);
        const neutralGuardCanBeAttacked = !guardGame.boardCards.includes(guard);
        check("02519", "相邻友军本回合加一并逐张自动攻击可交战的非我方卡牌，包含守军", allyBoostedAndAttacked && diagonalEnemyUntouched && boostExpires && noTargetAllyDoesNotAttack && neutralGuardCanBeAttacked);
      }
      {
        const watcher = makeCard("02520", 1, 1, 1);
        const ally = makeCard("01101", 1, 2, 2);
        ally.restedTurn = 1;
        const diagonalAlly = makeCard("01102", 1, 0, 0);
        diagonalAlly.restedTurn = 1;
        const enemy = makeCard("02101", 2, 0, 1);
        enemy.restedTurn = 1;
        const remote = makeCard("01103", 1, 3, 3);
        remote.restedTurn = 1;
        const g = makeGame([watcher, ally, diagonalAlly, enemy, remote]);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], ally, []);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], diagonalAlly, []);
        coreTriggerOtherV2PlacementEffects(g, g.players[1], enemy, []);
        coreTriggerOtherV2PlacementEffects(g, g.players[0], remote, []);
        const adjacentAlliesBoosted = ally.currentAttack === ally.attack + 1
          && diagonalAlly.currentAttack === diagonalAlly.attack + 1
          && ally.v2PermanentBonus === 1
          && diagonalAlly.v2PermanentBonus === 1;
        const adjacentAlliesNotRested = ally.restedTurn === null && diagonalAlly.restedTurn === null;
        const enemyAndRemoteUntouched = enemy.currentAttack === enemy.attack
          && remote.currentAttack === remote.attack
          && enemy.restedTurn === 1
          && remote.restedTurn === 1;
        check("02520", "八方相邻友军永久加一且不进入休整", adjacentAlliesBoosted && adjacentAlliesNotRested && enemyAndRemoteUntouched);
      }
      {
        const a = makeCard("02121", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]);
        place(g, a);
        const noNonFriendlyCardBoostsPermanently = a.currentAttack === a.attack + 1 && a.v2PermanentBonus === 1;
        coreRunV2EndSkills(g, g.players[0], []);
        const boostSurvivesTurnEnd = a.currentAttack === a.attack + 1;

        const blockedByEnemy = makeCard("02121", 1, 1, 1), enemy = makeCard("01101", 2, 1, 2);
        const enemyGame = makeGame([blockedByEnemy, enemy]);
        place(enemyGame, blockedByEnemy);
        const enemyBlocksBoost = blockedByEnemy.currentAttack === blockedByEnemy.attack;

        const blockedByGuard = makeCard("02121", 1, 1, 1);
        const guard = { uid: "guard-02121", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true };
        const guardGame = makeGame([blockedByGuard, guard]);
        place(guardGame, blockedByGuard);
        check("02121", "四方无敌军或守军时自身永久加一", noNonFriendlyCardBoostsPermanently && boostSurvivesTurnEnd
          && enemyBlocksBoost && blockedByGuard.currentAttack === blockedByGuard.attack);
      }
      {
        const a = makeCard("02122", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2), g = makeGame([a, enemy]);
        enemy.currentAttack = 3; enemy.v2PermanentBonus = 2;
        place(g, a);
        const boostAppliedBeforeAttack = !g.boardCards.includes(enemy) && g.boardCards.includes(a)
          && a.currentAttack === a.attack + 2 && a.v2TempBonus === 2;
        coreRunV2EndSkills(g, g.players[0], []);
        const boostExpires = a.currentAttack === a.attack && a.v2TempBonus === 0;

        const guardAttacker = makeCard("02122", 1, 1, 1);
        const guard = { uid: "guard-02122", ownerId: null, row: 1, col: 2, attack: 2, currentAttack: 2, isGuard: true };
        const guardGame = makeGame([guardAttacker, guard]);
        place(guardGame, guardAttacker);
        const guardCanBeAttacked = !guardGame.boardCards.includes(guard);

        const isolated = makeCard("02122", 1, 1, 1), ally = makeCard("01101", 1, 1, 2);
        const isolatedGame = makeGame([isolated, ally]);
        place(isolatedGame, isolated);

        const movingPlacement = makeCard("02122", 1, null, null), movingEnemy = makeCard("02101", 2, 2, 3);
        const movingGame = makeGame([movingEnemy]);
        movingGame.players[0].hand = [movingPlacement];
        movingGame.v2ControlCells = [{
          row: 2, col: 2, ownerId: 2, sourceUid: "entry-control", untilTurn: Infinity,
          persistent: true, invalidateOnAnyEntry: true
        }];
        const movingOutcome = coreSimulateActionOutcome(movingGame, movingGame.players[0], {
          type: "place", playerId: 1, cardUid: movingPlacement.uid, target: { row: 2, col: 2 }
        });
        const originalEntryInvalidated = movingOutcome && !movingOutcome.game.v2ControlCells.some((entry) => (
          entry.row === 2 && entry.col === 2
        ));
        check("02122", "存在四向非友军时先临时加二再随机攻击且包含守军", boostAppliedBeforeAttack && boostExpires
          && guardCanBeAttacked && isolated.currentAttack === isolated.attack && isolatedGame.boardCards.includes(ally)
          && originalEntryInvalidated);
      }
      {
        const a = makeCard("02123", 1, 1, 1), lowA = makeCard("02121", 1, 0, 0), lowB = makeCard("02124", 1, 3, 3);
        const high = makeCard("02227", 1, 4, 4), enemy = makeCard("02101", 2, 1, 2);
        lowA.currentAttack = 1; lowA.v2PermanentBonus = -1;
        lowB.currentAttack = 1;
        high.currentAttack = 4; high.v2PermanentBonus = 1;
        const g = makeGame([a, lowA, lowB, high, enemy]);
        place(g, a);
        const oneLowestAllyBoosted = [lowA, lowB].filter((target) => target.v2PermanentBonus > (target === lowA ? -1 : 0)).length === 1;
        const invalidTargetsUntouched = a.currentAttack === a.attack && high.currentAttack === 4 && enemy.currentAttack === enemy.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        const permanentBoostRetained = [lowA, lowB].some((target) => target.currentAttack === target.attack + target.v2PermanentBonus);

        const alone = makeCard("02123", 1, 1, 1), aloneGame = makeGame([alone]);
        place(aloneGame, alone);
        check("02123", "从全场并列最低的其他友军中随机永久加一且不选自身", oneLowestAllyBoosted
          && invalidTargetsUntouched && permanentBoostRetained && alone.currentAttack === alone.attack);
      }
      {
        const a = makeCard("02124", 1, 1, 1), g = makeGame([a]);
        const handA = makeCard("02121", 1, null, null), handB = makeCard("02122", 1, null, null);
        g.players[0].hand = [handA, handB];
        g.players[0].drawPile = [makeCard("02123", 1, null, null)];
        place(g, a);
        const oneHandCardBoosted = [handA, handB].filter((target) => target.v2PermanentBonus === 1
          && target.currentAttack === target.attack + 1).length === 1;
        const doesNotDrawWhenHoldingCards = g.players[0].hand.length === 2 && g.players[0].drawPile.length === 1;

        const empty = makeCard("02124", 1, 1, 1), emptyGame = makeGame([empty]);
        emptyGame.players[0].drawPile = [makeCard("02121", 1, null, null)];
        place(emptyGame, empty);
        check("02124", "有剩余手牌时随机永久强化一张，否则抽取一张", oneHandCardBoosted && doesNotDrawWhenHoldingCards
          && emptyGame.players[0].hand.length === 1 && emptyGame.players[0].drawPile.length === 0);
      }
      {
        const a = makeCard("02225", 1, 0, 1), edgeAlly = makeCard("02121", 1, 4, 2), innerAlly = makeCard("02121", 1, 2, 2);
        const edgeEnemy = makeCard("02101", 2, 0, 4), g = makeGame([a, edgeAlly, innerAlly, edgeEnemy]);
        start(g, a);
        const ownEdgeCardsBoosted = [a, edgeAlly].every((target) => target.v2TempBonus === 1 && target.currentAttack === target.attack + 1);
        const innerAndEnemyUntouched = innerAlly.currentAttack === innerAlly.attack && edgeEnemy.currentAttack === edgeEnemy.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        const boostsExpire = [a, edgeAlly].every((target) => target.v2TempBonus === 0 && target.currentAttack === target.attack);

        const inner = makeCard("02225", 1, 2, 2), otherEdge = makeCard("02121", 1, 0, 0), innerGame = makeGame([inner, otherEdge]);
        start(innerGame, inner);
        check("02225", "自身在边缘时全场己方边缘卡牌含自身本回合加一", ownEdgeCardsBoosted && innerAndEnemyUntouched
          && boostsExpire && inner.currentAttack === inner.attack && otherEdge.currentAttack === otherEdge.attack);
      }
      {
        const defender = makeCard("02226", 1, 1, 1), ally = makeCard("02121", 1, 1, 2), diagonal = makeCard("02121", 1, 2, 2);
        const attacker = makeCard("02211", 2, 1, 0), g = makeGame([defender, ally, diagonal, attacker]);
        coreResolveSkillAttack(g, attacker, defender, g.players[1], []);
        const boostsResolveBeforeCombat = g.boardCards.includes(defender) && !g.boardCards.includes(attacker)
          && defender.currentAttack === defender.attack + 2 && defender.v2TempBonus === 2
          && ally.currentAttack === ally.attack + 1 && ally.v2TempBonus === 1;
        const diagonalUntouched = diagonal.currentAttack === diagonal.attack;
        coreRunV2EndSkills(g, g.players[0], []);
        check("02226", "被攻击比较战力前自身临时加二且四向友军临时加一", boostsResolveBeforeCombat && diagonalUntouched
          && defender.currentAttack === defender.attack && ally.currentAttack === ally.attack);
      }
      {
        const a = makeCard("02227", 1, 2, 2), diagonalEnemy = makeCard("02101", 2, 1, 1);
        const diagonalGuard = { uid: "guard-02227", ownerId: null, row: 1, col: 3, attack: 2, currentAttack: 2, isGuard: true };
        const orthogonalEnemy = makeCard("02101", 2, 2, 3), orthogonalAlly = makeCard("02121", 1, 2, 1);
        const g = makeGame([a, diagonalEnemy, diagonalGuard, orthogonalEnemy, orthogonalAlly]);
        g.brokenCells = [{ row: 3, col: 1 }];
        const moves = coreValidMoves(g, a);
        const emptyDiagonalAllowed = moves.some((cell) => cell.row === 3 && cell.col === 3);
        const diagonalCombatBlocked = !moves.some((cell) => cell.row === 1 && (cell.col === 1 || cell.col === 3));
        const brokenDiagonalBlocked = !moves.some((cell) => cell.row === 3 && cell.col === 1);
        const orthogonalRulesPreserved = moves.some((cell) => cell.row === 2 && cell.col === 3)
          && !moves.some((cell) => cell.row === 2 && cell.col === 1);
        g.actionsUsed = 0;
        const diagonalOutcome = coreSimulateActionOutcome(g, g.players[0], {
          type: "move", playerId: 1, cardUid: a.uid,
          source: { row: 2, col: 2 }, target: { row: 3, col: 3 }
        });
        const movedCard = diagonalOutcome?.game.boardCards.find((target) => target.uid === a.uid);
        const diagonalMoveConsumesAction = diagonalOutcome?.game.actionsUsed === 1 && movedCard?.row === 3 && movedCard?.col === 3;
        check("02227", "允许斜向进入未占用且未破坏的空格", emptyDiagonalAllowed && brokenDiagonalBlocked);
        check("02227", "斜向不能攻击且保留普通四向移动交战规则", diagonalCombatBlocked && orthogonalRulesPreserved);
        check("02227", "斜向移动仍消耗一次行动", diagonalMoveConsumesAction);
      }
      {
        const a = makeCard("02328", 1, 1, 1), enemyA = makeCard("02101", 2, 1, 2), enemyB = makeCard("02101", 2, 1, 3);
        const g = makeGame([a, enemyA, enemyB]);
        coreResolveSkillAttack(g, a, enemyA, g.players[0], []);
        coreResolveSkillAttack(g, a, enemyB, g.players[0], []);
        const commandedAttacksDoNotTriggerActiveBonus = a.currentAttack === a.attack && a.v2TempBonus === 0;
        const eachEnemyDestroyedAddsAction = g.extraActions === 2 && !g.boardCards.includes(enemyA) && !g.boardCards.includes(enemyB);

        const activeAttacker = makeCard("02328", 1, 1, 1), activeEnemy = makeCard("02101", 2, 1, 2);
        const activeGame = makeGame([activeAttacker, activeEnemy]);
        const activeOutcome = coreSimulateActionOutcome(activeGame, activeGame.players[0], {
          type: "move", playerId: 1, cardUid: activeAttacker.uid,
          source: { row: 1, col: 1 }, target: { row: 1, col: 2 }
        });
        const resolvedActiveAttacker = activeOutcome?.game.boardCards.find((card) => card.uid === activeAttacker.uid);
        const activeAttackGetsTemporaryBonus = resolvedActiveAttacker?.currentAttack === activeAttacker.attack + 2
          && resolvedActiveAttacker?.v2TempBonus === 2;

        const guardAttacker = makeCard("02328", 1, 1, 1);
        const guard = { uid: "guard-02328", ownerId: null, row: 1, col: 2, attack: 1, currentAttack: 1, isGuard: true };
        const guardGame = makeGame([guardAttacker, guard]);
        coreResolveSkillAttack(guardGame, guardAttacker, guard, guardGame.players[0], []);
        check("02328", "仅主动攻击临时加二，摧毁敌方卡牌增加行动且守军不计", commandedAttacksDoNotTriggerActiveBonus
          && eachEnemyDestroyedAddsAction && activeAttackGetsTemporaryBonus && !guardGame.extraActions);
      }
      {
        const a = makeCard("02429", 1, 1, 1), ally = makeCard("02121", 1, 3, 3), g = makeGame([a, ally]);
        place(g, a);
        const placementBoostTriggersWatcher = ally.v2PermanentBonus === 1 && ally.currentAttack === ally.attack + 1
          && a.v2PermanentBonus === 1 && a.currentAttack === a.attack + 1;
        coreAdjustAttack(ally, 3);
        const onePermanentEventAddsOnlyOne = ally.v2PermanentBonus === 4 && a.v2PermanentBonus === 2;
        coreAdjustAttack(ally, 4, true);
        const temporaryIncreaseIgnored = a.v2PermanentBonus === 2;
        coreAdjustAttack(a, 1);
        const selfIncreaseDoesNotLoop = a.v2PermanentBonus === 3;

        const tied = makeCard("02429", 1, 1, 1), tiedAlly = makeCard("02124", 1, 3, 3), tiedGame = makeGame([tied, tiedAlly]);
        start(tiedGame, tied);
        const tiedHighestAddsAction = tiedGame.extraActions === 1;
        const behind = makeCard("02429", 1, 1, 1), stronger = makeCard("02227", 1, 3, 3), behindGame = makeGame([behind, stronger]);
        start(behindGame, behind);
        const lowerDoesNotAddAction = !behindGame.extraActions;
        const alone = makeCard("02429", 1, 1, 1), aloneGame = makeGame([alone]);
        start(aloneGame, alone);
        check("02429", "入阵强化可触发自身，永久增益事件仅加一且并列最高或无其他友军时加行动", placementBoostTriggersWatcher
          && onePermanentEventAddsOnlyOne && temporaryIncreaseIgnored && selfIncreaseDoesNotLoop
          && tiedHighestAddsAction && lowerDoesNotAddAction && aloneGame.extraActions === 1);
      }
      {
        const tiger = makeCard("02530", 1, 1, 1), first = makeCard("02121", 1, null, null), second = makeCard("02122", 1, null, null);
        const g = makeGame([tiger]);
        g.players[0].hand = [first, second];
        g.actionsUsed = coreActionLimit(g);
        g.selection = { handCardUid: first.uid, boardCardUid: null, targetCell: { row: 0, col: 0 } };
        const sourceAllowsPlacementAfterActionsEnd = coreCanUseAction(g, first) && coreBuildPendingAction(g)?.type === "place";
        const firstOutcome = coreSimulateActionOutcome(g, g.players[0], {
          type: "place", playerId: 1, cardUid: first.uid, target: { row: 0, col: 0 }
        });
        const firstOutcomeGame = firstOutcome?.game || g;
        const firstOutcomePlayer = firstOutcome && corePlayer(firstOutcomeGame, 1);
        const firstOutcomeTiger = firstOutcomeGame.boardCards.find((target) => target.uid === tiger.uid);
        const firstPlacementDoesNotConsumeAction = firstOutcome?.game.actionsUsed === coreActionLimit(firstOutcomeGame)
          && firstOutcomeTiger?.v2FreePlacementUsedTurn === firstOutcomeGame.turn;
        const remainingSecond = firstOutcomePlayer?.hand.find((target) => target.uid === second.uid);
        const secondPlacementIsNotFree = remainingSecond && !coreCanUseAction(firstOutcomeGame, remainingSecond);
        firstOutcomeGame.turn = 2;
        firstOutcomeGame.actionsUsed = coreActionLimit(firstOutcomeGame);
        const nextTurnResetsByTurnNumber = remainingSecond && coreCanUseAction(firstOutcomeGame, remainingSecond);

        const freshTiger = makeCard("02530", 1, 1, 1), regularPlacement = makeCard("02121", 1, null, null);
        const freshGame = makeGame([freshTiger]);
        freshGame.players[0].hand = [regularPlacement];
        freshGame.actionsUsed = 0;
        const freshOutcome = coreSimulateActionOutcome(freshGame, freshGame.players[0], {
          type: "place", playerId: 1, cardUid: regularPlacement.uid, target: { row: 0, col: 0 }
        });
        const firstPlacementIsFreeBeforeLimit = freshOutcome?.game.actionsUsed === 0;

        const self = makeCard("02530", 1, null, null), selfGame = makeGame([]);
        selfGame.players[0].hand = [self];
        selfGame.actionsUsed = coreActionLimit(selfGame);
        check("02530", "自身不能主动移动且自身放置不能使用自身效果", coreValidMoves(g, tiger).length === 0 && !coreCanUseAction(selfGame, self));
        check("02530", "行动耗尽后本回合首张其他友军仍可放置且不消耗行动", sourceAllowsPlacementAfterActionsEnd && firstPlacementDoesNotConsumeAction);
        check("02530", "第二张放置不免费且新回合恢复首张免费", secondPlacementIsNotFree && nextTurnResetsByTurnNumber);
        check("02530", "行动数未耗尽时首张其他友军放置同样免费", firstPlacementIsFreeBeforeLimit);
      }

      // Wu: V2 table effects and edge cases.
      {
        const a = makeCard("03101", 1, 1, 1), ally = makeCard("01101", 1, 1, 2);
        const remoteAlly = makeCard("01102", 1, 3, 3), enemy = makeCard("02101", 2, 2, 2);
        const g = makeGame([a, ally, remoteAlly, enemy]);
        destroy(g, a);
        check("03101", "摧毁时我方全部在场卡牌永久加一", ally.currentAttack === ally.attack + 1
          && remoteAlly.currentAttack === remoteAlly.attack + 1
          && enemy.currentAttack === enemy.attack);
      }
      {
        const a = makeCard("03102", 1, 1, 1), watcher = makeCard("03104", 1, 1, 2), ally = makeCard("01101", 1, 1, 3);
        const otherDestroyWatcher = makeCard("03416", 1, 3, 3);
        const g = makeGame([a, watcher, ally, otherDestroyWatcher]);
        place(g, a);
        const virtualOnDestroyRan = ally.currentAttack === ally.attack + 3;
        const virtualTargetRemains = g.boardCards.includes(watcher);
        const noOtherDestroyedTrigger = otherDestroyWatcher.currentAttack === otherDestroyWatcher.attack;

        const protectedTarget = makeCard("03416", 1, 1, 2);
        protectedTarget.currentAttack = 5;
        const protectedGame = makeGame([makeCard("03102", 1, 1, 1), protectedTarget]);
        place(protectedGame, protectedGame.boardCards[0]);
        const beforeDestroySkipped = protectedTarget.currentAttack === 5 && protectedGame.boardCards.includes(protectedTarget);
        check("03102", "放置时只虚拟触发相邻友军onDestroy且不实际摧毁", virtualOnDestroyRan && virtualTargetRemains && noOtherDestroyedTrigger && beforeDestroySkipped);
      }
      {
        const placed = makeCard("03103", 1, 1, 1), occupied = makeCard("02101", 2, 1, 2);
        const placementGame = makeGame([placed, occupied]);
        placementGame.brokenCells = [{ row: 0, col: 1 }];
        place(placementGame, placed);
        const guards = placementGame.boardCards.filter((card) => card.isGuard);
        const guardsFillOnlyValidEmptyCells = guards.length === 2
          && guards.every((guard) => guard.ownerId === null && guard.attack === 2 && guard.currentAttack === 2)
          && guards.some((guard) => guard.row === 1 && guard.col === 0)
          && guards.some((guard) => guard.row === 2 && guard.col === 1);

        const a = makeCard("03103", 1, 1, 1);
        a.currentAttack = 4;
        const lowAlly = makeCard("01101", 1, 1, 0); lowAlly.currentAttack = 1;
        const lowEnemy = makeCard("02101", 2, 1, 2); lowEnemy.currentAttack = 2;
        const lowGuard = { uid: "guard-03103", ownerId: null, row: 0, col: 1, attack: 2, currentAttack: 2, isGuard: true };
        const equalEnemy = makeCard("02101", 2, 2, 1); equalEnemy.currentAttack = 4;
        const destroyGame = makeGame([a, lowAlly, lowEnemy, lowGuard, equalEnemy]);
        const destructionPrevented = !destroy(destroyGame, a) && destroyGame.boardCards.includes(a);
        const exactlyOneLowerTargetDestroyed = [lowAlly, lowEnemy, lowGuard]
          .filter((target) => destroyGame.boardCards.includes(target)).length === 2;
        const equalTargetUntouched = destroyGame.boardCards.includes(equalEnemy);

        const vulnerable = makeCard("03103", 1, 1, 1); vulnerable.currentAttack = 2;
        const equal = makeCard("02101", 2, 1, 2); equal.currentAttack = 2;
        const higher = makeCard("02101", 2, 0, 1); higher.currentAttack = 3;
        const vulnerableGame = makeGame([vulnerable, equal, higher]);
        const destroyedWithoutLowerTarget = destroy(vulnerableGame, vulnerable) && !vulnerableGame.boardCards.includes(vulnerable);
        const virtualSource = makeCard("03102", 1, 1, 1), virtualTarget = makeCard("03103", 1, 1, 2);
        virtualSource.currentAttack = 5;
        virtualTarget.currentAttack = 4;
        const virtualLower = makeCard("01101", 1, 1, 3); virtualLower.currentAttack = 1;
        const virtualGame = makeGame([virtualSource, virtualTarget, virtualLower]);
        place(virtualGame, virtualSource);
        const onDestroyPathRan = !virtualGame.boardCards.includes(virtualLower) && virtualGame.boardCards.includes(virtualTarget);
        check("03103", "放置生成二战力守军且摧毁逻辑在两条钩子路径执行", guardsFillOnlyValidEmptyCells
          && destructionPrevented && exactlyOneLowerTargetDestroyed && equalTargetUntouched && destroyedWithoutLowerTarget);
        check("03103", "虚拟触发03103的onDestroy仍会摧毁低战力相邻卡牌", onDestroyPathRan);
      }
      {
        const a = makeCard("03104", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]);
        destroy(g, a);
        const boostedThisTurn = ally.currentAttack === ally.attack + 3 && ally.v2TempBonus === 3;
        coreRunV2EndSkills(g, g.players[0], []);
        check("03104", "摧毁时四方相邻友军本回合加三", boostedThisTurn && ally.currentAttack === ally.attack && ally.v2TempBonus === 0);
      }
      {
        const a = makeCard("03105", 1, 1, 1), cause = makeCard("02101", 2, 1, 2), g = makeGame([a, cause]);
        destroy(g, a, cause);
        const reducedThisTurn = cause.currentAttack === Math.max(0, cause.attack - 2) && cause.v2TempBonus === -2;
        coreRunV2EndSkills(g, g.players[0], []);
        check("03105", "摧毁时仍在场的摧毁者本回合减二", reducedThisTurn && cause.currentAttack === cause.attack && cause.v2TempBonus === 0);
      }
      {
        const a = makeCard("03106", 1, 1, 1), allyA = makeCard("01101", 1, 1, 2), allyB = makeCard("01102", 1, 3, 3);
        const guard = { uid: "guard-03106", ownerId: null, row: 0, col: 0, attack: 2, currentAttack: 2, isGuard: true };
        const enemy = makeCard("02101", 2, 2, 2);
        const placementGame = makeGame([a, allyA, allyB, guard, enemy]);
        place(placementGame, a);
        const placementBoostCount = [allyA, allyB].filter((target) => target.currentAttack === target.attack + 1
          && target.v2PermanentBonus === 1).length;
        const placementTargetsScoped = a.currentAttack === a.attack && guard.currentAttack === guard.attack && enemy.currentAttack === enemy.attack;

        const destroyed = makeCard("03106", 1, 1, 1), destroyedAllyA = makeCard("01101", 1, 1, 2), destroyedAllyB = makeCard("01102", 1, 3, 3);
        const destroyGame = makeGame([destroyed, destroyedAllyA, destroyedAllyB]);
        const destroyedCardRemoved = destroy(destroyGame, destroyed) && !destroyGame.boardCards.includes(destroyed);
        const destroyBoostCount = [destroyedAllyA, destroyedAllyB].filter((target) => target.currentAttack === target.attack + 1
          && target.v2PermanentBonus === 1).length;
        check("03106", "放置与摧毁时随机其他友军永久加一", placementBoostCount === 1 && placementTargetsScoped
          && destroyedCardRemoved && destroyBoostCount === 1);
      }
      {
        const a = makeCard("03107", 1, 1, 1), g = makeGame([a]);
        g.players[1].hand = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null), makeCard("02103", 2, null, null)];
        g.players[1].drawPile = [makeCard("02104", 2, null, null)];
        destroy(g, a);
        const drawsThenDiscards = g.players[1].hand.length === 2 && g.players[1].drawPile.length === 0;

        const full = makeCard("03107", 1, 1, 1), fullGame = makeGame([full]);
        fullGame.players[1].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("02101", 2, null, null));
        fullGame.players[1].drawPile = [makeCard("02102", 2, null, null)];
        destroy(fullGame, full);
        const failedDrawStillDiscards = fullGame.players[1].hand.length === HAND_LIMIT - 2 && fullGame.players[1].drawPile.length === 1;
        check("03107", "摧毁时敌方先抽一张再弃置两张", drawsThenDiscards && failedDrawStillDiscards);
      }
      { const a = makeCard("03208", 1, 1, 1), enemyDeckCard = makeCard("02101", 2, null, null), g = makeGame([a]); g.players[1].drawPile = [enemyDeckCard]; place(g, a); const placedDraw = g.players[0].hand.includes(enemyDeckCard) && enemyDeckCard.ownerId === 1; const second = makeCard("03208", 1, 2, 2); g.boardCards.push(second); g.players[1].drawPile = [makeCard("02102", 2, null, null)]; destroy(g, second); check("03208", "放置与摧毁时从敌方牌库抽牌", placedDraw && g.players[0].hand.length === 2); }
      { const a = makeCard("03209", 1, 1, 1), enemyA = makeCard("02101", 2, 1, 0), guard = { uid: "guard-test", ownerId: null, row: 0, col: 1, currentAttack: 2, attack: 2, isGuard: true }, g = makeGame([a, enemyA, guard]); g.players[0].drawPile = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)]; destroy(g, a); const directDestroy = g.players[0].hand.length === 2 && g.boardCards.length === 2;
        check("03209", "直接被摧毁时按原格四方相邻非我方卡牌数量抽牌", directDestroy);
        const attacker = makeCard("03209", 1, 1, 1), defender = makeCard("02101", 2, 1, 2), targetNeighbor = makeCard("02102", 2, 0, 2), sourceNeighbor = makeCard("02103", 2, 1, 0), combatGame = makeGame([attacker, defender, targetNeighbor, sourceNeighbor]);
        attacker.currentAttack = 1; defender.currentAttack = 2; combatGame.players[0].drawPile = [makeCard("01103", 1, null, null), makeCard("01104", 1, null, null)];
        coreResolveSkillAttack(combatGame, attacker, defender, combatGame.players[0], []);
        const targetPositionUsed = combatGame.players[0].hand.length === 1 && !combatGame.boardCards.includes(attacker);
        check("03209", "主动攻击被摧毁时按目标格四方相邻非我方卡牌数量抽牌", targetPositionUsed);
        const protectedAttacker = makeCard("01313", 1, 1, 1), strongerDefender = makeCard("02101", 2, 1, 2), protectedGame = makeGame([protectedAttacker, strongerDefender]);
        protectedAttacker.currentAttack = 5; strongerDefender.currentAttack = 6; coreResolveSkillAttack(protectedGame, protectedAttacker, strongerDefender, protectedGame.players[0], []);
        const returnedAfterProtection = protectedGame.boardCards.includes(protectedAttacker) && protectedAttacker.row === 1 && protectedAttacker.col === 1;
        check("03209", "主动攻击被免毁后在摧毁判定结束时返回原格", returnedAfterProtection); }
      { const a = makeCard("03210", 1, 1, 1), allyA = makeCard("01101", 1, 1, 2), allyB = makeCard("01101", 1, 2, 1), enemyA = makeCard("02101", 2, 1, 3), enemyB = makeCard("02101", 2, 3, 1), g = makeGame([a, allyA, allyB, enemyA, enemyB]); destroy(g, a); const allBoosted = [allyA, allyB].every((target) => target.currentAttack === target.attack + 2 && target.v2TempBonus === 2); const bothAttacked = !g.boardCards.includes(enemyA) && !g.boardCards.includes(enemyB); check("03210", "四方相邻友军本回合加二并分别随机攻击相邻敌军", allBoosted && bothAttacked); }
      { const a = makeCard("03211", 1, 1, 1), enemyA = makeCard("02101", 2, 0, 0), enemyB = makeCard("02101", 2, 0, 1), guard = { uid: "guard-03211", ownerId: null, row: 0, col: 2, attack: 2, currentAttack: 2, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 }, fewerGame = makeGame([a, enemyA, enemyB, guard]); destroy(fewerGame, a); const fewerBranch = enemyA.currentAttack === 0 && enemyB.currentAttack === 0 && guard.currentAttack === 1 && enemyA.v2PermanentBonus === -1 && guard.v2PermanentBonus === -1;
        const leader = makeCard("03211", 1, 1, 1), allyA = makeCard("01101", 1, 1, 2), allyB = makeCard("01101", 1, 2, 1), enemy = makeCard("02101", 2, 0, 0), greaterGame = makeGame([leader, allyA, allyB, enemy]); destroy(greaterGame, leader); const greaterBranch = allyA.currentAttack === allyA.attack + 1 && allyB.currentAttack === allyB.attack + 1 && allyA.v2PermanentBonus === 1 && enemy.currentAttack === enemy.attack;
        check("03211", "按双方玩家卡牌数量分支，少于时敌方含守军永久减一，多于时其他友军永久加一", fewerBranch && greaterBranch); }
      { const a = makeCard("03212", 1, 1, 1), currentAlly = makeCard("01101", 2, 1, 2), formerAlly = makeCard("01102", 1, 0, 1), g = makeGame([a, currentAlly, formerAlly]); place(g, a); const converted = a.ownerId === 2 && !destroy(g, a); g.turn = 2; const destroyed = destroy(g, a); check("03212", "放置转为对方所有且本回合免毁，之后只摧毁当前阵营相邻友军", converted && destroyed && !g.boardCards.includes(currentAlly) && g.boardCards.includes(formerAlly)); }
      { const a = makeCard("03313", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), guard = { uid: "guard-zero", ownerId: null, row: 0, col: 1, currentAttack: 2, attack: 2, isGuard: true }, g = makeGame([a, enemy, guard]); destroy(g, a); check("03313", "所有敌方含守军本回合减二并销毁归零卡", enemy.currentAttack === 0 && enemy.v2TempBonus === -2 && !g.boardCards.includes(enemy) && guard.currentAttack === 0 && guard.v2TempBonus === -2); }
      { const a = makeCard("03314", 1, 1, 1), g = makeGame([a]); g.players[1].drawPile = [makeCard("02101", 2, null, null)]; place(g, a); const placementDraw = a.currentAttack === a.attack + 1 && a.v2PermanentBonus === 1 && g.players[1].hand.length === 1;
        const enemyDrawer = makeCard("01107", 2, 3, 3); g.boardCards.push(enemyDrawer); g.players[1].drawPile = [makeCard("02103", 2, null, null)]; state.game = g; coreRunV2StartSkill(g, g.players[1], enemyDrawer); const futureEnemyDraw = a.currentAttack === a.attack + 2 && a.v2PermanentBonus === 2 && g.players[1].hand.length === 2;
        destroy(g, a); check("03314", "敌方任意效果抽牌使此卡永久加一，放置抽一张且摧毁时弃一张", placementDraw && futureEnemyDraw && g.players[1].hand.length === 1); }
      { const a = makeCard("03315", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2), remote = makeCard("02102", null, 3, 3), guard = { uid: "guard-03315", ownerId: null, row: 0, col: 0, attack: 3, currentAttack: 3, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 }, g = makeGame([a, enemy, remote, guard]); remote.attack = 4; remote.currentAttack = 4; place(g, a); const equalPlacement = enemy.currentAttack === 0 && enemy.v2PermanentBonus === -2 && remote.currentAttack === 2 && remote.v2PermanentBonus === -2 && guard.currentAttack === 1 && guard.v2PermanentBonus === -2; const destroyedLowCards = destroy(g, a) && !g.boardCards.includes(enemy) && g.boardCards.includes(remote) && g.boardCards.includes(guard);
        const leader = makeCard("03315", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), otherEnemy = makeCard("02101", 2, 3, 3), otherGuard = { uid: "guard-03315-unequal", ownerId: null, row: 0, col: 0, attack: 3, currentAttack: 3, isGuard: true, v2PermanentBonus: 0, v2TempBonus: 0 }, unequalGame = makeGame([leader, ally, otherEnemy, otherGuard]); place(unequalGame, leader); const unequalPlacement = otherEnemy.currentAttack === 0 && otherEnemy.v2PermanentBonus === -1 && otherGuard.currentAttack === 2 && otherGuard.v2PermanentBonus === -1;
        check("03315", "全场非己方按双方玩家卡牌数量永久减益，摧毁时销毁低于自身战力的非己方卡牌", equalPlacement && destroyedLowCards && unequalPlacement); }
      { const a = makeCard("03416", 1, 1, 1), lower = makeCard("01101", 1, 3, 3), higher = makeCard("02101", 2, 3, 2), g = makeGame([a, lower, higher]); lower.currentAttack = 3; higher.currentAttack = 6; destroy(g, lower); const gainedFromLowerCard = a.currentAttack === a.attack + 1 && a.v2PermanentBonus === 1; destroy(g, higher); const ignoredHigherCard = a.currentAttack === a.attack + 1 && a.v2PermanentBonus === 1; coreRunV2EndSkills(g, g.players[0], []); check("03416", "不高于自身战力的其他卡牌被摧毁时永久加一", gainedFromLowerCard && ignoredHigherCard && a.currentAttack === a.attack + 1); }
      { const a = makeCard("03416", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2), g = makeGame([a, enemy]); enemy.currentAttack = 6; coreResolveSkillAttack(g, a, enemy, g.players[0], []); const attackBoostedThisTurn = g.boardCards.includes(a) && !g.boardCards.includes(enemy) && a.currentAttack === a.attack + 4 && a.v2TempBonus === 3 && a.v2PermanentBonus === 1; coreRunV2EndSkills(g, g.players[0], []); check("03416", "攻击前本回合加三且摧毁较弱卡牌后再永久加一", attackBoostedThisTurn && a.currentAttack === a.attack + 1 && a.v2TempBonus === 0 && a.v2PermanentBonus === 1); }
      { const a = makeCard("03416", 1, 1, 1), regular = makeCard("01101", 1, 3, 3), g = makeGame([a, regular]); start(g, a); a.lastMovedTurn = g.turn; a.v2MovesTakenTurn = g.turn; a.v2MovesTakenThisTurn = 1; regular.lastMovedTurn = g.turn; regular.v2MovesTakenTurn = g.turn; regular.v2MovesTakenThisTurn = 1; const extraMoveAvailable = a.v2ExtraMovesTurn === g.turn && a.v2ExtraMoves === 1 && coreValidMoves(g, a).length > 0; const regularSecondMoveBlocked = coreValidMoves(g, regular).length === 0; a.v2MovesTakenThisTurn = 2; const thirdMoveBlocked = coreValidMoves(g, a).length === 0; g.actionsUsed = coreActionLimit(g); const stillConsumesActions = !coreCanUseAction(g, a); check("03416", "普通卡牌本回合移动一次后不可再次移动", regularSecondMoveBlocked); check("03416", "回合开始后本回合可额外移动一次且仍消耗行动数", extraMoveAvailable && stillConsumesActions); check("03416", "额外移动使用后本回合不可第三次移动", thirdMoveBlocked); }
      { const ship = makeCard("03517", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([ship, ally]); const original = { row: ally.row, col: ally.col }; const destroyed = destroy(g, ally); check("03517", "相邻友军免于摧毁，楼船阵自毁并将其移动到楼船位置", !destroyed && !g.boardCards.includes(ship) && g.boardCards.includes(ally) && ally.row === 1 && ally.col === 1 && (original.row !== ally.row || original.col !== ally.col)); }
      { const attacker = makeCard("01101", 1, 1, 1), defender = makeCard("02101", 2, 1, 2), ship = makeCard("03517", 1, 1, 3), g = makeGame([attacker, defender, ship]); attacker.currentAttack = 1; defender.currentAttack = 5; const outcome = coreSimulateActionOutcome(g, g.players[0], { type: "move", playerId: 1, cardUid: attacker.uid, source: { row: 1, col: 1 }, target: { row: 1, col: 2 } }); const movedAttacker = outcome?.game.boardCards.find((card) => card.uid === attacker.uid); const shipDestroyed = outcome && !outcome.game.boardCards.some((card) => card.uid === ship.uid); check("03517", "主动攻击者被楼船阵代死后停在楼船阵位置", movedAttacker?.row === 1 && movedAttacker?.col === 3 && shipDestroyed); }
      { const attacker = makeCard("01101", 1, 1, 1), defender = makeCard("02101", 2, 1, 2), ship = makeCard("03517", 1, 1, 3), g = makeGame([attacker, defender, ship]); attacker.currentAttack = 1; defender.currentAttack = 5; coreResolveSkillAttack(g, attacker, defender, g.players[0], []); check("03517", "技能攻击者被楼船阵代死后停在楼船阵位置", g.boardCards.includes(attacker) && !g.boardCards.includes(ship) && attacker.row === 1 && attacker.col === 3); }
      { const sima = makeCard("02314", 1, 0, 0), ship = makeCard("03517", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([sima, ship, ally]); ally.v2StartTurn = 1; ally.v2StartAttack = ally.attack; ally.currentAttack = ally.attack + 1; destroy(g, ally); coreRunV2EndSkills(g, g.players[0], []); check("02314", "司马懿回合结束结算不影响楼船阵保护后的存活", g.boardCards.includes(ally) && !g.boardCards.includes(ship) && ally.row === 1 && ally.col === 1); }
      { const a = makeCard("03518", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02101", 2, 2, 1), g = makeGame([a, ally, enemy]); destroy(g, a); check("03518", "摧毁四方相邻及原位置卡牌并生成破坏格", !g.boardCards.includes(ally) && !g.boardCards.includes(enemy) && g.brokenCells.some((cell) => cell.row === 1 && cell.col === 1)); }
      { const a = makeCard("03518", 1, 4, 1), deathEffect = makeCard("03101", 2, 2, 1), protectedCard = makeCard("03519", 2, 1, 1), ally = makeCard("02101", 2, 0, 0), g = makeGame([a, deathEffect, protectedCard, ally]); destroy(g, a); check("03518", "破坏格强制摧毁仍触发遗志且无视免毁", !g.boardCards.includes(deathEffect) && !g.boardCards.includes(protectedCard) && ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("03519", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); start(g, a); const kept = g.boardCards.includes(a); const isolatedBeforeStart = makeCard("03519", 1, 2, 2), externalCause = makeCard("02101", 2, 2, 3), preStartGame = makeGame([isolatedBeforeStart, externalCause]); const immuneBeforeOwnStart = !destroy(preStartGame, isolatedBeforeStart, externalCause) && preStartGame.boardCards.includes(isolatedBeforeStart); const isolated = makeCard("03519", 1, 2, 2); const isolatedGame = makeGame([isolated]); start(isolatedGame, isolated); check("03519", "普通摧毁始终无效，有相邻友军时保留且无友军时回合开始自毁", kept && immuneBeforeOwnStart && !isolatedGame.boardCards.includes(isolated)); }
      { const a = makeCard("03520", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02101", 2, 2, 2), g = makeGame([a, ally, enemy]); place(g, a); check("03520", "放置时全场本回合减二并增加行动数", a.currentAttack === 0 && ally.currentAttack === 0 && enemy.currentAttack === 0 && g.extraActions === 1); }

      // Wu: Modified card - 03519
      { const a = makeCard("03519", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemyAttacker = makeCard("02101", 2, 1, 0), g = makeGame([a, ally, enemyAttacker]);
        enemyAttacker.currentAttack = 5;
        a.currentAttack = 3;
        const allyBeforeAttack = ally.currentAttack;
        coreResolveSkillAttack(g, enemyAttacker, a, g.players[1], []);
        const allyReducedOnAttack = ally.currentAttack === allyBeforeAttack - 1
          && ally.v2PermanentBonus === -1 && ally.v2TempBonus === 0;
        coreRunV2EndSkills(g, g.players[1], []);
        const allyReductionPersists = ally.currentAttack === allyBeforeAttack - 1 && ally.v2PermanentBonus === -1;

        start(g, a);
        const keptWithAlly = g.boardCards.includes(a);
        const isolated = makeCard("03519", 1, 2, 2);
        const isolatedGame = makeGame([isolated]);
        start(isolatedGame, isolated);
        check("03519", "被攻击时四方相邻友军永久减一，有相邻友军时不可摧毁", allyReducedOnAttack && allyReductionPersists && keptWithAlly && !isolatedGame.boardCards.includes(isolated));
      }

      // Wu replacement cards: confirmed effects and action boundaries.
      {
        const a = makeCard("03121", 1, 1, 1), cause = makeCard("02122", 2, 1, 2), g = makeGame([a, cause]);
        cause.v2PermanentBonus = 3;
        cause.v2TempBonus = 2;
        cause.currentAttack = cause.attack + 5;
        destroy(g, a, cause);
        const cardCauseSetPermanentlyToOne = cause.currentAttack === 1
          && cause.v2PermanentBonus === 1 - cause.attack && cause.v2TempBonus === 0;
        coreRunV2EndSkills(g, g.players[0], []);
        const remainsOneAfterTurnEnd = cause.currentAttack === 1;

        const neutralVictim = makeCard("03121", 1, 2, 2);
        const guard = { uid: "guard-03121", ownerId: null, row: 2, col: 3, attack: 2, currentAttack: 2, v2PermanentBonus: 0, v2TempBonus: 0, isGuard: true };
        const neutralGame = makeGame([neutralVictim, guard]);
        destroy(neutralGame, neutralVictim, guard);
        check("03121", "摧毁者包含中立守军且战力永久变为一", cardCauseSetPermanentlyToOne
          && remainsOneAfterTurnEnd && guard.currentAttack === 1 && guard.v2PermanentBonus === -1);
      }
      {
        const a = makeCard("03122", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]);
        destroy(g, a);
        const movedAndBoosted = ally.row === 1 && ally.col === 1
          && ally.currentAttack === ally.attack + 1 && ally.v2PermanentBonus === 1;
        const isolated = makeCard("03122", 1, 2, 2), isolatedGame = makeGame([isolated]);
        const noTargetDoesNothing = destroy(isolatedGame, isolated) && isolatedGame.boardCards.length === 0;
        check("03122", "遗志随机移动四方相邻友军至原位并永久加一", movedAndBoosted && noTargetDoesNothing);
      }
      {
        const a = makeCard("03123", 1, 1, 1), g = makeGame([a]);
        g.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)];
        destroy(g, a);
        const discardedOne = g.players[0].hand.length === 1;
        const empty = makeCard("03123", 1, 2, 2), emptyGame = makeGame([empty]);
        const emptyHandDoesNothing = destroy(emptyGame, empty) && emptyGame.players[0].hand.length === 0;
        check("03123", "遗志随机弃置一张手牌且空手时不生效", discardedOne && emptyHandDoesNothing);
      }
      {
        const placed = makeCard("03124", 1, 1, 1), successAlly = makeCard("01101", 1, 3, 3), successGame = makeGame([placed, successAlly]);
        successGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(successGame, placed);
        const successfulDrawDoesNotBoost = successGame.players[0].hand.length === 1 && successAlly.currentAttack === successAlly.attack;

        const full = makeCard("03124", 1, 1, 1), fullAlly = makeCard("01101", 1, 3, 3), fullGame = makeGame([full, fullAlly]);
        fullGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        fullGame.players[0].drawPile = [makeCard("01102", 1, null, null)];
        place(fullGame, full);
        const fullHandFailureBoosts = fullAlly.currentAttack === fullAlly.attack + 1 && fullAlly.v2PermanentBonus === 1;

        const destroyed = makeCard("03124", 1, 1, 1), destroyedAlly = makeCard("01101", 1, 3, 3), destroyGame = makeGame([destroyed, destroyedAlly]);
        destroy(destroyGame, destroyed);
        const emptyDeckFailureBoosts = destroyedAlly.currentAttack === destroyedAlly.attack + 1 && destroyedAlly.v2PermanentBonus === 1;
        check("03124", "入阵和遗志抽牌，任意抽牌失败使随机其他友军永久加一", successfulDrawDoesNotBoost
          && fullHandFailureBoosts && emptyDeckFailureBoosts);
      }
      {
        const a = makeCard("03225", 1, 1, 1), g = makeGame([a]);
        g.players[0].drawPile = [makeCard("01101", 1, null, null)];
        g.players[1].drawPile = [makeCard("02101", 2, null, null)];
        place(g, a);
        const bothSuccessfulAddTwo = a.currentAttack === a.attack + 2 && a.v2PermanentBonus === 2;

        const one = makeCard("03225", 1, 2, 2), oneGame = makeGame([one]);
        oneGame.players[0].drawPile = [makeCard("01101", 1, null, null)];
        oneGame.players[1].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("02101", 2, null, null));
        oneGame.players[1].drawPile = [makeCard("02102", 2, null, null)];
        place(oneGame, one);
        check("03225", "双方每成功抽一张自身永久加一", bothSuccessfulAddTwo
          && one.currentAttack === one.attack + 1 && one.v2PermanentBonus === 1);
      }
      {
        const placed = makeCard("03226", 1, 1, 1), placementGame = makeGame([placed]);
        placementGame.players[1].hand = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null)];
        place(placementGame, placed);
        const discardedOne = placementGame.players[1].hand.length === 1;

        const destroyed = makeCard("03226", 1, 2, 2), destroyGame = makeGame([destroyed]);
        destroyGame.players[1].hand = Array.from({ length: HAND_LIMIT - 1 }, () => makeCard("02101", 2, null, null));
        destroyGame.players[1].drawPile = [makeCard("02102", 2, null, null), makeCard("02103", 2, null, null)];
        destroy(destroyGame, destroyed);
        check("03226", "入阵敌方弃一张，遗志最多抽两张且受手牌上限限制", discardedOne
          && destroyGame.players[1].hand.length === HAND_LIMIT && destroyGame.players[1].drawPile.length === 1);
      }
      {
        const watcher = makeCard("03227", 1, 1, 1), mover = makeCard("01101", 1, 1, 3), activeGame = makeGame([watcher, mover]);
        const activeOutcome = coreSimulateActionOutcome(activeGame, activeGame.players[0], {
          type: "move", playerId: 1, cardUid: mover.uid,
          source: { row: 1, col: 3 }, target: { row: 1, col: 2 }
        });
        const activeWatcher = activeOutcome?.game.boardCards.find((card) => card.uid === watcher.uid);
        const activeMover = activeOutcome?.game.boardCards.find((card) => card.uid === mover.uid);
        const activeMoveBoosted = activeMover?.currentAttack === mover.attack + 1 && activeMover?.v2PermanentBonus === 1;

        const skillWatcher = makeCard("03227", 1, 1, 1), skillMover = makeCard("01101", 1, 3, 3), skillGame = makeGame([skillWatcher, skillMover]);
        state.game = skillGame;
        const skillSource = { row: skillMover.row, col: skillMover.col };
        skillMover.row = 1;
        skillMover.col = 2;
        coreRunV2MoveEffects(skillGame, skillMover, skillSource, { row: 1, col: 2 }, true);
        check("03227", "主动与技能移动后落在四方相邻均永久加一", activeWatcher?.currentAttack === watcher.attack
          && activeMoveBoosted && skillMover.currentAttack === skillMover.attack + 1 && skillMover.v2PermanentBonus === 1);
      }
      {
        const placed = makeCard("03328", 1, 4, 4), placementGame = makeGame([placed]);
        placementGame.players[0].hand = Array.from({ length: HAND_LIMIT - 1 }, () => makeCard("01101", 1, null, null));
        placementGame.players[0].drawPile = [makeCard("01102", 1, null, null), makeCard("01103", 1, null, null)];
        place(placementGame, placed);
        const placementDrawStopsAtLimit = placementGame.players[0].hand.length === HAND_LIMIT && placementGame.players[0].drawPile.length === 1;

        const destroyed = makeCard("03328", 1, 4, 4), destroyGame = makeGame([destroyed]);
        destroyGame.players[1].hand = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null)];
        destroyGame.players[1].drawPile = Array.from({ length: 4 }, () => makeCard("02103", 2, null, null));
        destroy(destroyGame, destroyed);
        const enemyDrawsToLimit = destroyGame.players[1].hand.length === HAND_LIMIT && destroyGame.players[1].drawPile.length === 1;

        const starter = makeCard("03328", 1, 1, 1), ally = makeCard("01101", 1, 3, 3), freeGame = makeGame([starter, ally]);
        start(freeGame, starter);
        freeGame.actionsUsed = coreActionLimit(freeGame);
        const canMoveAtActionLimit = coreCanUseAction(freeGame, starter);
        const freeOutcome = coreSimulateActionOutcome(freeGame, freeGame.players[0], {
          type: "move", playerId: 1, cardUid: starter.uid,
          source: { row: 1, col: 1 }, target: { row: 1, col: 2 }
        });
        const freeMoveDidNotConsume = freeOutcome?.game.actionsUsed === coreActionLimit(freeOutcome?.game)
          && freeOutcome?.game.players[0].v2FirstFriendlyMoveFreeUsedTurn === freeOutcome?.game.turn;
        const outcomeAlly = freeOutcome?.game.boardCards.find((card) => card.uid === ally.uid);
        const secondMoveNotFree = outcomeAlly && !coreCanUseAction(freeOutcome.game, outcomeAlly);

        const attackStarter = makeCard("03328", 1, 4, 4), attacker = makeCard("01101", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2);
        const attackGame = makeGame([attackStarter, attacker, enemy]);
        start(attackGame, attackStarter);
        attackGame.actionsUsed = coreActionLimit(attackGame);
        const attackOutcome = coreSimulateActionOutcome(attackGame, attackGame.players[0], {
          type: "move", playerId: 1, cardUid: attacker.uid,
          source: { row: 1, col: 1 }, target: { row: 1, col: 2 }
        });
        const freeAttackResolved = attackOutcome?.game.actionsUsed === coreActionLimit(attackOutcome?.game)
          && !attackOutcome?.game.boardCards.some((card) => card.uid === enemy.uid);
        check("03328", "入阵抽二、遗志使敌方抽满且首次友方主动移动或攻击免费", placementDrawStopsAtLimit
          && enemyDrawsToLimit && canMoveAtActionLimit && freeMoveDidNotConsume && secondMoveNotFree && freeAttackResolved);
      }
      {
        const a = makeCard("03429", 1, 4, 4), ally = makeCard("01101", 1, 3, 3), g = makeGame([a, ally]);
        g.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null));
        g.players[0].drawPile = [makeCard("01102", 1, null, null)];
        destroy(g, ally);
        const gainsEvenWhenDrawFails = a.currentAttack === a.attack + 1 && a.v2PermanentBonus === 1
          && g.players[0].hand.length === HAND_LIMIT && g.players[0].drawPile.length === 1;

        const dying = makeCard("03429", 1, 4, 4), legacy = makeCard("03104", 1, 1, 1), beneficiary = makeCard("01101", 1, 1, 2);
        const virtualGame = makeGame([dying, legacy, beneficiary]);
        destroy(virtualGame, dying);
        const borrowsOnlyEligibleLegacy = virtualGame.boardCards.includes(legacy)
          && beneficiary.currentAttack === beneficiary.attack + 3 && beneficiary.v2TempBonus === 3;

        const starter = makeCard("03429", 1, 2, 2), enemy = makeCard("02101", 2, 0, 0);
        const guard = { uid: "guard-03429", ownerId: null, row: 0, col: 1, attack: 2, currentAttack: 2, isGuard: true };
        const startGame = makeGame([starter, enemy, guard]);
        start(startGame, starter);
        check("03429", "其他友军被摧毁永久加一并尝试抽牌，遗志借用友军遗志且起势排除自身与守军", gainsEvenWhenDrawFails
          && borrowsOnlyEligibleLegacy && startGame.extraActions === 1);
      }
      {
        const starter = makeCard("03530", 1, 4, 4), legacy = makeCard("03104", 1, 1, 1), beneficiary = makeCard("01101", 1, 1, 2);
        const startGame = makeGame([starter, legacy, beneficiary]);
        start(startGame, starter);
        const startBorrowsEligibleLegacy = startGame.boardCards.includes(legacy)
          && beneficiary.currentAttack === beneficiary.attack + 3 && beneficiary.v2TempBonus === 3;

        const dying = makeCard("03530", 1, 4, 4), drawWatcher = makeCard("03314", 2, 0, 0), redrawGame = makeGame([dying, drawWatcher]);
        redrawGame.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null), makeCard("01103", 1, null, null)];
        redrawGame.players[0].drawPile = [makeCard("01104", 1, null, null), makeCard("01105", 1, null, null)];
        destroy(redrawGame, dying);
        const redrawLimitedByDeck = redrawGame.players[0].hand.length === 2 && redrawGame.players[0].drawPile.length === 0;
        const redrawTriggersNormalDraws = drawWatcher.currentAttack === drawWatcher.attack + 2 && drawWatcher.v2PermanentBonus === 2;
        check("03530", "无法主动移动，起势借用有效遗志且遗志弃全手牌后正常抽取等量", coreValidMoves(startGame, starter).length === 0
          && startBorrowsEligibleLegacy && redrawLimitedByDeck && redrawTriggersNormalDraws);
      }
    } catch (error) {
      results.push({ id: "runtime", name: "边界测试执行", passed: false, error: String(error) });
    } finally {
      state.game = previousGame;
    }
    return { passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length, results };
  }



  window.runCoreV2RegressionTests = coreRunV2RegressionTests;
  window.runCoreV2CardBoundaryTests = coreRunV2CardBoundaryTests;
})();
