const BOARD_SIZE = 4;
const INITIAL_HAND_SIZE = 3;
const HAND_LIMIT = 5;
const MAX_TURNS = 25;
const VICTORY_CONTROL_COUNT = 13;
const BROKEN_CELL_COUNT = 2;
const ACTION_ANIMATION_MS = 1200;
const ACTION_IMPACT_HOLD_MS = 280;
const BOARD_PULSE_VISIBLE_MS = 520;
const BOARD_PULSE_FADE_MS = 260;
const BOARD_PULSE_STEP_GAP_MS = 140;
let destructionAnimationSequence = 0;

const GAME_CARD_SLOT_TEMPLATES = window.CARD_LIBRARY?.cardSlots || [];
const GAME_CAMP_NAME_POOL = window.CARD_LIBRARY?.campNamePool || {};

const ui = {
  screens: {
    menu: document.getElementById("menu-screen"),
    game: document.getElementById("game-screen"),
    result: document.getElementById("result-screen")
  },
  toastContainer: document.getElementById("toast-container"),
  phaseBanner: document.getElementById("phase-banner"),
  deckReveal: document.getElementById("deck-reveal"),
  playerIdModal: document.getElementById("player-id-modal"),
  playerIdValue: document.getElementById("player-id-value"),
  editPlayerIdBtn: document.getElementById("edit-player-id-btn"),
  modeButtons: [...document.querySelectorAll(".mode-btn")],
  mapButtons: [...document.querySelectorAll(".map-btn")],
  startGameBtn: document.getElementById("start-game-btn"),
  modeLabel: document.getElementById("mode-label"),
  turnLabel: document.getElementById("turn-label"),
  phaseLabel: document.getElementById("phase-label"),
  deckLabel: document.getElementById("deck-label"),
  statusMessage: document.getElementById("status-message"),
  statusSubtext: document.getElementById("status-subtext"),
  actingPlayerLabel: document.getElementById("acting-player-label"),
  actionsLabel: document.getElementById("actions-label"),
  player1Control: document.getElementById("player1-control"),
  player2Control: document.getElementById("player2-control"),
  player1Summary: document.getElementById("player1-summary"),
  player2Summary: document.getElementById("player2-summary"),
  selectionSummary: document.getElementById("selection-summary"),
  detailRarity: document.getElementById("detail-rarity"),
  detailName: document.getElementById("detail-name"),
  detailSkill: document.getElementById("detail-skill"),
  detailSummary: document.getElementById("detail-summary"),
  detailTags: document.getElementById("detail-tags"),
  detailLines: document.getElementById("detail-lines"),
  actionLogTurn: document.getElementById("action-log-turn"),
  actionLogList: document.getElementById("action-log-list"),
  boardStage: document.getElementById("board-stage"),
  boardAnimationLayer: document.getElementById("board-animation-layer"),
  board: document.getElementById("board"),
  handTitle: document.getElementById("hand-title"),
  handCards: document.getElementById("hand-cards"),
  submitActionBtn: document.getElementById("submit-action-btn"),
  cancelSelectionBtn: document.getElementById("cancel-selection-btn"),
  restartBtn: document.getElementById("restart-btn"),
  backMenuBtn: document.getElementById("back-menu-btn"),
  winnerTitle: document.getElementById("winner-title"),
  winnerSubtitle: document.getElementById("winner-subtitle"),
  winnerControlSummary: document.getElementById("winner-control-summary"),
  winnerComparison: document.getElementById("winner-comparison"),
  deckSummaryPlayer1: document.getElementById("deck-summary-player1"),
  deckSummaryPlayer2: document.getElementById("deck-summary-player2"),
  resultRestartBtn: document.getElementById("result-restart-btn"),
  resultMenuBtn: document.getElementById("result-menu-btn")
};

const state = {
  selectedMode: "pvp",
  selectedBoardSize: 4,
  playerName: "",
  selectedDecks: { 1: null, 2: null },
  game: null,
  online: { playerId: null, roomCode: null, host: false }
};

function getCampDisplayName(campKey) {
  return campKey.replace("~", "·");
}

function makeCardTemplate(campKey, slot, index) {
  const quality = slot.rarity || (index < 7 ? "普通" : index < 12 ? "稀有" : index < 15 ? "史诗" : index === 15 ? "传说" : "特殊");
  return {
    id: slot.id || `${campKey}-${String(index + 1).padStart(2, "0")}`,
    name: slot.name || GAME_CAMP_NAME_POOL[campKey]?.[index] || "未命名卡牌",
    type: slot.type || "普通",
    camp: slot.camp || campKey,
    quality,
    rarity: quality,
    attack: slot.attack,
    skill: slot.skill || "无",
    summary: slot.summary || slot.skill || "无技能。",
    effectId: slot.effectId || "none",
    effect: slot.effect || "无",
    image: slot.image || null
  };
}

function cloneCard(template) {
  return {
    ...template,
    uid: `${template.id}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId: null,
    currentAttack: template.attack,
    buffCap: template.attack,
    movesTaken: 0,
    isSpecial: template.rarity === "特殊",
    hasPlaced: false
  };
}

function buildCampDeck(campKey) {
  const directCards = GAME_CARD_SLOT_TEMPLATES.filter((slot) => slot.camp === campKey);
  if (directCards.length > 0) {
    return directCards.map((slot, index) => cloneCard(makeCardTemplate(campKey, slot, index)));
  }
  return GAME_CARD_SLOT_TEMPLATES.map((slot, index) => cloneCard(makeCardTemplate(campKey, slot, index)));
}

function createPlayer(id, name, deckKey, deckCatalog, isAI = false) {
  return {
    id,
    name,
    deckKey,
    deckCatalog,
    drawPile: shuffle(deckCatalog.map((card) => ({ ...card }))),
    hand: [],
    boardCardIds: [],
    submittedActions: [],
    lastControlCount: 0,
    isAI
  };
}

function createGame(mode, selectedDecks) {
  const player1Catalog = buildCampDeck(selectedDecks[1]);
  const player2Catalog = buildCampDeck(selectedDecks[2]);
  const player2Name = mode === "pve" ? "AI" : "玩家 2";
  const game = {
    mode,
    turn: 1,
    currentPhase: "准备阶段",
    boardSize: BOARD_SIZE,
    boardCards: [],
    brokenCells: pickBrokenCells(),
    moveLocks: {},
    players: [
      createPlayer(1, "玩家 1", selectedDecks[1], player1Catalog, false),
      createPlayer(2, player2Name, selectedDecks[2], player2Catalog, mode === "pve")
    ],
    activePlannerIndex: 0,
    placeLockTurn: { 1: 0, 2: 0 },
    plannedActions: {},
    selection: resetSelection(),
    lastResolution: `对局开始。玩家 1 使用${getCampDisplayName(selectedDecks[1])}，${player2Name}使用${getCampDisplayName(selectedDecks[2])}。双方将从各自携带的20张牌库中抽牌并秘密提交行动。`,
    winner: null,
    isAnimating: false,
    effectBoardCards: null,
    processingRealtime: false,
    pendingAnimations: [],
    consumedDestructionAnimationIds: new Set(),
    flowPrompt: "",
    roundLog: [],
    lastResolvedTurn: 0
  };

  for (let i = 0; i < INITIAL_HAND_SIZE; i += 1) {
    game.players.forEach((player) => drawOneCard(game, player));
  }
  game.currentPhase = "行动阶段";
  return game;
}

function resetSelection() {
  return { handCardUid: null, boardCardUid: null, targetCell: null };
}

function getExtraActionCount(game, playerId) {
  return getGlobalExtraActionCount(game, playerId) + getPersonalExtraActionCardUids(game, playerId).length;
}

function getGlobalExtraActionCount(game, playerId) {
  let extra = 0;
  const plannedActions = getSubmittedActions(game, playerId);
  game.boardCards.forEach((card) => {
    if (card.ownerId !== playerId) {
      return;
    }
    if (isCard(card, "0216") && getAlliedCards(game, playerId).length < 5) {
      extra += 1;
    }
  });
  plannedActions.forEach((action) => {
    if (action.type !== "place") {
      return;
    }
    const placedCard = getCardByUid(game, action.cardUid);
    if (placedCard && isCard(placedCard, "0205")) {
      extra += 1;
    }
  });
  return extra;
}

function getPersonalExtraActionCardUids(game, playerId) {
  return game.boardCards
    .filter((card) => card.ownerId === playerId && (isCard(card, "0116") || isCard(card, "0305")))
    .map((card) => card.uid);
}

function countPersonalExtraActions(game, playerId, actions) {
  const personalSet = new Set(getPersonalExtraActionCardUids(game, playerId));
  return actions.filter((action) => personalSet.has(action.cardUid)).length;
}

function getActionLimit(game, playerId) {
  return 1 + getExtraActionCount(game, playerId);
}

function getSubmittedActions(game, playerId) {
  return Array.isArray(game.plannedActions[playerId]) ? game.plannedActions[playerId] : [];
}

function hasFinishedPlanning(game, playerId) {
  return getSubmittedActions(game, playerId).length >= getActionLimit(game, playerId);
}

function pickBrokenCells() {
  const blocked = [];
  while (blocked.length < BROKEN_CELL_COUNT) {
    const row = randomInt(0, BOARD_SIZE - 1);
    const col = randomInt(0, BOARD_SIZE - 1);
    if (!blocked.some((cell) => cell.row === row && cell.col === col)) {
      blocked.push({ row, col });
    }
  }
  return blocked;
}

function createReinforcementCard(playerId) {
  return {
    id: `reinforcement-${Math.random().toString(36).slice(2, 8)}`,
    uid: `reinforcement-${Math.random().toString(36).slice(2, 10)}`,
    name: "援兵",
    type: "援",
    camp: "无势力",
    quality: "援兵",
    rarity: "援兵",
    attack: 1,
    currentAttack: 1,
    skill: "无",
    effectId: "none",
    effect: "无技能。",
    image: null,
    ownerId: playerId,
    buffCap: 1,
    movesTaken: 0,
    isSpecial: false,
    hasPlaced: false
  };
}

function drawOneCard(_game, player) {
  if (player.hand.length >= HAND_LIMIT) {
    return { status: "hand-full" };
  }
  if (player.drawPile.length === 0) {
    return { status: "deck-empty" };
  }
  const drawnCard = player.drawPile.shift();
  drawnCard.ownerId = player.id;
  player.hand.push(drawnCard);
  return { status: "drawn" };
}

function drawCardsToHandLimit(game, player) {
  let result = { status: "skipped" };
  while (player.hand.length < HAND_LIMIT) {
    result = drawOneCard(game, player);
    if (result.status !== "drawn" && result.status !== "reinforcement") {
      break;
    }
  }
  return result;
}

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function switchScreen(name) {
  Object.entries(ui.screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
}

function getAvailableDeckKeys() {
  return [...new Set(GAME_CARD_SLOT_TEMPLATES.map((slot) => slot.camp).filter(Boolean))];
}

function getRandomDeckKey(excluded = []) {
  const pool = getAvailableDeckKeys().filter((campKey) => !excluded.includes(campKey));
  const source = pool.length > 0 ? pool : getAvailableDeckKeys();
  return source[randomInt(0, source.length - 1)];
}

function startRandomGame(mode) {
  state.selectedMode = mode;
  state.game = null;
  const playerOneDeck = getRandomDeckKey();
  state.selectedDecks = {
    1: playerOneDeck,
    2: getRandomDeckKey([playerOneDeck])
  };
  beginGame();
}

function beginGame() {
  state.game = createGame(state.selectedMode, state.selectedDecks);
  switchScreen("game");
  updateCurrentPlannerForMode();
  render();
  showDeckReveal(state.game);
  maybeAutoPlanAI();
}

function showDeckReveal(game) {
  const [playerOne, playerTwo] = game.players;
  ui.deckReveal.innerHTML = `
    <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="本局随机卡组">
      <p class="phase-banner-eyebrow">Random Matchup</p>
      <h2 class="deck-reveal-title">本局卡组已确定</h2>
      <p class="deck-reveal-copy">双方随机获得不同势力的 20 张卡组。</p>
      <div class="deck-reveal-matchup">
        <article class="deck-reveal-side">
          <p class="label">${playerOne.name}</p>
          <h3>${getCampDisplayName(playerOne.deckKey)}</h3>
          <p>${summarizeDeck(playerOne.deckCatalog, playerOne.deckKey)}</p>
        </article>
        <div class="deck-reveal-versus">VS</div>
        <article class="deck-reveal-side">
          <p class="label">${playerTwo.name}</p>
          <h3>${getCampDisplayName(playerTwo.deckKey)}</h3>
          <p>${summarizeDeck(playerTwo.deckCatalog, playerTwo.deckKey)}</p>
        </article>
      </div>
      <button id="deck-reveal-start-btn" class="primary-btn">进入第一回合</button>
    </section>
  `;
  ui.deckReveal.classList.add("visible");
  document.getElementById("deck-reveal-start-btn").addEventListener("click", () => {
    ui.deckReveal.classList.remove("visible");
    window.setTimeout(() => {
      ui.deckReveal.innerHTML = "";
      showPhaseBanner("准备完成", `第 1 / ${MAX_TURNS} 回合开始，双方从各自牌库进入行动规划。`);
    }, 220);
  });
}

function updateCurrentPlannerForMode() {
  const game = state.game;
  if (!game) {
    return;
  }
  if (game.mode === "pvp") {
    if (!hasFinishedPlanning(game, 1)) {
      game.activePlannerIndex = 0;
      return;
    }
    if (!hasFinishedPlanning(game, 2)) {
      game.activePlannerIndex = 1;
      return;
    }
  }
  game.activePlannerIndex = 0;
}

function getPlannerPlayer(game) {
  return game.players[game.activePlannerIndex];
}

function otherPlayerId(playerId) {
  return playerId === 1 ? 2 : 1;
}

function cellKey(row, col) {
  return `${row},${col}`;
}

function isBrokenCell(game, row, col) {
  return game.brokenCells.some((cell) => cell.row === row && cell.col === col);
}

function getBoardCardAt(game, row, col) {
  const boardCards = game.effectBoardCards || game.boardCards;
  return boardCards.find((card) => card.row === row && card.col === col) || null;
}

function getActiveBoardCards(game) {
  if (!game) {
    return [];
  }
  return game.effectBoardCards || game.boardCards || [];
}

function cardHasEffect(_card, _effectId) {
  return false;
}

function isCard(card, id) {
  return card?.id === id;
}

function hasSkillText(card, text) {
  return typeof card?.effect === "string" && card.effect.includes(text);
}

function getPlayer(game, playerId) {
  return game.players.find((player) => player.id === playerId) || null;
}

function getEnemyCards(game, ownerId) {
  const boardCards = game.effectBoardCards || game.boardCards;
  return boardCards.filter((card) => card.ownerId !== ownerId);
}

function getAlliedCards(game, ownerId) {
  const boardCards = game.effectBoardCards || game.boardCards;
  return boardCards.filter((card) => card.ownerId === ownerId);
}

function getEightNeighbors(row, col) {
  const cells = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      cells.push({ row: row + dr, col: col + dc });
    }
  }
  return cells;
}

function getDiagonalNeighbors(row, col) {
  return [
    { row: row - 1, col: col - 1 },
    { row: row - 1, col: col + 1 },
    { row: row + 1, col: col - 1 },
    { row: row + 1, col: col + 1 }
  ];
}

function countAdjacentAllies(game, card) {
  return getOrthogonalNeighbors(card.row, card.col).filter((cell) => {
    const target = getBoardCardAt(game, cell.row, cell.col);
    return target && target.ownerId === card.ownerId;
  }).length;
}

function countAdjacentEnemies(game, card) {
  return getOrthogonalNeighbors(card.row, card.col).filter((cell) => {
    const target = getBoardCardAt(game, cell.row, cell.col);
    return target && target.ownerId !== card.ownerId;
  }).length;
}

function getAdjacentFriendlySources(game, card, effectId) {
  return getOrthogonalNeighbors(card.row, card.col).map((cell) => {
    const target = getBoardCardAt(game, cell.row, cell.col);
    return target && target.ownerId === card.ownerId && cardHasEffect(target, effectId) ? target : null;
  }).filter(Boolean);
}

function getsResonanceAura(game, card) {
  return getOrthogonalNeighbors(card.row, card.col).some((cell) => {
    const target = getBoardCardAt(game, cell.row, cell.col);
    return target && target.ownerId === card.ownerId && cardHasEffect(target, "resonance");
  });
}

function getLegendCount(game, ownerId) {
  return game.boardCards.filter((card) => card.ownerId === ownerId && card.rarity === "传说").length;
}

function getEmptyCells(game) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!isBrokenCell(game, row, col) && !getBoardCardAt(game, row, col)) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function getAdjacentEmptyCells(game, row, col, diagonal = false) {
  const neighbors = diagonal ? getEightNeighbors(row, col) : getOrthogonalNeighbors(row, col);
  return neighbors.filter((cell) => isInsideBoard(cell.row, cell.col) && !isBrokenCell(game, cell.row, cell.col) && !getBoardCardAt(game, cell.row, cell.col));
}

function findNearestCardInDirections(game, card) {
  const result = [];
  getOrthogonalNeighbors(card.row, card.col).forEach((neighbor) => {
    const stepRow = Math.sign(neighbor.row - card.row);
    const stepCol = Math.sign(neighbor.col - card.col);
    let row = neighbor.row;
    let col = neighbor.col;
    while (isInsideBoard(row, col) && !isBrokenCell(game, row, col)) {
      const target = getBoardCardAt(game, row, col);
      if (target) {
        result.push({
          card: target,
          direction: { row: stepRow, col: stepCol }
        });
        break;
      }
      row += stepRow;
      col += stepCol;
    }
  });
  return result;
}

function chooseZhouYuDuelTarget(game, target, zhouYuCard) {
  const nearby = getEightNeighbors(target.row, target.col)
    .map((cell) => getBoardCardAt(game, cell.row, cell.col))
    .filter((item) => item && item.uid !== target.uid);
  if (nearby.length === 0) {
    return null;
  }
  const nonZhouYuTargets = nearby.filter((item) => item.uid !== zhouYuCard.uid);
  if (nonZhouYuTargets.length === 0) {
    return null;
  }
  return nonZhouYuTargets[randomInt(0, nonZhouYuTargets.length - 1)] || null;
}

function moveCardToEmpty(game, boardCards, card, preferredCells) {
  const options = preferredCells.filter((cell) => isInsideBoard(cell.row, cell.col) && !isBrokenCell(game, cell.row, cell.col) && !boardCards.find((target) => target.uid !== card.uid && target.row === cell.row && target.col === cell.col));
  if (options.length === 0) {
    return false;
  }
  const target = options[randomInt(0, options.length - 1)];
  card.row = target.row;
  card.col = target.col;
  return true;
}

function adjustCardAttack(card, delta) {
  const game = state.game;
  const boardCards = game?.effectBoardCards || game?.boardCards || [];
  if (!card || !game || delta === 0) {
    return;
  }
  const currentValue = typeof card.currentAttack === "number" ? card.currentAttack : card.attack;
  const meta = arguments[2] || {};
  if (delta < 0 && !meta.redirected) {
    const zhoucang = boardCards.find((unit) => (
      unit.uid !== card.uid
      && unit.ownerId === card.ownerId
      && isCard(unit, "0103")
      && Math.abs(unit.row - card.row) + Math.abs(unit.col - card.col) === 1
    ));
    if (zhoucang) {
      adjustCardAttack(zhoucang, delta, { ...meta, redirected: true, allowReflection: false });
      return;
    }
  }
  if (game && delta < 0) {
    const blocked = boardCards.some((unit) => isCard(unit, "0118") && unit.ownerId === card.ownerId);
    if (blocked) {
      return;
    }
    if (boardCards.some((unit) => isCard(unit, "0215"))) {
      delta -= 1;
    }
  }
  if (game && delta > 0) {
    const blocked = boardCards.some((unit) => isCard(unit, "0118") && unit.ownerId !== card.ownerId);
    if (blocked) {
      return;
    }
    if (boardCards.some((unit) => isCard(unit, "0215") && unit.ownerId === card.ownerId)) {
      delta += 1;
    }
  }
  card.currentAttack = currentValue + delta;
  if (meta.allowTriggeredEffects === false) {
    return;
  }
  if (delta > 0 && meta.allowEcho !== false) {
    const adjacentSunCe = boardCards.filter((unit) => (
      unit.uid !== card.uid
      && isCard(unit, "0316")
      && Math.abs(unit.row - card.row) + Math.abs(unit.col - card.col) === 1
    ));
    adjacentSunCe.forEach((unit) => {
      adjustCardAttack(unit, delta, { allowTriggeredEffects: false, allowEcho: false });
    });
    const pangTongOwners = [...new Set(boardCards.filter((unit) => isCard(unit, "0115")).map((unit) => unit.ownerId))];
    pangTongOwners.forEach((ownerId) => {
      const candidateAllies = getOrthogonalNeighbors(card.row, card.col)
        .map((cell) => boardCards.find((unit) => unit.row === cell.row && unit.col === cell.col))
        .filter((unit) => unit && unit.ownerId === ownerId);
      if (candidateAllies.length > 0) {
        const target = candidateAllies[randomInt(0, candidateAllies.length - 1)];
        adjustCardAttack(target, delta, { allowTriggeredEffects: false, allowEcho: false });
      }
    });
  }
  if (delta < 0 && meta.allowReflection !== false) {
    const hasPangTong = boardCards.some((unit) => isCard(unit, "0115") && unit.ownerId === card.ownerId);
    if (hasPangTong) {
      getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
        const enemy = boardCards.find((unit) => unit.row === cell.row && unit.col === cell.col);
        if (enemy && enemy.ownerId !== card.ownerId) {
          adjustCardAttack(enemy, delta, { allowTriggeredEffects: false, allowReflection: false });
        }
      });
    }
  }
}

function addCardToHand(player, card) {
  card.row = undefined;
  card.col = undefined;
  card.ownerId = player.id;
  player.hand.push(card);
}

function createCampToken(playerId, camp, name, attack, effect = "无") {
  return {
    id: `token-${camp}-${Math.random().toString(36).slice(2, 8)}`,
    uid: `token-${Math.random().toString(36).slice(2, 10)}`,
    name,
    type: "援",
    camp,
    quality: "衍生",
    rarity: "衍生",
    attack,
    currentAttack: attack,
    skill: "无",
    effectId: "none",
    effect,
    image: null,
    ownerId: playerId,
    buffCap: attack,
    movesTaken: 0,
    isSpecial: false,
    hasPlaced: true
  };
}

function isCornerCell(row, col) {
  return (row === 0 || row === BOARD_SIZE - 1) && (col === 0 || col === BOARD_SIZE - 1);
}

function isEdgeCell(row, col) {
  return row === 0 || row === BOARD_SIZE - 1 || col === 0 || col === BOARD_SIZE - 1;
}

function getLowestAttackEnemy(game, ownerId, row, col, orthOnly = false) {
  const cells = orthOnly ? getOrthogonalNeighbors(row, col) : getEightNeighbors(row, col);
  const enemies = cells
    .map((cell) => getBoardCardAt(game, cell.row, cell.col))
    .filter((card) => card && card.ownerId !== ownerId);
  if (enemies.length === 0) {
    return null;
  }
  enemies.sort((a, b) => resolveAttackValue(game, a) - resolveAttackValue(game, b));
  return enemies[0];
}

function getOrthogonalNeighbors(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ];
}

function makeVirtualCard(card, position) {
  return position ? { ...card, row: position.row, col: position.col } : card;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function getCardByUid(game, uid) {
  for (const player of game.players) {
    const inHand = player.hand.find((card) => card.uid === uid);
    if (inHand) {
      return inHand;
    }
  }
  return game.boardCards.find((card) => card.uid === uid) || null;
}

function getValidMoves(game, card) {
  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 }
  ];
  if (isCard(card, "0111") && resolveAttackValue(game, card) > 1) {
    directions.push(
      { row: -1, col: -1 },
      { row: -1, col: 1 },
      { row: 1, col: -1 },
      { row: 1, col: 1 }
    );
  }
  const validMoves = [];
  const maxRange = (
    isCard(card, "0106")
    || isCard(card, "0211")
    || (isCard(card, "0111") && resolveAttackValue(game, card) > 2)
  ) ? BOARD_SIZE : 1;

  if (
    isCard(card, "0206")
    || ((isCard(card, "0102")) && resolveAttackValue(game, card) > 0)
    || isCard(card, "0320")
    || isCard(card, "0120")
    || isCard(card, "0220")
  ) {
    return [];
  }

  directions.forEach((direction) => {
    for (let step = 1; step <= maxRange; step += 1) {
      const targetRow = card.row + direction.row * step;
      const targetCol = card.col + direction.col * step;
      if (!isInsideBoard(targetRow, targetCol) || isBrokenCell(game, targetRow, targetCol)) {
        break;
      }
      const occupyingCard = getBoardCardAt(game, targetRow, targetCol);
      if (occupyingCard && occupyingCard.ownerId === card.ownerId) {
        if (isCard(card, "0209")) {
          validMoves.push({ row: targetRow, col: targetCol });
        }
        break;
      }
      validMoves.push({ row: targetRow, col: targetCol });
      if (occupyingCard && !isCard(card, "0109")) {
        break;
      }
    }
  });

  if (isCard(card, "0109")) {
    return validMoves.filter((cell) => Math.abs(cell.row - card.row) + Math.abs(cell.col - card.col) >= 2);
  }

  return validMoves;
}

function isBlockedByEnemyAdjacency(game, playerId, row, col) {
  const neighbors = [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ];
  return neighbors.every((cell) => {
    if (!isInsideBoard(cell.row, cell.col)) {
      return true;
    }
    if (isBrokenCell(game, cell.row, cell.col)) {
      return true;
    }
    const card = getBoardCardAt(game, cell.row, cell.col);
    return card && card.ownerId === otherPlayerId(playerId);
  });
}

function getPlaceableCells(game) {
  const player = getPlannerPlayer(game);
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const blockedByFire = game.boardCards.some((card) => isCard(card, "0320") && getEightNeighbors(card.row, card.col).some((cell) => cell.row === row && cell.col === col));
      if (blockedByFire) {
        continue;
      }
      if (!isBrokenCell(game, row, col) && !getBoardCardAt(game, row, col) && !isBlockedByEnemyAdjacency(game, player.id, row, col)) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

function drawPhase(game) {
  game.currentPhase = "抽牌阶段";
  game.players.forEach((player) => {
    game.boardCards.forEach((card) => {
      if (card.ownerId !== player.id) {
        return;
      }
      if (isCard(card, "0107")) {
        drawOneCard(game, player);
      }
      if (isCard(card, "0218")) {
        drawCardsToHandLimit(game, player);
      }
      if (isCard(card, "0319")) {
        const before = player.hand.length;
        const result = drawOneCard(game, player);
        if (result.status === "drawn") {
          const drawn = player.hand[player.hand.length - 1];
          if (drawn && player.hand.length > before) {
            adjustCardAttack(drawn, 1);
          }
        }
      }
    });
  });
  const results = game.players.map((player) => ({ playerId: player.id, result: drawOneCard(game, player) }));
  const fullPlayers = results.filter((item) => item.result.status === "hand-full").map((item) => playerName(game, item.playerId));
  if (fullPlayers.length > 0) {
    game.lastResolution += ` ${fullPlayers.join("、")} 手牌已满 ${HAND_LIMIT} 张，跳过本回合抽牌。`;
    fullPlayers.forEach((name) => showToast("手牌已满", `${name} 当前已有 ${HAND_LIMIT} 张手牌，本回合不会再抽牌。`));
  }
  const reinforcementPlayers = results.filter((item) => item.result.status === "reinforcement").map((item) => playerName(game, item.playerId));
  if (reinforcementPlayers.length > 0) {
    game.lastResolution += ` ${reinforcementPlayers.join("、")} 的牌库已空，改为抽取了无势力、无技能、战力 1 的援兵。`;
    reinforcementPlayers.forEach((name) => showToast("援兵加入", `${name} 的牌库已空，本回合改为抽取 1 张战力 1 的援兵。`));
  }
  if (game.turn >= MAX_TURNS) {
    finishGameByTurnLimit(game);
    return true;
  }
  return false;
}

function applyStartTurnEffects(game, boardCards, actionLog) {
  game.currentPhase = "准备阶段";
  [...boardCards].forEach((card) => {
    if (!boardCards.find((item) => item.uid === card.uid)) {
      return;
    }
    if (isCard(card, "0104")) {
      const allies = getOrthogonalNeighbors(card.row, card.col)
        .map((cell) => getBoardCardAt({ ...game, boardCards }, cell.row, cell.col))
        .filter((ally) => ally && ally.ownerId === card.ownerId);
      allies.forEach((ally) => adjustCardAttack(ally, 1));
      if (allies.length > 0) {
        const targetNames = allies.map((ally) => ally.name).join("、");
        const effectText = `对相邻友军 ${targetNames} 使用，使他们战力+1。`;
        actionLog.push(`${card.name} 在准备阶段以${card.skill}${effectText}`);
        queueSkillAnimation(game, card, effectText);
      }
    }
  });
}

function resolveAttackValue(game, card, targetCard = null, context = {}) {
  const selfCard = makeVirtualCard(card, context.selfPosition);
  let value = typeof selfCard.currentAttack === "number" ? selfCard.currentAttack : selfCard.attack;
  if (!game || typeof selfCard.row !== "number" || typeof selfCard.col !== "number") {
    return value;
  }
  const defender = targetCard ? makeVirtualCard(targetCard, context.targetPosition) : null;
  const duel = context.mode === "duel";
  const attack = context.mode === "attack";

  if (isCard(selfCard, "0202") && (attack || duel)) {
    value += 1;
  }
  if (isCard(selfCard, "0108") && (attack || duel) && defender) {
    const defenderValue = typeof defender.currentAttack === "number" ? defender.currentAttack : defender.attack;
    if (value === defenderValue) {
      value += 1;
    }
  }
  if (isCard(selfCard, "0212") && duel) {
    const duelSelf = context.selfPosition ? makeVirtualCard(selfCard, context.selfPosition) : selfCard;
    value += countAdjacentEnemies(game, duelSelf);
  }
  if (isCard(selfCard, "0116") && duel) {
    value = Math.max(value, 999);
  }
  if (isCard(selfCard, "0316") && context.isDefender) {
    value -= 4;
  }
  return value;
}

function resolveConflict(game, cardA, cardB, context = {}) {
  const mode = context.mode || "duel";
  if (mode === "attack") {
    if (context.defenderUid === cardA.uid && isCard(cardA, "0316")) {
      adjustCardAttack(cardA, -4);
    }
    if (context.defenderUid === cardB.uid && isCard(cardB, "0316")) {
      adjustCardAttack(cardB, -4);
    }
  }
  if (isCard(cardA, "0206") && mode === "attack" && context.defenderUid === cardA.uid) {
    return "a";
  }
  if (isCard(cardB, "0206") && mode === "attack" && context.defenderUid === cardB.uid) {
    return "b";
  }
  const attackA = resolveAttackValue(game, cardA, cardB, { selfPosition: context.positionA, targetPosition: context.positionB, mode, isDefender: context.defenderUid === cardA.uid });
  const attackB = resolveAttackValue(game, cardB, cardA, { selfPosition: context.positionB, targetPosition: context.positionA, mode, isDefender: context.defenderUid === cardB.uid });
  if ((isCard(cardA, "0217") || isCard(cardB, "0217") || isCard(cardA, "0318") || isCard(cardB, "0318")) && (mode === "attack" || mode === "duel")) {
    return "both";
  }
  if (isCard(cardA, "0113") && (mode === "attack" || mode === "duel")) {
    adjustCardAttack(cardA, -1);
    return "a";
  }
  if (isCard(cardB, "0113") && (mode === "attack" || mode === "duel")) {
    adjustCardAttack(cardB, -1);
    return "b";
  }
  if (isCard(cardA, "0108") && (mode === "attack" || mode === "duel") && attackA < attackB) {
    return "both";
  }
  if (isCard(cardB, "0108") && (mode === "attack" || mode === "duel") && attackB < attackA) {
    return "both";
  }
  if (attackA < 0 && attackB < 0) {
    return "both";
  }
  if (attackA < 0) {
    return "b";
  }
  if (attackB < 0) {
    return "a";
  }
  if (attackA > attackB) {
    return "a";
  }
  if (attackB > attackA) {
    return "b";
  }
  return "both";
}

function removeNegativeAttackCards(game, boardCards, actionLog) {
  const removed = [];
  for (let index = boardCards.length - 1; index >= 0; index -= 1) {
    const card = boardCards[index];
    const finalAttack = resolveAttackValue({ ...game, boardCards }, card);
    if (finalAttack < 0) {
      removed.push(`${describeCard(game, card)} 的最终战力降到 ${finalAttack}，已被直接摧毁。`);
      queueDestructionAnimation(game, card, "战力降至负数", "negative");
      boardCards.splice(index, 1);
    }
  }
  if (removed.length > 0) {
    actionLog.push(...removed.reverse());
  }
}

function discardRandomHandCard(game, playerId, count = 1, actionLog = []) {
  const player = getPlayer(game, playerId);
  if (!player) {
    return [];
  }
  const discarded = [];
  for (let i = 0; i < count; i += 1) {
    if (player.hand.length === 0) {
      break;
    }
    const index = randomInt(0, player.hand.length - 1);
    const [card] = player.hand.splice(index, 1);
    if (card) {
      discarded.push(card);
      if (isCard(card, "0301") || isCard(card, "0305")) {
        const empty = getEmptyCells(game);
        if (empty.length > 0) {
          const target = empty[randomInt(0, empty.length - 1)];
          card.row = target.row;
          card.col = target.col;
          card.ownerId = player.id;
          game.boardCards.push(card);
        }
      }
      if (isCard(card, "0308")) {
        const empty = getEmptyCells(game);
        if (empty.length > 0) {
          const target = empty[randomInt(0, empty.length - 1)];
          card.row = target.row;
          card.col = target.col;
          card.ownerId = player.id;
          adjustCardAttack(card, 2);
          game.boardCards.push(card);
        }
      }
      if (isCard(card, "0311")) {
        const selfEmpty = getEmptyCells(game);
        if (selfEmpty.length > 0) {
          const target = selfEmpty[randomInt(0, selfEmpty.length - 1)];
          card.row = target.row;
          card.col = target.col;
          card.ownerId = player.id;
          game.boardCards.push(card);
        }
      }
      if (isCard(card, "0312")) {
        const enemies = getEnemyCards(game, player.id);
      if (enemies.length > 0) {
        const targetEnemy = enemies[randomInt(0, enemies.length - 1)];
        const cells = getAdjacentEmptyCells(game, targetEnemy.row, targetEnemy.col);
        if (cells.length > 0) {
          const target = cells[randomInt(0, cells.length - 1)];
          card.row = target.row;
          card.col = target.col;
          card.ownerId = otherPlayerId(player.id);
          game.boardCards.push(card);
        }
      }
    }
      actionLog.push(`${player.name} 弃置了 ${card.name}。`);
    }
  }
  return discarded;
}

function discardRandomHandCard(game, playerId, count = 1, actionLog = []) {
  const player = getPlayer(game, playerId);
  if (!player) {
    return [];
  }
  const discarded = [];
  for (let i = 0; i < count; i += 1) {
    if (player.hand.length === 0) {
      break;
    }
    const boardCardsBeforeDiscard = [...game.boardCards];
    const index = randomInt(0, player.hand.length - 1);
    const [card] = player.hand.splice(index, 1);
    if (!card) {
      continue;
    }
    discarded.push(card);
    if (isCard(card, "0301") || isCard(card, "0305")) {
      const empty = getEmptyCells(game);
      if (empty.length > 0) {
        const target = empty[randomInt(0, empty.length - 1)];
        card.row = target.row;
        card.col = target.col;
        card.ownerId = player.id;
        game.boardCards.push(card);
      }
    }
    if (isCard(card, "0308")) {
      const empty = getEmptyCells(game);
      if (empty.length > 0) {
        const target = empty[randomInt(0, empty.length - 1)];
        card.row = target.row;
        card.col = target.col;
        card.ownerId = player.id;
        adjustCardAttack(card, 2);
        game.boardCards.push(card);
      }
    }
    if (isCard(card, "0311")) {
      const selfEmpty = getEmptyCells(game);
      if (selfEmpty.length > 0) {
        const target = selfEmpty[randomInt(0, selfEmpty.length - 1)];
        card.row = target.row;
        card.col = target.col;
        card.ownerId = player.id;
        game.boardCards.push(card);
      }
    }
    if (isCard(card, "0312")) {
      const enemies = getEnemyCards(game, player.id);
      if (enemies.length > 0) {
        const targetEnemy = enemies[randomInt(0, enemies.length - 1)];
        const cells = getAdjacentEmptyCells(game, targetEnemy.row, targetEnemy.col);
        if (cells.length > 0) {
          const target = cells[randomInt(0, cells.length - 1)];
          card.row = target.row;
          card.col = target.col;
          // 黄盖落地后归被选敌军所属玩家控制；其基础势力 camp 保持三国~吴不变。
          card.ownerId = targetEnemy.ownerId;
          card.hasPlaced = true;
          game.boardCards.push(card);
          actionLog.push(`${card.name} 被弃置后落在 ${formatCell(target.row, target.col)}，并转换为${playerName(game, targetEnemy.ownerId)}的卡牌。`);
        }
      }
    }
    actionLog.push(`${player.name} 弃置了 ${card.name}。`);
    boardCardsBeforeDiscard.forEach((boardCard) => {
      if (isCard(boardCard, "0311") && boardCard.ownerId === player.id) {
        const empty = getEmptyCells(game);
        if (empty.length > 0) {
          const target = empty[randomInt(0, empty.length - 1)];
          const token = createCampToken(player.id, "三国~吴", "江东水军", 3, "被攻破时，弃置我方一张手牌。");
          token.row = target.row;
          token.col = target.col;
          game.boardCards.push(token);
        }
      }
      if (isCard(boardCard, "0314") && boardCard.ownerId === player.id) {
        adjustCardAttack(boardCard, 1);
      }
      if (isCard(boardCard, "0316")) {
        adjustCardAttack(boardCard, 1);
      }
      if (isCard(boardCard, "0310")) {
        const owner = getPlayer(game, boardCard.ownerId);
        if (owner) {
          drawOneCard(game, owner);
        }
      }
      if (isCard(boardCard, "0319") && boardCard.ownerId === player.id) {
        const owner = getPlayer(game, boardCard.ownerId);
        if (owner) {
          drawOneCard(game, owner);
        }
      }
      if (isCard(boardCard, "0313") && boardCard.ownerId !== player.id) {
        const enemyTargets = getEnemyCards(game, boardCard.ownerId);
        if (enemyTargets.length > 0) {
          const target = enemyTargets[randomInt(0, enemyTargets.length - 1)];
          adjustCardAttack(target, -1);
        }
      }
    });
  }
  return discarded;
}

function getDestructionAnimationProfile(card, reason = "", cause = "other") {
  if (isCard(card, "0301") || isCard(card, "0318")) {
    return { kind: "return", label: "回手", effectType: "support" };
  }
  if (isCard(card, "0119")) {
    return { kind: "collapse", label: "崩解", effectType: "danger" };
  }
  if (isCard(card, "0312") || /黄盖|焚舟/.test(reason)) {
    return { kind: "fire", label: "焚舟", effectType: "danger" };
  }
  if (/楼船冲锋/.test(reason)) {
    return { kind: "ram", label: "冲锋撞毁", effectType: "danger" };
  }
  if (/虎痴震岳/.test(reason)) {
    return { kind: "quake", label: "震岳击毁", effectType: "danger" };
  }
  if (/自毁/.test(reason)) {
    return { kind: "collapse", label: "自毁", effectType: "danger" };
  }
  return { kind: "tear", label: "撕毁", effectType: "danger", cause };
}

function queueDestructionAnimation(game, card, reason = "", cause = "other") {
  const profile = {
    ...getDestructionAnimationProfile(card, reason, cause),
    id: `destroy-${++destructionAnimationSequence}`
  };
  card.destructionAnimation = profile;
  queueBoardAnimation(game, {
    kind: "destroy",
    row: card.row,
    col: card.col,
    ownerId: card.ownerId || 1,
    cardUid: card.uid,
    cardName: card.name,
    skillName: card.skill,
    label: profile.label,
    detail: `${card.name} 被摧毁`,
    flowPrompt: `${card.name}在${game.currentPhase || "结算阶段"}被摧毁，触发${profile.label}表现。`,
    destruction: profile,
    effectType: profile.effectType
  });
  return profile;
}

function destroyBoardCard(game, boardCards, card, actionLog = [], reason = "", cause = "other") {
  if (!card) {
    return false;
  }
  const zhoucang = boardCards.find((ally) => (
    ally.ownerId === card.ownerId
    && ally.uid !== card.uid
    && isCard(ally, "0103")
    && Math.abs(ally.row - card.row) + Math.abs(ally.col - card.col) === 1
  ));
  if (zhoucang) {
    const guardLoss = isCard(card, "0101") && cause === "break" ? -2 : -1;
    adjustCardAttack(zhoucang, guardLoss);
    return false;
  }
  const protector = boardCards.find((ally) => (
    ally.ownerId === card.ownerId
    && ally.uid !== card.uid
    && isCard(ally, "0203")
    && Math.abs(ally.row - card.row) + Math.abs(ally.col - card.col) === 1
  ));
  if (protector) {
    const targetRow = card.row;
    const targetCol = card.col;
    const protectorRow = protector.row;
    const protectorCol = protector.col;
    card.row = protectorRow;
    card.col = protectorCol;
    protector.row = targetRow;
    protector.col = targetCol;
    queueDestructionAnimation(game, protector, "代替友军承受摧毁", cause);
    removeBoardCard(boardCards, protector.uid);
    actionLog.push(`${protector.name} 代替 ${card.name} 被摧毁。`);
    return false;
  }
  const zhoutai = boardCards.find((ally) => (
    ally.ownerId === card.ownerId
    && ally.uid !== card.uid
    && isCard(ally, "0303")
    && Math.abs(ally.row - card.row) + Math.abs(ally.col - card.col) === 1
  ));
  if (zhoutai) {
    const target = getLowestAttackEnemy({ ...game, boardCards }, card.ownerId, zhoutai.row, zhoutai.col, true);
    if (target && resolveAttackValue({ ...game, boardCards }, target) < resolveAttackValue({ ...game, boardCards }, zhoutai)) {
      adjustCardAttack(zhoutai, -1);
      queueDestructionAnimation(game, target, "周泰护主击破", "skill");
      removeBoardCard(boardCards, target.uid);
      actionLog.push(`${zhoutai.name} 以战力代价保护了 ${card.name} 并击破了 ${target.name}。`);
      return false;
    }
  }
  const player = getPlayer(game, card.ownerId);
  const enemyId = otherPlayerId(card.ownerId);
  const enemy = getPlayer(game, enemyId);

  if (isCard(card, "0102") && resolveAttackValue({ ...game, boardCards }, card) > 0) {
    return false;
  }
  if (isCard(card, "0101") && cause === "break") {
    const empty = getEmptyCells({ ...game, boardCards });
    if (empty.length > 0) {
      const target = empty[randomInt(0, empty.length - 1)];
      card.row = target.row;
      card.col = target.col;
      adjustCardAttack(card, -2);
      actionLog.push(`${card.name} 被攻破时转移到了空位并失去 2 点战力，本次攻破无效。`);
      return false;
    }
  }
  if (isCard(card, "0114") && countAdjacentAllies({ ...game, boardCards }, card) > 0) {
    return false;
  }
  if (
    isCard(card, "0302")
    && cause === "break"
    && ((card.row === 0 || card.row === BOARD_SIZE - 1) && (card.col === 0 || card.col === BOARD_SIZE - 1))
  ) {
    return false;
  }

  if (isCard(card, "0301")) {
    queueDestructionAnimation(game, card, reason, cause);
    removeBoardCard(boardCards, card.uid);
    if (player && player.hand.length < HAND_LIMIT) {
      addCardToHand(player, { ...card });
    }
    queueSkillAnimation(game, card, `${card.name} 回手`);
    actionLog.push(`${card.name} 被摧毁后返回了手牌。`);
    return true;
  }

  if (isCard(card, "0318")) {
    if (player && player.hand.length > 0) {
      queueDestructionAnimation(game, card, reason, cause);
      removeBoardCard(boardCards, card.uid);
      if (player.hand.length < HAND_LIMIT) {
        addCardToHand(player, { ...card });
      }
      discardRandomHandCard(game, card.ownerId, 1, actionLog);
      queueSkillAnimation(game, card, `${card.name} 回手`);
      actionLog.push(`${card.name} 被摧毁后返回了手牌。`);
      return true;
    }
    queueDestructionAnimation(game, card, reason, cause);
    removeBoardCard(boardCards, card.uid);
    queueSkillAnimation(game, card, `${card.name} 失效`, "skill-warn");
    actionLog.push(`${card.name} 被摧毁，但因我方无手牌可弃，未能返回手牌。`);
    return true;
  }

  if (isCard(card, "0115") && !card.rebornOnce) {
    const empty = getEmptyCells({ ...game, boardCards });
    if (empty.length > 0) {
      const target = empty[randomInt(0, empty.length - 1)];
      card.row = target.row;
      card.col = target.col;
      card.rebornOnce = true;
      queueSkillAnimation(game, card, `${card.name} 转移`);
      actionLog.push(`${card.name} 被摧毁后转移到了新的空格。`);
      return false;
    }
  }

  if (isCard(card, "0314") && player && player.hand.length > 0) {
    discardRandomHandCard(game, card.ownerId, 1, actionLog);
    queueSkillAnimation(game, card, `${card.name} 弃牌保命`);
    actionLog.push(`${card.name} 通过弃牌免除了本次摧毁。`);
    return false;
  }

  const yanyan = boardCards.find((ally) => ally.ownerId === card.ownerId && isCard(ally, "0112"));
  if (yanyan) {
    const allyCount = getAlliedCards({ ...game, boardCards }, yanyan.ownerId).length;
    const enemyCount = getEnemyCards({ ...game, boardCards }, yanyan.ownerId).length;
    if (enemyCount > allyCount) {
      const emptyCells = getAdjacentEmptyCells({ ...game, boardCards }, card.row, card.col);
      if (emptyCells.length > 0) {
        const target = emptyCells[randomInt(0, emptyCells.length - 1)];
        card.row = target.row;
        card.col = target.col;
        adjustCardAttack(yanyan, -2);
        queueSkillAnimation(game, yanyan, `${yanyan.name} 援护`, "skill-warn");
        actionLog.push(`${yanyan.name} 令 ${card.name} 脱离战场边缘，免除了这次摧毁。`);
        processRealtimeEffects(game, boardCards, actionLog);
        return false;
      }
    }
  }

  queueDestructionAnimation(game, card, reason, cause);
  removeBoardCard(boardCards, card.uid);
  if (reason) {
    actionLog.push(`${card.name} 在 ${formatCell(card.row, card.col)} 因${reason}被摧毁。`);
  }

  if (isCard(card, "0119")) {
    queueSkillAnimation(game, card, `${card.name} 崩解`, "skill-warn");
    getAlliedCards({ ...game, boardCards }, card.ownerId).forEach((ally) => adjustCardAttack(ally, -2));
    if (player) {
      drawOneCard(game, player);
    }
  }
  if (isCard(card, "0312")) {
    getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
      const ally = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
      if (ally && ally.ownerId === card.ownerId) {
        destroyBoardCard(game, boardCards, ally, actionLog, "黄盖「苦肉焚舟」");
      }
    });
  }
  if (isCard(card, "0319") && player) {
    drawOneCard(game, player);
  }
  boardCards.forEach((boardCard) => {
    if (isCard(boardCard, "0216") && boardCard.ownerId === card.ownerId && card.camp === "三国~魏") {
      adjustCardAttack(boardCard, -1);
    }
    if (isCard(boardCard, "0111") && boardCard.ownerId === card.ownerId) {
      adjustCardAttack(boardCard, 1);
      if (resolveAttackValue({ ...game, boardCards }, boardCard) > 3) {
        moveCardToEmpty(game, boardCards, boardCard, getAdjacentEmptyCells(game, card.row, card.col));
      }
    }
    if (isCard(boardCard, "0112") && boardCard.ownerId === card.ownerId) {
      const allyCount = getAlliedCards({ ...game, boardCards }, boardCard.ownerId).length;
      const enemyCount = getEnemyCards({ ...game, boardCards }, boardCard.ownerId).length;
      if (allyCount > enemyCount) {
        adjustCardAttack(boardCard, 1);
      }
    }
  });
  boardCards.forEach((boardCard) => {
    if (isCard(boardCard, "0119") && boardCard.ownerId !== card.ownerId) {
      getAlliedCards({ ...game, boardCards }, boardCard.ownerId)
        .filter((ally) => ally.uid !== boardCard.uid)
        .forEach((ally) => adjustCardAttack(ally, 1));
      queueSkillAnimation(game, boardCard, `${boardCard.name} 助阵`);
      const owner = getPlayer(game, boardCard.ownerId);
      if (owner) {
        drawOneCard(game, owner);
      }
    }
    if (isCard(boardCard, "0315") && boardCard.ownerId !== card.ownerId) {
      if (!getBoardCardAt({ ...game, boardCards }, card.row, card.col) && !isBrokenCell(game, card.row, card.col)) {
        const token = createCampToken(boardCard.ownerId, "三国~吴", "江东水军", 3, "被攻破时，弃置我方一张手牌。");
        token.row = card.row;
        token.col = card.col;
        boardCards.push(token);
      }
    }
    if (isCard(boardCard, "0313") && boardCard.ownerId === card.ownerId) {
      discardRandomHandCard(game, card.ownerId, 1, actionLog);
    }
    if (isCard(boardCard, "0313") && boardCard.ownerId !== card.ownerId) {
      discardRandomHandCard(game, card.ownerId, 1, actionLog);
    }
  });
  processRealtimeEffects(game, boardCards, actionLog);
  return true;
}

function triggerOnDefeatEffects(game, boardCards, winnerCard, loserCard, actionLog, mode = "duel") {
  if (!winnerCard || !loserCard) {
    return;
  }
  if (isCard(winnerCard, "0105")) {
    getOrthogonalNeighbors(loserCard.row, loserCard.col).forEach((cell) => {
      const enemy = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
      if (enemy && enemy.ownerId !== winnerCard.ownerId) {
        destroyBoardCard(game, boardCards, enemy, actionLog, "寮犺嫙浣欏▉");
      }
    });
  }
  if (isCard(winnerCard, "0212")) {
    adjustCardAttack(winnerCard, 1);
  }
  if (isCard(winnerCard, "0316") && loserCard.ownerId !== winnerCard.ownerId) {
    adjustCardAttack(winnerCard, 1);
  }
  if (isCard(winnerCard, "0304")) {
    const winnerPlayer = getPlayer(game, winnerCard.ownerId);
    removeBoardCard(boardCards, winnerCard.uid);
    if (winnerPlayer && winnerPlayer.hand.length < HAND_LIMIT) {
      addCardToHand(winnerPlayer, { ...winnerCard });
    }
    discardRandomHandCard(game, 1, 1, actionLog);
    discardRandomHandCard(game, 2, 1, actionLog);
    actionLog.push(`${winnerCard.name} 鏀荤牬鍚庤繑鍥炰簡鎵嬬墝銆`);
  }
  if (isCard(winnerCard, "0315")) {
    if (!getBoardCardAt({ ...game, boardCards }, loserCard.row, loserCard.col) && !isBrokenCell(game, loserCard.row, loserCard.col)) {
      const token = createCampToken(winnerCard.ownerId, "涓夊浗~鍚?", "姹熶笢姘村啗", 3, "琚敾鐮存椂锛屽純缃垜鏂逛竴寮犳墜鐗屻€?");
      token.row = loserCard.row;
      token.col = loserCard.col;
      boardCards.push(token);
      actionLog.push(`${winnerCard.name} 鍦ㄥ師浣嶇疆鍙敜浜?姹熶笢姘村啗銆`);
    }
  }
  if (mode === "attack" && isCard(winnerCard, "0116") && getBoardCardAt({ ...game, boardCards }, loserCard.row, loserCard.col)?.uid === loserCard.uid) {
    adjustCardAttack(loserCard, -1);
  }
}

function applyPostPlaceReactions(game, placedCard, actionLog) {
  const boardCards = getActiveBoardCards(game);
  Object.keys(game.moveLocks).forEach((uid) => {
    const lockedCard = getCardByUid(game, uid);
    if (lockedCard && lockedCard.ownerId === placedCard.ownerId) {
      delete game.moveLocks[uid];
    }
  });

  boardCards.forEach((boardCard) => {
    if (boardCard.ownerId === placedCard.ownerId) {
      return;
    }
    if (isCard(boardCard, "0114")) {
      game.moveLocks[placedCard.uid] = true;
    }
    if (isCard(boardCard, "0219")) {
      getOrthogonalNeighbors(placedCard.row, placedCard.col).forEach((cell) => {
        const ally = getBoardCardAt(game, cell.row, cell.col);
        if (ally && ally.ownerId === boardCard.ownerId) {
          adjustCardAttack(ally, 1);
        }
      });
    }
  });
}

function applyEndTurnEffects(game, boardCards, actionLog) {
  const snapshot = [...boardCards];
  snapshot.forEach((card) => {
    if (!boardCards.find((item) => item.uid === card.uid)) {
      return;
    }
    if (isCard(card, "0104")) {
      getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
        const ally = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
        if (ally && ally.ownerId === card.ownerId) {
          adjustCardAttack(ally, 1);
        }
      });
    }
    if (isCard(card, "0117")) {
      boardCards.forEach((target) => {
        if (target.uid !== card.uid && (target.row === card.row || target.col === card.col)) {
          adjustCardAttack(target, -1);
        }
      });
    }
    if (isCard(card, "0110")) {
      const adjacentEnemyCount = countAdjacentEnemies({ ...game, boardCards }, card);
      if (adjacentEnemyCount > 0) {
        adjustCardAttack(card, -adjacentEnemyCount);
      }
      const dirs = [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }];
      dirs.forEach((dir) => {
        for (let step = 1; step <= BOARD_SIZE; step += 1) {
          const row = card.row + dir.row * step;
          const col = card.col + dir.col * step;
          if (!isInsideBoard(row, col)) {
            break;
          }
          const target = getBoardCardAt({ ...game, boardCards }, row, col);
          if (target) {
            if (target.ownerId !== card.ownerId) {
              adjustCardAttack(target, -1);
              if (resolveAttackValue({ ...game, boardCards }, target) < resolveAttackValue({ ...game, boardCards }, card)) {
                destroyBoardCard(game, boardCards, target, actionLog, "黄忠远射");
              }
            }
            break;
          }
        }
      });
    }
    if (isCard(card, "0210") && countAdjacentAllies({ ...game, boardCards }, card) >= 2) {
      adjustCardAttack(card, 1);
    }
  });
}

function getRetreatPosition(attackAction, defendPosition) {
  return {
    row: defendPosition.row - Math.sign(defendPosition.row - attackAction.source.row),
    col: defendPosition.col - Math.sign(defendPosition.col - attackAction.source.col)
  };
}

function tryRepelAttacker(game, boardCards, attackerCard, defenderCard, attackAction, actionLog) {
  const defendPosition = { row: defenderCard.row, col: defenderCard.col };
  const retreatPosition = getRetreatPosition(attackAction, defendPosition);
  const occupied = boardCards.find(
    (card) => card.uid !== attackerCard.uid && card.row === retreatPosition.row && card.col === retreatPosition.col
  );
  if (isInsideBoard(retreatPosition.row, retreatPosition.col) && !isBrokenCell(game, retreatPosition.row, retreatPosition.col) && !occupied) {
    attackerCard.row = retreatPosition.row;
    attackerCard.col = retreatPosition.col;
    actionLog.push(`${describeCard(game, attackerCard)} 攻击未能攻破防守方，被击退回原进攻方向相邻的位置。`);
    return;
  }
  queueDestructionAnimation(game, attackerCard, "攻击受阻后无处可退", "break");
  removeBoardCard(boardCards, attackerCard.uid);
  actionLog.push(`${describeCard(game, attackerCard)} 攻击受阻后无处可退，已被直接摧毁。`);
}

function getActionPath(action) {
  if (action.type !== "move") {
    return [];
  }
  const rowDelta = Math.sign(action.target.row - action.source.row);
  const colDelta = Math.sign(action.target.col - action.source.col);
  const steps = Math.max(Math.abs(action.target.row - action.source.row), Math.abs(action.target.col - action.source.col));
  const path = [];
  for (let step = 1; step <= steps; step += 1) {
    path.push({
      row: action.source.row + rowDelta * step,
      col: action.source.col + colDelta * step
    });
  }
  return path;
}

function detectActionCollision(actionA, actionB) {
  if (actionA.type !== "move" || actionB.type !== "move") {
    return null;
  }
  const pathA = getActionPath(actionA);
  const pathB = getActionPath(actionB);
  let previousA = actionA.source;
  let previousB = actionB.source;
  const maxSteps = Math.max(pathA.length, pathB.length);
  for (let step = 0; step < maxSteps; step += 1) {
    const currentA = pathA[Math.min(step, pathA.length - 1)];
    const currentB = pathB[Math.min(step, pathB.length - 1)];
    if (currentA.row === currentB.row && currentA.col === currentB.col) {
      return { point: currentA };
    }
    const swapped =
      previousA.row === currentB.row &&
      previousA.col === currentB.col &&
      previousB.row === currentA.row &&
      previousB.col === currentA.col;
    if (swapped) {
      return { point: currentA };
    }
    previousA = currentA;
    previousB = currentB;
  }
  return null;
}

function applyMoveBuff(card, movedSteps = 1) {
  card.movesTaken += movedSteps;
  const boardCards = getActiveBoardCards(state.game);
  if (boardCards.some((unit) => unit.ownerId === card.ownerId && isCard(unit, "0216"))) {
    adjustCardAttack(card, 1);
  }
  if (isCard(card, "0113")) {
    adjustCardAttack(card, -1);
  }
  if (isCard(card, "0211") && card.movesTaken % 4 === 0) {
    adjustCardAttack(card, 1);
  }
}

function applyMoveAdjacencyEffects(game, boardCards, movedCard) {
  boardCards.forEach((other) => {
    if (other.uid === movedCard.uid) {
      return;
    }
    if (Math.abs(other.row - movedCard.row) + Math.abs(other.col - movedCard.col) !== 1) {
      return;
    }
    if (isCard(other, "0207")) {
      if (other.ownerId === movedCard.ownerId) {
        adjustCardAttack(movedCard, 1);
      } else {
        const retreatRow = movedCard.row + Math.sign(movedCard.row - other.row);
        const retreatCol = movedCard.col + Math.sign(movedCard.col - other.col);
        if (
          isInsideBoard(retreatRow, retreatCol)
          && !isBrokenCell(game, retreatRow, retreatCol)
          && !boardCards.find((unit) => unit.uid !== movedCard.uid && unit.row === retreatRow && unit.col === retreatCol)
        ) {
          movedCard.row = retreatRow;
          movedCard.col = retreatCol;
        }
      }
    }
    if (isCard(other, "0219") && other.ownerId !== movedCard.ownerId) {
      adjustCardAttack(movedCard, -1);
    }
  });
}

function applyOnPlaceEffect(game, player, card, actionLog) {
  const boardCards = getActiveBoardCards(game);
  card.hasPlaced = true;
  let placeTriggered = false;
  if (isCard(card, "0204")) {
    getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
      const ally = getBoardCardAt(game, cell.row, cell.col);
      if (ally && ally.ownerId === player.id) {
        adjustCardAttack(ally, 1);
      }
    });
    placeTriggered = true;
  }
  if (isCard(card, "0205") || isCard(card, "0306")) {
    if (isCard(card, "0306")) {
      const enemy = getPlayer(game, otherPlayerId(player.id));
      if (enemy && enemy.drawPile.length > 0 && player.hand.length < HAND_LIMIT) {
        const drawn = enemy.drawPile.shift();
        drawn.ownerId = player.id;
        player.hand.push(drawn);
      }
    } else {
      drawOneCard(game, player);
    }
    placeTriggered = true;
  }
  if (isCard(card, "0119")) {
    getAlliedCards(game, player.id)
      .filter((ally) => ally.uid !== card.uid)
      .forEach((ally) => adjustCardAttack(ally, 1));
    queueSkillAnimation(game, card, `${card.name} 发动`);
  }
  if (isCard(card, "0312") && card.ownerId === player.id) {
    const convertedOwnerId = otherPlayerId(player.id);
    card.ownerId = convertedOwnerId;
    const effectText = `对自身使用，使其转换为${playerName(game, convertedOwnerId)}的卡牌；基础势力仍为三国~吴。`;
    actionLog.push(`${card.name} 落地后以${card.skill}${effectText}`);
    queueSkillAnimation(game, card, effectText, "skill-warn");
  }
  if (isCard(card, "0314")) {
    const control = computeControlMap(game);
    if ((control.counts[otherPlayerId(player.id)] || 0) > (control.counts[player.id] || 0)) {
      for (let i = 0; i < 2; i += 1) {
        const randomHandCard = player.hand.splice(randomInt(0, player.hand.length - 1), 1)[0];
        if (!randomHandCard) {
          break;
        }
        const empty = getEmptyCells(game);
        if (empty.length === 0) {
          addCardToHand(player, randomHandCard);
          break;
        }
        const target = empty[randomInt(0, empty.length - 1)];
        randomHandCard.row = target.row;
        randomHandCard.col = target.col;
        randomHandCard.ownerId = player.id;
        boardCards.push(randomHandCard);
      }
      placeTriggered = true;
    }
  }
  if (isCard(card, "0208")) {
    game.placeLockTurn[otherPlayerId(player.id)] = game.turn + 1;
    placeTriggered = true;
  }
  if (isCard(card, "0210")) {
    const twoAway = [
      { row: card.row - 2, col: card.col },
      { row: card.row + 2, col: card.col },
      { row: card.row, col: card.col - 2 },
      { row: card.row, col: card.col + 2 }
    ];
    twoAway.forEach((cell) => {
      const ally = getBoardCardAt(game, cell.row, cell.col);
      const midRow = card.row + Math.sign(cell.row - card.row);
      const midCol = card.col + Math.sign(cell.col - card.col);
      if (ally && ally.ownerId === player.id && !getBoardCardAt(game, midRow, midCol) && !isBrokenCell(game, midRow, midCol)) {
        ally.row = midRow;
        ally.col = midCol;
      }
    });
    placeTriggered = true;
  }
  if (isCard(card, "0216")) {
    const weiCount = game.boardCards.filter((unit) => (
      unit.uid !== card.uid
      && unit.ownerId === player.id
      && unit.camp === "三国~魏"
    )).length;
    adjustCardAttack(card, weiCount);
    placeTriggered = true;
  }
  if (isCard(card, "0303")) {
    getAdjacentEmptyCells(game, card.row, card.col).forEach((cell) => {
      const token = createReinforcementCard(otherPlayerId(player.id));
      token.row = cell.row;
      token.col = cell.col;
      game.boardCards.push(token);
    });
    placeTriggered = true;
  }
  if (isCard(card, "0307")) {
    const target = getLowestAttackEnemy({ ...game, boardCards: game.boardCards }, player.id, card.row, card.col);
    if (target) {
      const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, card, target, {
        mode: "attack",
        positionA: { row: target.row, col: target.col },
        positionB: { row: target.row, col: target.col },
        defenderUid: target.uid
      });
      if (outcome === "a") {
        destroyBoardCard(game, game.boardCards, target, actionLog, "潘璋突袭");
      } else if (outcome === "both") {
        destroyBoardCard(game, game.boardCards, target, actionLog, "潘璋突袭");
        destroyBoardCard(game, game.boardCards, card, actionLog, "潘璋突袭");
      }
      placeTriggered = true;
    }
  }
  if (isCard(card, "0315")) {
    const target = getLowestAttackEnemy({ ...game, boardCards: game.boardCards }, player.id, card.row, card.col, true);
    if (target) {
      const duelTarget = chooseZhouYuDuelTarget({ ...game, boardCards: game.boardCards }, target, card);
      if (duelTarget) {
        const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, target, duelTarget, {
          mode: "duel",
          positionA: { row: target.row, col: target.col },
          positionB: { row: duelTarget.row, col: duelTarget.col }
        });
        if (outcome === "a") {
          destroyBoardCard(game, game.boardCards, duelTarget, actionLog, "周瑜借势决斗", "break");
        } else if (outcome === "b") {
          destroyBoardCard(game, game.boardCards, target, actionLog, "周瑜借势决斗", "break");
        } else {
          destroyBoardCard(game, game.boardCards, target, actionLog, "周瑜借势决斗", "break");
          destroyBoardCard(game, game.boardCards, duelTarget, actionLog, "周瑜借势决斗", "break");
        }
        placeTriggered = true;
      }
    }
  }
  if (placeTriggered && !isCard(card, "0119")) {
    queueSkillAnimation(game, card, `${card.name} 发动`);
  }
}

async function submitCurrentAction() {
  const game = state.game;
  if (!game || game.isAnimating) {
    return;
  }
  const planner = getPlannerPlayer(game);
  const planned = getSubmittedActions(game, planner.id);
  const globalLimit = 1 + getGlobalExtraActionCount(game, planner.id);
  const actionLimit = getActionLimit(game, planner.id);
  let action = buildPendingAction(game, planner.id);
  if (!action) {
    if (planned.length > 0 && planned.length < actionLimit) {
      action = createPassAction(planner.id);
    } else {
      ui.statusSubtext.textContent = "请先完成一个合法行动，再提交。";
      return;
    }
  }
  if (planned.length >= actionLimit) {
    ui.statusSubtext.textContent = "当前玩家本回合的行动次数已经用完。";
    return;
  }
  if (action.type !== "pass" && planned.some((item) => item.cardUid === action.cardUid)) {
    ui.statusSubtext.textContent = "同一张卡牌在同一回合内不能重复提交行动。";
    return;
  }
  if (action.type !== "pass" && planned.some((item) => item.target?.row === action.target?.row && item.target?.col === action.target?.col)) {
    ui.statusSubtext.textContent = "同一名玩家不能在同一回合把多个行动指向同一个目标格。";
    return;
  }
  const projected = [...planned, action];
  const usedPersonalExtraCount = countPersonalExtraActions(game, planner.id, projected);
  if (projected.length > globalLimit + usedPersonalExtraCount) {
    ui.statusSubtext.textContent = "超出基础行动后的额外行动位，当前只能由带专属额外行动的卡牌来使用。";
    return;
  }
  if (action.type === "pass" && projected.length <= globalLimit) {
    ui.statusSubtext.textContent = "当前还没有需要跳过的额外行动位。";
    return;
  }
  game.plannedActions[planner.id] = projected;
  planner.submittedActions = [...game.plannedActions[planner.id]];
  game.selection = resetSelection();
  if (game.mode === "pvp" && planner.id === 1 && hasFinishedPlanning(game, 1) && !hasFinishedPlanning(game, 2)) {
    game.activePlannerIndex = 1;
    game.lastResolution = "玩家 1 已用完本回合行动次数，请将设备交给玩家 2。";
    render();
    showPhaseBanner("切换操作方", "请玩家 2 开始规划本回合行动。");
    return;
  }
  if (game.mode === "pve") {
    maybeAutoPlanAI();
  }
  if (!hasFinishedPlanning(game, 1) || !hasFinishedPlanning(game, 2)) {
    updateCurrentPlannerForMode();
    game.lastResolution = action.type === "pass"
      ? `${planner.name} 已跳过一个额外行动位。`
      : `${planner.name} 已提交 1 次行动，仍可继续规划剩余行动。`;
    render();
    return;
  }
  await resolveRound(game);
}

function buildPendingAction(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  const selection = game.selection;
  if (selection.handCardUid && selection.targetCell) {
    const card = player.hand.find((item) => item.uid === selection.handCardUid);
    if (!card) {
      return null;
    }
    if (game.placeLockTurn[playerId] === game.turn) {
      return null;
    }
    if (game.boardCards.length > 5 && game.boardCards.some((item) => item.ownerId === otherPlayerId(playerId) && isCard(item, "0208"))) {
      return null;
    }
    const { row, col } = selection.targetCell;
    if (isCard(card, "0320") && !isEdgeCell(row, col)) {
      return null;
    }
    if (isBrokenCell(game, row, col) || getBoardCardAt(game, row, col) || isBlockedByEnemyAdjacency(game, playerId, row, col)) {
      return null;
    }
    return { type: "place", playerId, cardUid: card.uid, target: { row, col } };
  }
  if (selection.boardCardUid && selection.targetCell) {
    const boardCard = game.boardCards.find((item) => item.uid === selection.boardCardUid && item.ownerId === playerId);
    if (!boardCard) {
      return null;
    }
    if (game.moveLocks[boardCard.uid]) {
      return null;
    }
    const validMove = getValidMoves(game, boardCard).some((cell) => cell.row === selection.targetCell.row && cell.col === selection.targetCell.col);
    if (!validMove) {
      return null;
    }
    return {
      type: "move",
      playerId,
      cardUid: boardCard.uid,
      source: { row: boardCard.row, col: boardCard.col },
      target: { ...selection.targetCell }
    };
  }
  return null;
}

function buildPendingAction(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  const selection = game.selection;
  if (selection.handCardUid && selection.targetCell) {
    const card = player.hand.find((item) => item.uid === selection.handCardUid);
    if (!card) {
      return null;
    }
    if (game.placeLockTurn[playerId] === game.turn) {
      return null;
    }
    if (game.boardCards.length > 5 && game.boardCards.some((item) => item.ownerId === otherPlayerId(playerId) && isCard(item, "0208"))) {
      return null;
    }
    const { row, col } = selection.targetCell;
    if (isCard(card, "0320") && !isEdgeCell(row, col)) {
      return null;
    }
    if (isBrokenCell(game, row, col) || getBoardCardAt(game, row, col) || isBlockedByEnemyAdjacency(game, playerId, row, col)) {
      return null;
    }
    return { type: "place", playerId, cardUid: card.uid, target: { row, col } };
  }
  if (selection.boardCardUid && selection.targetCell) {
    const boardCard = game.boardCards.find((item) => item.uid === selection.boardCardUid && item.ownerId === playerId);
    if (!boardCard || game.moveLocks[boardCard.uid]) {
      return null;
    }
    const validMove = getValidMoves(game, boardCard).some((cell) => cell.row === selection.targetCell.row && cell.col === selection.targetCell.col);
    if (!validMove) {
      return null;
    }
    return {
      type: "move",
      playerId,
      cardUid: boardCard.uid,
      source: { row: boardCard.row, col: boardCard.col },
      target: { ...selection.targetCell }
    };
  }
  return null;
}

function maybeAutoPlanAI() {
  const game = state.game;
  if (!game || game.mode !== "pve") {
    return;
  }
  const ai = game.players.find((player) => player.isAI);
  const limit = getActionLimit(game, ai.id);
  const planned = [];
  while (planned.length < limit) {
    const action = planAiAction(game, ai);
    if (action.type !== "pass" && planned.some((item) => item.cardUid === action.cardUid)) {
      planned.push(createPassAction(ai.id));
    } else {
      planned.push(action);
    }
  }
  game.plannedActions[ai.id] = planned;
  ai.submittedActions = [...planned];
}

function wouldAttackerWin(attacker, defender) {
  const defendPosition = { row: defender.row, col: defender.col };
  return resolveAttackValue(state.game, attacker, defender, { selfPosition: defendPosition, targetPosition: defendPosition })
    >= resolveAttackValue(state.game, defender, attacker, { selfPosition: defendPosition, targetPosition: defendPosition });
}

function planAiAction(game, aiPlayer) {
  const enemyId = otherPlayerId(aiPlayer.id);
  const aiCards = game.boardCards.filter((card) => card.ownerId === aiPlayer.id);
  const enemyCards = game.boardCards.filter((card) => card.ownerId === enemyId);
  for (const card of aiCards) {
    const winningMove = getValidMoves(game, card).find((move) => {
      const defender = getBoardCardAt(game, move.row, move.col);
      return defender && defender.ownerId === enemyId && wouldAttackerWin(card, defender);
    });
    if (winningMove) {
      return {
        type: "move",
        playerId: aiPlayer.id,
        cardUid: card.uid,
        source: { row: card.row, col: card.col },
        target: winningMove
      };
    }
  }
  if (aiPlayer.hand.length > 0) {
    const card = [...aiPlayer.hand].sort((a, b) => a.attack - b.attack)[0];
    const placeable = getPlaceableCells(game, card, aiPlayer.id);
    if (placeable.length > 0) {
      const target = placeable.find((cell) => enemyCards.some((enemy) => Math.abs(enemy.row - cell.row) + Math.abs(enemy.col - cell.col) <= 2))
        || placeable[randomInt(0, placeable.length - 1)];
      return { type: "place", playerId: aiPlayer.id, cardUid: card.uid, target };
    }
  }
  for (const card of aiCards) {
    const validMoves = getValidMoves(game, card);
    if (validMoves.length > 0) {
      return {
        type: "move",
        playerId: aiPlayer.id,
        cardUid: card.uid,
        source: { row: card.row, col: card.col },
        target: validMoves[randomInt(0, validMoves.length - 1)]
      };
    }
  }
  return { type: "pass", playerId: aiPlayer.id };
}

function createPassAction(playerId) {
  return { type: "pass", playerId };
}

async function resolveActionBatch(game, nextBoard, actionA, actionB, actionLog) {
  game.currentPhase = "结算阶段";
  const actions = [actionA, actionB];
  await playActionAnimations(game, actions);

  const resolvedMoveCards = new Set();
  const directCollision = detectActionCollision(actionA, actionB);
  if (directCollision) {
      const cardA = nextBoard.find((item) => item.uid === actionA.cardUid);
      const cardB = nextBoard.find((item) => item.uid === actionB.cardUid);
    if (cardA && cardB) {
      const duelPositionA = { ...actionA.source };
      const duelPositionB = { ...actionB.source };
      cardA.row = directCollision.point.row;
      cardA.col = directCollision.point.col;
      cardB.row = directCollision.point.row;
      cardB.col = directCollision.point.col;
      applyMoveBuff(cardA, Math.abs(directCollision.point.row - actionA.source.row) + Math.abs(directCollision.point.col - actionA.source.col));
      applyMoveBuff(cardB, Math.abs(directCollision.point.row - actionB.source.row) + Math.abs(directCollision.point.col - actionB.source.col));
      resolvedMoveCards.add(cardA.uid);
      resolvedMoveCards.add(cardB.uid);
      const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, {
        positionA: duelPositionA,
        positionB: duelPositionB
      });
      if (outcome === "a") {
        cardA.row = actionA.target.row;
        cardA.col = actionA.target.col;
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗失败", "break");
        actionLog.push(`${describeCard(game, cardA)} 在移动中与 ${describeCard(game, cardB)} 发生决斗，并以攻击方身份取胜。`);
      } else if (outcome === "b") {
        cardB.row = actionB.target.row;
        cardB.col = actionB.target.col;
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗失败", "break");
        actionLog.push(`${describeCard(game, cardB)} 在移动中与 ${describeCard(game, cardA)} 发生决斗，并以攻击方身份取胜。`);
      } else {
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗同归于尽", "break");
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗同归于尽", "break");
        actionLog.push(`${describeCard(game, cardA)} 与 ${describeCard(game, cardB)} 在移动中发生决斗，最终同归于尽。`);
      }
    }
  }

  actions.forEach((action) => {
    if (action.type === "pass") {
      return;
    }
    if (action.type === "place") {
      const player = game.players.find((item) => item.id === action.playerId);
      const handIndex = player.hand.findIndex((card) => card.uid === action.cardUid);
      const card = handIndex >= 0 ? player.hand.splice(handIndex, 1)[0] : null;
      if (!card) {
        actionLog.push(`${playerName(game, action.playerId)} 的放置行动失效。`);
        return;
      }
      const placedCard = { ...card, row: action.target.row, col: action.target.col };
      nextBoard.push(placedCard);
      applyOnPlaceEffect(game, player, placedCard, actionLog);
      actionLog.push(`${playerName(game, action.playerId)} 放置了 ${card.name}。`);
      return;
    }
    if (action.type === "move") {
      if (resolvedMoveCards.has(action.cardUid)) {
        return;
      }
      const card = nextBoard.find((item) => item.uid === action.cardUid);
      if (!card) {
        actionLog.push(`${playerName(game, action.playerId)} 的移动行动失效。`);
        return;
      }
      const alliedTarget = nextBoard.find(
        (item) => item.uid !== card.uid && item.ownerId === card.ownerId && item.row === action.target.row && item.col === action.target.col
      );
      if (alliedTarget) {
        actionLog.push(`${playerName(game, action.playerId)} 的移动因目标格已有己方卡牌而失效。`);
        return;
      }
      card.row = action.target.row;
      card.col = action.target.col;
      applyMoveBuff(card, Math.abs(action.target.row - sourceRow) + Math.abs(action.target.col - sourceCol));
      nextBoard.forEach((other) => {
        if (other.uid === card.uid) {
          return;
        }
        if (Math.abs(other.row - card.row) + Math.abs(other.col - card.col) !== 1) {
          return;
        }
        if (isCard(other, "0207")) {
          if (other.ownerId === card.ownerId) {
            adjustCardAttack(card, 1);
          } else {
            const retreatRow = card.row + Math.sign(card.row - other.row);
            const retreatCol = card.col + Math.sign(card.col - other.col);
            if (
              isInsideBoard(retreatRow, retreatCol)
              && !isBrokenCell(game, retreatRow, retreatCol)
              && !nextBoard.find((unit) => unit.uid !== card.uid && unit.row === retreatRow && unit.col === retreatCol)
            ) {
              card.row = retreatRow;
              card.col = retreatCol;
            }
          }
        }
      });
      actionLog.push(`${playerName(game, action.playerId)} 移动了 ${card.name}。`);
    }
  });

  removeNegativeAttackCards(game, nextBoard, actionLog);

  const occupiedByPosition = new Map();
  const actionByCardUid = new Map();
  [actionA, actionB].forEach((action) => {
    if (action.type !== "pass") {
      actionByCardUid.set(action.cardUid, action);
    }
  });
  nextBoard.forEach((card) => {
    const key = cellKey(card.row, card.col);
    const list = occupiedByPosition.get(key) || [];
    list.push(card);
    occupiedByPosition.set(key, list);
  });

  occupiedByPosition.forEach((cardsAtCell) => {
    if (cardsAtCell.length < 2) {
      return;
    }
    const [cardA, cardB] = cardsAtCell;
    if (cardA.ownerId === cardB.ownerId) {
      return;
    }
    const sourceActionA = actionByCardUid.get(cardA.uid);
    const sourceActionB = actionByCardUid.get(cardB.uid);
    let conflictContext = {};
    if (sourceActionA?.type === "move" && sourceActionB?.type === "move") {
      conflictContext = {
        positionA: { ...sourceActionA.source },
        positionB: { ...sourceActionB.source }
      };
    } else if (sourceActionA?.type === "move" && (!sourceActionB || sourceActionB.type !== "move")) {
      const defendPosition = { row: cardB.row, col: cardB.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition
      };
    } else if (sourceActionB?.type === "move" && (!sourceActionA || sourceActionA.type !== "move")) {
      const defendPosition = { row: cardA.row, col: cardA.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition
      };
    }
    const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, conflictContext);
    if (outcome === "a") {
      if (sourceActionB?.type === "move" && (!sourceActionA || sourceActionA.type !== "move")) {
        tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
        actionLog.push(`${describeCard(game, cardA)} 以防守方身份守住了攻击。`);
      } else {
        destroyBoardCard(game, nextBoard, cardB, actionLog, "攻击失败", "break");
        actionLog.push(`${describeCard(game, cardA)} 以攻击方身份击破了作为防守方的 ${describeCard(game, cardB)}。`);
      }
    } else if (outcome === "b") {
      if (sourceActionA?.type === "move" && (!sourceActionB || sourceActionB.type !== "move")) {
        tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
        actionLog.push(`${describeCard(game, cardB)} 以防守方身份守住了攻击。`);
      } else {
        destroyBoardCard(game, nextBoard, cardA, actionLog, "攻击失败", "break");
        actionLog.push(`${describeCard(game, cardB)} 以防守方身份守住了攻击，并反制了 ${describeCard(game, cardA)}。`);
      }
    } else {
      destroyBoardCard(game, nextBoard, cardA, actionLog, "战斗同归于尽", "break");
      destroyBoardCard(game, nextBoard, cardB, actionLog, "战斗同归于尽", "break");
      actionLog.push(`${describeCard(game, cardA)} 与 ${describeCard(game, cardB)} 在攻防结算中同归于尽。`);
    }
  });

  removeNegativeAttackCards(game, nextBoard, actionLog);
}

async function resolveActionBatch(game, nextBoard, actionA, actionB, actionLog) {
  const actions = [actionA, actionB];
  await playActionAnimations(game, actions);

  const resolvedMoveCards = new Set();
  const directCollision = detectActionCollision(actionA, actionB);
  if (directCollision) {
    const cardA = nextBoard.find((item) => item.uid === actionA.cardUid);
    const cardB = nextBoard.find((item) => item.uid === actionB.cardUid);
    if (cardA && cardB) {
      const duelPositionA = { ...actionA.source };
      const duelPositionB = { ...actionB.source };
      cardA.row = directCollision.point.row;
      cardA.col = directCollision.point.col;
      cardB.row = directCollision.point.row;
      cardB.col = directCollision.point.col;
      applyMoveBuff(cardA, Math.abs(directCollision.point.row - actionA.source.row) + Math.abs(directCollision.point.col - actionA.source.col));
      applyMoveBuff(cardB, Math.abs(directCollision.point.row - actionB.source.row) + Math.abs(directCollision.point.col - actionB.source.col));
      resolvedMoveCards.add(cardA.uid);
      resolvedMoveCards.add(cardB.uid);
      const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, {
        positionA: duelPositionA,
        positionB: duelPositionB
      });
      if (outcome === "a") {
        cardA.row = actionA.target.row;
        cardA.col = actionA.target.col;
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗失败", "break");
        actionLog.push(`${describeCard(game, cardA)} 在 ${formatCell(directCollision.point.row, directCollision.point.col)} 与 ${describeCard(game, cardB)} 决斗并获胜，随后到达 ${formatCell(cardA.row, cardA.col)}。`);
        triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "duel");
      } else if (outcome === "b") {
        cardB.row = actionB.target.row;
        cardB.col = actionB.target.col;
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗失败", "break");
        actionLog.push(`${describeCard(game, cardB)} 在 ${formatCell(directCollision.point.row, directCollision.point.col)} 与 ${describeCard(game, cardA)} 决斗并获胜，随后到达 ${formatCell(cardB.row, cardB.col)}。`);
        triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "duel");
      } else {
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗同归于尽", "break");
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗同归于尽", "break");
        actionLog.push(`${describeCard(game, cardA)} 与 ${describeCard(game, cardB)} 在 ${formatCell(directCollision.point.row, directCollision.point.col)} 决斗后同归于尽。`);
      }
    }
  }

  actions.forEach((action) => {
    if (action.type === "pass") {
      return;
    }
    if (action.type === "place") {
      const player = game.players.find((item) => item.id === action.playerId);
      const handIndex = player.hand.findIndex((card) => card.uid === action.cardUid);
      const card = handIndex >= 0 ? player.hand.splice(handIndex, 1)[0] : null;
      if (!card) {
        return;
      }
      const placedCard = { ...card, row: action.target.row, col: action.target.col };
      nextBoard.push(placedCard);
      applyOnPlaceEffect(game, player, placedCard, actionLog);
      applyPostPlaceReactions(game, placedCard, actionLog);
      processRealtimeEffects(game, nextBoard, actionLog);
      return;
    }
    if (action.type !== "move" || resolvedMoveCards.has(action.cardUid)) {
      return;
    }
    const card = nextBoard.find((item) => item.uid === action.cardUid);
    if (!card) {
      return;
    }
    const alliedTarget = nextBoard.find((item) => (
      item.uid !== card.uid
      && item.ownerId === card.ownerId
      && item.row === action.target.row
      && item.col === action.target.col
    ));
    if (alliedTarget && !isCard(card, "0209")) {
      return;
    }
    const sourceRow = card.row;
    const sourceCol = card.col;
    if (alliedTarget && isCard(card, "0209")) {
      alliedTarget.row = sourceRow;
      alliedTarget.col = sourceCol;
      adjustCardAttack(card, 1);
    }
    card.row = action.target.row;
    card.col = action.target.col;
    applyMoveBuff(card, Math.abs(action.target.row - sourceRow) + Math.abs(action.target.col - sourceCol));
    if (alliedTarget && isCard(card, "0209")) {
      applyMoveAdjacencyEffects(game, nextBoard, alliedTarget);
    }

    if (isCard(card, "0201") && !getBoardCardAt({ ...game, boardCards: nextBoard }, sourceRow, sourceCol) && !isBrokenCell(game, sourceRow, sourceCol)) {
      const token = createReinforcementCard(card.ownerId);
      token.row = sourceRow;
      token.col = sourceCol;
      nextBoard.push(token);
    }

    if (isCard(card, "0214")) {
      getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
        const target = getBoardCardAt({ ...game, boardCards: nextBoard }, cell.row, cell.col);
        if (target) {
          adjustCardAttack(target, -1);
        }
      });
    }

    if (isCard(card, "0309")) {
      findNearestCardInDirections({ ...game, boardCards: nextBoard }, card).forEach(({ card: target, direction }) => {
        if (target.ownerId === card.ownerId) {
          return;
        }
        const pushRow = target.row + direction.row;
        const pushCol = target.col + direction.col;
        if (
          isInsideBoard(pushRow, pushCol)
          && !isBrokenCell(game, pushRow, pushCol)
          && !getBoardCardAt({ ...game, boardCards: nextBoard }, pushRow, pushCol)
        ) {
          target.row = pushRow;
          target.col = pushCol;
        }
      });
    }

    applyMoveAdjacencyEffects(game, nextBoard, card);

    if (isCard(card, "0317")) {
      const stepRow = Math.sign(action.target.row - action.source.row);
      const stepCol = Math.sign(action.target.col - action.source.col);
      let row = card.row + stepRow;
      let col = card.col + stepCol;
      while (isInsideBoard(row, col) && !isBrokenCell(game, row, col)) {
        const target = getBoardCardAt({ ...game, boardCards: nextBoard }, row, col);
        if (target) {
          destroyBoardCard(game, nextBoard, target, actionLog, "楼船冲锋");
        }
        row += stepRow;
        col += stepCol;
      }
      destroyBoardCard(game, nextBoard, card, actionLog, "楼船冲锋自毁");
    }
    processRealtimeEffects(game, nextBoard, actionLog);
  });

  removeNegativeAttackCards(game, nextBoard, actionLog);

  const occupiedByPosition = new Map();
  const actionByCardUid = new Map();
  [actionA, actionB].forEach((action) => {
    if (action.type !== "pass") {
      actionByCardUid.set(action.cardUid, action);
    }
  });
  nextBoard.forEach((card) => {
    const key = cellKey(card.row, card.col);
    const list = occupiedByPosition.get(key) || [];
    list.push(card);
    occupiedByPosition.set(key, list);
  });

  occupiedByPosition.forEach((cardsAtCell) => {
    if (cardsAtCell.length < 2) {
      return;
    }
    const [cardA, cardB] = cardsAtCell;
    if (cardA.ownerId === cardB.ownerId) {
      return;
    }
    const sourceActionA = actionByCardUid.get(cardA.uid);
    const sourceActionB = actionByCardUid.get(cardB.uid);
    let conflictContext = {};
    if (sourceActionA?.type === "move" && sourceActionB?.type === "move") {
      conflictContext = {
        positionA: { ...sourceActionA.source },
        positionB: { ...sourceActionB.source }
      };
    } else if (sourceActionA?.type === "move" && (!sourceActionB || sourceActionB.type !== "move")) {
      const defendPosition = { row: cardB.row, col: cardB.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition
      };
    } else if (sourceActionB?.type === "move" && (!sourceActionA || sourceActionA.type !== "move")) {
      const defendPosition = { row: cardA.row, col: cardA.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition
      };
    }
    const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, conflictContext);
    if (outcome === "a") {
      if (sourceActionB?.type === "move" && (!sourceActionA || sourceActionA.type !== "move")) {
        tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
      } else {
        destroyBoardCard(game, nextBoard, cardB, actionLog, "攻击失败", "break");
        triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, sourceActionA?.type === "move" ? "attack" : "duel");
      }
    } else if (outcome === "b") {
      if (sourceActionA?.type === "move" && (!sourceActionB || sourceActionB.type !== "move")) {
        tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
      } else {
        destroyBoardCard(game, nextBoard, cardA, actionLog, "攻击失败", "break");
        triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, sourceActionB?.type === "move" ? "attack" : "duel");
      }
    } else {
      destroyBoardCard(game, nextBoard, cardA, actionLog, "战斗同归于尽", "break");
      destroyBoardCard(game, nextBoard, cardB, actionLog, "战斗同归于尽", "break");
    }
  });

  removeNegativeAttackCards(game, nextBoard, actionLog);
}

async function resolveRound(game) {
  const actions1 = getSubmittedActions(game, 1);
  const actions2 = getSubmittedActions(game, 2);
  const maxActionSlots = Math.max(actions1.length, actions2.length, getActionLimit(game, 1), getActionLimit(game, 2));
  game.isAnimating = true;
  game.lastResolution = "双方行动已锁定，正在播放行动动画并结算。";
  render();
  showPhaseBanner("结算阶段", "双方行动同时执行，正在结算本回合结果。");

  const actionLog = [];
  const nextBoard = game.boardCards.map((card) => ({ ...card }));
  game.effectBoardCards = nextBoard;
  game.flowPrompt = "";
  game.currentPhase = "准备阶段";
  processRealtimeEffects(game, nextBoard, actionLog);
  game.currentPhase = "行动阶段";
  for (let slot = 0; slot < maxActionSlots; slot += 1) {
    const action1 = actions1[slot] || createPassAction(1);
    const action2 = actions2[slot] || createPassAction(2);
    await resolveActionBatch(game, nextBoard, action1, action2, actionLog);
  }

  applyEndTurnEffects(game, nextBoard, actionLog);

  game.boardCards = nextBoard;
  game.effectBoardCards = game.boardCards;
  syncPlayerBoardIds(game);
  const control = computeControlMap(game);
  game.players.forEach((player) => {
    player.lastControlCount = control.counts[player.id];
  });

  const eligibleWinners = game.players
    .filter((player) => player.lastControlCount >= VICTORY_CONTROL_COUNT)
    .sort((a, b) => b.lastControlCount - a.lastControlCount);

  game.roundLog = [...actionLog];
  game.lastResolvedTurn = game.turn;
  game.lastResolution = actionLog.length > 0 ? actionLog.join(" ") : "双方本回合均未形成有效变化。";
  game.plannedActions = {};
  game.players.forEach((player) => {
    player.submittedActions = [];
  });
  game.isAnimating = false;

  if (eligibleWinners.length > 0) {
    if (eligibleWinners.length > 1 && eligibleWinners[0].lastControlCount === eligibleWinners[1].lastControlCount) {
      game.winner = { playerId: 0, text: `双方同时占领 ${eligibleWinners[0].lastControlCount} 格，本局判定为平局。` };
    } else {
      game.winner = {
        playerId: eligibleWinners[0].id,
        text: `${playerName(game, eligibleWinners[0].id)} 占领 ${eligibleWinners[0].lastControlCount} 格，达成胜利条件。`
      };
    }
    showResult();
    return;
  }

  game.turn += 1;
  const startLog = [];
  applyStartTurnEffects(game, game.boardCards, startLog);
  const ended = drawPhase(game);
  if (startLog.length > 0) {
    game.lastResolution += ` ${startLog.join(" ")}`;
  }
  if (ended) {
    game.effectBoardCards = null;
    showResult();
    return;
  }
  game.currentPhase = "行动阶段";
  updateCurrentPlannerForMode();
  render();
  showPhaseBanner("新回合开始", `进入第 ${game.turn} / ${MAX_TURNS} 回合，准备与抽牌已完成，进入行动阶段。`);
  game.effectBoardCards = null;
  maybeAutoPlanAI();
}

function removeBoardCard(boardCards, uid) {
  const index = boardCards.findIndex((card) => card.uid === uid);
  if (index >= 0) {
    boardCards.splice(index, 1);
  }
}

function syncPlayerBoardIds(game) {
  game.players.forEach((player) => {
    player.boardCardIds = game.boardCards.filter((card) => card.ownerId === player.id).map((card) => card.uid);
  });
}

function computeControlMap(game) {
  const influence = new Map();
  const addInfluence = (row, col, ownerId) => {
    if (!isInsideBoard(row, col) || isBrokenCell(game, row, col)) {
      return;
    }
    const key = cellKey(row, col);
    const data = influence.get(key) || { owners: new Set() };
    data.owners.add(ownerId);
    influence.set(key, data);
  };

  game.boardCards.forEach((card) => {
    addInfluence(card.row, card.col, card.ownerId);
    if (isCard(card, "0220")) {
      getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
        if (!getBoardCardAt(game, cell.row, cell.col)) {
          addInfluence(cell.row, cell.col, card.ownerId);
        }
      });
    }
    if (isCard(card, "0120")) {
      getDiagonalNeighbors(card.row, card.col).forEach((cell) => {
        if (!getBoardCardAt(game, cell.row, cell.col)) {
          addInfluence(cell.row, cell.col, card.ownerId);
        }
      });
    }
    if (isCard(card, "0320")) {
      getEightNeighbors(card.row, card.col).forEach((cell) => {
        if (!getBoardCardAt(game, cell.row, cell.col)) {
          addInfluence(cell.row, cell.col, card.ownerId);
        }
      });
    }
  });

  const counts = { 1: 0, 2: 0 };
  influence.forEach((data) => {
    if (data.owners.size === 1) {
      const [ownerId] = [...data.owners];
      counts[ownerId] += 1;
    }
  });
  return { influence, counts };
}

function playerName(game, playerId) {
  return game.players.find((player) => player.id === playerId)?.name || `玩家 ${playerId}`;
}

function formatCell(row, col) {
  return `${row + 1}-${col + 1}`;
}

function describeCard(game, card) {
  return `${playerName(game, card.ownerId)} 的 ${card.name}[${resolveAttackValue(game, card)}]`;
}

function getCardQuality(card) {
  return card.type || card.rarity || "普通";
}

function getCardTierLabel(card) {
  return `${getCardQuality(card)}卡`;
}

function getCardAttackText(card, game = null) {
  const currentValue = resolveAttackValue(game, card);
  return currentValue === card.attack
    ? `战力 ${card.attack}`
    : `战力 ${currentValue} / 基础 ${card.attack}`;
}

function getFocusCard(game, planner) {
  if (game.selection.handCardUid) {
    return planner.hand.find((card) => card.uid === game.selection.handCardUid) || null;
  }
  if (game.selection.boardCardUid) {
    return game.boardCards.find((card) => card.uid === game.selection.boardCardUid) || null;
  }
  return planner.hand[0] || game.boardCards.find((card) => card.ownerId === planner.id) || null;
}

function getCardStateNotes(game, card) {
  const notes = [];
  if (!game || typeof card.row !== "number" || typeof card.col !== "number") {
    notes.push("当前在手牌中，尚未进入战场。");
    return notes;
  }
  if (cardHasEffect(card, "adjacent_ally_power") && countAdjacentAllies(game, card) > 0) {
    notes.push("正交相邻存在友方卡牌，已触发 +1 战力。");
  }
  if (cardHasEffect(card, "adjacent_enemy_power") && countAdjacentEnemies(game, card) > 0) {
    notes.push("正交相邻存在敌方卡牌，已触发 +1 战力。");
  }
  if (cardHasEffect(card, "edge_power") && isOuterRingCell(card.row, card.col)) {
    notes.push("当前位于战场外圈，已触发边线增伤。");
  }
  if (cardHasEffect(card, "ruin_power") && hasAdjacentBrokenOrEdge(game, card)) {
    notes.push("邻近破坏格或边界外圈，已触发借势增伤。");
  }
  if (cardHasEffect(card, "surrounded_power")) {
    const amount = Math.min(2, countAdjacentEnemies(game, card));
    if (amount > 0) {
      notes.push(`周围敌方压力生效，当前额外获得 +${amount} 战力。`);
    }
  }
  if (cardHasEffect(card, "resonance")) {
    const amount = Math.min(2, countAdjacentAllies(game, card));
    if (amount > 0) {
      notes.push(`连营共振已生效，当前额外获得 +${amount} 战力。`);
    }
  }
  const auraCount = getAdjacentFriendlySources(game, card, "adjacent_aura").length + getAdjacentFriendlySources(game, card, "support_beacon").length;
  if (auraCount > 0) {
    notes.push(`受到邻近友方支援光环影响，当前额外获得 +${auraCount} 战力。`);
  }
  if (getsResonanceAura(game, card)) {
    notes.push("相邻共振单位已形成联动，本卡额外获得 +1 战力。");
  }
  const legendCount = getLegendCount(game, card.ownerId);
  if (legendCount > 0 && !cardHasEffect(card, "legend_aura")) {
    notes.push(`受到己方传说卡军势号令影响，当前额外获得 +${legendCount} 战力。`);
  }
  if (cardHasEffect(card, "move_grow") && card.movesTaken > 0) {
    notes.push(`已累计移动 ${card.movesTaken} 格，成长效果正在生效。`);
  }
  if (cardHasEffect(card, "fort_control")) {
    notes.push("这是据点型特殊牌，不能移动，但会大范围扩张占领。");
  }
  if (notes.length === 0) {
    notes.push("当前没有额外战力修正，按基础状态生效。");
  }
  return notes;
}

function renderDetailPanel(game, planner) {
  if (!ui.detailRarity || !ui.detailName || !ui.detailSkill || !ui.detailSummary || !ui.detailTags || !ui.detailLines) {
    return;
  }
  const card = getFocusCard(game, planner);
  if (!card) {
    ui.detailRarity.textContent = "";
    ui.detailName.textContent = "暂无卡牌";
    ui.detailSkill.textContent = "等待选择";
    ui.detailSummary.textContent = "选中手牌或场上己方卡牌后，这里会显示它的技能与当前状态。";
    ui.detailTags.innerHTML = "";
    ui.detailLines.innerHTML = "";
    return;
  }

  ui.detailRarity.textContent = `${card.rarity}卡`;
  ui.detailName.textContent = card.name;
  ui.detailSkill.textContent = card.skill;
  ui.detailSummary.textContent = card.effect;
  ui.detailTags.innerHTML = `
    <div class="detail-tag">${getCampDisplayName(card.camp)}</div>
    <div class="detail-tag">${card.type} · ${getCardAttackText(card, game)}</div>
  `;
  ui.detailLines.innerHTML = [
    { label: "定位", value: typeof card.row === "number" ? `当前位于 ${card.row + 1}-${card.col + 1}，适合按技能特点参与争夺。` : "当前在手牌中，可以先观察可下位置再决定是否出牌。" },
    { label: "技能", value: card.effect },
    { label: "状态", value: getCardStateNotes(game, card).join(" ") }
  ].map((item) => `<div class="detail-line"><strong>${item.label}</strong><span>${item.value}</span></div>`).join("");
}

function selectionMoveTargets(game, planner) {
  if (!game.selection.boardCardUid) {
    return [];
  }
  const card = game.boardCards.find((item) => item.uid === game.selection.boardCardUid && item.ownerId === planner.id);
  return card ? getValidMoves(game, card) : [];
}

function getMoveOutcomeMap(game, planner) {
  if (!game.selection.boardCardUid) {
    return new Map();
  }
  const card = game.boardCards.find((item) => item.uid === game.selection.boardCardUid && item.ownerId === planner.id);
  if (!card) {
    return new Map();
  }
  const outcomes = new Map();
  getValidMoves(game, card).forEach((cell) => {
    const target = getBoardCardAt(game, cell.row, cell.col);
    if (!target || target.ownerId === planner.id) {
      return;
    }
    const defendPosition = { row: target.row, col: target.col };
    outcomes.set(cellKey(cell.row, cell.col), resolveConflict(game, card, target, {
      positionA: defendPosition,
      positionB: defendPosition
    }));
  });
  return outcomes;
}

function createCellHint(text, variant) {
  const hint = document.createElement("span");
  hint.className = `cell-hint ${variant}`;
  hint.textContent = text;
  return hint;
}

function createUnitElement(card, game) {
  const element = document.createElement("div");
  const battleValue = resolveAttackValue(game, card);
  element.className = `unit player${card.ownerId}`;
  element.dataset.cardUid = card.uid;
  element.tabIndex = 0;
  element.setAttribute("aria-label", `${card.name}，当前战力 ${battleValue}，${getCampDisplayName(card.camp)}，${card.skill}。技能效果：${card.effect}`);
  element.innerHTML = `
    <div class="unit-main">
      <div class="unit-identity">
        <span class="unit-name">${card.name}</span>
        <span class="unit-camp">${getCampDisplayName(card.camp)}</span>
      </div>
      <span class="unit-attack" title="当前战力 ${battleValue}，基础战力 ${card.attack}">
        <strong>${battleValue}</strong>
        <small>战力</small>
      </span>
    </div>
    <span class="unit-skill">${card.skill}</span>
    <div class="unit-tooltip" role="tooltip">
      <span class="unit-tooltip-label">技能效果</span>
      <span>${card.effect}</span>
    </div>
  `;
  return element;
}

function render() {
  const game = state.game;
  if (!game) {
    return;
  }
  const planner = getPlannerPlayer(game);
  const controlMap = computeControlMap(game);
  ui.modeLabel.textContent = game.mode === "pve" ? "PVE" : "本地 1v1";
  ui.turnLabel.textContent = `第 ${game.turn} / ${MAX_TURNS} 回合`;
  ui.phaseLabel.textContent = game.isAnimating ? "结算阶段" : game.currentPhase;
  ui.deckLabel.textContent = `P1 ${game.players[0].drawPile.length} / P2 ${game.players[1].drawPile.length}`;
  ui.statusMessage.textContent = game.flowPrompt || game.lastResolution;
  ui.statusSubtext.textContent = game.isAnimating
    ? "行动动画播放中，结算完成后会自动进入下一步。"
    : game.mode === "pvp"
      ? "当前为秘密提交阶段，每名玩家基础行动次数固定为 1；若存在额外行动位，可继续提交对应行动，或直接空提交跳过。"
      : "玩家先提交行动，AI 将同步生成行动后统一结算；若存在额外行动位，可继续提交对应行动，或直接空提交跳过。";
  ui.actingPlayerLabel.textContent = planner.name;
  ui.actionsLabel.textContent = `P1 ${getSubmittedActions(game, 1).length}/${getActionLimit(game, 1)} · P2 ${getSubmittedActions(game, 2).length}/${getActionLimit(game, 2)}`;

  game.players.forEach((player) => {
    const text = `${getCampDisplayName(player.deckKey)} · 占领 ${controlMap.counts[player.id]} 格 · 手牌 ${player.hand.length}/${HAND_LIMIT} 张 · 牌库 ${player.drawPile.length} 张 · 行动 ${getSubmittedActions(game, player.id).length}/${getActionLimit(game, player.id)}`;
    if (player.id === 1) {
      ui.player1Control.textContent = `${controlMap.counts[player.id]} 格`;
      ui.player1Summary.textContent = text;
    } else {
      ui.player2Control.textContent = `${controlMap.counts[player.id]} 格`;
      ui.player2Summary.textContent = text;
    }
  });

  ui.handTitle.textContent = `${planner.name} 的手牌`;
  ui.submitActionBtn.disabled = game.isAnimating;
  ui.cancelSelectionBtn.disabled = game.isAnimating;
  ui.restartBtn.disabled = game.isAnimating;
  ui.backMenuBtn.disabled = game.isAnimating;

  renderSelectionSummary(game, planner);
  renderDetailPanel(game, planner);
  renderActionLog(game);
  renderBoard(game, planner, controlMap);
  renderHand(game, planner);
}

function renderActionLog(game) {
  if (!ui.actionLogList || !ui.actionLogTurn) {
    return;
  }
  ui.actionLogTurn.textContent = game.lastResolvedTurn > 0 ? `第 ${game.lastResolvedTurn} 回合` : "未结算";
  ui.actionLogList.innerHTML = "";
  const entries = Array.isArray(game.roundLog) && game.roundLog.length > 0
    ? game.roundLog
    : ["本回合尚无行动记录。"];
  entries.forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "action-log-item";
    item.innerHTML = `<strong>${String(index + 1).padStart(2, "0")}</strong><span>${entry}</span>`;
    ui.actionLogList.appendChild(item);
  });
}

function renderSelectionSummary(game, planner) {
  const selection = game.selection;
  if (game.isAnimating) {
    ui.selectionSummary.textContent = "行动已锁定，正在播放平移动画。";
    return;
  }
  if (selection.handCardUid && selection.targetCell) {
    const card = planner.hand.find((item) => item.uid === selection.handCardUid);
    ui.selectionSummary.textContent = `准备放置 ${card?.name || "卡牌"} 到 (${selection.targetCell.row + 1}, ${selection.targetCell.col + 1})。`;
    return;
  }
  if (selection.boardCardUid && selection.targetCell) {
    const card = game.boardCards.find((item) => item.uid === selection.boardCardUid);
    ui.selectionSummary.textContent = `准备将 ${card?.name || "卡牌"} 移动到 (${selection.targetCell.row + 1}, ${selection.targetCell.col + 1})。`;
    return;
  }
  if (selection.handCardUid) {
    const card = planner.hand.find((item) => item.uid === selection.handCardUid);
    const availability = getPlacementAvailability(game, planner.id, card);
    ui.selectionSummary.textContent = availability.cells.length > 0
      ? `已选中手牌 ${card?.name || ""}，请点击一个空格放置。`
      : `已选中手牌 ${card?.name || ""}，当前无法放置：${availability.reason}`;
    return;
  }
  if (selection.boardCardUid) {
    const card = game.boardCards.find((item) => item.uid === selection.boardCardUid);
    ui.selectionSummary.textContent = `已选中场上卡牌 ${card?.name || ""}，请点击一个可移动目标格。主动移动进入敌方所在格视为攻击，被进入的一方视为防守；若双方同时朝对方移动，则视为决斗。`;
    return;
  }
  ui.selectionSummary.textContent = "先选手牌进行放置，或先选己方场上卡牌再点目标格进行移动。";
}

function renderBoard(game, planner, controlMap) {
  ui.board.innerHTML = "";
  ui.boardAnimationLayer.innerHTML = "";
  const validMoveTargets = selectionMoveTargets(game, planner);
  const selectedHandCard = game.selection.handCardUid
    ? planner.hand.find((card) => card.uid === game.selection.handCardUid)
    : null;
  const placeableTargets = selectedHandCard ? getPlaceableCells(game, selectedHandCard, planner.id) : [];
  const moveOutcomeMap = getMoveOutcomeMap(game, planner);
  const pendingAction = game.isAnimating ? null : buildPendingAction(game, planner.id);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.disabled = game.isAnimating;

      if (isBrokenCell(game, row, col)) {
        cell.classList.add("blocked");
      }
      const influenceData = controlMap.influence.get(cellKey(row, col));
      if (influenceData) {
        if (influenceData.owners.size === 2) {
          cell.classList.add("contested");
        } else if (influenceData.owners.has(1)) {
          cell.classList.add("control-1");
        } else if (influenceData.owners.has(2)) {
          cell.classList.add("control-2");
        }
      }

      const isMoveTarget = validMoveTargets.some((item) => item.row === row && item.col === col);
      const isPlaceTarget = placeableTargets.some((item) => item.row === row && item.col === col);
      const isRestrictedPlacement = Boolean(game.selection.handCardUid) && !isBrokenCell(game, row, col) && !getBoardCardAt(game, row, col) && isBlockedByEnemyAdjacency(game, planner.id, row, col);
      const moveOutcome = moveOutcomeMap.get(cellKey(row, col));

      if ((isMoveTarget || isPlaceTarget) && !isBrokenCell(game, row, col)) {
        cell.classList.add("selectable");
      }
      if (isRestrictedPlacement) {
        cell.classList.add("restricted");
      }
      if (moveOutcome === "a") {
        cell.classList.add("capture");
      }
      if (moveOutcome === "both") {
        cell.classList.add("trade");
      }
      if (pendingAction && pendingAction.target.row === row && pendingAction.target.col === col) {
        cell.classList.add("pending");
      }

      const coord = document.createElement("span");
      coord.className = "cell-coord";
      coord.textContent = `${row + 1}-${col + 1}`;
      cell.appendChild(coord);

      const boardCard = getBoardCardAt(game, row, col);
      if (boardCard) {
        cell.appendChild(createUnitElement(boardCard, game));
      } else if (isBrokenCell(game, row, col)) {
        const blockedText = document.createElement("span");
        blockedText.className = "unit-meta";
        blockedText.textContent = "破坏格";
        cell.appendChild(blockedText);
      }

      if (isRestrictedPlacement) {
        cell.appendChild(createCellHint("被包围", "restricted"));
      }
      if (moveOutcome === "a") {
        cell.appendChild(createCellHint("可攻破", "capture"));
      }
      if (moveOutcome === "both") {
        cell.appendChild(createCellHint("将决斗", "trade"));
      }
      if (influenceData) {
        if (influenceData.owners.size === 2) {
          cell.appendChild(createCellHint("无人占领", "control"));
        } else if (influenceData.owners.has(1)) {
          cell.appendChild(createCellHint("P1 占领", "control"));
        } else if (influenceData.owners.has(2)) {
          cell.appendChild(createCellHint("P2 占领", "control"));
        }
      }

      cell.addEventListener("click", () => handleBoardClick(row, col));
      ui.board.appendChild(cell);
    }
  }
}

function renderHand(game, planner) {
  ui.handCards.innerHTML = "";
  planner.hand.forEach((card) => {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "card";
    element.disabled = game.isAnimating;
    if (game.selection.handCardUid === card.uid) {
      element.classList.add("selected");
    }
    element.innerHTML = `
      <div class="card-top">
        <h3>${card.name}</h3>
        <strong>ATK ${card.attack}</strong>
      </div>
      <p class="card-stats">${getCardTierLabel(card)} · ${card.skill}</p>
      <p class="card-effect">${card.effect}</p>
      <div class="card-tags">
        <span class="card-tag">${getCampDisplayName(card.camp)}</span>
        <span class="card-tag alt">上限 ${card.buffCap || card.attack}</span>
      </div>
    `;
    element.addEventListener("click", () => handleHandCardClick(card.uid));
    ui.handCards.appendChild(element);
  });
}

function handleHandCardClick(cardUid) {
  const game = state.game;
  if (!game || game.isAnimating) {
    return;
  }
  const planner = getPlannerPlayer(game);
  const nextSelectedUid = game.selection.handCardUid === cardUid ? null : cardUid;
  game.selection = {
    handCardUid: nextSelectedUid,
    boardCardUid: null,
    targetCell: null
  };
  if (nextSelectedUid) {
    const card = planner.hand.find((item) => item.uid === nextSelectedUid);
    const availability = getPlacementAvailability(game, planner.id, card);
    if (availability.cells.length === 0) {
      showToast("无法放置", `${card?.name || "该卡"}：${availability.reason}`);
    }
  }
  render();
}

function handleBoardClick(row, col) {
  const game = state.game;
  if (!game || game.isAnimating || isBrokenCell(game, row, col)) {
    return;
  }
  const planner = getPlannerPlayer(game);
  const boardCard = getBoardCardAt(game, row, col);
  if (game.selection.handCardUid) {
    const card = planner.hand.find((item) => item.uid === game.selection.handCardUid);
    const availability = getPlacementAvailability(game, planner.id, card);
    if (availability.cells.length === 0) {
      showToast("无法放置", `${card?.name || "该卡"}：${availability.reason}`);
      render();
      return;
    }
    if (!boardCard && availability.cells.some((cell) => cell.row === row && cell.col === col)) {
      game.selection.targetCell = { row, col };
    } else if (!boardCard) {
      showToast("此处不能放置", "该格不符合当前卡牌的放置规则，请选择高亮空格。");
    }
    render();
    return;
  }
  if (game.selection.boardCardUid) {
    const validTargets = selectionMoveTargets(game, planner);
    if (validTargets.some((cell) => cell.row === row && cell.col === col)) {
      game.selection.targetCell = { row, col };
      render();
      return;
    }
  }
  if (boardCard && boardCard.ownerId === planner.id) {
    game.selection = {
      handCardUid: null,
      boardCardUid: game.selection.boardCardUid === boardCard.uid ? null : boardCard.uid,
      targetCell: null
    };
    render();
  }
}

function renderResult(game) {
  ui.winnerTitle.textContent = game.winner.playerId === 0 ? "本局平局" : `${playerName(game, game.winner.playerId)} 获胜`;
  ui.winnerSubtitle.textContent = game.winner.text;
  const finalControl = game.finalControlCounts || game.players.reduce((counts, player) => {
    counts[player.id] = game.boardCards.filter((card) => !card.isGuard && card.ownerId === player.id).length;
    return counts;
  }, {});
  game.players.forEach((player) => {
    player.lastControlCount = finalControl[player.id] || 0;
  });
  ui.winnerControlSummary.textContent = `最终占领：玩家 1 ${finalControl[1] || 0} 格：${finalControl[2] || 0} 格 玩家 2`;
  const power = game.players.map((player) => game.boardCards
    .filter((card) => card.ownerId === player.id)
    .reduce((sum, card) => sum + (Number(card.currentAttack) || Number(card.attack) || 0), 0));
  const losingId = game.winner.playerId === 0 ? 0 : (power[0] < power[1] ? 1 : power[1] < power[0] ? 2 : 0);
  ui.winnerComparison.innerHTML = `<span class="winner-power ${losingId === 1 ? "losing-power" : ""}">${power[0]}</span><span class="winner-vs">VS</span><span class="winner-power ${losingId === 2 ? "losing-power" : ""}">${power[1]}</span>`;
  if (losingId) {
    window.setTimeout(() => {
      const losingPower = ui.winnerComparison.querySelector(`.winner-power:nth-of-type(${losingId === 1 ? 1 : 3})`);
      losingPower?.classList.add("power-slashed");
    }, 520);
  }
  ui.deckSummaryPlayer1.textContent = summarizeDeck(game.players[0].deckCatalog, game.players[0].deckKey);
  ui.deckSummaryPlayer2.textContent = summarizeDeck(game.players[1].deckCatalog, game.players[1].deckKey);
}

function summarizeDeck(deckCatalog, deckKey) {
  const bucket = deckCatalog.reduce((acc, card) => {
    const quality = getCardQuality(card);
    acc[quality] = (acc[quality] || 0) + 1;
    return acc;
  }, {});
  const order = ["普通", "稀有", "史诗", "传说", "特殊"];
  return `${getCampDisplayName(deckKey)} · ` + order.filter((key) => bucket[key]).map((key) => `${key}x${bucket[key]}`).join(" / ");
}

function finishGameByTurnLimit(game) {
  const controlMap = computeControlMap(game);
  game.players.forEach((player) => {
    player.lastControlCount = controlMap.counts[player.id];
  });
  game.finalControlCounts = { ...controlMap.counts };
  const [player1, player2] = game.players;
  const player1BoardCount = game.boardCards.filter((card) => card.ownerId === 1).length;
  const player2BoardCount = game.boardCards.filter((card) => card.ownerId === 2).length;
  if (player1.lastControlCount !== player2.lastControlCount) {
    const winner = player1.lastControlCount > player2.lastControlCount ? player1 : player2;
    game.winner = {
      playerId: winner.id,
      text: `已到第 ${MAX_TURNS} 回合，${winner.name} 以占领 ${winner.lastControlCount} 格获胜。`
    };
    return;
  }
  if (player1BoardCount !== player2BoardCount) {
    const winner = player1BoardCount > player2BoardCount ? player1 : player2;
    game.winner = {
      playerId: winner.id,
      text: `已到第 ${MAX_TURNS} 回合，双方占领格相同，${winner.name} 以场上 ${Math.max(player1BoardCount, player2BoardCount)} 张卡牌获胜。`
    };
    return;
  }
  game.winner = {
    playerId: 0,
    text: `已到第 ${MAX_TURNS} 回合，双方占领格与场上卡牌数相同，本局判定为平局。`
  };
}

function showResult() {
  renderResult(state.game);
  switchScreen("result");
}

function getEightDirectionAdjacentEmptyCells(game, card) {
  return getEightNeighbors(card.row, card.col).filter((cell) => (
    isInsideBoard(cell.row, cell.col)
    && !isBrokenCell(game, cell.row, cell.col)
    && !getBoardCardAt(game, cell.row, cell.col)
  ));
}

function getZhugePlaceRestrictionCells(game, playerId) {
  const enemyId = otherPlayerId(playerId);
  const zhugeExists = game.boardCards.some((card) => isCard(card, "0114") && card.ownerId === enemyId);
  if (!zhugeExists) {
    return null;
  }
  const cells = [];
  game.boardCards.forEach((card) => {
    if (card.ownerId !== enemyId) {
      return;
    }
    getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
      if (
        isInsideBoard(cell.row, cell.col)
        && !isBrokenCell(game, cell.row, cell.col)
        && !getBoardCardAt(game, cell.row, cell.col)
        && !cells.some((item) => item.row === cell.row && item.col === cell.col)
      ) {
        cells.push(cell);
      }
    });
  });
  return cells.length > 0 ? cells : null;
}

function tryTriggerDefenderAvoidance(game, boardCards, attackerCard, defenderCard, attackAction, actionLog) {
  if (!attackerCard || !defenderCard || !attackAction) {
    return false;
  }
  if (isCard(defenderCard, "0214")) {
    const ally = getOrthogonalNeighbors(defenderCard.row, defenderCard.col)
      .map((cell) => getBoardCardAt({ ...game, boardCards }, cell.row, cell.col))
      .find((card) => card && card.ownerId === defenderCard.ownerId && card.uid !== defenderCard.uid);
    if (ally) {
      const row = defenderCard.row;
      const col = defenderCard.col;
      defenderCard.row = ally.row;
      defenderCard.col = ally.col;
      ally.row = row;
      ally.col = col;
      actionLog.push(`${defenderCard.name} 在被攻击前与相邻友军交换了位置。`);
    }
  }
  if (isCard(defenderCard, "0215")) {
    const emptyCells = getEightDirectionAdjacentEmptyCells({ ...game, boardCards }, defenderCard);
    if (emptyCells.length > 0) {
      const target = emptyCells[randomInt(0, emptyCells.length - 1)];
      defenderCard.row = target.row;
      defenderCard.col = target.col;
      actionLog.push(`${defenderCard.name} 在被攻击前闪避到了空位。`);
      return true;
    }
  }
  if (isCard(defenderCard, "0116")) {
    const defendPosition = { row: defenderCard.row, col: defenderCard.col };
    const defendValue = resolveAttackValue({ ...game, boardCards }, defenderCard, attackerCard, {
      selfPosition: defendPosition,
      targetPosition: defendPosition,
      mode: "attack",
      isDefender: true
    });
    const attackValue = resolveAttackValue({ ...game, boardCards }, attackerCard, defenderCard, {
      selfPosition: defendPosition,
      targetPosition: defendPosition,
      mode: "attack"
    });
    if (defendValue < attackValue) {
      const emptyCells = getOrthogonalNeighbors(defenderCard.row, defenderCard.col).filter((cell) => (
        isInsideBoard(cell.row, cell.col)
        && !isBrokenCell(game, cell.row, cell.col)
        && !getBoardCardAt({ ...game, boardCards }, cell.row, cell.col)
      ));
      if (emptyCells.length > 0) {
        const target = emptyCells[randomInt(0, emptyCells.length - 1)];
        defenderCard.row = target.row;
        defenderCard.col = target.col;
        adjustCardAttack(defenderCard, -1);
        queueSkillAnimation(game, defenderCard, `${defenderCard.name} 后撤`, "skill-warn");
        actionLog.push(`${defenderCard.name} 防守失利前后撤并失去了 1 点战力。`);
        processRealtimeEffects(game, boardCards, actionLog);
        return true;
      }
    }
  }
  return false;
}

function triggerCrossedCards(game, boardCards, movingCard, action, actionLog) {
  if (!isCard(movingCard, "0109")) {
    return;
  }
  getActionPath(action).forEach((cell) => {
    if (cell.row === action.target.row && cell.col === action.target.col) {
      return;
    }
    const crossed = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
    if (crossed) {
      destroyBoardCard(game, boardCards, crossed, actionLog, "西凉铁骑跨越");
    }
  });
}

function triggerSimaYiSweep(game, boardCards, card, actionLog) {
  if (!isCard(card, "0214")) {
    return false;
  }
  let destroyedCount = 0;
  getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
    const target = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
    if (target && resolveAttackValue({ ...game, boardCards }, target) <= 2) {
      const destroyed = destroyBoardCard(game, boardCards, target, actionLog, "鹰视狼顾");
      if (destroyed) {
        destroyedCount += 1;
      }
    }
  });
  if (destroyedCount > 0) {
    adjustCardAttack(card, destroyedCount);
  }
  return destroyedCount > 0;
}

function processRealtimeEffects(game, boardCards, actionLog) {
  if (game.processingRealtime) {
    return;
  }
  game.processingRealtime = true;
  try {
    let changed = true;
    let guard = 0;
    while (changed && guard < 10) {
      changed = false;
      guard += 1;
      [...boardCards].forEach((card) => {
        if (!boardCards.find((item) => item.uid === card.uid)) {
          return;
        }
        if (triggerSimaYiSweep(game, boardCards, card, actionLog)) {
          changed = true;
        }
      });
      const beforeCount = boardCards.length;
      removeNegativeAttackCards(game, boardCards, actionLog);
      if (boardCards.length !== beforeCount) {
        changed = true;
      }
    }
  } finally {
    game.processingRealtime = false;
  }
}

function countsAsBreak(mode) {
  return mode === "attack" || mode === "duel";
}

function resolveAttackValue(game, card, targetCard = null, context = {}) {
  const selfCard = makeVirtualCard(card, context.selfPosition);
  let value = typeof selfCard.currentAttack === "number" ? selfCard.currentAttack : selfCard.attack;
  if (!game || typeof selfCard.row !== "number" || typeof selfCard.col !== "number") {
    return value;
  }
  const defender = targetCard ? makeVirtualCard(targetCard, context.targetPosition) : null;
  const duel = context.mode === "duel";
  const attack = context.mode === "attack";
  if (isCard(selfCard, "0202") && (attack || duel)) {
    value += 1;
  }
  if (isCard(selfCard, "0108") && (attack || duel) && defender) {
    const defenderValue = typeof defender.currentAttack === "number" ? defender.currentAttack : defender.attack;
    if (value === defenderValue) {
      value += 1;
    }
  }
  if (isCard(selfCard, "0212") && duel) {
    const duelSelf = context.selfPosition ? makeVirtualCard(selfCard, context.selfPosition) : selfCard;
    value += countAdjacentEnemies(game, duelSelf);
  }
  if (isCard(selfCard, "0116") && duel) {
    value = Math.max(value, 999);
  }
  if (isCard(selfCard, "0316") && context.isDefender) {
    value -= 4;
  }
  return value;
}

function resolveConflict(game, cardA, cardB, context = {}) {
  const mode = context.mode || "duel";
  if (isCard(cardA, "0206") && mode === "attack" && context.defenderUid === cardA.uid) {
    return "a";
  }
  if (isCard(cardB, "0206") && mode === "attack" && context.defenderUid === cardB.uid) {
    return "b";
  }
  const attackA = resolveAttackValue(game, cardA, cardB, { selfPosition: context.positionA, targetPosition: context.positionB, mode, isDefender: context.defenderUid === cardA.uid });
  const attackB = resolveAttackValue(game, cardB, cardA, { selfPosition: context.positionB, targetPosition: context.positionA, mode, isDefender: context.defenderUid === cardB.uid });
  if ((isCard(cardA, "0217") || isCard(cardB, "0217") || isCard(cardA, "0318") || isCard(cardB, "0318")) && (mode === "attack" || mode === "duel")) {
    return "both";
  }
  if (isCard(cardA, "0113") && (mode === "attack" || mode === "duel")) {
    adjustCardAttack(cardA, -1);
    return "a";
  }
  if (isCard(cardB, "0113") && (mode === "attack" || mode === "duel")) {
    adjustCardAttack(cardB, -1);
    return "b";
  }
  if (isCard(cardA, "0108") && (mode === "attack" || mode === "duel") && attackA < attackB) {
    return "both";
  }
  if (isCard(cardB, "0108") && (mode === "attack" || mode === "duel") && attackB < attackA) {
    return "both";
  }
  if (attackA < 0 && attackB < 0) {
    return "both";
  }
  if (attackA < 0) {
    return "b";
  }
  if (attackB < 0) {
    return "a";
  }
  if (attackA > attackB) {
    return "a";
  }
  if (attackB > attackA) {
    return "b";
  }
  return "both";
}
function tryRepelAttacker(game, boardCards, attackerCard, defenderCard, attackAction, actionLog) {
  const defendPosition = { row: defenderCard.row, col: defenderCard.col };
  const retreatPosition = getRetreatPosition(attackAction, defendPosition);
  const occupied = boardCards.find(
    (card) => card.uid !== attackerCard.uid && card.row === retreatPosition.row && card.col === retreatPosition.col
  );
  if (isInsideBoard(retreatPosition.row, retreatPosition.col) && !isBrokenCell(game, retreatPosition.row, retreatPosition.col) && !occupied) {
    attackerCard.row = retreatPosition.row;
    attackerCard.col = retreatPosition.col;
    actionLog.push(`${describeCard(game, attackerCard)} 攻击未能击破防守方，被击退回原进攻方向相邻的位置。`);
    return false;
  }
  return destroyBoardCard(game, boardCards, attackerCard, actionLog, "受阻后无处可退", "break");
}

function getPlacementAvailability(game, playerId, card = null) {
  const player = getPlayer(game, playerId);
  if (!player) {
    return { cells: [], reason: "当前没有可执行放置的玩家。" };
  }
  if (game.placeLockTurn[playerId] === game.turn) {
    return { cells: [], reason: "受到徐晃「兵粮寸断」影响，本回合无法放置卡牌。" };
  }
  if (getEnemyCards(game, playerId).length > 5 && game.boardCards.some((item) => item.ownerId === otherPlayerId(playerId) && isCard(item, "0208"))) {
    return { cells: [], reason: "敌方徐晃限制生效：敌方场上卡牌超过 5 张时，无法放置卡牌。" };
  }

  const restrictedByZhuge = getZhugePlaceRestrictionCells(game, player.id);
  const cells = [];
  let emptyCount = 0;
  let fireBlockedCount = 0;
  let surroundedCount = 0;
  let zhugeBlockedCount = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (isBrokenCell(game, row, col) || getBoardCardAt(game, row, col)) {
        continue;
      }
      emptyCount += 1;
      const blockedByFire = game.boardCards.some((card) => isCard(card, "0320") && getEightNeighbors(card.row, card.col).some((cell) => cell.row === row && cell.col === col));
      if (blockedByFire) {
        fireBlockedCount += 1;
        continue;
      }
      if (isBlockedByEnemyAdjacency(game, player.id, row, col)) {
        surroundedCount += 1;
        continue;
      }
      if (restrictedByZhuge && !restrictedByZhuge.some((cell) => cell.row === row && cell.col === col)) {
        zhugeBlockedCount += 1;
        continue;
      }
      if (isCard(card, "0320") && !isEdgeCell(row, col)) {
        continue;
      }
      cells.push({ row, col });
    }
  }

  if (cells.length > 0) {
    return { cells, reason: "" };
  }
  if (emptyCount === 0) {
    return { cells, reason: "战场已没有可用空格。" };
  }
  if (isCard(card, "0320")) {
    return { cells, reason: `${card.name} 只能放置在边缘，但边缘没有合法空格。` };
  }
  if (fireBlockedCount === emptyCount) {
    return { cells, reason: "赤壁火攻令的火焰封锁了所有可用空格。" };
  }
  if (surroundedCount + fireBlockedCount === emptyCount) {
    return { cells, reason: "所有可用空格都被敌军或破坏格包围，无法直接下牌。" };
  }
  if (zhugeBlockedCount > 0) {
    return { cells, reason: "诸葛亮「八阵天机」限制了放置区域，当前没有合法落点。" };
  }
  return { cells, reason: "当前没有符合放置规则的空格。" };
}

function getPlaceableCells(game, card = null, playerId = null) {
  const player = playerId ? getPlayer(game, playerId) : getPlannerPlayer(game);
  return getPlacementAvailability(game, player?.id, card).cells;
}

function buildPendingAction(game, playerId) {
  const player = game.players.find((item) => item.id === playerId);
  const selection = game.selection;
  if (selection.handCardUid && selection.targetCell) {
    const card = player.hand.find((item) => item.uid === selection.handCardUid);
    if (!card) {
      return null;
    }
    if (game.placeLockTurn[playerId] === game.turn) {
      return null;
    }
    if (getEnemyCards(game, playerId).length > 5 && game.boardCards.some((item) => item.ownerId === otherPlayerId(playerId) && isCard(item, "0208"))) {
      return null;
    }
    const { row, col } = selection.targetCell;
    const placeable = getPlaceableCells(game, card, playerId);
    if (!placeable.some((cell) => cell.row === row && cell.col === col)) {
      return null;
    }
    if (isCard(card, "0320") && !isEdgeCell(row, col)) {
      return null;
    }
    return { type: "place", playerId, cardUid: card.uid, target: { row, col } };
  }
  if (selection.boardCardUid && selection.targetCell) {
    const boardCard = game.boardCards.find((item) => item.uid === selection.boardCardUid && item.ownerId === playerId);
    if (!boardCard || game.moveLocks[boardCard.uid]) {
      return null;
    }
    const validMove = getValidMoves(game, boardCard).some((cell) => cell.row === selection.targetCell.row && cell.col === selection.targetCell.col);
    if (!validMove) {
      return null;
    }
    return {
      type: "move",
      playerId,
      cardUid: boardCard.uid,
      source: { row: boardCard.row, col: boardCard.col },
      target: { ...selection.targetCell }
    };
  }
  return null;
}

function triggerOnDefeatEffects(game, boardCards, winnerCard, loserCard, actionLog, mode = "duel") {
  if (!winnerCard || !loserCard) {
    return;
  }
  const breakResult = countsAsBreak(mode);
  if (breakResult && isCard(winnerCard, "0105")) {
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 裂阵`);
    getOrthogonalNeighbors(loserCard.row, loserCard.col).forEach((cell) => {
      const enemy = getBoardCardAt({ ...game, boardCards }, cell.row, cell.col);
      if (enemy && enemy.ownerId !== winnerCard.ownerId) {
        destroyBoardCard(game, boardCards, enemy, actionLog, "猛骑裂阵");
      }
    });
  }
  if (breakResult && isCard(winnerCard, "0212")) {
    adjustCardAttack(winnerCard, 1);
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 势起`);
  }
  if (breakResult && isCard(winnerCard, "0316") && loserCard.ownerId !== winnerCard.ownerId) {
    adjustCardAttack(winnerCard, 1);
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 夺势`);
  }
  if (breakResult && isCard(winnerCard, "0304")) {
    const winnerPlayer = getPlayer(game, winnerCard.ownerId);
    removeBoardCard(boardCards, winnerCard.uid);
    if (winnerPlayer && winnerPlayer.hand.length < HAND_LIMIT) {
      addCardToHand(winnerPlayer, { ...winnerCard });
    }
    discardRandomHandCard(game, 1, 1, actionLog);
    discardRandomHandCard(game, 2, 1, actionLog);
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 返手`);
    actionLog.push(`${winnerCard.name} 攻破后返回了手牌。`);
  }
  if (mode === "duel" && isCard(winnerCard, "0116")) {
    adjustCardAttack(winnerCard, 1);
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 决胜`);
  }
  if (breakResult && isCard(winnerCard, "0307")) {
    const winnerPlayer = getPlayer(game, winnerCard.ownerId);
    if (winnerPlayer) {
      discardRandomHandCard(game, winnerPlayer.id, 1, actionLog);
    }
    queueSkillAnimation(game, winnerCard, `${winnerCard.name} 追击`);
    const nextTarget = getLowestAttackEnemy({ ...game, boardCards }, winnerCard.ownerId, winnerCard.row, winnerCard.col);
    if (nextTarget) {
      const outcome = resolveConflict({ ...game, boardCards }, winnerCard, nextTarget, {
        mode: "attack",
        positionA: { row: nextTarget.row, col: nextTarget.col },
        positionB: { row: nextTarget.row, col: nextTarget.col },
        defenderUid: nextTarget.uid
      });
      if (outcome === "a") {
        destroyBoardCard(game, boardCards, nextTarget, actionLog, "乘胜追杀");
        if (boardCards.find((item) => item.uid === winnerCard.uid)) {
          triggerOnDefeatEffects(game, boardCards, winnerCard, nextTarget, actionLog, "attack");
        }
      } else if (outcome === "both") {
        destroyBoardCard(game, boardCards, nextTarget, actionLog, "乘胜追杀");
        destroyBoardCard(game, boardCards, winnerCard, actionLog, "乘胜追杀");
      }
    }
  }

}

function hasFriendlyZhouYu(boardCards, ownerId) {
  return boardCards.some((card) => card.ownerId === ownerId && isCard(card, "0315"));
}

function trySpawnZhouYuTokenAt(game, boardCards, ownerId, row, col, actionLog) {
  if (!hasFriendlyZhouYu(boardCards, ownerId) || isBrokenCell(game, row, col)) {
    return false;
  }
  if (getBoardCardAt({ ...game, boardCards }, row, col)) {
    return false;
  }
  const token = createCampToken(ownerId, "三国~吴", "江东水军", 3, "被攻破时，弃置我方一张手牌。");
  token.row = row;
  token.col = col;
  boardCards.push(token);
  if (actionLog) {
    actionLog.push(`周瑜军略在 ${row + 1}-${col + 1} 召来了江东水军。`);
  }
  return true;
}

function tryReturnAttackerToOriginAfterBreak(game, boardCards, attackerCard, attackAction, actionLog) {
  if (!attackAction || !hasFriendlyZhouYu(boardCards, attackerCard.ownerId)) {
    return;
  }
  const { row, col } = attackAction.source;
  if (isBrokenCell(game, row, col)) {
    return;
  }
  const occupied = boardCards.find((card) => card.uid !== attackerCard.uid && card.row === row && card.col === col);
  if (occupied) {
    return;
  }
  attackerCard.row = row;
  attackerCard.col = col;
  actionLog.push(`${attackerCard.name} 在周瑜军略下回到了原位。`);
}

function applyOnPlaceEffect(game, player, card, actionLog) {
  // "放置时"效果只在该卡首次从手牌进入战场时结算一次。
  if (card.hasPlaced) {
    return;
  }
  const boardCards = game.boardCards;
  card.hasPlaced = true;
  if (isCard(card, "0204")) {
    getOrthogonalNeighbors(card.row, card.col).forEach((cell) => {
      const ally = getBoardCardAt(game, cell.row, cell.col);
      if (ally && ally.ownerId === player.id) {
        adjustCardAttack(ally, 1);
      }
    });
  }
  if (isCard(card, "0205") || isCard(card, "0306")) {
    if (isCard(card, "0306")) {
      const enemy = getPlayer(game, otherPlayerId(player.id));
      if (enemy && enemy.drawPile.length > 0 && player.hand.length < HAND_LIMIT) {
        const drawn = enemy.drawPile.shift();
        drawn.ownerId = player.id;
        player.hand.push(drawn);
      }
    } else {
      drawOneCard(game, player);
    }
  }
  if (isCard(card, "0119")) {
    getAlliedCards(game, player.id)
      .filter((ally) => ally.uid !== card.uid)
      .forEach((ally) => adjustCardAttack(ally, 1));
    queueSkillAnimation(game, card, `${card.name} 发动`);
  }
  if (isCard(card, "0312") && card.ownerId === player.id) {
    const convertedOwnerId = otherPlayerId(player.id);
    card.ownerId = convertedOwnerId;
    const effectText = `对自身使用，使其转换为${playerName(game, convertedOwnerId)}的卡牌；基础势力仍为三国~吴。`;
    actionLog.push(`${card.name} 落地后以${card.skill}${effectText}`);
    queueSkillAnimation(game, card, effectText, "skill-warn");
  }
  if (isCard(card, "0314")) {
    const control = computeControlMap(game);
    if ((control.counts[otherPlayerId(player.id)] || 0) > (control.counts[player.id] || 0)) {
      for (let i = 0; i < 2; i += 1) {
        const randomHandCard = player.hand.splice(randomInt(0, player.hand.length - 1), 1)[0];
        if (!randomHandCard) {
          break;
        }
        const empty = getEmptyCells(game);
        if (empty.length === 0) {
          addCardToHand(player, randomHandCard);
          break;
        }
        const target = empty[randomInt(0, empty.length - 1)];
        randomHandCard.row = target.row;
        randomHandCard.col = target.col;
        randomHandCard.ownerId = player.id;
        game.boardCards.push(randomHandCard);
      }
    }
  }
  if (isCard(card, "0208")) {
    game.placeLockTurn[otherPlayerId(player.id)] = game.turn + 1;
  }
  if (isCard(card, "0210")) {
    const twoAway = [
      { row: card.row - 2, col: card.col },
      { row: card.row + 2, col: card.col },
      { row: card.row, col: card.col - 2 },
      { row: card.row, col: card.col + 2 }
    ];
    twoAway.forEach((cell) => {
      const ally = getBoardCardAt(game, cell.row, cell.col);
      const midRow = card.row + Math.sign(cell.row - card.row);
      const midCol = card.col + Math.sign(cell.col - card.col);
      if (ally && ally.ownerId === player.id && !getBoardCardAt(game, midRow, midCol) && !isBrokenCell(game, midRow, midCol)) {
        ally.row = midRow;
        ally.col = midCol;
      }
    });
  }
  if (isCard(card, "0216")) {
    const weiCount = boardCards.filter((unit) => (
      unit.uid !== card.uid
      && unit.ownerId === player.id
      && unit.camp === "三国~魏"
    )).length;
    adjustCardAttack(card, weiCount);
  }
  if (isCard(card, "0303")) {
    getAdjacentEmptyCells(game, card.row, card.col).forEach((cell) => {
      const token = createReinforcementCard(otherPlayerId(player.id));
      token.row = cell.row;
      token.col = cell.col;
      boardCards.push(token);
    });
  }
  if (isCard(card, "0307")) {
    const target = getLowestAttackEnemy({ ...game, boardCards }, player.id, card.row, card.col);
    if (target) {
      const outcome = resolveConflict({ ...game, boardCards }, card, target, {
        mode: "attack",
        positionA: { row: target.row, col: target.col },
        positionB: { row: target.row, col: target.col },
        defenderUid: target.uid
      });
      if (outcome === "a") {
        destroyBoardCard(game, boardCards, target, actionLog, "潘璋突袭");
        triggerOnDefeatEffects(game, boardCards, card, target, actionLog, "attack");
      } else if (outcome === "both") {
        destroyBoardCard(game, boardCards, target, actionLog, "潘璋突袭");
        destroyBoardCard(game, boardCards, card, actionLog, "潘璋突袭");
      }
    }
  }
  if (isCard(card, "0315")) {
    const adjacentEnemies = getOrthogonalNeighbors(card.row, card.col)
      .map((cell) => getBoardCardAt(game, cell.row, cell.col))
      .filter((item) => item && item.ownerId !== player.id);
    if (adjacentEnemies.length > 0) {
      const target = adjacentEnemies[randomInt(0, adjacentEnemies.length - 1)];
      const duelTarget = chooseZhouYuDuelTarget(game, target, card);
      if (duelTarget) {
        const outcome = resolveConflict(game, target, duelTarget, {
          mode: "duel",
          positionA: { row: target.row, col: target.col },
          positionB: { row: duelTarget.row, col: duelTarget.col }
        });
        if (outcome === "a") {
          destroyBoardCard(game, game.boardCards, duelTarget, actionLog, "周瑜借势决斗");
          triggerOnDefeatEffects(game, game.boardCards, target, duelTarget, actionLog, "duel");
        } else if (outcome === "b") {
          destroyBoardCard(game, game.boardCards, target, actionLog, "周瑜借势决斗");
          triggerOnDefeatEffects(game, game.boardCards, duelTarget, target, actionLog, "duel");
        } else {
          destroyBoardCard(game, game.boardCards, target, actionLog, "周瑜借势决斗");
          destroyBoardCard(game, game.boardCards, duelTarget, actionLog, "周瑜借势决斗");
        }
      }
    }
  }
  processRealtimeEffects(game, game.boardCards, actionLog);
}

function applyEndTurnEffects(game, boardCards, actionLog) {
  game.currentPhase = "结束阶段";
  const snapshot = [...boardCards];
  snapshot.forEach((card) => {
    if (!boardCards.find((item) => item.uid === card.uid)) {
      return;
    }
    if (isCard(card, "0117")) {
      const targets = boardCards.filter((target) => target.uid !== card.uid && (target.row === card.row || target.col === card.col));
      targets.forEach((target) => adjustCardAttack(target, -1));
      if (targets.length > 0) {
        const effectText = `对同一行或列的 ${targets.map((target) => target.name).join("、")} 使用，使他们战力-1。`;
        actionLog.push(`${card.name} 在结束阶段以${card.skill}${effectText}`);
        queueSkillAnimation(game, card, effectText);
      }
    }
    if (isCard(card, "0110")) {
      const adjacentEnemyCount = countAdjacentEnemies({ ...game, boardCards }, card);
      if (adjacentEnemyCount > 0) {
        adjustCardAttack(card, -adjacentEnemyCount);
      }
      const dirs = [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }];
      dirs.forEach((dir) => {
        for (let step = 1; step <= BOARD_SIZE; step += 1) {
          const row = card.row + dir.row * step;
          const col = card.col + dir.col * step;
          if (!isInsideBoard(row, col)) {
            break;
          }
          const target = getBoardCardAt({ ...game, boardCards }, row, col);
          if (target) {
            if (target.ownerId !== card.ownerId) {
              adjustCardAttack(target, -1);
              if (resolveAttackValue({ ...game, boardCards }, target) < resolveAttackValue({ ...game, boardCards }, card)) {
                destroyBoardCard(game, boardCards, target, actionLog, "黄忠远射");
              }
            }
            break;
          }
        }
      });
    }
    if (isCard(card, "0210") && countAdjacentAllies({ ...game, boardCards }, card) >= 2) {
      adjustCardAttack(card, 1);
      const effectText = "对自身使用，使自身战力+1。";
      actionLog.push(`${card.name} 在结束阶段以${card.skill}${effectText}`);
      queueSkillAnimation(game, card, effectText);
    }
    if (isCard(card, "0213")) {
      const adjacentEnemies = getEightNeighbors(card.row, card.col)
        .map((cell) => getBoardCardAt({ ...game, boardCards }, cell.row, cell.col))
        .filter((target) => target && target.ownerId !== card.ownerId);
      if (adjacentEnemies.length > 0) {
        const target = adjacentEnemies[randomInt(0, adjacentEnemies.length - 1)];
        const outcome = resolveConflict({ ...game, boardCards }, card, target, {
          mode: "duel",
          positionA: { row: card.row, col: card.col },
          positionB: { row: target.row, col: target.col }
        });
        if (outcome === "a") {
          const targetRow = target.row;
          const targetCol = target.col;
          destroyBoardCard(game, boardCards, target, actionLog, "虎痴震岳");
          triggerOnDefeatEffects(game, boardCards, card, target, actionLog, "duel");
          if (boardCards.find((item) => item.uid === card.uid)) {
            card.row = targetRow;
            card.col = targetCol;
          }
        } else if (outcome === "b") {
          destroyBoardCard(game, boardCards, card, actionLog, "虎痴震岳");
          triggerOnDefeatEffects(game, boardCards, target, card, actionLog, "duel");
        } else {
          destroyBoardCard(game, boardCards, card, actionLog, "虎痴震岳");
          destroyBoardCard(game, boardCards, target, actionLog, "虎痴震岳");
        }
      } else {
        adjustCardAttack(card, -2);
      }
      if (boardCards.find((item) => item.uid === card.uid) && resolveAttackValue({ ...game, boardCards }, card) < 3) {
        const enemies = getEnemyCards({ ...game, boardCards }, card.ownerId).sort((a, b) => resolveAttackValue({ ...game, boardCards }, b) - resolveAttackValue({ ...game, boardCards }, a));
        if (enemies.length > 0) {
          destroyBoardCard(game, boardCards, enemies[0], actionLog, "虎痴震岳终击");
        }
        destroyBoardCard(game, boardCards, card, actionLog, "虎痴震岳自毁");
      }
    }
  });
  processRealtimeEffects(game, boardCards, actionLog);
}

async function resolveActionBatch(game, nextBoard, actionA, actionB, actionLog) {
  const actions = [actionA, actionB];
  await playActionAnimations(game, actions);
  const resolvedMoveCards = new Set();
  const directCollision = detectActionCollision(actionA, actionB);
  if (directCollision) {
    const cardA = nextBoard.find((item) => item.uid === actionA.cardUid);
    const cardB = nextBoard.find((item) => item.uid === actionB.cardUid);
    if (cardA && cardB) {
      const duelPositionA = { ...actionA.source };
      const duelPositionB = { ...actionB.source };
      cardA.row = directCollision.point.row;
      cardA.col = directCollision.point.col;
      cardB.row = directCollision.point.row;
      cardB.col = directCollision.point.col;
      applyMoveBuff(cardA);
      applyMoveBuff(cardB);
      resolvedMoveCards.add(cardA.uid);
      resolvedMoveCards.add(cardB.uid);
      const combatScene = await playCombatClashAnimation(game, cardA, cardB, directCollision.point.row, directCollision.point.col, "决斗");
      const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, {
        positionA: duelPositionA,
        positionB: duelPositionB
      });
      if (outcome === "a") {
        cardA.row = actionA.target.row;
        cardA.col = actionA.target.col;
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗失败", "break");
        triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "duel");
      } else if (outcome === "b") {
        cardB.row = actionB.target.row;
        cardB.col = actionB.target.col;
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗失败", "break");
        triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "duel");
      } else {
        destroyBoardCard(game, nextBoard, cardA, actionLog, "移动决斗同归于尽", "break");
        destroyBoardCard(game, nextBoard, cardB, actionLog, "移动决斗同归于尽", "break");
      }
      await finishCombatAnimation(game, combatScene, nextBoard, outcome);
    }
  }
  await flushPendingAnimations(game);

  for (const action of actions) {
    if (action.type === "pass") {
      continue;
    }
    if (action.type === "place") {
      const player = game.players.find((item) => item.id === action.playerId);
      const handIndex = player.hand.findIndex((card) => card.uid === action.cardUid);
      const card = handIndex >= 0 ? player.hand.splice(handIndex, 1)[0] : null;
      if (!card) {
        continue;
      }
      const placedCard = { ...card, row: action.target.row, col: action.target.col };
      nextBoard.push(placedCard);
      applyOnPlaceEffect({ ...game, boardCards: nextBoard }, player, placedCard, actionLog);
      applyPostPlaceReactions({ ...game, boardCards: nextBoard }, placedCard, actionLog);
      actionLog.push(`${playerName(game, action.playerId)} 将 ${card.name} 放置于 ${formatCell(action.target.row, action.target.col)}。`);
      await flushPendingAnimations(game);
      continue;
    }
    if (action.type !== "move" || resolvedMoveCards.has(action.cardUid)) {
      continue;
    }
    const card = nextBoard.find((item) => item.uid === action.cardUid);
    if (!card) {
      continue;
    }
    const alliedTarget = nextBoard.find((item) => (
      item.uid !== card.uid
      && item.ownerId === card.ownerId
      && item.row === action.target.row
      && item.col === action.target.col
    ));
    if (alliedTarget && !isCard(card, "0209")) {
      continue;
    }
    const sourceRow = card.row;
    const sourceCol = card.col;
    if (alliedTarget && isCard(card, "0209")) {
      alliedTarget.row = sourceRow;
      alliedTarget.col = sourceCol;
      adjustCardAttack(card, 1);
    }
    card.row = action.target.row;
    card.col = action.target.col;
    actionLog.push(`${playerName(game, action.playerId)} 将 ${card.name} 从 ${formatCell(sourceRow, sourceCol)} 移动至 ${formatCell(action.target.row, action.target.col)}。`);
    applyMoveBuff(card);
    if (alliedTarget && isCard(card, "0209")) {
      applyMoveAdjacencyEffects(game, nextBoard, alliedTarget);
    }
    triggerCrossedCards(game, nextBoard, card, action, actionLog);
    if (isCard(card, "0201") && !getBoardCardAt({ ...game, boardCards: nextBoard }, sourceRow, sourceCol) && !isBrokenCell(game, sourceRow, sourceCol)) {
      const token = createReinforcementCard(card.ownerId);
      token.row = sourceRow;
      token.col = sourceCol;
      nextBoard.push(token);
      queueSkillAnimation(game, card, `${card.name} 留下援兵`);
    }
    if (isCard(card, "0214")) {
      getEightNeighbors(card.row, card.col).forEach((cell) => {
        const target = getBoardCardAt({ ...game, boardCards: nextBoard }, cell.row, cell.col);
        if (target) {
          adjustCardAttack(target, -1);
        }
      });
      queueSkillAnimation(game, card, `${card.name} 扫荡`);
    }
    if (isCard(card, "0309")) {
      findNearestCardInDirections({ ...game, boardCards: nextBoard }, card).forEach(({ card: target, direction }) => {
        if (target.ownerId === card.ownerId) {
          return;
        }
        const pushRow = target.row + direction.row;
        const pushCol = target.col + direction.col;
        if (isInsideBoard(pushRow, pushCol) && !isBrokenCell(game, pushRow, pushCol) && !getBoardCardAt({ ...game, boardCards: nextBoard }, pushRow, pushCol)) {
          target.row = pushRow;
          target.col = pushCol;
        }
      });
      queueSkillAnimation(game, card, `${card.name} 冲阵`);
    }
    applyMoveAdjacencyEffects(game, nextBoard, card);
    if (isCard(card, "0317")) {
      const stepRow = Math.sign(action.target.row - action.source.row);
      const stepCol = Math.sign(action.target.col - action.source.col);
      let row = card.row + stepRow;
      let col = card.col + stepCol;
      while (isInsideBoard(row, col) && !isBrokenCell(game, row, col)) {
        const target = getBoardCardAt({ ...game, boardCards: nextBoard }, row, col);
        if (target) {
          destroyBoardCard(game, nextBoard, target, actionLog, "楼船冲锋");
        }
        row += stepRow;
        col += stepCol;
      }
      destroyBoardCard(game, nextBoard, card, actionLog, "楼船冲锋自毁");
      queueSkillAnimation(game, card, `${card.name} 冲锋`, "skill-warn");
    }
    await flushPendingAnimations(game);
  }

  removeNegativeAttackCards(game, nextBoard, actionLog);
  const occupiedByPosition = new Map();
  const actionByCardUid = new Map();
  [actionA, actionB].forEach((action) => {
    if (action.type !== "pass") {
      actionByCardUid.set(action.cardUid, action);
    }
  });
  nextBoard.forEach((card) => {
    const key = cellKey(card.row, card.col);
    const list = occupiedByPosition.get(key) || [];
    list.push(card);
    occupiedByPosition.set(key, list);
  });

  for (const cardsAtCell of occupiedByPosition.values()) {
    if (cardsAtCell.length < 2) {
      continue;
    }
    const [cardA, cardB] = cardsAtCell;
    if (cardA.ownerId === cardB.ownerId) {
      continue;
    }
    const sourceActionA = actionByCardUid.get(cardA.uid);
    const sourceActionB = actionByCardUid.get(cardB.uid);
    const aAttacks = sourceActionA?.type === "move" && (!sourceActionB || sourceActionB.type !== "move");
    const bAttacks = sourceActionB?.type === "move" && (!sourceActionA || sourceActionA.type !== "move");
    if (aAttacks && tryTriggerDefenderAvoidance(game, nextBoard, cardA, cardB, sourceActionA, actionLog)) {
      tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
      await flushPendingAnimations(game);
      continue;
    }
    if (bAttacks && tryTriggerDefenderAvoidance(game, nextBoard, cardB, cardA, sourceActionB, actionLog)) {
      tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
      await flushPendingAnimations(game);
      continue;
    }
    let conflictContext = {};
    if (sourceActionA?.type === "move" && sourceActionB?.type === "move") {
      conflictContext = {
        positionA: { ...sourceActionA.source },
        positionB: { ...sourceActionB.source }
      };
    } else if (aAttacks) {
      const defendPosition = { row: cardB.row, col: cardB.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition,
        mode: "attack",
        defenderUid: cardB.uid
      };
    } else if (bAttacks) {
      const defendPosition = { row: cardA.row, col: cardA.col };
      conflictContext = {
        positionA: defendPosition,
        positionB: defendPosition,
        mode: "attack",
        defenderUid: cardA.uid
      };
    }
    const combatMode = aAttacks || bAttacks ? "攻击" : "决斗";
    const combatScene = await playCombatClashAnimation(game, cardA, cardB, cardA.row, cardA.col, combatMode);
    const outcome = resolveConflict({ ...game, boardCards: nextBoard }, cardA, cardB, conflictContext);
    const resolvedAttackA = resolveAttackValue({ ...game, boardCards: nextBoard }, cardA, cardB, {
      selfPosition: conflictContext.positionA,
      targetPosition: conflictContext.positionB,
      mode: conflictContext.mode,
      isDefender: conflictContext.defenderUid === cardA.uid
    });
    const resolvedAttackB = resolveAttackValue({ ...game, boardCards: nextBoard }, cardB, cardA, {
      selfPosition: conflictContext.positionB,
      targetPosition: conflictContext.positionA,
      mode: conflictContext.mode,
      isDefender: conflictContext.defenderUid === cardB.uid
    });
    try {
    if (outcome === "a") {
      if (bAttacks) {
        actionLog.push(`${describeCard(game, cardB)} 在 ${formatCell(cardA.row, cardA.col)} 发起攻击，${describeCard(game, cardA)} 成功防守。`);
        if (isCard(cardB, "0116")) {
          adjustCardAttack(cardA, -1);
          const destroyed = tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardA.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardA.ownerId, cardB.row, cardB.col, actionLog);
          }
          return;
        }
        if (resolvedAttackB < resolvedAttackA) {
          const defeatedRow = cardB.row;
          const defeatedCol = cardB.col;
          const destroyed = destroyBoardCard(game, nextBoard, cardB, actionLog, "攻击失败", "break");
          if (destroyed && nextBoard.find((item) => item.uid === cardA.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardA.ownerId, defeatedRow, defeatedCol, actionLog);
          }
          return;
        }
        if (isCard(cardA, "0206")) {
          const destroyed = tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardA.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardA.ownerId, cardB.row, cardB.col, actionLog);
          }
          return;
        }
        {
          const destroyed = tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardA.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardA.ownerId, cardB.row, cardB.col, actionLog);
          }
        }
      } else {
        actionLog.push(`${describeCard(game, cardA)} 在 ${formatCell(cardB.row, cardB.col)} 发起攻击并占优。`);
        const defeatedRow = cardB.row;
        const defeatedCol = cardB.col;
        const destroyed = destroyBoardCard(game, nextBoard, cardB, actionLog, "攻击失败", "break");
        if (destroyed) {
          triggerOnDefeatEffects(game, nextBoard, cardA, cardB, actionLog, aAttacks ? "attack" : "duel");
        } else if (aAttacks && nextBoard.find((item) => item.uid === cardA.uid) && nextBoard.find((item) => item.uid === cardB.uid)) {
          tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
        }
        if (destroyed && aAttacks && nextBoard.find((item) => item.uid === cardA.uid)) {
          tryReturnAttackerToOriginAfterBreak(game, nextBoard, cardA, sourceActionA, actionLog);
          trySpawnZhouYuTokenAt(game, nextBoard, cardA.ownerId, defeatedRow, defeatedCol, actionLog);
        }
      }
    } else if (outcome === "b") {
      if (aAttacks) {
        actionLog.push(`${describeCard(game, cardA)} 在 ${formatCell(cardB.row, cardB.col)} 发起攻击，${describeCard(game, cardB)} 成功防守。`);
        if (isCard(cardA, "0116")) {
          adjustCardAttack(cardB, -1);
          const destroyed = tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardB.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardB.ownerId, cardA.row, cardA.col, actionLog);
          }
          return;
        }
        if (resolvedAttackA < resolvedAttackB) {
          const defeatedRow = cardA.row;
          const defeatedCol = cardA.col;
          const destroyed = destroyBoardCard(game, nextBoard, cardA, actionLog, "攻击失败", "break");
          if (destroyed && nextBoard.find((item) => item.uid === cardB.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardB.ownerId, defeatedRow, defeatedCol, actionLog);
          }
          return;
        }
        if (isCard(cardB, "0206")) {
          const destroyed = tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardB.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardB.ownerId, cardA.row, cardA.col, actionLog);
          }
          return;
        }
        {
          const destroyed = tryRepelAttacker(game, nextBoard, cardA, cardB, sourceActionA, actionLog);
          if (destroyed && nextBoard.find((item) => item.uid === cardB.uid)) {
            triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, "attack");
            trySpawnZhouYuTokenAt(game, nextBoard, cardB.ownerId, cardA.row, cardA.col, actionLog);
          }
        }
      } else {
        actionLog.push(`${describeCard(game, cardB)} 在 ${formatCell(cardA.row, cardA.col)} 发起攻击并占优。`);
        const defeatedRow = cardA.row;
        const defeatedCol = cardA.col;
        const destroyed = destroyBoardCard(game, nextBoard, cardA, actionLog, "攻击失败", "break");
        if (destroyed) {
          triggerOnDefeatEffects(game, nextBoard, cardB, cardA, actionLog, bAttacks ? "attack" : "duel");
        } else if (bAttacks && nextBoard.find((item) => item.uid === cardB.uid) && nextBoard.find((item) => item.uid === cardA.uid)) {
          tryRepelAttacker(game, nextBoard, cardB, cardA, sourceActionB, actionLog);
        }
        if (destroyed && bAttacks && nextBoard.find((item) => item.uid === cardB.uid)) {
          tryReturnAttackerToOriginAfterBreak(game, nextBoard, cardB, sourceActionB, actionLog);
          trySpawnZhouYuTokenAt(game, nextBoard, cardB.ownerId, defeatedRow, defeatedCol, actionLog);
        }
      }
    } else {
      actionLog.push(`${describeCard(game, cardA)} 与 ${describeCard(game, cardB)} 在 ${formatCell(cardA.row, cardA.col)} 交战后同归于尽。`);
      destroyBoardCard(game, nextBoard, cardA, actionLog, "战斗同归于尽", "break");
      destroyBoardCard(game, nextBoard, cardB, actionLog, "战斗同归于尽", "break");
    }
    } finally {
      await finishCombatAnimation(game, combatScene, nextBoard, outcome);
    }
    await flushPendingAnimations(game);
  }
  removeNegativeAttackCards(game, nextBoard, actionLog);
}

function cancelSelection() {
  const game = state.game;
  if (!game || game.isAnimating) {
    return;
  }
  game.selection = resetSelection();
  render();
}

function resetToMenu() {
  state.game = null;
  switchScreen("menu");
}

function getBoardCellElement(row, col) {
  return ui.board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

function createMovingCard(card, ownerId) {
  const ghost = document.createElement("div");
  ghost.className = `moving-card player${ownerId}`;
  ghost.innerHTML = `
    <span class="unit-name">${card.name}</span>
    <span class="unit-meta">${card.skill} · ${getCardAttackText(card)}</span>
  `;
  return ghost;
}

function createCombatCard(card, side) {
  const ghost = document.createElement("div");
  ghost.className = `combat-card player${card.ownerId} combat-${side}`;
  ghost.innerHTML = `
    <span class="combat-card-name">${card.name}</span>
    <span class="combat-card-skill">${card.skill}</span>
    <strong>${resolveAttackValue(state.game, card)}</strong>
  `;
  return ghost;
}

function applyDestructionVisual(element, card, game) {
  const visual = card.destructionAnimation || { kind: "tear", label: "撕毁" };
  element.classList.add(`destroy-${visual.kind}`);
  if (visual.id) {
    if (!(game.consumedDestructionAnimationIds instanceof Set)) {
      game.consumedDestructionAnimationIds = new Set();
    }
    game.consumedDestructionAnimationIds.add(visual.id);
  }
  return visual;
}

function createDestructionCard(event) {
  const ghost = document.createElement("div");
  ghost.className = `combat-card player${event.ownerId || 1} destruction-card`;
  ghost.innerHTML = `
    <span class="combat-card-name">${event.cardName || "卡牌"}</span>
    <span class="combat-card-skill">${event.skillName || event.label || "被摧毁"}</span>
    <strong>${event.label || "撕毁"}</strong>
  `;
  ghost.classList.add(`destroy-${event.destruction?.kind || "tear"}`);
  return ghost;
}

function showCombatFlowPrompt(game, message) {
  if (state.game && state.game.turn === game?.turn) {
    state.game.flowPrompt = message;
  }
  ui.statusMessage.textContent = message;
  ui.statusSubtext.textContent = "交战结果正在展示。";
}

async function playCombatClashAnimation(game, cardA, cardB, row, col, mode) {
  const targetCell = getBoardCellElement(row, col);
  if (!targetCell) {
    return null;
  }
  const stageRect = ui.boardStage.getBoundingClientRect();
  const rect = targetCell.getBoundingClientRect();
  const cardWidth = rect.width * 0.74;
  const cardHeight = rect.height * 0.82;
  const cardAElement = createCombatCard(cardA, "a");
  const cardBElement = createCombatCard(cardB, "b");
  [cardAElement, cardBElement].forEach((element) => {
    element.style.width = `${cardWidth}px`;
    element.style.height = `${cardHeight}px`;
    element.style.top = `${rect.top - stageRect.top + rect.height * 0.09}px`;
    ui.boardAnimationLayer.appendChild(element);
  });
  cardAElement.style.left = `${rect.left - stageRect.left - rect.width * 0.06}px`;
  cardBElement.style.left = `${rect.left - stageRect.left + rect.width * 0.32}px`;
  showCombatFlowPrompt(game, `${cardA.name} 与 ${cardB.name} 在${game.currentPhase || "行动阶段"}进行${mode}。`);
  await nextFrame();
  cardAElement.classList.add("engaged");
  cardBElement.classList.add("engaged");
  await wait(560);
  return { cardA, cardB, cardAElement, cardBElement, row, col, mode };
}

async function finishCombatAnimation(game, scene, boardCards, outcome = null) {
  if (!scene) {
    return;
  }
  const aAlive = boardCards.some((card) => card.uid === scene.cardA.uid);
  const bAlive = boardCards.some((card) => card.uid === scene.cardB.uid);
  const result = document.createElement("div");
  result.className = "combat-result";
  let message;
  if (!aAlive && !bAlive) {
    applyDestructionVisual(scene.cardAElement, scene.cardA, game);
    applyDestructionVisual(scene.cardBElement, scene.cardB, game);
    message = `${scene.cardA.name} 与 ${scene.cardB.name} 同归于尽`;
  } else if (aAlive && !bAlive) {
    applyDestructionVisual(scene.cardBElement, scene.cardB, game);
    message = `${scene.cardA.name} 胜利，${scene.cardB.name} 被摧毁`;
  } else if (!aAlive && bAlive) {
    applyDestructionVisual(scene.cardAElement, scene.cardA, game);
    message = `${scene.cardB.name} 胜利，${scene.cardA.name} 被摧毁`;
  } else if (outcome === "both") {
    scene.cardAElement.classList.add("shielded");
    scene.cardBElement.classList.add("shielded");
    message = `${scene.cardA.name} 与 ${scene.cardB.name} 交战未分胜负`;
  } else if (aAlive) {
    scene.cardBElement.classList.add("shielded");
    message = `${scene.cardA.name} 占优，但 ${scene.cardB.name} 防守成功`;
  } else {
    scene.cardAElement.classList.add("shielded");
    message = `${scene.cardB.name} 占优，但 ${scene.cardA.name} 防守成功`;
  }
  result.textContent = message;
  ui.boardAnimationLayer.appendChild(result);
  showCombatFlowPrompt(game, message);
  await nextFrame();
  result.classList.add("visible");
  await wait(760);
  result.classList.add("fade");
  await wait(260);
  ui.boardAnimationLayer.innerHTML = "";
}

function queueBoardAnimation(game, event) {
  if (!game || !event || typeof event.row !== "number" || typeof event.col !== "number") {
    return;
  }
  if (!Array.isArray(game.pendingAnimations)) {
    game.pendingAnimations = [];
  }
  game.pendingAnimations.push(event);
}

function queuePowerAnimation(game, card, delta) {
  if (!game || !card || !delta || typeof card.row !== "number" || typeof card.col !== "number") return;
  queueBoardAnimation(game, {
    row: card.row,
    col: card.col,
    ownerId: card.ownerId || 1,
    kind: "power",
    effectType: delta > 0 ? "boost" : "weaken",
    glyph: delta > 0 ? "↑" : "↓",
    label: "战力变化",
    detail: `${delta > 0 ? "+" : ""}${delta}`,
    cardUid: card.uid
  });
}

function queueSkillMoveAnimation(game, card, from, to, detail = "技能移动") {
  if (!game || !card || !from || !to) return;
  queueBoardAnimation(game, {
    row: to.row,
    col: to.col,
    fromRow: from.row,
    fromCol: from.col,
    toRow: to.row,
    toCol: to.col,
    ownerId: card.ownerId || 1,
    kind: "skill-move",
    effectType: "support",
    glyph: "→",
    label: detail,
    detail: `${from.row + 1}-${from.col + 1} → ${to.row + 1}-${to.col + 1}`,
    cardUid: card.uid
  });
}

function getSkillAnimationProfile(card, detail, tone) {
  const text = `${card?.effect || ""} ${detail || ""}`;
  if (tone === "skill-warn" || /摧毁|崩解|冲锋|裂阵|焚舟|失效|弃牌/.test(text)) {
    return { effectType: "danger", glyph: "破", tag: "破坏" };
  }
  if (/战力\+|鼓舞|助阵|势起|夺势|护主|援护/.test(text)) {
    return { effectType: "boost", glyph: "+", tag: "强化" };
  }
  if (/战力-|后撤|压制|寸断|封锁|削弱/.test(text)) {
    return { effectType: "weaken", glyph: "-", tag: "压制" };
  }
  if (/抽取|抽牌|援兵|水军|回手|转移|放置/.test(text)) {
    return { effectType: "support", glyph: "召", tag: "支援" };
  }
  return { effectType: "tactic", glyph: "技", tag: "发动" };
}

function formatSkillFlowPrompt(game, card, detail) {
  const phase = game?.currentPhase || "结算阶段";
  const outcome = (detail || "触发技能效果。").trim();
  if (outcome.startsWith("对") || outcome.startsWith("使")) {
    return `${card.name}在${phase}以${card.skill}${outcome}`;
  }
  const simplified = outcome.startsWith(card.name) ? outcome.slice(card.name.length).trim() : outcome;
  return `${card.name}在${phase}以${card.skill}发动：${simplified}`;
}

function showSkillFlowPrompt(game, prompt) {
  if (!prompt) {
    return;
  }
  if (state.game && state.game.turn === game?.turn) {
    state.game.flowPrompt = prompt;
  }
  if (ui.statusMessage) {
    ui.statusMessage.textContent = prompt;
  }
  if (ui.statusSubtext) {
    ui.statusSubtext.textContent = "技能效果正在按顺序结算。";
  }
}

function queueSkillAnimation(game, card, detail = null, tone = "skill") {
  if (!card) {
    return;
  }
  const profile = getSkillAnimationProfile(card, detail, tone);
  queueBoardAnimation(game, {
    row: card.row,
    col: card.col,
    ownerId: card.ownerId || 1,
    kind: tone,
    label: card.skill || "技能触发",
    detail: detail || card.name,
    flowPrompt: formatSkillFlowPrompt(game, card, detail),
    cardUid: card.uid,
    ...profile
  });
}

function createBoardPulse(event) {
  const pulse = document.createElement("div");
  pulse.className = `board-pulse ${event.kind || "skill"} ${event.effectType ? `skill-${event.effectType}` : ""} player${event.ownerId || 1}`;
  pulse.innerHTML = `
    <span class="pulse-ripple ripple-one"></span>
    <span class="pulse-ripple ripple-two"></span>
    <span class="pulse-core">
      <span class="pulse-glyph">${event.glyph || "!"}</span>
      <span class="pulse-copy">
        <span class="pulse-tag">${event.tag || "交战"}</span>
        <span class="pulse-title">${event.label || "技能触发"}</span>
        ${event.detail ? `<span class="pulse-detail">${event.detail}</span>` : ""}
      </span>
    </span>
  `;
  return pulse;
}

async function playBoardAnimations(game, events) {
  if (!Array.isArray(events) || events.length === 0) {
    return;
  }
  const stageRect = ui.boardStage.getBoundingClientRect();
  for (const event of events) {
    if (event.kind === "destroy" && game.consumedDestructionAnimationIds?.has(event.destruction?.id)) {
      continue;
    }
    const cell = getBoardCellElement(event.row, event.col);
    if (!cell) {
      continue;
    }
    const rect = cell.getBoundingClientRect();
    if (event.kind === "power") {
      const arrow = document.createElement("div");
      arrow.className = `power-arrow ${event.effectType === "weaken" ? "down" : "up"}`;
      arrow.textContent = event.glyph || (event.effectType === "weaken" ? "↓" : "↑");
      cell.appendChild(arrow);
      await wait(900);
      arrow.remove();
      continue;
    }
    if (event.kind === "skill-move" && typeof event.fromRow === "number" && typeof event.toRow === "number") {
      const fromCell = getBoardCellElement(event.fromRow, event.fromCol);
      const toCell = getBoardCellElement(event.toRow, event.toCol);
      if (fromCell && toCell) {
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const startX = fromRect.left - stageRect.left + fromRect.width / 2;
        const startY = fromRect.top - stageRect.top + fromRect.height / 2;
        const endX = toRect.left - stageRect.left + toRect.width / 2;
        const endY = toRect.top - stageRect.top + toRect.height / 2;
        const distance = Math.hypot(endX - startX, endY - startY);
        const arrow = document.createElement("div");
        arrow.className = "skill-move-arrow";
        arrow.style.left = `${startX}px`;
        arrow.style.top = `${startY}px`;
        arrow.style.width = `${distance}px`;
        arrow.style.transform = `rotate(${Math.atan2(endY - startY, endX - startX) * 180 / Math.PI}deg)`;
        ui.boardAnimationLayer.appendChild(arrow);
        await wait(760);
        arrow.remove();
      }
      continue;
    }
    showSkillFlowPrompt(game, event.flowPrompt);
    const pulse = createBoardPulse(event);
    const destructionCard = event.kind === "destroy" ? createDestructionCard(event) : null;
    const sourceUnit = event.cardUid ? ui.board.querySelector(`.unit[data-card-uid="${event.cardUid}"]`) : null;
    const impactType = event.effectType || (event.kind === "attack" ? "danger" : event.kind === "duel" ? "tactic" : null);
    pulse.style.left = `${rect.left - stageRect.left}px`;
    pulse.style.top = `${rect.top - stageRect.top}px`;
    pulse.style.width = `${rect.width}px`;
    pulse.style.height = `${rect.height}px`;
    ui.boardAnimationLayer.appendChild(pulse);
    if (destructionCard) {
      destructionCard.style.left = `${rect.left - stageRect.left}px`;
      destructionCard.style.top = `${rect.top - stageRect.top}px`;
      destructionCard.style.width = `${rect.width}px`;
      destructionCard.style.height = `${rect.height}px`;
      ui.boardAnimationLayer.appendChild(destructionCard);
    }
    cell.classList.add("skill-impact");
    if (impactType) {
      cell.classList.add(`skill-impact-${impactType}`);
    }
    if (sourceUnit) {
      sourceUnit.classList.add("skill-casting");
      if (impactType) {
        sourceUnit.classList.add(`skill-casting-${impactType}`);
      }
    }
    await nextFrame();
    pulse.classList.add("visible");
    await wait(event.kind === "skill" || event.kind === "skill-warn" ? BOARD_PULSE_VISIBLE_MS + 220 : BOARD_PULSE_VISIBLE_MS);
    pulse.classList.add("fade");
    await wait(BOARD_PULSE_FADE_MS);
    pulse.remove();
    destructionCard?.remove();
    cell.classList.remove("skill-impact", "skill-impact-danger", "skill-impact-boost", "skill-impact-weaken", "skill-impact-support", "skill-impact-tactic");
    if (sourceUnit) {
      sourceUnit.classList.remove("skill-casting", "skill-casting-danger", "skill-casting-boost", "skill-casting-weaken", "skill-casting-support", "skill-casting-tactic");
    }
    await wait(BOARD_PULSE_STEP_GAP_MS);
  }
}

async function flushPendingAnimations(game) {
  if (!game || !Array.isArray(game.pendingAnimations) || game.pendingAnimations.length === 0) {
    return;
  }
  const events = [...game.pendingAnimations];
  game.pendingAnimations.length = 0;
  await playBoardAnimations(game, events);
}

async function playActionAnimations(game, actions) {
  const actionable = actions.filter((action) => action.type !== "pass");
  if (actionable.length === 0) {
    return;
  }
  ui.boardAnimationLayer.innerHTML = "";
  const stageRect = ui.boardStage.getBoundingClientRect();
  const nodes = [];
  actionable.forEach((action) => {
    const card = getCardByUid(game, action.cardUid);
    const targetCell = getBoardCellElement(action.target.row, action.target.col);
    if (!card || !targetCell) {
      return;
    }
    const targetRect = targetCell.getBoundingClientRect();
    let startRect;
    if (action.type === "move") {
      const sourceCell = getBoardCellElement(action.source.row, action.source.col);
      startRect = sourceCell ? sourceCell.getBoundingClientRect() : targetRect;
    } else {
      const offsetX = action.playerId === 1 ? -120 : 120;
      const offsetY = action.playerId === 1 ? 40 : -40;
      startRect = { left: targetRect.left + offsetX, top: targetRect.top + offsetY, width: targetRect.width, height: targetRect.height };
    }
    const ghost = createMovingCard(card, action.playerId);
    ghost.style.left = `${startRect.left - stageRect.left}px`;
    ghost.style.top = `${startRect.top - stageRect.top}px`;
    ghost.style.width = `${targetRect.width}px`;
    ghost.style.minHeight = `${targetRect.height}px`;
    ghost.style.setProperty("--move-x", `${targetRect.left - startRect.left}px`);
    ghost.style.setProperty("--move-y", `${targetRect.top - startRect.top}px`);
    ui.boardAnimationLayer.appendChild(ghost);
    nodes.push(ghost);
  });
  if (nodes.length === 0) {
    return;
  }
  await nextFrame();
  nodes.forEach((node) => node.classList.add("arrived"));
  await wait(ACTION_ANIMATION_MS - ACTION_IMPACT_HOLD_MS);
  nodes.forEach((node) => node.classList.add("flash"));
  await wait(ACTION_IMPACT_HOLD_MS);
  ui.boardAnimationLayer.innerHTML = "";
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function showToast(title, copy) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-copy">${copy}</div>`;
  ui.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("visible"));
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 2200);
}

function showPhaseBanner(title, copy) {
  ui.phaseBanner.innerHTML = `
    <div class="phase-banner-card">
      <div class="phase-banner-eyebrow">Phase Change</div>
      <div class="phase-banner-title">${title}</div>
      <div class="phase-banner-copy">${copy}</div>
    </div>
  `;
  ui.phaseBanner.classList.add("visible");
  window.setTimeout(() => ui.phaseBanner.classList.remove("visible"), 1200);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function publishDebugScenarioResult(name, payload) {
  let panel = document.getElementById("debug-scenario-output");
  if (!panel) {
    panel = document.createElement("pre");
    panel.id = "debug-scenario-output";
    panel.style.whiteSpace = "pre-wrap";
    panel.style.maxWidth = "1100px";
    panel.style.margin = "16px auto 20px";
    panel.style.padding = "16px 18px";
    panel.style.border = "2px solid rgba(255,218,107,0.52)";
    panel.style.borderRadius = "16px";
    panel.style.background = "linear-gradient(135deg, rgba(22,28,44,0.96), rgba(54,28,18,0.94))";
    panel.style.color = "#fff7d1";
    panel.style.fontSize = "13px";
    panel.style.fontWeight = "600";
    panel.style.lineHeight = "1.6";
    panel.style.boxShadow = "0 18px 40px rgba(0,0,0,0.34)";
    panel.style.position = "relative";
    panel.style.zIndex = "30";
    const appShell = document.querySelector(".app-shell");
    if (appShell && appShell.parentNode) {
      appShell.parentNode.insertBefore(panel, appShell);
    } else {
      document.body.insertBefore(panel, document.body.firstChild);
    }
  }
  const summaryText = Array.isArray(payload.summaryLines) ? `${payload.summaryLines.join("\n")}\n\n` : "";
  panel.textContent = `SCENARIO ${name}\n${summaryText}${JSON.stringify(payload, null, 2)}`;
  panel.scrollIntoView({ block: "start", behavior: "instant" });
}

function createScenarioCard(campKey, name, ownerId, row, col) {
  const card = buildCampDeck(campKey).find((item) => item.name === name);
  if (!card) {
    throw new Error(`Scenario card not found: ${campKey} / ${name}`);
  }
  return {
    ...card,
    ownerId,
    row,
    col,
    hasPlaced: true,
    movesTaken: 0
  };
}

function loadCardTestSetup() {
  let setup;
  try {
    setup = JSON.parse(window.localStorage.getItem("cardDemoCardTestSetup") || "null");
  } catch (_error) {
    return false;
  }
  if (!setup || !Array.isArray(setup.cards)) {
    return false;
  }
  const firstCamp = (ownerId, fallback) => {
    const entry = setup.cards.find((card) => Number(card.ownerId) === ownerId);
    const template = entry && GAME_CARD_SLOT_TEMPLATES.find((card) => String(card.id) === String(entry.id));
    return template?.camp || fallback;
  };
  const game = createGame("pvp", {
    1: firstCamp(1, "三国~蜀"),
    2: firstCamp(2, "三国~魏")
  });
  const boardCards = [];
  for (const entry of setup.cards) {
    const template = GAME_CARD_SLOT_TEMPLATES.find((card) => String(card.id) === String(entry.id));
    if (!template || !isInsideBoard(entry.row, entry.col)) {
      continue;
    }
    const card = cloneCard(makeCardTemplate(template.camp, template, 0));
    card.ownerId = Number(entry.ownerId) === 2 ? 2 : 1;
    card.row = entry.row;
    card.col = entry.col;
    card.currentAttack = Number.isFinite(Number(entry.attack)) ? Number(entry.attack) : card.attack;
    card.buffCap = Math.max(card.attack, card.currentAttack);
    card.hasPlaced = true;
    boardCards.push(card);
  }
  game.boardCards = boardCards;
  game.brokenCells = Array.isArray(setup.brokenCells)
    ? setup.brokenCells.filter((cell) => isInsideBoard(cell.row, cell.col))
    : [];
  game.players.forEach((player) => {
    player.hand = [];
    player.drawPile = [];
    player.submittedActions = [];
  });
  game.plannedActions = { 1: [], 2: [] };
  game.lastResolution = "已从 Card Test 导入自定义场景。双方可在此场面下提交行动并验证结算。";
  state.game = game;
  render();
  return true;
}

async function runDebugScenarioFromQuery() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("card-test") === "1" && loadCardTestSetup()) {
    switchScreen("game");
    showToast("Card Test 场景已导入", "可直接在该场面下测试行动与结算。");
    return;
  }
  const scenario = params.get("scenario");
  if (!scenario) {
    return;
  }

  switchScreen("game");

  if (scenario === "zhouyu-return") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouYu = createScenarioCard("三国~吴", "周瑜", 1, 1, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouYu, hanDang, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: hanDang.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      turn: game.turn,
      phase: game.currentPhase,
      winner: game.winner
    });
    return;
  }

  if (scenario === "zhouyu-place-duel") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 3, 3);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const zhouYu = buildCampDeck("三国~吴").find((item) => item.name === "周瑜");
    zhouYu.ownerId = 1;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [hanDang, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...zhouYu }];
    game.plannedActions = {
      1: [{ type: "place", playerId: 1, cardUid: zhouYu.uid, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      turn: game.turn,
      phase: game.currentPhase,
      winner: game.winner
    });
    return;
  }

  if (scenario === "zhouyu-place-no-priority") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 3, 3);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const liDian = createScenarioCard("三国~魏", "李典", 2, 1, 2);
    const zhouYu = buildCampDeck("三国~吴").find((item) => item.name === "周瑜");
    zhouYu.ownerId = 1;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [hanDang, maoJie, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...zhouYu }];
    game.plannedActions = {
      1: [{ type: "place", playerId: 1, cardUid: zhouYu.uid, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      turn: game.turn,
      phase: game.currentPhase,
      winner: game.winner
    });
    return;
  }

  if (scenario === "zhouyu-duel-enemy-enemy-both") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouYu = createScenarioCard("三国~吴", "周瑜", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const liDian = createScenarioCard("三国~魏", "李典", 2, 1, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouYu, maoJie, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyOnPlaceEffect(game, game.players[0], zhouYu, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhouyu-duel-enemy-enemy-one") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouYu = createScenarioCard("三国~吴", "周瑜", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 1, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouYu, maoJie, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyOnPlaceEffect(game, game.players[0], zhouYu, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhouyu-duel-enemy-friendly-enemy-dies") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouYu = createScenarioCard("三国~吴", "周瑜", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 1, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouYu, maoJie, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyOnPlaceEffect(game, game.players[0], zhouYu, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhouyu-duel-enemy-friendly-friendly-dies") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouYu = createScenarioCard("三国~吴", "周瑜", 1, 2, 2);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 2, 3);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 1, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouYu, caoXiu, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyOnPlaceEffect(game, game.players[0], zhouYu, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "luxun-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const luXun = createScenarioCard("三国~吴", "陆逊", 1, 1, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const caoXiu = buildCampDeck("三国~魏").find((item) => item.name === "曹休");
    caoXiu.ownerId = 2;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [luXun, hanDang, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[1].hand = [{ ...caoXiu }];
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: hanDang.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "luxun-enemy-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const luXun = createScenarioCard("三国~吴", "陆逊", 1, 1, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const liDian = createScenarioCard("三国~魏", "李典", 2, 2, 3);
    const caoXiu = buildCampDeck("三国~魏").find((item) => item.name === "曹休");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [luXun, maoJie, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[1].hand = [{ ...caoXiu, ownerId: 2 }];
    state.game = game;
    discardRandomHandCard(game, 2, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "sunce-defend") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 2);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: caoXiu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "sunce-adjacent-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 2);
    const yuJin = createScenarioCard("三国~魏", "于禁", 1, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(yuJin, 2);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "sunce-discard-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 2);
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[1].hand = [{ ...maoJie, ownerId: 2 }];
    state.game = game;
    discardRandomHandCard(game, 2, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p2Hand: game.players[1].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "sunce-break-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: sunCe.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "sunce-defense-break-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: maoJie.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "low-attack-direct-break") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: maoJie.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "high-attack-repel-on-immunity") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 0, 0);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 0, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [jiangQin, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: caoXiu.uid, source: { row: 0, col: 1 }, target: { row: 0, col: 0 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "sunce-duel-no-minus-four") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const sunCe = createScenarioCard("三国~吴", "孙策", 1, 2, 1);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [sunCe, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: sunCe.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: caoXiu.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "louchuanzhen-move-sweep") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const louChuan = createScenarioCard("三国~吴", "楼船阵", 1, 2, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 3);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [louChuan, hanDang, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: louChuan.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "chiyanzhou-destroy-return") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chiYan = createScenarioCard("三国~吴", "赤焰舟", 1, 2, 2);
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [chiYan];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, chiYan, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      sampleEnemy: maoJie ? maoJie.name : null
    });
    return;
  }

  if (scenario === "chiyanzhou-attack-both-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chiYan = createScenarioCard("三国~吴", "赤焰舟", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [chiYan, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: chiYan.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "chiyanzhou-duel-both-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chiYan = createScenarioCard("三国~吴", "赤焰舟", 1, 2, 1);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 2, 3);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [chiYan, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: chiYan.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: caoXiu.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "changjiang-draw-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const tianXian = createScenarioCard("三国~吴", "长江天险", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "抽牌阶段";
    game.brokenCells = [];
    game.boardCards = [tianXian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].drawPile = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    drawOneCard(game, game.players[0]);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => ({ name: card.name, attack: card.currentAttack })),
      p1DrawPile: game.players[0].drawPile.map((card) => card.name)
    });
    return;
  }

  if (scenario === "changjiang-discard-draw") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const tianXian = createScenarioCard("三国~吴", "长江天险", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    const zhouTai = buildCampDeck("三国~吴").find((item) => item.name === "周泰");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [tianXian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    game.players[0].drawPile = [{ ...zhouTai, ownerId: 1 }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => ({ name: card.name, attack: card.currentAttack })),
      p1DrawPile: game.players[0].drawPile.map((card) => card.name)
    });
    return;
  }

  if (scenario === "changjiang-destroy-draw") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const tianXian = createScenarioCard("三国~吴", "长江天险", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    const zhouTai = buildCampDeck("三国~吴").find((item) => item.name === "周泰");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [tianXian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].drawPile = [{ ...hanDang, ownerId: 1 }, { ...zhouTai, ownerId: 1 }];
    state.game = game;
    destroyBoardCard(game, game.boardCards, tianXian, [], "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => ({ name: card.name, attack: card.currentAttack })),
      p1DrawPile: game.players[0].drawPile.map((card) => card.name)
    });
    return;
  }

  if (scenario === "changjiang-place-no-draw-check") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const tianXian = buildCampDeck("三国~吴").find((item) => item.name === "长江天险");
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...tianXian, ownerId: 1 }];
    game.players[0].drawPile = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    placeCardFromHand(game, game.players[0], game.players[0].hand[0].uid, 2, 2, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => ({ name: card.name, attack: card.currentAttack })),
      p1DrawPile: game.players[0].drawPile.map((card) => card.name)
    });
    return;
  }

  if (scenario === "chibihuo-edge-only") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const fireOrder = buildCampDeck("三国~吴").find((item) => item.name === "赤壁火攻令");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...fireOrder, ownerId: 1 }];
    state.game = game;
    const centerPlace = placeCardFromHand(game, game.players[0], game.players[0].hand[0].uid, 2, 2, []);
    const edgePlace = placeCardFromHand(game, game.players[0], game.players[0].hand[0].uid, 0, 2, []);
    render();
    publishDebugScenarioResult(scenario, {
      centerPlace,
      edgePlace,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "chibihuo-block-place") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const fireOrder = createScenarioCard("三国~吴", "赤壁火攻令", 1, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [fireOrder];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const p1Placeable = getPlaceableCells(game).map((cell) => `${cell.row},${cell.col}`);
    game.currentPlayer = 2;
    const p2Placeable = getPlaceableCells(game).map((cell) => `${cell.row},${cell.col}`);
    render();
    publishDebugScenarioResult(scenario, {
      p1Placeable,
      p2Placeable,
      blockedCells: ["0,1", "1,0", "1,1"]
    });
    return;
  }

  if (scenario === "chibihuo-no-move") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const fireOrder = createScenarioCard("三国~吴", "赤壁火攻令", 1, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [fireOrder];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, fireOrder).map((cell) => `${cell.row},${cell.col}`);
    render();
    publishDebugScenarioResult(scenario, {
      validMoves,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "chibihuo-control-empty-only") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const fireOrder = createScenarioCard("三国~吴", "赤壁火攻令", 1, 0, 0);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 0, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [fireOrder, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const control = computeControlMap(game);
    render();
    publishDebugScenarioResult(scenario, {
      controlCounts: control.counts,
      influenceEntries: [...control.influence.entries()].map(([key, data]) => ({
        cell: key,
        owners: [...data.owners]
      })),
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "caohong-move-token") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoHong = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [caoHong];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: caoHong.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "caoxiu-attack-plus-one") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoXiu = createScenarioCard("三国~魏", "曹休", 1, 2, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [caoXiu, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: caoXiu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "caoxiu-duel-no-plus-one") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoXiu = createScenarioCard("三国~魏", "曹休", 1, 2, 1);
    const chenWu = createScenarioCard("三国~吴", "陈武", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [caoXiu, chenWu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: caoXiu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: chenWu.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "xiahouen-protect-swap") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xiahouEn = createScenarioCard("三国~魏", "夏侯恩", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 2);
    const zhouTai = createScenarioCard("三国~吴", "周泰", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [xiahouEn, maoJie, zhouTai];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: zhouTai.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "yujin-place-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const yuJin = buildCampDeck("三国~魏").find((item) => item.name === "于禁");
    const liDian = createScenarioCard("三国~魏", "李典", 1, 1, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 1);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 1, 1, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [liDian, maoJie, caoXiu, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...yuJin, ownerId: 1 }];
    state.game = game;
    placeCardFromHand(game, game.players[0], game.players[0].hand[0].uid, 2, 2, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lidian-place-draw-extra-action") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    const caoXiu = buildCampDeck("三国~魏").find((item) => item.name === "曹休");
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...liDian, ownerId: 1 }];
    game.players[0].drawPile = [{ ...caoXiu, ownerId: 1 }, { ...maoJie, ownerId: 1 }];
    game.plannedActions = {
      1: [{ type: "place", playerId: 1, cardUid: game.players[0].hand[0].uid, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    const baseActionLimit = 1;
    const actionLimitAfterSubmittingLiDian = getActionLimit(game, 1);
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      baseActionLimit,
      actionLimitAfterSubmittingLiDian,
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p1DrawPile: game.players[0].drawPile.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "zangba-no-active-move") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zangBa = createScenarioCard("三国~魏", "臧霸", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zangBa];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, zangBa).map((cell) => `${cell.row},${cell.col}`);
    publishDebugScenarioResult(scenario, {
      validMoves,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "zangba-defend-not-broken") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zangBa = createScenarioCard("三国~魏", "臧霸", 1, 2, 2);
    const sunCe = createScenarioCard("三国~吴", "孙策", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zangBa, sunCe];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: sunCe.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "zangba-duel-check") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zangBa = createScenarioCard("三国~魏", "臧霸", 1, 2, 1);
    const sunCe = createScenarioCard("三国~吴", "孙策", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zangBa, sunCe];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zangBa.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: sunCe.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "maojie-ally-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 2);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 1, 2, 4);
    const liDian = createScenarioCard("三国~魏", "李典", 1, 1, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, caoXiu, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: caoXiu.uid, source: { row: 2, col: 4 }, target: { row: 2, col: 3 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "maojie-enemy-retreat") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: hanDang.uid, source: { row: 2, col: 4 }, target: { row: 2, col: 3 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "maojie-enemy-no-retreat-room") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 0, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 2, 0, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: hanDang.uid, source: { row: 0, col: 3 }, target: { row: 0, col: 2 } }]
    };
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "maojie-zhanghe-swap-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 2);
    const zhangHe = createScenarioCard("三国~魏", "张郃", 1, 2, 4);
    const liDian = createScenarioCard("三国~魏", "李典", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, zhangHe, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zhangHe.uid, source: { row: 2, col: 4 }, target: { row: 2, col: 3 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "maojie-direct-swap") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const maoJie = createScenarioCard("三国~魏", "毛玠", 1, 2, 2);
    const zhangHe = createScenarioCard("三国~魏", "张郃", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, zhangHe];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zhangHe.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "xuhuang-next-turn-lock") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuHuang = buildCampDeck("三国~魏").find((item) => item.name === "徐晃");
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...xuHuang, ownerId: 1 }];
    game.players[1].hand = [{ ...hanDang, ownerId: 2 }];
    state.game = game;
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    placed.ownerId = 1;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, []);
    game.turn = 2;
    game.currentPlayer = 2;
    const enemyPlaceable = getPlaceableCells(game).map((cell) => `${cell.row},${cell.col}`);
    render();
    publishDebugScenarioResult(scenario, {
      placeLockTurn: game.placeLockTurn,
      enemyPlaceableCount: enemyPlaceable.length,
      enemyPlaceable,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xuhuang-over-five-enemies-only") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuHuang = createScenarioCard("三国~魏", "徐晃", 1, 2, 2);
    const a = createScenarioCard("三国~吴", "韩当", 2, 0, 0);
    const b = createScenarioCard("三国~吴", "周泰", 2, 0, 1);
    const c = createScenarioCard("三国~吴", "陈武", 2, 0, 2);
    const d = createScenarioCard("三国~吴", "丁奉", 2, 1, 0);
    const e = createScenarioCard("三国~吴", "徐盛", 2, 1, 1);
    const f = createScenarioCard("三国~吴", "潘璋", 2, 1, 2);
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [xuHuang, a, b, c, d, e, f];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...liDian, ownerId: 1 }];
    state.game = game;
    game.currentPlayer = 1;
    const placeable = getPlaceableCells(game).map((cell) => `${cell.row},${cell.col}`);
    const pending = (() => {
      game.selection = {
        handCardUid: game.players[0].hand[0].uid,
        boardCardUid: null,
        targetCell: { row: 4, col: 4 }
      };
      const result = buildPendingAction(game, 1);
      game.selection = resetSelection();
      return result;
    })();
    render();
    publishDebugScenarioResult(scenario, {
      enemyCount: getEnemyCards(game, 1).length,
      placeableCount: placeable.length,
      pendingAction: pending,
      placeable
    });
    return;
  }

  if (scenario === "xuhuang-not-total-over-five") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuHuang = createScenarioCard("三国~魏", "徐晃", 1, 2, 2);
    const allyA = createScenarioCard("三国~魏", "毛玠", 1, 0, 0);
    const allyB = createScenarioCard("三国~魏", "于禁", 1, 0, 1);
    const allyC = createScenarioCard("三国~魏", "李典", 1, 0, 2);
    const enemyA = createScenarioCard("三国~吴", "韩当", 2, 1, 0);
    const enemyB = createScenarioCard("三国~吴", "周泰", 2, 1, 1);
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [xuHuang, allyA, allyB, allyC, enemyA, enemyB];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...liDian, ownerId: 1 }];
    state.game = game;
    game.currentPlayer = 1;
    const placeable = getPlaceableCells(game).map((cell) => `${cell.row},${cell.col}`);
    const pending = (() => {
      game.selection = {
        handCardUid: game.players[0].hand[0].uid,
        boardCardUid: null,
        targetCell: { row: 4, col: 4 }
      };
      const result = buildPendingAction(game, 1);
      game.selection = resetSelection();
      return result;
    })();
    render();
    publishDebugScenarioResult(scenario, {
      totalBoardCount: game.boardCards.length,
      enemyCount: getEnemyCards(game, 1).length,
      placeableCount: placeable.length,
      pendingAction: pending,
      placeable
    });
    return;
  }

  if (scenario === "zhanghe-swap-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zhangHe = createScenarioCard("三国~魏", "张郃", 1, 2, 4);
    const liDian = createScenarioCard("三国~魏", "李典", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhangHe, liDian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zhangHe.uid, source: { row: 2, col: 4 }, target: { row: 2, col: 3 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "zhanghe-normal-move-no-swap-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zhangHe = createScenarioCard("三国~魏", "张郃", 1, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhangHe];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zhangHe.uid, source: { row: 2, col: 4 }, target: { row: 2, col: 3 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "caoren-place-pull") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoRen = buildCampDeck("三国~魏").find((item) => item.name === "曹仁");
    const north = createScenarioCard("三国~魏", "毛玠", 1, 0, 2);
    const east = createScenarioCard("三国~魏", "于禁", 1, 2, 4);
    const west = createScenarioCard("三国~魏", "李典", 1, 2, 0);
    const south = createScenarioCard("三国~魏", "曹休", 1, 4, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [north, east, west, south];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...caoRen, ownerId: 1 }];
    state.game = game;
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    placed.ownerId = 1;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "caoren-end-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoRen = createScenarioCard("三国~魏", "曹仁", 1, 2, 2);
    const allyA = createScenarioCard("三国~魏", "毛玠", 1, 2, 1);
    const allyB = createScenarioCard("三国~魏", "于禁", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [caoRen, allyA, allyB];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    game.boardCards.forEach((card) => {
      if (isCard(card, "0210") && countAdjacentAllies({ ...game, boardCards: game.boardCards }, card) >= 2) {
        adjustCardAttack(card, 1);
        actionLog.push(`${card.name}在结束阶段因相邻友军不少于2张而战力+1`);
      }
    });
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xiahouyuan-range-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xiahouYuan = createScenarioCard("三国~魏", "夏侯渊", 1, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [xiahouYuan];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, xiahouYuan).map((cell) => `${cell.row},${cell.col}`);
    xiahouYuan.row = 0;
    xiahouYuan.col = 3;
    applyMoveBuff(xiahouYuan, 3);
    const afterThree = {
      attack: xiahouYuan.currentAttack,
      moved: xiahouYuan.movesTaken,
      row: xiahouYuan.row,
      col: xiahouYuan.col
    };
    xiahouYuan.row = 1;
    xiahouYuan.col = 3;
    applyMoveBuff(xiahouYuan, 1);
    render();
    publishDebugScenarioResult(scenario, {
      validMoves,
      afterThree,
      afterFour: {
        attack: xiahouYuan.currentAttack,
        moved: xiahouYuan.movesTaken,
        row: xiahouYuan.row,
        col: xiahouYuan.col
      }
    });
    return;
  }

  if (scenario === "lejin-duel-origin-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const leJin = createScenarioCard("三国~魏", "乐进", 1, 2, 1);
    const enemyA = createScenarioCard("三国~吴", "韩当", 2, 1, 1);
    const enemyB = createScenarioCard("三国~吴", "蒋钦", 2, 3, 1);
    const duelEnemy = createScenarioCard("三国~吴", "周泰", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [leJin, enemyA, enemyB, duelEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: leJin.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: duelEnemy.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xuchu-end-duel-move") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuChu = createScenarioCard("三国~魏", "许褚", 1, 2, 2);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [xuChu, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    game.boardCards.forEach((card) => {
      if (!isCard(card, "0213")) {
        return;
      }
      const adjacentEnemies = getEightNeighbors(card.row, card.col)
        .map((cell) => getBoardCardAt({ ...game, boardCards: game.boardCards }, cell.row, cell.col))
        .filter((target) => target && target.ownerId !== card.ownerId);
      if (adjacentEnemies.length > 0) {
        const target = adjacentEnemies[0];
        const targetRow = target.row;
        const targetCol = target.col;
        const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, card, target, {
          mode: "duel",
          positionA: { row: card.row, col: card.col },
          positionB: { row: target.row, col: target.col }
        });
        if (outcome === "a") {
          destroyBoardCard(game, game.boardCards, target, actionLog, "虎痴震岳");
          triggerOnDefeatEffects(game, game.boardCards, card, target, actionLog, "duel");
          if (game.boardCards.find((item) => item.uid === card.uid)) {
            card.row = targetRow;
            card.col = targetCol;
          }
        } else if (outcome === "b") {
          destroyBoardCard(game, game.boardCards, card, actionLog, "虎痴震岳");
          triggerOnDefeatEffects(game, game.boardCards, target, card, actionLog, "duel");
        } else {
          destroyBoardCard(game, game.boardCards, card, actionLog, "虎痴震岳");
          destroyBoardCard(game, game.boardCards, target, actionLog, "虎痴震岳");
        }
      }
    });
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xuchu-no-enemy-decay") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuChu = createScenarioCard("三国~魏", "许褚", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [xuChu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    adjustCardAttack(xuChu, -2);
    if (resolveAttackValue({ ...game, boardCards: game.boardCards }, xuChu) < 3) {
      const enemies = getEnemyCards({ ...game, boardCards: game.boardCards }, xuChu.ownerId)
        .sort((a, b) => resolveAttackValue({ ...game, boardCards: game.boardCards }, b) - resolveAttackValue({ ...game, boardCards: game.boardCards }, a));
      if (enemies.length > 0) {
        destroyBoardCard(game, game.boardCards, enemies[0], actionLog, "虎痴震岳终击");
      }
      destroyBoardCard(game, game.boardCards, xuChu, actionLog, "虎痴震岳自毁");
    }
    render();
    publishDebugScenarioResult(scenario, {
      finalAttack: resolveAttackValue({ ...game, boardCards: game.boardCards }, xuChu),
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xuchu-last-stand") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuChu = createScenarioCard("三国~魏", "许褚", 1, 2, 2);
    const enemyA = createScenarioCard("三国~吴", "周泰", 2, 1, 1);
    const enemyB = createScenarioCard("三国~吴", "韩当", 2, 1, 2);
    xuChu.currentAttack = 2;
    enemyA.currentAttack = 3;
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [xuChu, enemyA, enemyB];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    if (resolveAttackValue({ ...game, boardCards: game.boardCards }, xuChu) < 3) {
      const enemies = getEnemyCards({ ...game, boardCards: game.boardCards }, xuChu.ownerId)
        .sort((a, b) => resolveAttackValue({ ...game, boardCards: game.boardCards }, b) - resolveAttackValue({ ...game, boardCards: game.boardCards }, a));
      if (enemies.length > 0) {
        destroyBoardCard(game, game.boardCards, enemies[0], actionLog, "虎痴震岳终击");
      }
      destroyBoardCard(game, game.boardCards, xuChu, actionLog, "虎痴震岳自毁");
    }
    render();
    publishDebugScenarioResult(scenario, {
      finalAttackBeforeDestroy: 2,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "xuchu-single-duel-only") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const xuChu = createScenarioCard("三国~魏", "许褚", 1, 2, 2);
    const enemyA = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const enemyB = createScenarioCard("三国~吴", "蒋钦", 2, 1, 2);
    const enemyC = createScenarioCard("三国~吴", "周泰", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [xuChu, enemyA, enemyB, enemyC];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const beforeCount = game.boardCards.length;
    game.boardCards.forEach((card) => {
      if (isCard(card, "0213")) {
        const adjacentEnemies = getEightNeighbors(card.row, card.col)
          .map((cell) => getBoardCardAt({ ...game, boardCards: game.boardCards }, cell.row, cell.col))
          .filter((target) => target && target.ownerId !== card.ownerId);
        if (adjacentEnemies.length > 0) {
          const target = adjacentEnemies[0];
          const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, card, target, {
            mode: "duel",
            positionA: { row: card.row, col: card.col },
            positionB: { row: target.row, col: target.col }
          });
          if (outcome === "a") {
            const targetRow = target.row;
            const targetCol = target.col;
            destroyBoardCard(game, game.boardCards, target, actionLog, "虎痴震岳");
            triggerOnDefeatEffects(game, game.boardCards, card, target, actionLog, "duel");
            if (game.boardCards.find((item) => item.uid === card.uid)) {
              card.row = targetRow;
              card.col = targetCol;
            }
          } else if (outcome === "b") {
            destroyBoardCard(game, game.boardCards, card, actionLog, "虎痴震岳");
            triggerOnDefeatEffects(game, game.boardCards, target, card, actionLog, "duel");
          } else {
            destroyBoardCard(game, game.boardCards, card, actionLog, "虎痴震岳");
            destroyBoardCard(game, game.boardCards, target, actionLog, "虎痴震岳");
          }
        } else {
          adjustCardAttack(card, -2);
        }
      }
    });
    render();
    publishDebugScenarioResult(scenario, {
      beforeCount,
      afterCount: game.boardCards.length,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "simayi-sweep") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const simaYi = createScenarioCard("三国~魏", "司马懿", 1, 2, 2);
    const lowEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    const lowAlly = createScenarioCard("三国~魏", "于禁", 1, 2, 3);
    const highEnemy = createScenarioCard("三国~吴", "周泰", 2, 1, 2);
    highEnemy.currentAttack = 3;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [simaYi, lowEnemy, lowAlly, highEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    processRealtimeEffects(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "simayi-move-aura") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const simaYi = createScenarioCard("三国~魏", "司马懿", 1, 2, 1);
    const orthEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const diagEnemy = createScenarioCard("三国~吴", "蒋钦", 2, 1, 3);
    const farEnemy = createScenarioCard("三国~吴", "周泰", 2, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [simaYi, orthEnemy, diagEnemy, farEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const sourceRow = simaYi.row;
    const sourceCol = simaYi.col;
    simaYi.row = 2;
    simaYi.col = 2;
    applyMoveBuff(simaYi, 1);
    getOrthogonalNeighbors(simaYi.row, simaYi.col).forEach((cell) => {
      const target = getBoardCardAt({ ...game, boardCards: game.boardCards }, cell.row, cell.col);
      if (target) {
        adjustCardAttack(target, -1);
      }
    });
    render();
    publishDebugScenarioResult(scenario, {
      source: { row: sourceRow, col: sourceCol },
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "simayi-move-aura-friendly-fire") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const simaYi = createScenarioCard("三国~魏", "司马懿", 1, 2, 1);
    const orthAlly = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const orthEnemy = createScenarioCard("三国~吴", "韩当", 2, 3, 2);
    const diagAlly = createScenarioCard("三国~魏", "于禁", 1, 1, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [simaYi, orthAlly, orthEnemy, diagAlly];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    simaYi.row = 2;
    simaYi.col = 2;
    applyMoveBuff(simaYi, 1);
    getOrthogonalNeighbors(simaYi.row, simaYi.col).forEach((cell) => {
      const target = getBoardCardAt({ ...game, boardCards: game.boardCards }, cell.row, cell.col);
      if (target) {
        adjustCardAttack(target, -1);
      }
    });
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "simayi-defender-swap-diagonal") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const simaYi = createScenarioCard("三国~魏", "司马懿", 1, 2, 2);
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 1, 1);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [simaYi, ally, attacker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const attackAction = { type: "move", playerId: 2, cardUid: attacker.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } };
    const swapped = tryTriggerDefenderAvoidance(game, game.boardCards, attacker, simaYi, attackAction, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      swapped,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "simayi-defender-swap-orthogonal") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const simaYi = createScenarioCard("三国~魏", "司马懿", 1, 2, 2);
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [simaYi, ally, attacker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const attackAction = { type: "move", playerId: 2, cardUid: attacker.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } };
    const swapped = tryTriggerDefenderAvoidance(game, game.boardCards, attacker, simaYi, attackAction, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      swapped,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "zhenji-buff-ally-only") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zhenJi = createScenarioCard("三国~魏", "甄姬", 1, 2, 2);
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhenJi, ally, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(ally, 1);
    adjustCardAttack(enemy, 1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "zhenji-debuff-global") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zhenJi = createScenarioCard("三国~魏", "甄姬", 1, 2, 2);
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhenJi, ally, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(ally, -1);
    adjustCardAttack(enemy, -1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "zhenji-dodge") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const zhenJi = createScenarioCard("三国~魏", "甄姬", 1, 2, 2);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    const blockerA = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const blockerB = createScenarioCard("三国~魏", "于禁", 1, 1, 2);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [zhenJi, attacker, blockerA, blockerB];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const attackAction = { type: "move", playerId: 2, cardUid: attacker.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } };
    const dodged = tryTriggerDefenderAvoidance(game, game.boardCards, attacker, zhenJi, attackAction, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      dodged,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "caocao-place-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoCao = createScenarioCard("三国~魏", "曹操", 1, 2, 2);
    const weiAllyA = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    const weiAllyB = createScenarioCard("三国~魏", "于禁", 1, 2, 3);
    const nonWeiAlly = createReinforcementCard(1);
    nonWeiAlly.row = 1;
    nonWeiAlly.col = 2;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [weiAllyA, weiAllyB, nonWeiAlly];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.boardCards.push(caoCao);
    applyOnPlaceEffect(game, game.players[0], caoCao, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "caocao-break-wei-loss") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoCao = createScenarioCard("三国~魏", "曹操", 1, 2, 2);
    const weiAlly = createScenarioCard("三国~魏", "曹洪", 1, 2, 3);
    const nonWeiAlly = createReinforcementCard(1);
    nonWeiAlly.row = 2;
    nonWeiAlly.col = 1;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [caoCao, weiAlly, nonWeiAlly];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, weiAlly, actionLog, "测试击破");
    const afterWei = caoCao.currentAttack;
    destroyBoardCard(game, game.boardCards, nonWeiAlly, actionLog, "测试击破");
    render();
    publishDebugScenarioResult(scenario, {
      afterWei,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "caocao-move-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoCao = createScenarioCard("三国~魏", "曹操", 1, 2, 2);
    const mover = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [caoCao, mover, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    mover.row = 2;
    mover.col = 3;
    applyMoveBuff(mover, 1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "caocao-extra-action") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const caoCao = createScenarioCard("三国~魏", "曹操", 1, 2, 2);
    const allyA = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    const allyB = createScenarioCard("三国~魏", "于禁", 1, 2, 3);
    const allyC = createScenarioCard("三国~魏", "李典", 1, 1, 2);
    const allyD = createScenarioCard("三国~魏", "曹休", 1, 3, 2);
    const allyE = createScenarioCard("三国~魏", "毛玠", 1, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [caoCao, allyA, allyB, allyC];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const limitUnderFive = getActionLimit(game, 1);
    game.boardCards.push(allyD);
    const limitAtFour = getActionLimit(game, 1);
    game.boardCards.push(allyE);
    const limitAtFive = getActionLimit(game, 1);
    render();
    publishDebugScenarioResult(scenario, {
      limitUnderFive,
      limitAtFour,
      limitAtFive,
      alliedCountUnderFive: 4,
      alliedCountAtFour: 5,
      alliedCountAtFive: 6
    });
    return;
  }

  if (scenario === "hubaoqi-attack-both") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const huBaoQi = createScenarioCard("三国~魏", "虎豹骑", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [huBaoQi, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, huBaoQi, enemy, {
      mode: "attack",
      positionA: { row: 2, col: 2 },
      positionB: { row: 2, col: 2 },
      defenderUid: enemy.uid
    });
    if (outcome === "both") {
      destroyBoardCard(game, game.boardCards, huBaoQi, actionLog, "虎豹骑卷入战斗");
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "虎豹骑卷入战斗");
    }
    render();
    publishDebugScenarioResult(scenario, {
      outcome,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "hubaoqi-duel-both") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const huBaoQi = createScenarioCard("三国~魏", "虎豹骑", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [huBaoQi, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, huBaoQi, enemy, {
      mode: "duel",
      positionA: { row: 2, col: 1 },
      positionB: { row: 2, col: 3 }
    });
    if (outcome === "both") {
      destroyBoardCard(game, game.boardCards, huBaoQi, actionLog, "虎豹骑卷入战斗");
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "虎豹骑卷入战斗");
    }
    render();
    publishDebugScenarioResult(scenario, {
      outcome,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "tuntian-draw-to-limit") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const tunTian = createScenarioCard("三国~魏", "屯田营", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "准备阶段";
    game.brokenCells = [];
    game.boardCards = [tunTian];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.submittedActions = [];
    });
    state.game = game;
    const player = game.players[0];
    player.hand = [
      createScenarioCard("三国~魏", "曹洪", 1, null, null),
      createScenarioCard("三国~魏", "于禁", 1, null, null)
    ].map((card) => {
      card.row = undefined;
      card.col = undefined;
      return card;
    });
    player.drawPile = [
      buildCampDeck("三国~魏").find((card) => card.name === "李典"),
      buildCampDeck("三国~魏").find((card) => card.name === "曹休"),
      buildCampDeck("三国~魏").find((card) => card.name === "毛玠"),
      buildCampDeck("三国~魏").find((card) => card.name === "徐晃")
    ].filter(Boolean).map((card) => ({ ...card, ownerId: 1 }));
    game.players[1].drawPile = [];
    drawPhase(game);
    render();
    publishDebugScenarioResult(scenario, {
      p1HandCount: game.players[0].hand.length,
      p1HandNames: game.players[0].hand.map((card) => card.name),
      p1DrawPileCount: game.players[0].drawPile.length,
      lastResolution: game.lastResolution
    });
    return;
  }

  if (scenario === "xietianzi-own-place-no-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    const order = createScenarioCard("三国~魏", "挟天子令", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [ally];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.boardCards.push(order);
    applyOnPlaceEffect(game, game.players[0], order, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "xietianzi-enemy-place-buff") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const ally = createScenarioCard("三国~魏", "曹洪", 1, 2, 1);
    const order = createScenarioCard("三国~魏", "挟天子令", 1, 0, 0);
    const enemyPlaced = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [ally, order];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.boardCards.push(enemyPlaced);
    applyPostPlaceReactions(game, enemyPlaced, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "qingzhou-control") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const flag = createScenarioCard("三国~魏", "青州归战旗", 1, 2, 2);
    const blocker = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [flag, blocker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const control = computeControlMap(game);
    render();
    publishDebugScenarioResult(scenario, {
      counts: control.counts,
      occupied: control.occupied,
      contested: control.contested,
      influenceCells: Array.from(control.ownersByCell.entries())
    });
    return;
  }

  if (scenario === "qingzhou-no-move") {
    const game = createGame("pvp", { 1: "三国~魏", 2: "三国~吴" });
    const flag = createScenarioCard("三国~魏", "青州归战旗", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [flag];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, flag);
    render();
    publishDebugScenarioResult(scenario, {
      validMoves
    });
    return;
  }

  if (scenario === "liaohua-defend-save") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const liaoHua = createScenarioCard("三国~蜀", "廖化", 1, 2, 2);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [liaoHua, attacker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, liaoHua, actionLog, "测试攻破", "break");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "liaohua-attack-into-higher-save") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const liaoHua = createScenarioCard("三国~蜀", "廖化", 1, 2, 1);
    const defender = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    defender.currentAttack = 5;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [liaoHua, defender];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, liaoHua, actionLog, "主动攻击撞上高战力后被攻破", "break");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "wangping-skill-active") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const wangPing = createScenarioCard("三国~蜀", "王平", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [wangPing];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, wangPing);
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, wangPing, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      validMoves,
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "wangping-zero-no-skill") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const wangPing = createScenarioCard("三国~蜀", "王平", 1, 2, 2);
    wangPing.currentAttack = 0;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [wangPing];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, wangPing);
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, wangPing, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      validMoves,
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhoucang-redirect-debuff") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const ally = createScenarioCard("三国~蜀", "廖化", 1, 2, 2);
    const zhouCang = createScenarioCard("三国~蜀", "周仓", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [ally, zhouCang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(ally, -1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhoucang-save-ally") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const ally = createScenarioCard("三国~蜀", "廖化", 1, 2, 2);
    const zhouCang = createScenarioCard("三国~蜀", "周仓", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [ally, zhouCang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, ally, actionLog, "测试摧毁", "break");
    removeNegativeAttackCards(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhoucang-save-ally-negative") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const ally = createScenarioCard("三国~蜀", "廖化", 1, 2, 2);
    const zhouCang = createScenarioCard("三国~蜀", "周仓", 1, 2, 3);
    zhouCang.currentAttack = 1;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [ally, zhouCang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, ally, actionLog, "测试摧毁", "break");
    removeNegativeAttackCards(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "guanxing-start-buff") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanXing = createScenarioCard("三国~蜀", "关兴", 1, 2, 2);
    const orthAlly = createScenarioCard("三国~蜀", "廖化", 1, 2, 1);
    const diagAlly = createScenarioCard("三国~蜀", "周仓", 1, 1, 1);
    const orthEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "准备阶段";
    game.brokenCells = [];
    game.boardCards = [guanXing, orthAlly, diagAlly, orthEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyStartTurnEffects(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhangbao-break-splash") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhangBao = createScenarioCard("三国~蜀", "张苞", 1, 2, 1);
    const mainTarget = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    const enemyNorth = createScenarioCard("三国~吴", "蒋钦", 2, 1, 2);
    const enemySouth = createScenarioCard("三国~吴", "周泰", 2, 3, 2);
    const friendlyEast = createScenarioCard("三国~蜀", "关兴", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [zhangBao, mainTarget, enemyNorth, enemySouth, friendlyEast];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, mainTarget, actionLog, "测试攻破", "break");
    if (destroyed) {
      triggerOnDefeatEffects(game, game.boardCards, zhangBao, mainTarget, actionLog, "attack");
    }
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "madai-long-move") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const maDai = createScenarioCard("三国~蜀", "马岱", 1, 2, 2);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 4);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 0, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maDai, enemy, ally];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, maDai);
    render();
    publishDebugScenarioResult(scenario, {
      validMoves
    });
    return;
  }

  if (scenario === "mifang-extra-draw") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const miFang = createScenarioCard("三国~蜀", "糜芳", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "准备阶段";
    game.brokenCells = [];
    game.boardCards = [miFang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.players[0].drawPile = [
      createScenarioCard("三国~蜀", "关兴", 1, null, null),
      createScenarioCard("三国~蜀", "张苞", 1, null, null),
      createScenarioCard("三国~蜀", "马岱", 1, null, null)
    ].map((card) => {
      card.row = undefined;
      card.col = undefined;
      return card;
    });
    game.players[1].drawPile = [];
    drawPhase(game);
    render();
    publishDebugScenarioResult(scenario, {
      p1HandCount: game.players[0].hand.length,
      p1HandNames: game.players[0].hand.map((card) => card.name),
      p1DrawPileCount: game.players[0].drawPile.length,
      lastResolution: game.lastResolution
    });
    return;
  }

  if (scenario === "weiyan-equal-win") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const weiYan = createScenarioCard("三国~蜀", "魏延", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    enemy.currentAttack = 4;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [weiYan, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, weiYan, enemy, {
      mode: "attack",
      positionA: { row: 2, col: 2 },
      positionB: { row: 2, col: 2 },
      defenderUid: enemy.uid
    });
    if (outcome === "a") {
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "测试攻击", "break");
    } else if (outcome === "both") {
      destroyBoardCard(game, game.boardCards, weiYan, actionLog, "测试攻击", "break");
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "测试攻击", "break");
    }
    render();
    publishDebugScenarioResult(scenario, {
      outcome,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      actionLog
    });
    return;
  }

  if (scenario === "weiyan-lower-both") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const weiYan = createScenarioCard("三国~蜀", "魏延", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    enemy.currentAttack = 5;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [weiYan, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, weiYan, enemy, {
      mode: "attack",
      positionA: { row: 2, col: 2 },
      positionB: { row: 2, col: 2 },
      defenderUid: enemy.uid
    });
    if (outcome === "both") {
      destroyBoardCard(game, game.boardCards, weiYan, actionLog, "测试攻击", "break");
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "测试攻击", "break");
    }
    render();
    publishDebugScenarioResult(scenario, {
      outcome,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      actionLog
    });
    return;
  }

  if (scenario === "machao-two-step-moves") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const maChao = createScenarioCard("三国~蜀", "马超", 1, 2, 2);
    const midEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const farEnemy = createScenarioCard("三国~吴", "蒋钦", 2, 2, 4);
    const fartherEnemy = createScenarioCard("三国~吴", "周泰", 2, 2, 5);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maChao, midEnemy, farEnemy, fartherEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const validMoves = getValidMoves(game, maChao);
    render();
    publishDebugScenarioResult(scenario, {
      validMoves
    });
    return;
  }

  if (scenario === "machao-cross-destroy") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const maChao = createScenarioCard("三国~蜀", "马超", 1, 2, 2);
    const crossedEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const targetEnemy = createScenarioCard("三国~吴", "蒋钦", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maChao, crossedEnemy, targetEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const action = { type: "move", playerId: 1, cardUid: maChao.uid, source: { row: 2, col: 2 }, target: { row: 2, col: 4 } };
    maChao.row = 2;
    maChao.col = 4;
    triggerCrossedCards(game, game.boardCards, maChao, action, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "machao-cross-friendly") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const maChao = createScenarioCard("三国~蜀", "马超", 1, 2, 2);
    const crossedAlly = createScenarioCard("三国~蜀", "关兴", 1, 2, 3);
    const targetEnemy = createScenarioCard("三国~吴", "韩当", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maChao, crossedAlly, targetEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const action = { type: "move", playerId: 1, cardUid: maChao.uid, source: { row: 2, col: 2 }, target: { row: 2, col: 4 } };
    maChao.row = 2;
    maChao.col = 4;
    triggerCrossedCards(game, game.boardCards, maChao, action, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "huangzhong-end-shot") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const huangZhong = createScenarioCard("三国~蜀", "黄忠", 1, 2, 2);
    const northEnemy = createScenarioCard("三国~吴", "韩当", 2, 1, 2);
    const southEnemy = createScenarioCard("三国~吴", "蒋钦", 2, 4, 2);
    southEnemy.currentAttack = 5;
    const westAlly = createScenarioCard("三国~蜀", "关兴", 1, 2, 0);
    const eastEnemy = createScenarioCard("三国~吴", "周泰", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [huangZhong, northEnemy, southEnemy, westAlly, eastEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyEndTurnEffects(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "huangzhong-adjacent-penalty") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const huangZhong = createScenarioCard("三国~蜀", "黄忠", 1, 2, 2);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const enemyTwo = createScenarioCard("三国~吴", "蒋钦", 2, 1, 2);
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [huangZhong, enemy, enemyTwo];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyEndTurnEffects(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      huangZhongBase: huangZhong.attack,
      huangZhongCurrent: resolveAttackValue(game, huangZhong),
      enemyCurrent: resolveAttackValue(game, enemy),
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: resolveAttackValue(game, card),
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "jiangwei-growth-move") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const jiangWei = createScenarioCard("三国~蜀", "姜维", 1, 0, 0);
    jiangWei.currentAttack = 3;
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 2);
    const blocker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [jiangWei, ally, blocker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, ally, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "jiangwei-move-thresholds") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const base = createScenarioCard("三国~蜀", "姜维", 1, 2, 2);
    const atk2 = createScenarioCard("三国~蜀", "姜维", 1, 2, 2);
    atk2.currentAttack = 2;
    const atk3 = createScenarioCard("三国~蜀", "姜维", 1, 2, 2);
    atk3.currentAttack = 3;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [base];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const moves1 = getValidMoves(game, base);
    game.boardCards = [atk2];
    const moves2 = getValidMoves(game, atk2);
    game.boardCards = [atk3];
    const moves3 = getValidMoves(game, atk3);
    render();
    publishDebugScenarioResult(scenario, {
      atk1Moves: moves1,
      atk2Moves: moves2,
      atk3Moves: moves3
    });
    return;
  }

  if (scenario === "yanyan-ahead-buff") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const yanYan = createScenarioCard("三国~蜀", "严颜", 1, 2, 2);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 3);
    const allyTwo = createScenarioCard("三国~蜀", "廖化", 1, 1, 2);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 0, 0);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [yanYan, ally, allyTwo, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, ally, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "yanyan-behind-save") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const yanYan = createScenarioCard("三国~蜀", "严颜", 1, 0, 0);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 2);
    const enemyA = createScenarioCard("三国~吴", "韩当", 2, 4, 4);
    const enemyB = createScenarioCard("三国~吴", "蒋钦", 2, 4, 3);
    const enemyC = createScenarioCard("三国~吴", "周泰", 2, 3, 4);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [yanYan, ally, enemyA, enemyB, enemyC];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, ally, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhaoyun-move-loss") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhaoYun = createScenarioCard("三国~蜀", "赵云", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhaoYun];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    zhaoYun.row = 2;
    zhaoYun.col = 3;
    applyMoveBuff(zhaoYun, 1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhaoyun-attack-kill") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhaoYun = createScenarioCard("三国~蜀", "赵云", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    enemy.currentAttack = 20;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [zhaoYun, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const outcome = resolveConflict({ ...game, boardCards: game.boardCards }, zhaoYun, enemy, {
      mode: "attack",
      positionA: { row: 2, col: 2 },
      positionB: { row: 2, col: 2 },
      defenderUid: enemy.uid
    });
    if (outcome === "a") {
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "测试攻击", "break");
    } else if (outcome === "both") {
      destroyBoardCard(game, game.boardCards, zhaoYun, actionLog, "测试攻击", "break");
      destroyBoardCard(game, game.boardCards, enemy, actionLog, "测试攻击", "break");
    }
    render();
    publishDebugScenarioResult(scenario, {
      outcome,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      actionLog
    });
    return;
  }

  if (scenario === "zhaoyun-full-attack-flow") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhaoYun = createScenarioCard("三国~蜀", "赵云", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    enemy.currentAttack = 20;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhaoYun, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: zhaoYun.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    render();
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "zhuge-move-lock-cycle") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhuge = createScenarioCard("三国~蜀", "诸葛亮", 1, 2, 2);
    const enemyPlaced = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    const enemyPlacedTwo = createScenarioCard("三国~吴", "蒋钦", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhuge];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    game.boardCards.push(enemyPlaced);
    applyPostPlaceReactions(game, enemyPlaced, actionLog);
    const firstLock = !!game.moveLocks[enemyPlaced.uid];
    const firstMoves = getValidMoves(game, enemyPlaced);
    game.boardCards.push(enemyPlacedTwo);
    applyPostPlaceReactions(game, enemyPlacedTwo, actionLog);
    const firstLockAfterSecondPlace = !!game.moveLocks[enemyPlaced.uid];
    const secondLock = !!game.moveLocks[enemyPlacedTwo.uid];
    render();
    publishDebugScenarioResult(scenario, {
      firstLock,
      firstMoves,
      firstLockAfterSecondPlace,
      secondLock
    });
    return;
  }

  if (scenario === "zhuge-adjacent-immortal") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const zhuge = createScenarioCard("三国~蜀", "诸葛亮", 1, 2, 2);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [zhuge, ally];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, zhuge, actionLog, "测试摧毁", "break");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "pangtong-reflect-debuff") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const pangTong = createScenarioCard("三国~蜀", "庞统", 1, 0, 0);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 2);
    const enemyNorth = createScenarioCard("三国~吴", "韩当", 2, 1, 2);
    const enemyEast = createScenarioCard("三国~吴", "蒋钦", 2, 2, 3);
    const enemyFar = createScenarioCard("三国~吴", "周泰", 2, 4, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [pangTong, ally, enemyNorth, enemyEast, enemyFar];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(ally, -1);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "pangtong-reborn-once") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const pangTong = createScenarioCard("三国~蜀", "庞统", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [pangTong];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, pangTong, actionLog, "第一次测试摧毁", "break");
    const afterFirst = game.boardCards.map((card) => ({
      name: card.name,
      attack: card.currentAttack,
      row: card.row,
      col: card.col,
      rebornOnce: !!card.rebornOnce
    }));
    const secondTarget = game.boardCards.find((card) => isCard(card, "0115"));
    const secondDestroyed = secondTarget ? destroyBoardCard(game, game.boardCards, secondTarget, actionLog, "第二次测试摧毁", "break") : null;
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      actionLog,
      afterFirst,
      finalBoardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col,
        rebornOnce: !!card.rebornOnce
      }))
    });
    return;
  }

  if (scenario === "guanyu-duel-win") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanYu = createScenarioCard("三国~蜀", "关羽", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    enemy.currentAttack = 50;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [guanYu, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: guanYu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: [{ type: "move", playerId: 2, cardUid: enemy.uid, source: { row: 2, col: 3 }, target: { row: 2, col: 2 } }]
    };
    render();
    await resolveRound(game);
    const guanYuState = game.boardCards.find((card) => card.uid === guanYu.uid);
    const enemyState = game.boardCards.find((card) => card.uid === enemy.uid);
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 关羽与敌方对冲，按决斗处理。",
        "- 关羽应无视战力直接获胜，并在结算后战力+1。",
        `- 实际结果：关羽${guanYuState ? `战力 ${guanYuState.currentAttack}，位置 ${guanYuState.row + 1}-${guanYuState.col + 1}` : "已不在场上"}。`,
        `- 敌方是否仍在场：${enemyState ? "是" : "否"}。`
      ],
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "guanyu-attack-stall") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanYu = createScenarioCard("三国~蜀", "关羽", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 2);
    enemy.currentAttack = 10;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [guanYu, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: guanYu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    render();
    await resolveRound(game);
    const guanYuState = game.boardCards.find((card) => card.uid === guanYu.uid);
    const enemyState = game.boardCards.find((card) => card.uid === enemy.uid);
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 关羽主动攻击更高战力目标。",
        "- 依当前规则，应视为未能击破，对方战力-1，关羽本次攻击无效且留存。",
        `- 实际结果：关羽${guanYuState ? `战力 ${guanYuState.currentAttack}，位置 ${guanYuState.row + 1}-${guanYuState.col + 1}` : "已不在场上"}。`,
        `- 韩当${enemyState ? `战力 ${enemyState.currentAttack}，位置 ${enemyState.row + 1}-${enemyState.col + 1}` : "已不在场上"}。`
      ],
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "guanyu-defend-retreat") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanYu = createScenarioCard("三国~蜀", "关羽", 1, 2, 2);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    attacker.currentAttack = 10;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [];
    game.boardCards = [guanYu, attacker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const attackAction = { type: "move", playerId: 2, cardUid: attacker.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } };
    const dodged = tryTriggerDefenderAvoidance(game, game.boardCards, attacker, guanYu, attackAction, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      dodged,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      actionLog
    });
    return;
  }

  if (scenario === "guanyu-defend-no-space") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanYu = createScenarioCard("三国~蜀", "关羽", 1, 2, 2);
    const attacker = createScenarioCard("三国~吴", "韩当", 2, 2, 1);
    const blockUp = createScenarioCard("三国~吴", "周瑜", 2, 1, 2);
    const blockRight = createScenarioCard("三国~吴", "黄盖", 2, 2, 3);
    const blockDown = createScenarioCard("三国~吴", "程普", 2, 3, 2);
    attacker.currentAttack = 10;
    game.turn = 1;
    game.currentPhase = "结算阶段";
    game.brokenCells = [{ row: 2, col: 1 }];
    game.boardCards = [guanYu, attacker, blockUp, blockRight, blockDown];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const attackAction = { type: "move", playerId: 2, cardUid: attacker.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } };
    const dodged = tryTriggerDefenderAvoidance(game, game.boardCards, attacker, guanYu, attackAction, actionLog);
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 关羽被更高战力攻击，但四周没有可后撤空位。",
        "- 此时不应触发后撤闪避。"
      ],
      dodged,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      actionLog
    });
    return;
  }

  if (scenario === "guanyu-extra-action-limit") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const guanYu = createScenarioCard("三国~蜀", "关羽", 1, 2, 2);
    const ally = createScenarioCard("三国~蜀", "关兴", 1, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [guanYu, ally];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const globalLimit = 1 + getGlobalExtraActionCount(game, 1);
    const guanAction = { type: "move", playerId: 1, cardUid: guanYu.uid, source: { row: 2, col: 2 }, target: { row: 2, col: 3 } };
    const allyAction = { type: "move", playerId: 1, cardUid: ally.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 0 } };
    const guanFirst = [guanAction];
    const allySecond = [guanAction, allyAction];
    const allyFirst = [allyAction];
    const guanSecond = [allyAction, guanAction];
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 关羽在场时，玩家应多出 1 个只能由关羽使用的专属额外行动位。",
        "- 所以先让其他卡行动，再让关羽作为第二次行动，应该允许。"
      ],
      globalLimit,
      personalExtraUids: getPersonalExtraActionCardUids(game, 1),
      guanFirstAllowed: guanFirst.length <= globalLimit + countPersonalExtraActions(game, 1, guanFirst),
      allySecondAllowed: allySecond.length <= globalLimit + countPersonalExtraActions(game, 1, allySecond),
      allyFirstAllowed: allyFirst.length <= globalLimit + countPersonalExtraActions(game, 1, allyFirst),
      guanSecondAllowed: guanSecond.length <= globalLimit + countPersonalExtraActions(game, 1, guanSecond)
    });
    return;
  }

  if (scenario === "liannuying-endturn") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const liannu = createScenarioCard("三国~蜀", "连弩营", 1, 2, 2);
    const allyRow = createScenarioCard("三国~蜀", "关羽", 1, 2, 0);
    const enemyCol = createScenarioCard("三国~吴", "韩当", 2, 0, 2);
    const enemyDiag = createScenarioCard("三国~吴", "周瑜", 2, 1, 1);
    allyRow.currentAttack = 4;
    enemyCol.currentAttack = 3;
    enemyDiag.currentAttack = 5;
    game.turn = 1;
    game.currentPhase = "结束阶段";
    game.brokenCells = [];
    game.boardCards = [liannu, allyRow, enemyCol, enemyDiag];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    applyEndTurnEffects(game, game.boardCards, actionLog);
    removeNegativeAttackCards(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 连弩营在回合结束时结算。",
        "- 与连弩营同一行或同一列的其他卡牌战力各-1。",
        "- 不在同一行列的卡牌不受影响，连弩营自己也不会掉战力。"
      ],
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "bazhentu-buffs-debuffs") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const bazhen = createScenarioCard("三国~蜀", "八阵图", 1, 2, 2);
    const ally = createScenarioCard("三国~蜀", "关羽", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "韩当", 2, 2, 3);
    ally.currentAttack = 4;
    enemy.currentAttack = 3;
    game.turn = 1;
    game.currentPhase = "准备阶段";
    game.brokenCells = [];
    game.boardCards = [bazhen, ally, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    adjustCardAttack(ally, -2);
    adjustCardAttack(enemy, 2);
    adjustCardAttack(ally, 1);
    adjustCardAttack(enemy, -1);
    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 我方卡牌战力减少应被八阵图阻止。",
        "- 敌方卡牌战力增加应被八阵图阻止。",
        "- 我方正常增益与敌方正常减益不应被阻止。"
      ],
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      }))
    });
    return;
  }

  if (scenario === "muniuliuma-all") {
    const game = createGame("pvp", { 1: "三国~蜀", 2: "三国~吴" });
    const ally = createScenarioCard("三国~蜀", "关羽", 1, 2, 1);
    const enemy = createScenarioCard("三国~吴", "周瑜", 2, 2, 3);
    const muniuHandCard = buildCampDeck("三国~蜀").find((item) => item.name === "木牛流马");
    const drawCardA = buildCampDeck("三国~蜀").find((item) => item.name === "王平");
    const drawCardB = buildCampDeck("三国~蜀").find((item) => item.name === "周仓");
    ally.currentAttack = 4;
    enemy.currentAttack = 3;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [ally, enemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    const muniu = { ...(muniuHandCard || createReinforcementCard(1)), ownerId: 1, row: 2, col: 2 };
    game.players[0].drawPile = [drawCardA ? { ...drawCardA, ownerId: 1 } : createReinforcementCard(1), drawCardB ? { ...drawCardB, ownerId: 1 } : createReinforcementCard(1)];
    state.game = game;
    game.boardCards.push(muniu);
    applyOnPlaceEffect({ ...game, boardCards: game.boardCards }, game.players[0], muniu, []);
    const afterPlace = game.boardCards.map((card) => ({
      name: card.name,
      attack: card.currentAttack,
      row: card.row,
      col: card.col
    }));

    const destroyEnemyLog = [];
    destroyBoardCard(game, game.boardCards, enemy, destroyEnemyLog, "木牛流马测试击破", "break");
    const afterEnemyDestroyed = {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      hand: game.players[0].hand.map((card) => card.name),
      drawPileCount: game.players[0].drawPile.length,
      actionLog: destroyEnemyLog
    };

    const destroySelfLog = [];
    destroyBoardCard(game, game.boardCards, muniu, destroySelfLog, "木牛流马测试自毁", "break");
    const afterSelfDestroyed = {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        attack: card.currentAttack,
        row: card.row,
        col: card.col
      })),
      hand: game.players[0].hand.map((card) => card.name),
      drawPileCount: game.players[0].drawPile.length,
      actionLog: destroySelfLog
    };

    publishDebugScenarioResult(scenario, {
      summaryLines: [
        "结果摘要",
        "- 木牛流马放置后，所有友方卡牌战力+1。",
        "- 对方卡牌被摧毁时，所有友方卡牌战力+1，并抽1张牌。",
        "- 木牛流马被摧毁时，其余友方卡牌战力-2，并抽1张牌。"
      ],
      afterPlace,
      afterEnemyDestroyed,
      afterSelfDestroyed
    });
    return;
  }

  if (scenario === "huanggai-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = buildCampDeck("三国~吴").find((item) => item.name === "黄盖");
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...huangGai }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "huanggai-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = createScenarioCard("三国~吴", "黄盖", 2, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 1, 2);
    const liDian = createScenarioCard("三国~魏", "李典", 2, 2, 1);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [huangGai, maoJie, liDian, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    destroyBoardCard(game, game.boardCards, huangGai, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "huanggai-discard-no-space") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = buildCampDeck("三国~吴").find((item) => item.name === "黄盖");
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const a = createScenarioCard("三国~魏", "于禁", 2, 1, 2);
    const b = createScenarioCard("三国~魏", "李典", 2, 3, 2);
    const c = createScenarioCard("三国~魏", "曹休", 2, 2, 1);
    const d = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, a, b, c, d];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...huangGai }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "huanggai-destroy-mixed-neighbors") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = createScenarioCard("三国~吴", "黄盖", 2, 2, 2);
    const weiNorth = createScenarioCard("三国~魏", "毛玠", 2, 1, 2);
    const weiWest = createScenarioCard("三国~魏", "李典", 2, 2, 1);
    const wuEast = createScenarioCard("三国~吴", "韩当", 1, 2, 3);
    const wuSouth = createScenarioCard("三国~吴", "蒋钦", 1, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [huangGai, weiNorth, weiWest, wuEast, wuSouth];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    destroyBoardCard(game, game.boardCards, huangGai, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      }))
    });
    return;
  }

  if (scenario === "huanggai-discard-no-valid-enemy-space") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = buildCampDeck("三国~吴").find((item) => item.name === "黄盖");
    const center = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const top = createScenarioCard("三国~魏", "于禁", 2, 1, 2);
    const bottom = createScenarioCard("三国~魏", "李典", 2, 3, 2);
    const left = createScenarioCard("三国~魏", "曹休", 2, 2, 1);
    const right = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const topLeft = createScenarioCard("三国~魏", "于禁", 2, 1, 1);
    const topRight = createScenarioCard("三国~魏", "李典", 2, 1, 3);
    const bottomLeft = createScenarioCard("三国~魏", "曹休", 2, 3, 1);
    const bottomRight = createScenarioCard("三国~魏", "毛玠", 2, 3, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [center, top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...huangGai }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "huanggai-discard-absolute-no-space") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const huangGai = buildCampDeck("三国~吴").find((item) => item.name === "黄盖");
    const enemyCenter = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const wuNorth = createScenarioCard("三国~吴", "韩当", 1, 1, 2);
    const wuWest = createScenarioCard("三国~吴", "蒋钦", 1, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [
      { row: 2, col: 3 },
      { row: 3, col: 2 }
    ];
    game.boardCards = [enemyCenter, wuNorth, wuWest];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...huangGai }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      brokenCells: game.brokenCells,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "chengpu-self-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chengPu = buildCampDeck("三国~吴").find((item) => item.name === "程普");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...chengPu }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "chengpu-ally-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chengPu = createScenarioCard("三国~吴", "程普", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [chengPu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lingtong-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lingTong = createScenarioCard("三国~吴", "凌统", 1, 2, 2);
    const jiangQin = buildCampDeck("三国~吴").find((item) => item.name === "蒋钦");
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lingTong];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].drawPile = [{ ...jiangQin, ownerId: 1 }];
    game.players[1].hand = [{ ...maoJie, ownerId: 2 }];
    state.game = game;
    discardRandomHandCard(game, 2, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p1Deck: game.players[0].drawPile.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lingtong-double-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lingTong = createScenarioCard("三国~吴", "凌统", 1, 2, 2);
    const jiangQin = buildCampDeck("三国~吴").find((item) => item.name === "蒋钦");
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lingTong];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].drawPile = [
      { ...jiangQin, ownerId: 1 },
      { ...hanDang, ownerId: 1 }
    ];
    game.players[1].hand = [
      { ...maoJie, ownerId: 2 },
      { ...liDian, ownerId: 2 }
    ];
    state.game = game;
    discardRandomHandCard(game, 2, 2, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p1Deck: game.players[0].drawPile.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lvmeng-place") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lvMeng = buildCampDeck("三国~吴").find((item) => item.name === "吕蒙");
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 4, 4);
    const jiangQin = buildCampDeck("三国~吴").find((item) => item.name === "蒋钦");
    const ganNing = buildCampDeck("三国~吴").find((item) => item.name === "甘宁");
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 0, 0);
    const liDian = createScenarioCard("三国~魏", "李典", 2, 0, 1);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 1, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [hanDang, maoJie, liDian, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [
      { ...lvMeng, ownerId: 1 },
      { ...jiangQin, ownerId: 1 },
      { ...ganNing, ownerId: 1 }
    ];
    state.game = game;
    const player = game.players[0];
    const placed = player.hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, player, placed, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lvmeng-discard-buff") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lvMeng = createScenarioCard("三国~吴", "吕蒙", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lvMeng];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lvmeng-destroy-save") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lvMeng = createScenarioCard("三国~吴", "吕蒙", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lvMeng];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    destroyBoardCard(game, game.boardCards, lvMeng, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lvmeng-destroy-save-twice") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lvMeng = createScenarioCard("三国~吴", "吕蒙", 1, 2, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    const jiangQin = buildCampDeck("三国~吴").find((item) => item.name === "蒋钦");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lvMeng];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [
      { ...hanDang, ownerId: 1 },
      { ...jiangQin, ownerId: 1 }
    ];
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, lvMeng, actionLog, "第一次测试摧毁");
    const secondDestroyed = destroyBoardCard(game, game.boardCards, lvMeng, actionLog, "第二次测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "lvmeng-destroy-no-hand") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const lvMeng = createScenarioCard("三国~吴", "吕蒙", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [lvMeng];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const destroyed = destroyBoardCard(game, game.boardCards, lvMeng, actionLog, "无手牌测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "handang-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    destroyBoardCard(game, game.boardCards, hanDang, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "handang-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "ganning-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const ganNing = buildCampDeck("三国~吴").find((item) => item.name === "甘宁");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...ganNing, ownerId: 1 }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "ganning-place-direct") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const ganNing = buildCampDeck("三国~吴").find((item) => item.name === "甘宁");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...ganNing, ownerId: 1 }];
    state.game = game;
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "zhoutai-place") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = buildCampDeck("三国~吴").find((item) => item.name === "周泰");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...zhouTai, ownerId: 1 }];
    state.game = game;
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhoutai-protect") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const enemyLow = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const enemyHigh = createScenarioCard("三国~魏", "于禁", 2, 1, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, hanDang, enemyLow, enemyHigh];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const destroyed = destroyBoardCard(game, game.boardCards, hanDang, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhoutai-multi-protect") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 1, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, hanDang, jiangQin, maoJie, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, hanDang, actionLog, "第一次测试摧毁");
    const secondDestroyed = destroyBoardCard(game, game.boardCards, jiangQin, actionLog, "第二次测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhoutai-stop-protect") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 1, 2);
    const chenWu = createScenarioCard("三国~吴", "陈武", 1, 2, 3);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 3, 2);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 1, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, hanDang, jiangQin, chenWu, maoJie, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, hanDang, actionLog, "第一次测试摧毁");
    const secondDestroyed = destroyBoardCard(game, game.boardCards, jiangQin, actionLog, "第二次测试摧毁");
    const thirdDestroyed = destroyBoardCard(game, game.boardCards, chenWu, actionLog, "第三次测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      thirdDestroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhoutai-stop-on-equal") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 1, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 3, 2);
    const enemyJiangQin = createScenarioCard("三国~吴", "蒋钦", 2, 2, 3);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, hanDang, jiangQin, maoJie, enemyJiangQin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, hanDang, actionLog, "第一次测试摧毁");
    const secondDestroyed = destroyBoardCard(game, game.boardCards, jiangQin, actionLog, "第二次测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "zhoutai-negative-attack") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const zhouTai = createScenarioCard("三国~吴", "周泰", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 1, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 3, 2);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 3, 2);
    zhouTai.currentAttack = 1;
    maoJie.currentAttack = 0;
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [zhouTai, hanDang, jiangQin, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    const firstDestroyed = destroyBoardCard(game, game.boardCards, hanDang, actionLog, "第一次测试摧毁");
    game.boardCards.push(yuJin);
    yuJin.currentAttack = -1;
    const secondDestroyed = destroyBoardCard(game, game.boardCards, jiangQin, actionLog, "第二次测试摧毁");
    removeNegativeAttackCards(game, game.boardCards, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      firstDestroyed,
      secondDestroyed,
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "chenwu-break") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const chenWu = createScenarioCard("三国~吴", "陈武", 1, 2, 1);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 2);
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [chenWu, maoJie];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[1].hand = [{ ...liDian, ownerId: 2 }];
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: chenWu.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      p1Hand: game.players[0].hand.map((card) => card.name),
      p2Hand: game.players[1].hand.map((card) => card.name),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "dingfeng-discard") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const dingFeng = buildCampDeck("三国~吴").find((item) => item.name === "丁奉");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...dingFeng, ownerId: 1 }];
    state.game = game;
    discardRandomHandCard(game, 1, 1, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "dingfeng-action-slots") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const dingFeng = createScenarioCard("三国~吴", "丁奉", 1, 2, 2);
    const hanDang = createScenarioCard("三国~吴", "韩当", 1, 2, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [dingFeng, hanDang];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    const dingAction = { type: "move", playerId: 1, cardUid: dingFeng.uid, source: { row: 2, col: 2 }, target: { row: 2, col: 3 } };
    const hanAction = { type: "move", playerId: 1, cardUid: hanDang.uid, source: { row: 2, col: 1 }, target: { row: 2, col: 0 } };
    state.game = game;
    const globalLimit = 1 + getGlobalExtraActionCount(game, 1);
    const personalSet = new Set(getPersonalExtraActionCardUids(game, 1));
    const firstDingProjected = [dingAction];
    const secondHanProjected = [dingAction, hanAction];
    const firstHanProjected = [hanAction];
    const secondDingProjected = [hanAction, dingAction];
    publishDebugScenarioResult(scenario, {
      globalLimit,
      personalExtraUids: [...personalSet],
      firstDingAllowedByLimit: firstDingProjected.length <= globalLimit + countPersonalExtraActions(game, 1, firstDingProjected),
      secondHanAllowedByLimit: secondHanProjected.length <= globalLimit + countPersonalExtraActions(game, 1, secondHanProjected),
      firstHanAllowedByLimit: firstHanProjected.length <= globalLimit + countPersonalExtraActions(game, 1, firstHanProjected),
      secondDingAllowedByLimit: secondDingProjected.length <= globalLimit + countPersonalExtraActions(game, 1, secondDingProjected)
    });
    return;
  }

  if (scenario === "xusheng-place-draw") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const xuSheng = buildCampDeck("三国~吴").find((item) => item.name === "徐盛");
    const maoJie = buildCampDeck("三国~魏").find((item) => item.name === "毛玠");
    const liDian = buildCampDeck("三国~魏").find((item) => item.name === "李典");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...xuSheng, ownerId: 1 }];
    game.players[1].drawPile = [
      { ...maoJie, ownerId: 2 },
      { ...liDian, ownerId: 2 }
    ];
    state.game = game;
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, []);
    render();
    publishDebugScenarioResult(scenario, {
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      p1Hand: game.players[0].hand.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp
      })),
      p2Deck: game.players[1].drawPile.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "panzhang-place") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const panZhang = buildCampDeck("三国~吴").find((item) => item.name === "潘璋");
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [maoJie, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...panZhang, ownerId: 1 }];
    state.game = game;
    const actionLog = [];
    const placed = game.players[0].hand.splice(0, 1)[0];
    placed.row = 2;
    placed.col = 2;
    game.boardCards.push(placed);
    applyOnPlaceEffect(game, game.players[0], placed, actionLog);
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      }))
    });
    return;
  }

  if (scenario === "panzhang-chain") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const panZhang = createScenarioCard("三国~吴", "潘璋", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 3, 2);
    const hanDang = buildCampDeck("三国~吴").find((item) => item.name === "韩当");
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [panZhang, maoJie, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.players[0].hand = [{ ...hanDang, ownerId: 1 }];
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, maoJie, actionLog, "测试击破");
    triggerOnDefeatEffects(game, game.boardCards, panZhang, maoJie, actionLog, "attack");
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "panzhang-chain-no-hand") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const panZhang = createScenarioCard("三国~吴", "潘璋", 1, 2, 2);
    const maoJie = createScenarioCard("三国~魏", "毛玠", 2, 2, 3);
    const yuJin = createScenarioCard("三国~魏", "于禁", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [panZhang, maoJie, yuJin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const actionLog = [];
    destroyBoardCard(game, game.boardCards, maoJie, actionLog, "测试击破");
    triggerOnDefeatEffects(game, game.boardCards, panZhang, maoJie, actionLog, "attack");
    render();
    publishDebugScenarioResult(scenario, {
      actionLog,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "taishici-move-push") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const taiShiCi = createScenarioCard("三国~吴", "太史慈", 1, 3, 2);
    const northEnemy = createScenarioCard("三国~魏", "毛玠", 2, 0, 2);
    const eastEnemy = createScenarioCard("三国~魏", "于禁", 2, 2, 3);
    const westAlly = createScenarioCard("三国~吴", "韩当", 1, 2, 0);
    const southEnemy = createScenarioCard("三国~魏", "曹休", 2, 4, 2);
    const eastBlocker = createScenarioCard("三国~魏", "李典", 2, 2, 4);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [taiShiCi, northEnemy, eastEnemy, westAlly, southEnemy, eastBlocker];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: taiShiCi.uid, source: { row: 3, col: 2 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "taishici-move-push-success") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const taiShiCi = createScenarioCard("三国~吴", "太史慈", 1, 3, 2);
    const northEnemy = createScenarioCard("三国~魏", "毛玠", 2, 1, 2);
    const eastEnemy = createScenarioCard("三国~魏", "于禁", 2, 2, 3);
    const westEnemy = createScenarioCard("三国~魏", "李典", 2, 2, 1);
    const southEnemy = createScenarioCard("三国~魏", "曹休", 2, 3, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [taiShiCi, northEnemy, eastEnemy, westEnemy, southEnemy];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [{ type: "move", playerId: 1, cardUid: taiShiCi.uid, source: { row: 3, col: 2 }, target: { row: 2, col: 2 } }],
      2: []
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack,
        camp: card.camp
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }

  if (scenario === "jiangqin-corner-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 0, 0);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [jiangQin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const destroyed = destroyBoardCard(game, game.boardCards, jiangQin, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "jiangqin-center-destroy") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 2, 2);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [jiangQin];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    state.game = game;
    const destroyed = destroyBoardCard(game, game.boardCards, jiangQin, [], "测试摧毁");
    render();
    publishDebugScenarioResult(scenario, {
      destroyed,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      p1Hand: game.players[0].hand.map((card) => card.name)
    });
    return;
  }

  if (scenario === "jiangqin-corner-break") {
    const game = createGame("pvp", { 1: "三国~吴", 2: "三国~魏" });
    const jiangQin = createScenarioCard("三国~吴", "蒋钦", 1, 0, 0);
    const caoXiu = createScenarioCard("三国~魏", "曹休", 2, 0, 1);
    game.turn = 1;
    game.currentPhase = "行动阶段";
    game.brokenCells = [];
    game.boardCards = [jiangQin, caoXiu];
    game.effectBoardCards = null;
    game.winner = null;
    game.isAnimating = false;
    game.players.forEach((player) => {
      player.hand = [];
      player.drawPile = [];
      player.submittedActions = [];
    });
    game.plannedActions = {
      1: [],
      2: [{ type: "move", playerId: 2, cardUid: caoXiu.uid, source: { row: 0, col: 1 }, target: { row: 0, col: 0 } }]
    };
    state.game = game;
    await resolveRound(game);
    publishDebugScenarioResult(scenario, {
      lastResolution: game.lastResolution,
      boardCards: game.boardCards.map((card) => ({
        name: card.name,
        ownerId: card.ownerId,
        row: card.row,
        col: card.col,
        attack: card.currentAttack
      })),
      turn: game.turn,
      phase: game.currentPhase
    });
    return;
  }
}

function bindEvents() {
  ui.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMode = button.dataset.mode;
      ui.modeButtons.forEach((item) => item.classList.toggle("selected", item === button));
    });
  });

  ui.mapButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedBoardSize = Number(button.dataset.boardSize) || 4;
      ui.mapButtons.forEach((item) => item.classList.toggle("selected", item === button));
    });
  });

  ui.startGameBtn.addEventListener("click", () => startRandomGame(state.selectedMode));
  ui.submitActionBtn.addEventListener("click", () => {
    submitCurrentAction();
  });
  ui.cancelSelectionBtn.addEventListener("click", cancelSelection);
  ui.restartBtn.addEventListener("click", () => startRandomGame(state.game?.mode || state.selectedMode));
  ui.backMenuBtn.addEventListener("click", resetToMenu);
  ui.resultRestartBtn.addEventListener("click", () => startRandomGame(state.game?.mode || state.selectedMode));
  ui.resultMenuBtn.addEventListener("click", resetToMenu);
}

window.__CARD_DEMO_DEBUG__ = {
  state,
  ui,
  render,
  createGame,
  resolveRound,
  resetSelection,
  cloneCard,
  buildCampDeck,
  drawOneCard,
  getPlayer,
  getCardByUid,
  getBoardCardAt,
  getCampDisplayName
};

bindEvents();
runDebugScenarioFromQuery();
