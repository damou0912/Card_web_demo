(function() {
  const api = window.__CARD_DEMO_CORE_V2_TEST_API__;
  if (!api) throw new Error("V2 test API is unavailable. Load core-v2.js first.");
  const { cloneCard, coreAdjustAttack, coreAiPlacementScore, coreApplyV2PlacementSkill, coreControlMap, coreCreateGame, coreDestroyV2Card, coreEnforceZeroDestroy, coreLoadCardTestSetup, corePlanAiAction, corePlayer, coreResolveSkillAttack, coreRunV2EndSkills, coreRunV2MoveEffects, coreRunV2StartSkill, coreStartTurn, coreTriggerOtherV2PlacementEffects, coreValidMoves, coreVictoryTarget, HAND_LIMIT, state } = api;
  function coreRunV2RegressionTests() {
    const previousGame = state.game;
    const results = [];
    const check = (name, condition) => results.push({ name, passed: Boolean(condition) });
    const makeCard = (id, ownerId, row, col) => {
      const template = window.CARD_LIBRARY?.cardSlots?.find((card) => card.id === id);
      const card = cloneCard(template || { id, name: id, attack: 0, camp: "三国~魏", skill: "测试", effect: "测试", rarity: "普通" });
      Object.assign(card, { ownerId, row, col, currentAttack: Number(card.attack) || 0, v2PermanentBonus: 0, v2TempBonus: 0 });
      return card;
    };
    const makeGame = (boardCards = []) => ({
      turn: 1, activePlayerId: 1, boardCards, brokenCells: [], v2ControlCells: [], v2PlacementLocks: [], moveLocks: {}, pendingAnimations: [], players: [
        { id: 1, hand: [], drawPile: [], lastControlCount: 0 }, { id: 2, hand: [], drawPile: [], lastControlCount: 0 }
      ]
    });
    try {
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

      const remoteAlly = makeCard("02105", 1, 3, 3);
      const commanderGame = makeGame([caoCao, placed, remoteAlly]); state.game = commanderGame;
      coreApplyV2PlacementSkill(commanderGame, commanderGame.players[0], caoCao, []);
      check("曹操放置时强化所有其他友军", placed.currentAttack === placed.attack + 1 && remoteAlly.currentAttack === remoteAlly.attack + 1);
      coreAdjustAttack(remoteAlly, -1);
      check("曹操在场时阻止友军战力降低", remoteAlly.currentAttack === remoteAlly.attack + 1);

      const grain = makeCard("01107", 1, 0, 0);
      const grainGame = makeGame([grain]); grainGame.players[0].drawPile = [makeCard("01101", 1, null, null)]; state.game = grainGame;
      coreRunV2StartSkill(grainGame, grainGame.players[0], grain);
      check("糜芳手牌不超过三张时抽牌", grainGame.players[0].hand.length === 1);

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
      coreEnforceZeroDestroy(zeroGame, []);
      check("司马懿摧毁归零卡牌后永久加一", commander.currentAttack === 1 && !zeroGame.boardCards.includes(zero));

      const order = makeCard("02519", 1, 0, 0);
      const ally = makeCard("01101", 1, 0, 1);
      const enemy = makeCard("01102", 2, 0, 2);
      const attackGame = makeGame([order, ally, enemy]); state.game = attackGame;
      coreApplyV2PlacementSkill(attackGame, attackGame.players[0], order, []);
      check("奉诏征伐触发相邻友军自动攻击", !attackGame.boardCards.includes(enemy));

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
      const attacker = makeCard("02105", 2, 0, 1);
      const secondEnemy = makeCard("02101", 2, 1, 1);
      const zhugeGame = makeGame([zhuge, attacker, secondEnemy]); zhugeGame.activePlayerId = 2;
      check("诸葛亮占领落后时双方不能主动与其交战", !coreValidMoves(zhugeGame, attacker).some((cell) => cell.row === 0 && cell.col === 0));
      coreResolveSkillAttack(zhugeGame, attacker, zhuge, zhugeGame.players[1], []);
      check("诸葛亮不可交战状态同样阻止技能攻击", zhugeGame.boardCards.includes(zhuge) && zhugeGame.boardCards.includes(attacker));

      const edict = makeCard("01520", 1, 1, 1);
      const edictGame = makeGame([edict]); edictGame.activePlayerId = 1; state.game = edictGame;
      coreApplyV2PlacementSkill(edictGame, edictGame.players[0], edict, []);
      check("昭烈仁德令从下个己方回合开始占领", edictGame.v2ControlCells.length === 4 && edictGame.v2ControlCells.every((entry) => entry.startsAtTurn === 3));

      const activeCard = makeCard("01101", 1, 0, 0);
      const offTurnCard = makeCard("03101", 2, 0, 1); offTurnCard.v2TempBonus = 2; offTurnCard.currentAttack += 2;
      const expiryGame = makeGame([activeCard, offTurnCard]); state.game = expiryGame;
      coreRunV2EndSkills(expiryGame, expiryGame.players[0], []);
      check("敌方回合获得的临时战力在本回合结束时清除", offTurnCard.currentAttack === offTurnCard.attack);

      const hanDang = makeCard("03101", 1, 0, 0);
      const zhenJi = makeCard("02315", 1, 2, 2); zhenJi.v2ReplacedThisTurn = new Set();
      const wuAlly = makeCard("01101", 1, 0, 1);
      const reentryGame = makeGame([hanDang, zhenJi, wuAlly]); state.game = reentryGame;
      coreDestroyV2Card(reentryGame, hanDang, [], null);
      check("甄姬重新放置不会跳过吴国摧毁效果", reentryGame.boardCards.includes(hanDang) && zhenJi.currentAttack + wuAlly.currentAttack === 5);

      const simaYi = makeCard("02314", 1, 0, 0);
      const fragileTarget = makeCard("02105", 2, 0, 1);
      const zeroTriggerGame = makeGame([simaYi, fragileTarget]); state.game = zeroTriggerGame;
      coreAdjustAttack(fragileTarget, -1, true);
      check("司马懿会响应任意减益造成的归零", !zeroTriggerGame.boardCards.includes(fragileTarget) && simaYi.currentAttack === 1);

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
      const leJinGame = makeGame([leJin]); leJinGame.players[0].v2NextPlacementExtra = leJin.uid; state.game = leJinGame;
      coreRunV2EndSkills(leJinGame, leJinGame.players[0], []);
      check("乐进的额外放置结算不会跨回合保留", !leJinGame.players[0].v2NextPlacementExtra);

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
      const aiWinGame = makeGame(aiWinningCards); aiWinGame.activePlayerId = 2; aiWinGame.players[1].hand = [makeCard("02105", 2, null, null)];
      const aiWinningAction = corePlanAiAction(aiWinGame, aiWinGame.players[1]);
      check("AI优先选择可立即达成占领胜利的放置", aiWinningAction?.type === "place");

      const tigerCavalry = makeCard("02517", 1, null, null);
      const weakTarget = makeCard("02105", 2, 1, 2);
      const strongTarget = makeCard("03416", 2, 1, 2);
      const weakTradeGame = makeGame([weakTarget]);
      const strongTradeGame = makeGame([strongTarget]);
      check("AI虎豹骑更愿意交换高战力敌军", coreAiPlacementScore(strongTradeGame, strongTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }) > coreAiPlacementScore(weakTradeGame, weakTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }));

      const imported = coreLoadCardTestSetup({
        cards: [
          { id: "01101", ownerId: 1, row: 1, col: 1, attack: 6 },
          { id: "02101", ownerId: 2, row: 2, col: 2, attack: 2 },
          { id: "03101", ownerId: 1, row: 1, col: 1, attack: 2 }
        ],
        brokenCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 0 }, { row: 1, col: 3 }]
      });
      check("Card Test 场景会以 V2 核心导入并过滤非法重叠", imported && state.game.ruleset === "core-v2" && state.game.boardCards.length === 2 && state.game.boardCards[0].attack === 6 && state.game.brokenCells.length === 5);

      const winningCards = [];
      for (let index = 0; index < 9; index += 1) winningCards.push(makeCard("02518", 1, Math.floor(index / 4), index % 4));
      const startVictoryGame = makeGame(winningCards); state.game = startVictoryGame;
      check("回合开始技能阶段会立即检查占领胜负", coreStartTurn(startVictoryGame) && startVictoryGame.winner?.playerId === 1);

      const mapSizes = [3, 4, 5].map((size) => coreCreateGame("pvp", { 1: "三国~蜀", 2: "三国~魏" }, size));
      check("3x3、4x4、5x5 地图尺寸与胜利阈值正确", mapSizes.every((map, index) => map.boardSize === index + 3 && map.boardCards.length === 2 && coreVictoryTarget(map) === [5, 9, 13][index]));
    } catch (error) {
      results.push({ name: "回归测试执行", passed: false, error: String(error) });
    } finally {
      state.game = previousGame;
    }
    return { passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length, results };
  }

  function coreRunV2CardBoundaryTests() {
    const previousGame = state.game;
    const results = [];
    const check = (id, name, condition) => results.push({ id, name, passed: Boolean(condition) });
    const makeCard = (id, ownerId, row, col) => {
      const template = window.CARD_LIBRARY?.cardSlots?.find((card) => card.id === id);
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
      { const a = makeCard("01102", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); start(g, a); check("01102", "相邻友军永久强化", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("01103", 1, 1, 1), weak = makeCard("01101", 1, 1, 0), high = makeCard("01210", 1, 1, 2), g = makeGame([a, weak, high]); start(g, a); check("01103", "仅最高相邻友军获得强化", high.currentAttack === high.attack + 1 && weak.currentAttack === weak.attack); }
      { const a = makeCard("01104", 1, 1, 1), ally = makeCard("01210", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), g = makeGame([a, ally, enemy]); start(g, a); check("01104", "相邻最高友军自动攻击", !g.boardCards.includes(enemy)); }
      { const a = makeCard("01105", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("01105", "相邻敌军触发永久强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("01106", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("01106", "随机相邻敌军获得本回合减益", enemy.currentAttack === 0); }
      { const a = makeCard("01107", 1, 1, 1), g = makeGame([a]); g.players[0].hand = Array.from({ length: 3 }, () => makeCard("01101", 1, null, null)); g.players[0].drawPile = [makeCard("01101", 1, null, null)]; start(g, a); check("01107", "手牌等于三张时仍可额外抽牌", g.players[0].hand.length === 4); }
      { const a = makeCard("01208", 1, 1, 1), ally = makeCard("01102", 1, 1, 2), target = makeCard("01101", 1, 1, 3), g = makeGame([a, ally, target]); place(g, a); check("01208", "放置时触发相邻友军的开始技能", target.currentAttack === target.attack + 1); }
      { const a = makeCard("01209", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("01209", "相邻敌军强化且可两格直线移动", a.currentAttack === a.attack + 2 && coreValidMoves(g, a).some((cell) => cell.row === 3 && cell.col === 1)); }
      { const a = makeCard("01210", 1, 1, 1), diagonal = makeCard("02105", 2, 0, 0), other = makeCard("02105", 2, 2, 1), g = makeGame([a, diagonal, other]); start(g, a); check("01210", "同行或同列敌军会被烈弓选中", diagonal.currentAttack === diagonal.attack && other.currentAttack === 0); }
      { const a = makeCard("01211", 1, 1, 1), enemyA = makeCard("02101", 2, 0, 0), enemyB = makeCard("02101", 2, 0, 1), g = makeGame([a, enemyA, enemyB]); start(g, a); check("01211", "我方卡牌较少时强化自身", a.currentAttack === a.attack + 2); }
      { const a = makeCard("01212", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("01212", "相邻敌军触发本回合强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("01313", 1, 1, 1), g = makeGame([a]); a.currentAttack = 2; start(g, a); const restoredAtStart = a.currentAttack === 4; const protectedFirst = !destroy(g, a) && a.currentAttack === 1; const destroyedSecond = destroy(g, a); check("01313", "低战力恢复且免毁仅限本回合一次", restoredAtStart && protectedFirst && destroyedSecond && !g.boardCards.includes(a)); }
      { const a = makeCard("01314", 1, 1, 1), ally = makeCard("01105", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), g = makeGame([a, ally, enemy]); start(g, a); check("01314", "其他友军开始技能额外结算", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("01315", 1, 1, 1), enemyA = makeCard("02101", 2, 0, 0), enemyB = makeCard("02101", 2, 0, 1), g = makeGame([a, enemyA, enemyB]); start(g, a); check("01315", "卡牌较少时增加行动位", g.extraActions === 1); }
      { const a = makeCard("01416", 1, 1, 1), g = makeGame([a]); start(g, a); check("01416", "回合开始强化并标记免费行动", a.currentAttack === a.attack + 2 && a.freeActionTurn === g.turn); }
      { const a = makeCard("01517", 1, 1, 1), row = makeCard("02101", 2, 1, 3), col = makeCard("02101", 2, 3, 1), diagonal = makeCard("02101", 2, 2, 2), g = makeGame([a, row, col, diagonal]); start(g, a); check("01517", "仅同行同列卡牌被永久削弱", row.currentAttack === row.attack - 1 && col.currentAttack === col.attack - 1 && diagonal.currentAttack === diagonal.attack); }
      { const a = makeCard("01518", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); const saved = !destroy(g, ally); check("01518", "代替相邻友军被摧毁", saved && !g.boardCards.includes(a) && g.boardCards.includes(ally)); }
      { const a = makeCard("01519", 1, 0, 0), ally = makeCard("01101", 1, 3, 3), g = makeGame([a, ally]); g.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("01101", 1, null, null)); start(g, a); check("01519", "满手时改为强化任意其他友军", ally.currentAttack === ally.attack + 2); }
      { const a = makeCard("01520", 1, 1, 1), g = makeGame([a]); place(g, a); check("01520", "相邻空格从下个己方回合开始占领", g.v2ControlCells.length === 4 && g.v2ControlCells.every((entry) => entry.startsAtTurn === 3)); }

      // Wei: placement, protection and movement boundaries.
      { const a = makeCard("02101", 1, 1, 1), g = makeGame([a]); g.players[0].drawPile = [makeCard("01101", 1, null, null)]; g.players[1].hand = [makeCard("02101", 2, null, null)]; place(g, a); check("02101", "手牌不多于敌方时放置抽牌", g.players[0].hand.length === 1); }
      { const a = makeCard("02102", 1, 1, 1), enemy = makeCard("01101", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("02102", "放置时永久削弱相邻敌军", enemy.currentAttack === enemy.attack - 1); }
      { const a = makeCard("02103", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); place(g, a); check("02103", "放置时强化随机相邻友军", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("02104", 1, 1, 1), left = makeCard("01101", 1, 1, 0), right = makeCard("01101", 1, 1, 2), g = makeGame([a, left, right]); place(g, a); check("02104", "放置时强化全部相邻友军", left.currentAttack === left.attack + 1 && right.currentAttack === right.attack + 1); }
      { const a = makeCard("02105", 1, 1, 1), g = makeGame([a]); g.players[0].drawPile = [makeCard("01101", 1, null, null)]; place(g, a); check("02105", "手牌未满时放置抽牌", g.players[0].hand.length === 1); }
      { const a = makeCard("02106", 1, 0, 1), g = makeGame([a]); place(g, a); check("02106", "边缘放置获得永久强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("02107", 1, 1, 1), allyA = makeCard("01101", 1, 1, 2), allyB = makeCard("01101", 1, 1, 3), g = makeGame([a, allyA, allyB]); place(g, a); check("02107", "连续连接友军获得临时强化", allyA.currentAttack === allyA.attack + 1 && allyB.currentAttack === allyB.attack + 1); }
      { const a = makeCard("02208", 1, 1, 1), g = makeGame([a]); g.players[1].hand = [makeCard("01101", 2, null, null)]; place(g, a); check("02208", "放置时敌方随机弃置手牌", g.players[1].hand.length === 0); }
      { const a = makeCard("02209", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); place(g, a); check("02209", "放置时交换相邻友军并强化双方", a.col === 2 && ally.col === 1 && a.currentAttack === a.attack + 1 && ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("02210", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); const saved = !destroy(g, ally); check("02210", "相邻高战力友军改为归零保留", saved && ally.currentAttack === 0 && g.boardCards.includes(ally)); }
      { const a = makeCard("02211", 1, 0, 0), g = makeGame([a]); check("02211", "首次主动移动允许远距离直线移动", coreValidMoves(g, a).some((cell) => cell.row === 0 && cell.col === 3)); }
      { const a = makeCard("02212", 1, 1, 1), g = makeGame([a]); place(g, a); check("02212", "放置后标记下一张友军额外结算", g.players[0].v2NextPlacementExtra === a.uid); }
      { const a = makeCard("02313", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("02313", "敌军因放置减益归零时强化自身", enemy.currentAttack === 0 && a.currentAttack === a.attack + 1); }
      { const a = makeCard("02314", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("02314", "放置后摧毁其他归零卡牌并强化自身", !g.boardCards.includes(enemy) && a.currentAttack === a.attack + 1); }
      { const a = makeCard("02315", 1, 1, 1), placed = makeCard("01101", 1, 3, 3), g = makeGame([a, placed]); coreTriggerOtherV2PlacementEffects(g, g.players[0], placed, []); check("02315", "其他友军放置时自身低于三则强化", a.currentAttack === 2); }
      { const a = makeCard("02416", 1, 1, 1), ally = makeCard("01101", 1, 3, 3), g = makeGame([a, ally]); place(g, a); coreAdjustAttack(ally, -1); check("02416", "全场强化友军且阻止我方减益", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("02517", 1, 1, 1), enemy = makeCard("01101", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("02517", "放置时与相邻敌军同时摧毁", !g.boardCards.includes(a) && !g.boardCards.includes(enemy)); }
      { const a = makeCard("02518", 1, 1, 1), g = makeGame([a]); g.players[0].hand = [makeCard("01101", 1, null, null), makeCard("01101", 1, null, null)]; g.players[0].drawPile = [makeCard("01101", 1, null, null), makeCard("01101", 1, null, null), makeCard("01101", 1, null, null)]; place(g, a); check("02518", "放置时抽牌至手牌上限", g.players[0].hand.length === HAND_LIMIT); }
      { const a = makeCard("02519", 1, 1, 1), ally = makeCard("01210", 1, 1, 2), enemy = makeCard("02105", 2, 1, 3), g = makeGame([a, ally, enemy]); place(g, a); check("02519", "相邻友军强化后自动攻击", !g.boardCards.includes(enemy) && ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("02520", 1, 1, 1), ally = makeCard("01101", 1, 2, 2), g = makeGame([a, ally]); coreTriggerOtherV2PlacementEffects(g, g.players[0], ally, []); coreRunV2MoveEffects(g, ally, { row: 2, col: 2 }, { row: 3, col: 2 }, true); check("02520", "相邻放置强化且成功离开相邻区域削弱", a.currentAttack === a.attack); }

      // Wu: V2 table effects and edge cases.
      { const a = makeCard("03101", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); check("03101", "摧毁时随机其他友军永久加一", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("03102", 1, 1, 1), watcher = makeCard("03104", 1, 1, 2), ally = makeCard("01101", 1, 1, 3), g = makeGame([a, watcher, ally]); place(g, a); check("03102", "放置时虚拟触发相邻友军摧毁效果", ally.currentAttack === ally.attack + 1 && g.boardCards.includes(watcher)); }
      { const a = makeCard("03103", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); const original = { row: ally.row, col: ally.col }; destroy(g, a); check("03103", "摧毁相邻友军并以基础战力重放到原位", g.boardCards.includes(ally) && ally.row === original.row && ally.col === original.col && ally.currentAttack === ally.attack); }
      { const a = makeCard("03104", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); check("03104", "摧毁时四方相邻友军永久加一", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("03105", 1, 1, 1), cause = makeCard("02101", 2, 1, 2), g = makeGame([a, cause]); destroy(g, a, cause); check("03105", "摧毁时仍在场的摧毁者本回合减二", cause.currentAttack === cause.attack - 2); }
      { const a = makeCard("03106", 1, 1, 1), g = makeGame([a]); place(g, a); check("03106", "放置时四方相邻空格被我方占领", g.v2ControlCells.length === 4 && coreControlMap(g).counts[1] === 5); }
      { const a = makeCard("03107", 1, 1, 1), g = makeGame([a]); g.players[1].hand = [makeCard("02101", 2, null, null)]; destroy(g, a); check("03107", "摧毁时敌方随机弃置一张手牌", g.players[1].hand.length === 0); }
      { const a = makeCard("03208", 1, 1, 1), enemyDeckCard = makeCard("02101", 2, null, null), g = makeGame([a]); g.players[1].drawPile = [enemyDeckCard]; place(g, a); const placedDraw = g.players[0].hand.includes(enemyDeckCard) && enemyDeckCard.ownerId === 1; const second = makeCard("03208", 1, 2, 2); g.boardCards.push(second); g.players[1].drawPile = [makeCard("02102", 2, null, null)]; destroy(g, second); check("03208", "放置与摧毁时从敌方牌库抽牌", placedDraw && g.players[0].hand.length === 2); }
      { const a = makeCard("03209", 1, 1, 1), enemyA = makeCard("02101", 2, 1, 0), guard = { uid: "guard-test", ownerId: null, row: 0, col: 1, currentAttack: 2, attack: 2, isGuard: true }, g = makeGame([a, enemyA, guard]); g.players[0].drawPile = [makeCard("01101", 1, null, null), makeCard("01102", 1, null, null)]; destroy(g, a); check("03209", "按相邻敌方卡牌含守军数量抽牌且不生成援兵", g.players[0].hand.length === 2 && !g.boardCards.some((card) => card.name === "援兵")); }
      { const a = makeCard("03210", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), cause = makeCard("02101", 2, 1, 3), g = makeGame([a, ally, cause]); destroy(g, a, cause); check("03210", "相邻友军本回合加二并攻击摧毁者", ally.currentAttack === ally.attack + 2 && !g.boardCards.includes(cause)); }
      { const a = makeCard("03211", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemyA = makeCard("02101", 2, 0, 0), enemyB = makeCard("02101", 2, 0, 1), g = makeGame([a, ally, enemyA, enemyB]); destroy(g, a); check("03211", "己方卡牌少于敌方时其他友军永久加一", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("03212", 1, 1, 1), ally = makeCard("01101", 2, 1, 2), g = makeGame([a, ally]); place(g, a); const converted = a.ownerId === 2 && !destroy(g, a); g.turn = 2; const destroyed = destroy(g, a); check("03212", "放置转为对方所有且本回合免毁，之后摧毁相邻友军", converted && destroyed && !g.boardCards.includes(ally)); }
      { const a = makeCard("03313", 1, 1, 1), enemy = makeCard("02105", 2, 1, 2), guard = { uid: "guard-zero", ownerId: null, row: 0, col: 1, currentAttack: 2, attack: 2, isGuard: true }, g = makeGame([a, enemy, guard]); destroy(g, a); check("03313", "所有敌方含守军本回合减二并销毁归零卡", enemy.currentAttack === 0 && !g.boardCards.includes(enemy) && guard.currentAttack === 0); }
      { const a = makeCard("03314", 1, 1, 1), g = makeGame([a]); g.players[1].drawPile = [makeCard("02101", 2, null, null), makeCard("02102", 2, null, null)]; place(g, a); const drew = a.currentAttack === a.attack + 2 && g.players[1].hand.length === 2; g.players[1].hand.push(makeCard("02103", 2, null, null)); destroy(g, a); check("03314", "敌方实际抽牌使自身加一，摧毁时仅弃牌", drew && g.players[1].hand.length === 1); }
      { const a = makeCard("03315", 1, 1, 1), enemy = makeCard("02101", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); const placementDebuff = enemy.currentAttack === enemy.attack - 2; const remote = makeCard("02102", 2, 3, 3); remote.currentAttack = 0; g.boardCards.push(remote); destroy(g, a); check("03315", "放置按两个数量条件减益，摧毁时销毁低于自身的全场敌军", placementDebuff && !g.boardCards.includes(enemy) && !g.boardCards.includes(remote)); }
      { const a = makeCard("03416", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, ally); const gained = a.currentAttack === a.attack + 1; a.currentAttack = 5; const saved = !destroy(g, a) && a.currentAttack === 2; check("03416", "友军摧毁时加一，战力大于四被摧毁时原格减三保留", gained && saved); }
      { const ship = makeCard("03517", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([ship, ally]); const original = { row: ally.row, col: ally.col }; destroy(g, ally); check("03517", "相邻友军被摧毁时楼船阵自毁并将其重放到楼船位置", !g.boardCards.includes(ship) && g.boardCards.includes(ally) && ally.row === 1 && ally.col === 1 && (original.row !== ally.row || original.col !== ally.col)); }
      { const sima = makeCard("02314", 1, 0, 0), ship = makeCard("03517", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([sima, ship, ally]); ally.v2StartTurn = 1; ally.v2StartAttack = ally.attack; ally.currentAttack = ally.attack + 1; destroy(g, ally); coreRunV2EndSkills(g, g.players[0], []); check("02314", "司马懿回合结束跳过楼船阵重放卡牌", g.boardCards.includes(ally) && ally.currentAttack === ally.attack); }
      { const a = makeCard("03518", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02101", 2, 2, 1), g = makeGame([a, ally, enemy]); destroy(g, a); check("03518", "摧毁四方相邻及原位置卡牌并生成破坏格", !g.boardCards.includes(ally) && !g.boardCards.includes(enemy) && g.brokenCells.some((cell) => cell.row === 1 && cell.col === 1)); }
      { const a = makeCard("03519", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), g = makeGame([a, ally]); start(g, a); const kept = g.boardCards.includes(a); const isolated = makeCard("03519", 1, 2, 2); const isolatedGame = makeGame([isolated]); start(isolatedGame, isolated); check("03519", "有相邻友军时不可摧毁，无友军时回合开始自毁", kept && !isolatedGame.boardCards.includes(isolated)); }
      { const a = makeCard("03520", 1, 1, 1), ally = makeCard("01101", 1, 1, 2), enemy = makeCard("02101", 2, 2, 2), g = makeGame([a, ally, enemy]); place(g, a); check("03520", "放置时全场本回合减二并增加行动数", a.currentAttack === 0 && ally.currentAttack === 0 && enemy.currentAttack === 0 && g.extraActions === 1); }
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

