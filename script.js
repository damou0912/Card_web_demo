const HAND_LIMIT = 5;
const ACTION_ANIMATION_MS = 1200;
const ACTION_IMPACT_HOLD_MS = 280;
const BOARD_PULSE_VISIBLE_MS = 520;
const BOARD_PULSE_FADE_MS = 260;
const BOARD_PULSE_STEP_GAP_MS = 140;
const TURN_START_PULSE_VISIBLE_MS = 2200;
const TURN_START_PULSE_FADE_MS = 320;
const TURN_START_PULSE_STEP_GAP_MS = 220;
const CARD_FLOW_VISIBLE_MS = 980;
const CARD_FLOW_FADE_MS = 260;
const CARD_FLOW_STEP_GAP_MS = 140;
const POWER_CHANGE_VISIBLE_MS = 980;
const POWER_CHANGE_FADE_MS = 300;
let destructionAnimationSequence = 0;

const THEME_STORAGE_KEY = "card-demo-theme";
const THEME_PRESETS = Object.freeze({
  moss: "苔原灰绿",
  mist: "雾蓝灰",
  dawn: "暖杏灰",
  bamboo: "竹青淡绿",
  night: "夜间护眼"
});

const GAME_CARD_SLOT_TEMPLATES = window.CARD_LIBRARY?.cardSlots;
if (window.CARD_LIBRARY?.version !== "card-info-v2-display-effect-isolation-20260908" || !Array.isArray(GAME_CARD_SLOT_TEMPLATES)) {
  throw new Error("当前卡牌数据未正确加载，游戏已停止初始化。");
}
const CHAOS_DECK_KEY = "混沌";
const CHAOS_DECK_RARITY_COUNTS = Object.freeze({
  "普通": 7,
  "稀有": 5,
  "史诗": 3,
  "传说": 1,
  "特殊": 4
});
const GAME_CARD_DISPLAY_BY_ID = new Map(GAME_CARD_SLOT_TEMPLATES.map((slot) => [String(slot.id), slot]));
const GUARD_CARD_DISPLAY = Object.freeze({
  name: "守军", camp: "无势力", rarity: "普通", skill: "无",
  effect: "中立守军：双方均视为敌方卡牌。"
});
const UNKNOWN_CARD_DISPLAY = Object.freeze({
  name: "未知卡牌", camp: "无势力", rarity: "普通", skill: "无",
  effect: "无技能效果。"
});

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
  gameMenuBtn: document.getElementById("game-menu-btn"),
  gameMenuModal: document.getElementById("game-menu-modal"),
  gameMenuClose: document.getElementById("game-menu-close"),
  themeMenuBtn: document.getElementById("theme-menu-btn"),
  themeMenuModal: document.getElementById("theme-menu-modal"),
  themeMenuClose: document.getElementById("theme-menu-close"),
  themeSubmenuBtn: document.getElementById("theme-submenu-btn"),
  themeSubmenu: document.getElementById("theme-submenu"),
  mapSubmenuBtn: document.getElementById("map-submenu-btn"),
  mapSubmenu: document.getElementById("map-submenu"),
  playerIdValue: document.getElementById("player-id-value"),
  editPlayerIdBtn: document.getElementById("edit-player-id-btn"),
  modeButtons: [...document.querySelectorAll(".mode-btn")],
  modeDescription: document.getElementById("mode-description"),
  mapButtons: [...document.querySelectorAll(".map-btn")],
  themeButtons: [...document.querySelectorAll(".theme-btn")],
  themeCurrentLabels: [...document.querySelectorAll(".theme-current-label")],
  startGameBtn: document.getElementById("start-game-btn"),
  modeLabel: document.getElementById("mode-label"),
  turnLabel: document.getElementById("turn-label"),
  phaseLabel: document.getElementById("phase-label"),
  deckLabel: document.getElementById("deck-label"),
  statusMessage: document.getElementById("status-message"),
  statusSubtext: document.getElementById("status-subtext"),
  actingPlayerLabel: document.getElementById("acting-player-label"),
  actionsLabel: document.getElementById("actions-label"),
  ownPlayerTitle: document.getElementById("own-player-title"),
  opponentPlayerTitle: document.getElementById("opponent-player-title"),
  ownPlayerControl: document.getElementById("own-player-control"),
  opponentPlayerControl: document.getElementById("opponent-player-control"),
  ownPlayerSummary: document.getElementById("own-player-summary"),
  opponentPlayerSummary: document.getElementById("opponent-player-summary"),
  opponentAiEffect: document.getElementById("opponent-ai-effect"),
  ownChallengeEffects: document.getElementById("own-challenge-effects"),
  challengeRewardModal: document.getElementById("challenge-reward-modal"),
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
  turnTimer: document.getElementById("turn-timer"),
  turnTimerValue: document.getElementById("turn-timer-value"),
  handCards: document.getElementById("hand-cards"),
  submitActionBtn: document.getElementById("submit-action-btn"),
  cancelSelectionBtn: document.getElementById("cancel-selection-btn"),
  restartBtn: document.getElementById("restart-btn"),
  backMenuBtn: document.getElementById("back-menu-btn"),
  winnerTitle: document.getElementById("winner-title"),
  winnerSubtitle: document.getElementById("winner-subtitle"),
  resultWinnerId: document.getElementById("result-winner-id"),
  resultWinnerSlot: document.getElementById("result-winner-slot"),
  resultScorePlayer1Label: document.getElementById("result-score-player1-label"),
  resultScorePlayer2Label: document.getElementById("result-score-player2-label"),
  resultScorePlayer1: document.getElementById("result-score-player1"),
  resultScorePlayer2: document.getElementById("result-score-player2"),
  resultScoreSummary: document.getElementById("result-score-summary"),
  resultRoundCount: document.getElementById("result-round-count"),
  winnerControlSummary: document.getElementById("winner-control-summary"),
  winnerComparison: document.getElementById("winner-comparison"),
  deckSummaryPlayer1: document.getElementById("deck-summary-player1"),
  deckSummaryPlayer2: document.getElementById("deck-summary-player2"),
  resultRestartBtn: document.getElementById("result-restart-btn"),
  resultNextLevelBtn: document.getElementById("result-next-level-btn"),
  resultMenuBtn: document.getElementById("result-menu-btn")
};

const state = {
  selectedMode: "pvp",
  challengeLevel: 1,
  selectedBoardSize: 5,
  playerName: "",
  selectedDecks: { 1: null, 2: null },
  pendingChallengeTraitIds: null,
  challengePlayerTraitIds: [],
  pendingChallengeRewardChoices: null,
  pendingChallengeRewardLevel: null,
  game: null,
  online: { playerId: null, roomCode: null, host: false, role: null, rooms: [] }
};

function getCampDisplayName(campKey) {
  return String(campKey || "无势力").replace("~", "·");
}

function getCardDisplay(cardOrId) {
  if (cardOrId?.isGuard) return GUARD_CARD_DISPLAY;
  const id = typeof cardOrId === "object" ? cardOrId?.id : cardOrId;
  return GAME_CARD_DISPLAY_BY_ID.get(String(id || "")) || UNKNOWN_CARD_DISPLAY;
}

function getCardDisplayName(cardOrId) {
  return getCardDisplay(cardOrId).name;
}

function getCardBaseAttack(cardOrId) {
  const displayValue = Number(getCardDisplay(cardOrId)?.baseAttack);
  if (Number.isFinite(displayValue)) return displayValue;
  const runtimeValue = typeof cardOrId === "object" ? Number(cardOrId?.attack) : NaN;
  return Number.isFinite(runtimeValue) ? Math.max(0, runtimeValue) : 0;
}

function getCardRuntimeDefinition(cardOrId) {
  const id = String(typeof cardOrId === "object" ? cardOrId?.id : cardOrId || "");
  const prefix = id.slice(0, 2);
  const group = prefix === "01" ? "shu" : prefix === "02" ? "wei" : prefix === "03" ? "wu" : "";
  return group ? window.CARD_EFFECTS_V2?.[group]?.[id] || null : null;
}

function makeCardTemplate(slot) {
  return {
    id: String(slot.id),
    attack: Number(slot.attack) || 0
  };
}

function cloneCard(template) {
  const id = String(template?.id || "");
  const runtimeDefinition = getCardRuntimeDefinition(id);
  const runtimeBaseAttack = runtimeDefinition?.baseAttack;
  const attack = Math.max(0, Number.isFinite(runtimeBaseAttack) ? runtimeBaseAttack : Number(template?.attack) || 0);
  return {
    id,
    attack,
    uid: `${id}-${Math.random().toString(36).slice(2, 8)}`,
    ownerId: null,
    currentAttack: attack,
    buffCap: attack,
    movesTaken: 0,
    hasPlaced: false,
    // Persist generic action capabilities so the online validator can apply
    // the same effect flags without loading browser-only effect modules.
    freeMove: Boolean(runtimeDefinition?.flags?.freeMove)
  };
}

function buildCampDeck(campKey) {
  if (campKey === CHAOS_DECK_KEY) {
    const selectedSlots = Object.entries(CHAOS_DECK_RARITY_COUNTS).flatMap(([rarity, count]) => {
      const rarityPool = GAME_CARD_SLOT_TEMPLATES.filter((slot) => slot.rarity === rarity);
      if (rarityPool.length < count) {
        throw new Error(`混沌卡组无法生成：${rarity}卡牌需要 ${count} 张，当前仅有 ${rarityPool.length} 张。`);
      }
      return shuffle(rarityPool).slice(0, count);
    });
    return selectedSlots.map((slot) => cloneCard(makeCardTemplate(slot)));
  }
  const directCards = GAME_CARD_SLOT_TEMPLATES.filter((slot) => slot.camp === campKey);
  return directCards.map((slot) => cloneCard(makeCardTemplate(slot)));
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

function resetSelection() {
  return { handCardUid: null, boardCardUid: null, targetCell: null };
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
  return { status: "drawn", card: drawnCard };
}

function drawCardsToHandLimit(game, player) {
  let result = { status: "skipped" };
  while (player.hand.length < HAND_LIMIT) {
    result = drawOneCard(game, player);
    if (result.status !== "drawn") {
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

function getStoredTheme() {
  try {
    const stored = window.localStorage?.getItem(THEME_STORAGE_KEY);
    return Object.prototype.hasOwnProperty.call(THEME_PRESETS, stored) ? stored : "moss";
  } catch (_error) {
    return "moss";
  }
}

function applyTheme(themeKey, persist = true) {
  const nextTheme = Object.prototype.hasOwnProperty.call(THEME_PRESETS, themeKey) ? themeKey : "moss";
  if (document.documentElement?.dataset) document.documentElement.dataset.theme = nextTheme;
  ui.themeButtons?.forEach((button) => {
    const selected = button.dataset.theme === nextTheme;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.title = THEME_PRESETS[button.dataset.theme] || "页面配色";
  });
  ui.themeCurrentLabels?.forEach((label) => {
    label.textContent = THEME_PRESETS[nextTheme];
  });
  if (!persist) return;
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (_error) {
    // Theme changes still apply for the current session when storage is unavailable.
  }
}

function initializeTheme() {
  applyTheme(getStoredTheme(), false);
}

function syncBoardSizeUi() {
  const selectedSize = Number(state.selectedBoardSize) || 5;
  ui.mapButtons?.forEach((button) => {
    const selected = Number(button.dataset.boardSize) === selectedSize;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function switchScreen(name) {
  Object.entries(ui.screens).forEach(([key, element]) => {
    element.classList.toggle("active", key === name);
  });
  if (ui.themeMenuBtn) {
    const showThemeTrigger = name === "menu";
    ui.themeMenuBtn.hidden = !showThemeTrigger;
    ui.themeMenuBtn.setAttribute("aria-hidden", String(!showThemeTrigger));
  }
  if (name !== "game") closeGameMenu();
  closeThemeMenu();
}

function setGameMenuOpen(open) {
  if (!ui.gameMenuModal) return;
  const shouldOpen = Boolean(open);
  if (shouldOpen) closeThemeMenu();
  ui.gameMenuModal.classList.toggle("visible", shouldOpen);
  ui.gameMenuModal.setAttribute("aria-hidden", String(!shouldOpen));
  ui.gameMenuBtn?.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) ui.gameMenuClose?.focus();
  else ui.gameMenuBtn?.focus();
}

function closeGameMenu() {
  setGameMenuOpen(false);
}

function setThemeSubmenuOpen(open) {
  if (!ui.themeSubmenu) return;
  const shouldOpen = Boolean(open);
  ui.themeSubmenu.hidden = !shouldOpen;
  ui.themeSubmenu.classList.toggle("visible", shouldOpen);
  ui.themeSubmenuBtn?.setAttribute("aria-expanded", String(shouldOpen));
  ui.themeSubmenuBtn?.classList.toggle("expanded", shouldOpen);
  if (shouldOpen) ui.themeButtons?.[0]?.focus();
}

function setMapSubmenuOpen(open) {
  if (!ui.mapSubmenu) return;
  const shouldOpen = Boolean(open);
  ui.mapSubmenu.hidden = !shouldOpen;
  ui.mapSubmenu.classList.toggle("visible", shouldOpen);
  ui.mapSubmenuBtn?.setAttribute("aria-expanded", String(shouldOpen));
  ui.mapSubmenuBtn?.classList.toggle("expanded", shouldOpen);
  if (shouldOpen) {
    const submenuButtons = [...ui.mapSubmenu.querySelectorAll(".map-btn")];
    const selectedButton = submenuButtons.find((button) => Number(button.dataset.boardSize) === Number(state.selectedBoardSize));
    (selectedButton || submenuButtons[0])?.focus();
  }
}

function setThemeMenuOpen(open) {
  if (!ui.themeMenuModal) return;
  const shouldOpen = Boolean(open);
  if (shouldOpen) closeGameMenu();
  ui.themeMenuModal.classList.toggle("visible", shouldOpen);
  ui.themeMenuModal.setAttribute("aria-hidden", String(!shouldOpen));
  ui.themeMenuBtn?.setAttribute("aria-expanded", String(shouldOpen));
  setThemeSubmenuOpen(false);
  setMapSubmenuOpen(false);
  if (shouldOpen) ui.themeMenuClose?.focus();
}

function closeThemeMenu() {
  setThemeMenuOpen(false);
}

function getAvailableDeckKeys() {
  return [...new Set(GAME_CARD_SLOT_TEMPLATES.map((slot) => slot.camp).filter(Boolean)), CHAOS_DECK_KEY];
}

function getRandomDeckKey() {
  const decks = getAvailableDeckKeys().filter((deckKey) => deckKey !== CHAOS_DECK_KEY);
  return decks.length ? decks[randomInt(0, decks.length - 1)] : null;
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

function getOrthogonalNeighbors(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 }
  ];
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

function syncPlayerBoardIds(game) {
  game.players.forEach((player) => {
    player.boardCardIds = game.boardCards.filter((card) => card.ownerId === player.id).map((card) => card.uid);
  });
}

function playerName(game, playerId) {
  return game.players.find((player) => player.id === playerId)?.name || `玩家 ${playerId}`;
}

function formatCell(row, col) {
  return `${row + 1}-${col + 1}`;
}

function getCardQuality(card) {
  return getCardDisplay(card).rarity || "普通";
}

function getCardTierLabel(card) {
  return `${getCardQuality(card)}卡`;
}

function getCardAttackText(card, game = null) {
  const currentValue = resolveAttackValue(game, card);
  const baseValue = getCardBaseAttack(card);
  return currentValue === baseValue
    ? `战力 ${baseValue}`
    : `战力 ${currentValue} / 基础 ${baseValue}`;
}

function renderResult(game) {
  const winnerId = Number(game.winner?.playerId) || 0;
  const winner = winnerId ? game.players.find((player) => player.id === winnerId) : null;
  const displayName = (player) => player?.name || `玩家 ${player?.id || "?"}`;
  const playerOne = game.players.find((player) => player.id === 1) || game.players[0];
  const playerTwo = game.players.find((player) => player.id === 2) || game.players[1];
  const finalControl = game.finalControlCounts || game.players.reduce((counts, player) => {
    counts[player.id] = game.boardCards.filter((card) => !card.isGuard && card.ownerId === player.id).length;
    return counts;
  }, {});
  game.players.forEach((player) => {
    player.lastControlCount = finalControl[player.id] || 0;
  });
  const scoreOne = Number(finalControl[playerOne?.id || 1]) || 0;
  const scoreTwo = Number(finalControl[playerTwo?.id || 2]) || 0;
  const roundCount = Math.max(1, Number(game.turn) || Number(game.lastResolvedTurn) || 1);
  const winnerDisplayId = winner
    ? (game.mode === "online" ? displayName(winner) : winner.isAI ? "AI" : `P${winner.id}`)
    : "—";

  ui.winnerTitle.textContent = winner ? `${displayName(winner)} 获胜` : "本局平局";
  const challengeComplete = game.mode === "pve-challenge" && winnerId === 1 && Number(game.challengeLevel) >= 12;
  ui.winnerSubtitle.textContent = challengeComplete
    ? "恭喜，你已打通目前的全部 12 个挑战关卡。"
    : game.winner?.text || "本局对战已结束。";
  ui.resultWinnerId.textContent = winnerDisplayId;
  ui.resultWinnerSlot.textContent = winner
    ? (game.mode === "online" ? `联网对局 · 玩家 ${winner.id} 席位` : `${displayName(winner)} · ${winner.isAI ? "PVE" : "本地"}对局`)
    : "双方没有单一获胜者";
  ui.resultScorePlayer1Label.textContent = displayName(playerOne);
  ui.resultScorePlayer2Label.textContent = displayName(playerTwo);
  ui.resultScorePlayer1.textContent = String(scoreOne);
  ui.resultScorePlayer2.textContent = String(scoreTwo);
  const isSurrenderResult = /认输/.test(game.winner?.text || "");
  ui.resultScoreSummary.textContent = isSurrenderResult
    ? `${displayName(winner)} 因对方认输获胜 · 最终占领 ${scoreOne}:${scoreTwo}`
    : winner
      ? `${displayName(winner)} 以 ${winner.id === 1 ? `${scoreOne}:${scoreTwo}` : `${scoreTwo}:${scoreOne}`} 获胜`
      : `双方 ${scoreOne}:${scoreTwo} 平局`;
  ui.resultRoundCount.textContent = `${roundCount} 回合`;
  ui.winnerControlSummary.textContent = `最终占领：${displayName(playerOne)} ${scoreOne} 格 · ${displayName(playerTwo)} ${scoreTwo} 格`;
  const power = game.players.map((player) => game.boardCards
    .filter((card) => card.ownerId === player.id)
    .reduce((sum, card) => sum + (Number(card.currentAttack) || Number(card.attack) || 0), 0));
  const losingId = winnerId === 0 ? 0 : (power[0] < power[1] ? 1 : power[1] < power[0] ? 2 : 0);
  ui.winnerComparison.innerHTML = `<span class="winner-power-block"><small>${displayName(playerOne)} 战力</small><strong class="winner-power ${losingId === 1 ? "losing-power" : ""}">${power[0]}</strong></span><span class="winner-vs">VS</span><span class="winner-power-block"><small>${displayName(playerTwo)} 战力</small><strong class="winner-power ${losingId === 2 ? "losing-power" : ""}">${power[1]}</strong></span>`;
  if (losingId) {
    window.setTimeout(() => {
      const losingPower = ui.winnerComparison.querySelector(`.winner-power-block:nth-of-type(${losingId === 1 ? 1 : 3}) .winner-power`);
      losingPower?.classList.add("power-slashed");
    }, 520);
  }
  ui.deckSummaryPlayer1.textContent = summarizeDeck(game.players[0].deckCatalog, game.players[0].deckKey);
  ui.deckSummaryPlayer2.textContent = summarizeDeck(game.players[1].deckCatalog, game.players[1].deckKey);
  if (ui.resultNextLevelBtn) {
    const canAdvance = game.mode === "pve-challenge" && winnerId === 1 && Number(game.challengeLevel) < 12;
    ui.resultNextLevelBtn.hidden = !canAdvance;
    ui.resultNextLevelBtn.textContent = `进入第 ${(Number(game.challengeLevel) || 1) + 1} 关`;
  }
  const isSpectator = state.online?.role === "spectator";
  ui.resultRestartBtn.hidden = isSpectator;
  ui.resultMenuBtn.textContent = isSpectator ? "退出观战" : "返回主菜单";
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

function showResult() {
  renderResult(state.game);
  const game = state.game;
  const winnerId = game?.winner?.id;
  const shouldShowReward = game?.mode === "pve-challenge" && winnerId === 1 && Number(game.challengeLevel) < 12;
  if (shouldShowReward) {
    const ownedTraitIds = state.challengePlayerTraitIds || [];
    const rewardChoices = window.corePickChallengeRewardTraits?.(ownedTraitIds, 3) || [];
    if (rewardChoices.length) {
      setTimeout(() => window.showChallengeRewardSelection?.(rewardChoices), 500);
      return;
    }
  }
  switchScreen("result");
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
  closeGameMenu();
  if (state.game?.mode === "online" || state.online?.roomCode) leaveOnlineSession();
  state.game = null;
  state.challengeLevel = 1;
  state.pendingChallengeTraitIds = null;
  state.challengePlayerTraitIds = [];
  state.pendingChallengeRewardChoices = null;
  state.pendingChallengeRewardLevel = null;
  switchScreen("menu");
}

function leaveOnlineSession() {
  if (state.online?.roomCode) window.CardOnline?.leaveRoom?.();
  try { window.localStorage?.removeItem("cardDemoOnlineRoom"); } catch (_error) { /* storage may be unavailable */ }
  const unsubscribe = state.online?.unsubscribe;
  state.online = { playerId: null, roomCode: null, host: false, role: null, rooms: [], unsubscribe };
}

function getBoardCellElement(row, col) {
  return ui.board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
}

function createMovingCard(card, ownerId) {
  const display = getCardDisplay(card);
  const ghost = document.createElement("div");
  ghost.className = `moving-card player${ownerId}`;
  ghost.innerHTML = `
    <span class="unit-name">${display.name}</span>
    <span class="unit-meta">${display.skill} · ${getCardAttackText(card)}</span>
  `;
  return ghost;
}

function createMovementRoute(stageRect, fromRect, toRect, variant = "action", label = "移动") {
  const startX = fromRect.left - stageRect.left + fromRect.width / 2;
  const startY = fromRect.top - stageRect.top + fromRect.height / 2;
  const endX = toRect.left - stageRect.left + toRect.width / 2;
  const endY = toRect.top - stageRect.top + toRect.height / 2;
  const distance = Math.max(8, Math.hypot(endX - startX, endY - startY));
  const route = document.createElement("div");
  route.className = `movement-route movement-route-${variant}`;
  route.style.left = `${startX}px`;
  route.style.top = `${startY - 4}px`;
  route.style.width = `${distance}px`;
  route.style.setProperty("--route-angle", `${Math.atan2(endY - startY, endX - startX) * 180 / Math.PI}deg`);

  const marker = document.createElement("div");
  marker.className = `movement-destination movement-destination-${variant}`;
  marker.style.left = `${endX}px`;
  marker.style.top = `${endY}px`;
  marker.innerHTML = `<span class="movement-destination-ring"></span><span class="movement-destination-label"></span>`;
  const markerLabel = marker.querySelector(".movement-destination-label");
  if (markerLabel) markerLabel.textContent = label;
  return { route, marker, startX, startY, endX, endY };
}

function markMovementCells(sourceCell, targetCell) {
  sourceCell?.classList.add("movement-source-cell");
  targetCell?.classList.add("movement-target-cell");
}

function clearMovementCells(sourceCell, targetCell) {
  sourceCell?.classList.remove("movement-source-cell");
  targetCell?.classList.remove("movement-target-cell");
}

function prepareMovingGhost(ghost, stageRect, fromRect, toRect) {
  if (!ghost) return;
  ghost.style.left = `${fromRect.left - stageRect.left}px`;
  ghost.style.top = `${fromRect.top - stageRect.top}px`;
  ghost.style.width = `${toRect.width}px`;
  ghost.style.minHeight = `${toRect.height}px`;
  ghost.style.setProperty("--move-x", `${toRect.left - fromRect.left}px`);
  ghost.style.setProperty("--move-y", `${toRect.top - fromRect.top}px`);
}

function createCombatCard(card, side) {
  const display = getCardDisplay(card);
  const ghost = document.createElement("div");
  ghost.className = `combat-card player${card.ownerId} combat-${side}`;
  ghost.innerHTML = `
    <span class="combat-card-name">${display.name}</span>
    <span class="combat-card-skill">${display.skill}</span>
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
  const display = getCardDisplay(event.cardId);
  const ghost = document.createElement("div");
  ghost.className = `combat-card player${event.ownerId || 1} destruction-card`;
  ghost.innerHTML = `
    <span class="combat-card-name">${display === UNKNOWN_CARD_DISPLAY ? "卡牌" : display.name}</span>
    <span class="combat-card-skill">${display === UNKNOWN_CARD_DISPLAY ? (event.label || "被摧毁") : display.skill}</span>
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
  showCombatFlowPrompt(game, `${getCardDisplayName(cardA)} 与 ${getCardDisplayName(cardB)} 在${game.currentPhase || "行动阶段"}进行${mode}。`);
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
  const cardAName = getCardDisplayName(scene.cardA);
  const cardBName = getCardDisplayName(scene.cardB);
  const result = document.createElement("div");
  result.className = "combat-result";
  let message;
  if (!aAlive && !bAlive) {
    applyDestructionVisual(scene.cardAElement, scene.cardA, game);
    applyDestructionVisual(scene.cardBElement, scene.cardB, game);
    message = `${cardAName} 与 ${cardBName} 同归于尽`;
  } else if (aAlive && !bAlive) {
    applyDestructionVisual(scene.cardBElement, scene.cardB, game);
    message = `${cardAName} 胜利，${cardBName} 被摧毁`;
  } else if (!aAlive && bAlive) {
    applyDestructionVisual(scene.cardAElement, scene.cardA, game);
    message = `${cardBName} 胜利，${cardAName} 被摧毁`;
  } else if (outcome === "both") {
    scene.cardAElement.classList.add("shielded");
    scene.cardBElement.classList.add("shielded");
    message = `${cardAName} 与 ${cardBName} 交战未分胜负`;
  } else if (aAlive) {
    scene.cardBElement.classList.add("shielded");
    message = `${cardAName} 占优，但 ${cardBName} 防守成功`;
  } else {
    scene.cardAElement.classList.add("shielded");
    message = `${cardBName} 占优，但 ${cardAName} 防守成功`;
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
  const isBoardEvent = typeof event?.row === "number" && typeof event?.col === "number";
  const isCardFlowEvent = ["draw", "discard", "draw-failed"].includes(event?.kind);
  if (!game || !event || (!isBoardEvent && !isCardFlowEvent)) {
    return null;
  }
  if (!Array.isArray(game.pendingAnimations)) {
    game.pendingAnimations = [];
  }
  game.pendingAnimations.push(event);
  return event;
}

function queuePowerAnimation(game, card, delta, previousPower = null, currentPower = null) {
  if (!game || !card || !delta || typeof card.row !== "number" || typeof card.col !== "number") return;
  const before = Number.isFinite(Number(previousPower)) ? Number(previousPower) : Math.max(0, (Number(card.currentAttack) || 0) - delta);
  const after = Number.isFinite(Number(currentPower)) ? Number(currentPower) : Number(card.currentAttack) || 0;
  queueBoardAnimation(game, {
    row: card.row,
    col: card.col,
    ownerId: card.ownerId || 1,
    kind: "power",
    effectType: delta > 0 ? "boost" : "weaken",
    glyph: delta > 0 ? "↑" : "↓",
    label: "战力变化",
    detail: `${delta > 0 ? "+" : ""}${delta}`,
    delta,
    previousPower: before,
    currentPower: after,
    cardUid: card.uid
  });
}

function createPowerChangeEffect(event) {
  const delta = Number(event.delta ?? event.currentPower - event.previousPower) || 0;
  const increase = delta > 0;
  const amount = Math.abs(delta);
  const before = Number.isFinite(Number(event.previousPower)) ? Number(event.previousPower) : "-";
  const after = Number.isFinite(Number(event.currentPower)) ? Number(event.currentPower) : "-";
  const effect = document.createElement("div");
  effect.className = `power-change power-change-${increase ? "boost" : "weaken"}`;
  effect.setAttribute("aria-hidden", "true");
  effect.innerHTML = `
    <span class="power-change-burst"></span>
    <span class="power-change-card">
      <span class="power-change-title">战力${increase ? "提升" : "下降"}</span>
      <strong class="power-change-delta">${increase ? "+" : "-"}${amount}</strong>
      <span class="power-change-values">${before} <b>→</b> ${after}</span>
    </span>
  `;
  return effect;
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
  const text = `${getCardDisplay(card).effect || ""} ${detail || ""}`;
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
  const display = getCardDisplay(card);
  const phase = game?.currentPhase || "结算阶段";
  const outcome = (detail || "触发技能效果。").trim();
  if (outcome.startsWith("对") || outcome.startsWith("使")) {
    return `${display.name}在${phase}以${display.skill}${outcome}`;
  }
  const simplified = outcome.startsWith(display.name) ? outcome.slice(display.name.length).trim() : outcome;
  return `${display.name}在${phase}以${display.skill}发动：${simplified}`;
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

function showCardFlowPrompt(game, prompt, kind) {
  if (!prompt) return;
  if (state.game && state.game.turn === game?.turn) {
    state.game.flowPrompt = prompt;
  }
  if (ui.statusMessage) ui.statusMessage.textContent = prompt;
  if (ui.statusSubtext) {
    ui.statusSubtext.textContent = kind === "discard" ? "弃牌效果正在展示。" : "抽卡效果正在展示。";
  }
}

function queueSkillAnimation(game, card, detail = null, tone = "skill") {
  if (!card) {
    return null;
  }
  const display = getCardDisplay(card);
  const profile = getSkillAnimationProfile(card, detail, tone);
  return queueBoardAnimation(game, {
    row: card.row,
    col: card.col,
    ownerId: card.ownerId || 1,
    kind: tone,
    cardName: display.name || "卡牌",
    label: display.skill || "技能触发",
    detail,
    fullEffect: display.effect || "无技能效果。",
    result: "",
    flowPrompt: formatSkillFlowPrompt(game, card, detail),
    cardUid: card.uid,
    ...profile
  });
}

function queueCardFlowAnimation(game, kind, player, card = null, options = {}) {
  if (!game || !kind || !player) return null;
  const display = card ? getCardDisplay(card) : null;
  const isDiscard = kind === "discard";
  const isFailed = kind === "draw-failed";
  const reason = options.reason === "hand-full" ? "手牌已满" : options.reason === "deck-empty" ? "牌库已空" : options.reason;
  return queueBoardAnimation(game, {
    kind,
    ownerId: player.id || 1,
    playerName: player.name || `玩家 ${player.id || 1}`,
    cardName: display?.name || (isFailed ? "未抽到卡牌" : "卡牌"),
    cardSkill: display?.skill || "",
    cardAttack: card ? Number(card.currentAttack ?? card.attack) || 0 : null,
    sourceLabel: options.sourceLabel || (isDiscard ? "手牌" : "牌库"),
    destinationLabel: options.destinationLabel || (isDiscard ? "弃牌" : "手牌"),
    reason,
    flowPrompt: options.flowPrompt || (isFailed
      ? `${player.name || `玩家 ${player.id || 1}`} 抽卡未成功：${reason || "当前条件不满足"}。`
      : `${player.name || `玩家 ${player.id || 1}`} ${isDiscard ? "弃置" : "抽取"} ${display?.name || "1 张卡牌"}。`)
  });
}

function escapeAnimationText(value) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[char]));
}

function createBoardPulse(event) {
  const pulse = document.createElement("div");
  pulse.className = `board-pulse ${event.kind || "skill"} ${event.effectType ? `skill-${event.effectType}` : ""} player${event.ownerId || 1}`;
  const fullEffect = event.fullEffect ? `<span class="pulse-effect-label">技能效果</span><span class="pulse-effect">${escapeAnimationText(event.fullEffect)}</span>` : "";
  const result = event.result ? `<span class="pulse-result-label">实际结果</span><span class="pulse-result">${escapeAnimationText(event.result)}</span>` : "";
  const detail = event.detail ? `<span class="pulse-detail">${escapeAnimationText(event.detail)}</span>` : "";
  pulse.innerHTML = `
    <span class="pulse-ripple ripple-one"></span>
    <span class="pulse-ripple ripple-two"></span>
    <span class="pulse-core">
      <span class="pulse-glyph">${event.glyph || "!"}</span>
      <span class="pulse-copy">
        <span class="pulse-tag">${escapeAnimationText(event.tag || "交战")}</span>
        ${event.cardName ? `<span class="pulse-card-name">${escapeAnimationText(event.cardName)}</span>` : ""}
        <span class="pulse-title">${escapeAnimationText(event.label || "技能触发")}</span>
        ${fullEffect}
        ${result}
        ${detail}
      </span>
    </span>
  `;
  return pulse;
}

function createCardFlowEffect(event) {
  const isDiscard = event.kind === "discard";
  const isFailed = event.kind === "draw-failed";
  const actionLabel = isFailed ? "抽卡未成功" : isDiscard ? "弃牌" : "抽卡";
  const sourceLabel = event.sourceLabel || (isDiscard ? "手牌" : "牌库");
  const destinationLabel = event.destinationLabel || (isDiscard ? "弃牌" : "手牌");
  const cardName = escapeAnimationText(event.cardName || (isFailed ? "未抽到卡牌" : "卡牌"));
  const cardSkill = event.cardSkill ? escapeAnimationText(event.cardSkill) : "";
  const hasCardAttack = event.cardAttack !== null && event.cardAttack !== undefined && Number.isFinite(Number(event.cardAttack));
  const cardAttack = hasCardAttack ? `战力 ${Number(event.cardAttack)}` : "";
  const reason = event.reason ? `<span class="card-flow-reason">${escapeAnimationText(event.reason)}</span>` : "";
  const effect = document.createElement("div");
  effect.className = `card-flow card-flow-${event.kind} player${event.ownerId || 1}`;
  effect.innerHTML = `
    <span class="card-flow-burst"></span>
    <span class="card-flow-route" aria-hidden="true"><span></span><b>${isDiscard ? "↓" : "↑"}</b></span>
    <span class="card-flow-card" aria-hidden="true">
      <span class="card-flow-card-top">${isFailed ? "!" : isDiscard ? "弃" : "抽"}</span>
      <strong>${cardName}</strong>
      ${cardSkill ? `<small>${cardSkill}</small>` : ""}
      ${cardAttack ? `<em>${cardAttack}</em>` : ""}
    </span>
    <span class="card-flow-copy">
      <span class="card-flow-label">${actionLabel}</span>
      <strong>${escapeAnimationText(event.playerName || "当前玩家")}</strong>
      <span class="card-flow-path"><b>${escapeAnimationText(sourceLabel)}</b><i>→</i><b>${escapeAnimationText(destinationLabel)}</b></span>
      ${reason}
    </span>
  `;
  return effect;
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
    if (["draw", "discard", "draw-failed"].includes(event.kind)) {
      showCardFlowPrompt(game, event.flowPrompt || `${event.playerName || "当前玩家"}${event.kind === "discard" ? "弃牌" : "抽卡"}。`, event.kind);
      const flow = createCardFlowEffect(event);
      ui.boardAnimationLayer.appendChild(flow);
      await nextFrame();
      flow.classList.add("visible");
      await wait(CARD_FLOW_VISIBLE_MS);
      flow.classList.add("fade");
      await wait(CARD_FLOW_FADE_MS);
      flow.remove();
      await wait(CARD_FLOW_STEP_GAP_MS);
      continue;
    }
    const cell = getBoardCellElement(event.row, event.col);
    if (!cell) {
      continue;
    }
    const rect = cell.getBoundingClientRect();
    if (event.kind === "power") {
      const effect = createPowerChangeEffect(event);
      const targetUnit = event.cardUid ? ui.board.querySelector(`.unit[data-card-uid="${event.cardUid}"]`) : null;
      const effectType = event.effectType === "weaken" ? "weaken" : "boost";
      effect.style.left = `${rect.left - stageRect.left + rect.width / 2}px`;
      effect.style.top = `${rect.top - stageRect.top + rect.height / 2}px`;
      ui.boardAnimationLayer.appendChild(effect);
      cell.classList.add("power-change-impact", `power-change-impact-${effectType}`);
      targetUnit?.classList.add("power-change-target", `power-change-target-${effectType}`);
      await nextFrame();
      effect.classList.add("visible");
      await wait(POWER_CHANGE_VISIBLE_MS);
      effect.classList.add("fade");
      await wait(POWER_CHANGE_FADE_MS);
      effect.remove();
      cell.classList.remove("power-change-impact", "power-change-impact-boost", "power-change-impact-weaken");
      targetUnit?.classList.remove("power-change-target", "power-change-target-boost", "power-change-target-weaken");
      continue;
    }
    if (event.kind === "skill-move" && typeof event.fromRow === "number" && typeof event.toRow === "number") {
      const fromCell = getBoardCellElement(event.fromRow, event.fromCol);
      const toCell = getBoardCellElement(event.toRow, event.toCol);
      if (fromCell && toCell) {
        const fromRect = fromCell.getBoundingClientRect();
        const toRect = toCell.getBoundingClientRect();
        const movingCard = event.cardUid ? getCardByUid(game, event.cardUid) : null;
        const route = createMovementRoute(stageRect, fromRect, toRect, "skill", event.label || "技能移动");
        const ghost = movingCard ? createMovingCard(movingCard, event.ownerId || movingCard.ownerId || 1) : null;
        prepareMovingGhost(ghost, stageRect, fromRect, toRect);
        ghost?.classList.add("skill-moving-card");
        markMovementCells(fromCell, toCell);
        showSkillFlowPrompt(game, event.flowPrompt || `${event.label || "技能移动"}：${event.detail || "卡牌位置发生变化"}`);
        ui.boardAnimationLayer.appendChild(route.route);
        ui.boardAnimationLayer.appendChild(route.marker);
        if (ghost) ui.boardAnimationLayer.appendChild(ghost);
        await nextFrame();
        route.route.classList.add("visible");
        route.marker.classList.add("visible");
        ghost?.classList.add("arrived");
        await wait(ACTION_ANIMATION_MS - ACTION_IMPACT_HOLD_MS);
        route.marker.classList.add("impact");
        ghost?.classList.add("flash");
        route.route.classList.add("fade");
        await wait(ACTION_IMPACT_HOLD_MS);
        route.route.remove?.();
        route.marker.remove?.();
        ghost?.remove?.();
        clearMovementCells(fromCell, toCell);
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
    const isTurnStart = event.kind === "turn-start";
    await wait(isTurnStart ? TURN_START_PULSE_VISIBLE_MS : event.kind === "skill" || event.kind === "skill-warn" ? BOARD_PULSE_VISIBLE_MS + 220 : BOARD_PULSE_VISIBLE_MS);
    pulse.classList.add("fade");
    await wait(isTurnStart ? TURN_START_PULSE_FADE_MS : BOARD_PULSE_FADE_MS);
    pulse.remove();
    destructionCard?.remove();
    cell.classList.remove("skill-impact", "skill-impact-danger", "skill-impact-boost", "skill-impact-weaken", "skill-impact-support", "skill-impact-tactic");
    if (sourceUnit) {
      sourceUnit.classList.remove("skill-casting", "skill-casting-danger", "skill-casting-boost", "skill-casting-weaken", "skill-casting-support", "skill-casting-tactic");
    }
    await wait(isTurnStart ? TURN_START_PULSE_STEP_GAP_MS : BOARD_PULSE_STEP_GAP_MS);
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
  const movementCells = [];
  actionable.forEach((action) => {
    const card = getCardByUid(game, action.cardUid);
    const targetCell = getBoardCellElement(action.target.row, action.target.col);
    if (!card || !targetCell) {
      return;
    }
    const targetRect = targetCell.getBoundingClientRect();
    let startRect;
    let sourceCell = null;
    if (action.type === "move") {
      sourceCell = getBoardCellElement(action.source.row, action.source.col);
      startRect = sourceCell ? sourceCell.getBoundingClientRect() : targetRect;
      if (sourceCell) {
        const route = createMovementRoute(stageRect, startRect, targetRect, "action", "移动");
        ui.boardAnimationLayer.appendChild(route.route);
        ui.boardAnimationLayer.appendChild(route.marker);
        route.route.classList.add("visible");
        route.marker.classList.add("visible");
        movementCells.push({ sourceCell, targetCell, route });
      }
    } else {
      const offsetX = action.playerId === 1 ? -120 : 120;
      const offsetY = action.playerId === 1 ? 40 : -40;
      startRect = { left: targetRect.left + offsetX, top: targetRect.top + offsetY, width: targetRect.width, height: targetRect.height };
      const arrival = document.createElement("div");
      arrival.className = "movement-destination movement-destination-action visible";
      arrival.style.left = `${targetRect.left - stageRect.left + targetRect.width / 2}px`;
      arrival.style.top = `${targetRect.top - stageRect.top + targetRect.height / 2}px`;
      arrival.innerHTML = `<span class="movement-destination-ring"></span><span class="movement-destination-label">放置</span>`;
      ui.boardAnimationLayer.appendChild(arrival);
      movementCells.push({ targetCell, marker: arrival });
    }
    const ghost = createMovingCard(card, action.playerId);
    prepareMovingGhost(ghost, stageRect, startRect, targetRect);
    ghost.classList.add(action.type === "move" ? "action-moving-card" : "placement-moving-card");
    markMovementCells(sourceCell, targetCell);
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
  movementCells.forEach(({ route, marker }) => {
    route?.route?.classList.add("fade");
    route?.marker?.classList.add("impact");
    marker?.classList.add("impact");
  });
  await wait(ACTION_IMPACT_HOLD_MS);
  movementCells.forEach(({ sourceCell, targetCell, route, marker }) => {
    clearMovementCells(sourceCell, targetCell);
    route?.route?.remove?.();
    route?.marker?.remove?.();
    marker?.remove?.();
  });
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

function bindEvents() {
  ui.gameMenuBtn?.addEventListener("click", () => setGameMenuOpen(true));
  ui.gameMenuClose?.addEventListener("click", closeGameMenu);
  ui.gameMenuModal?.addEventListener("click", (event) => {
    if (event.target === ui.gameMenuModal) closeGameMenu();
  });
  ui.themeMenuBtn?.addEventListener("click", () => setThemeMenuOpen(true));
  ui.themeMenuClose?.addEventListener("click", closeThemeMenu);
  ui.themeMenuModal?.addEventListener("click", (event) => {
    if (event.target === ui.themeMenuModal) closeThemeMenu();
  });
  ui.themeSubmenuBtn?.addEventListener("click", () => {
    const shouldOpen = Boolean(ui.themeSubmenu?.hidden);
    if (shouldOpen) setMapSubmenuOpen(false);
    setThemeSubmenuOpen(shouldOpen);
  });
  ui.mapSubmenuBtn?.addEventListener("click", () => {
    const shouldOpen = Boolean(ui.mapSubmenu?.hidden);
    if (shouldOpen) setThemeSubmenuOpen(false);
    setMapSubmenuOpen(shouldOpen);
  });
  document.addEventListener?.("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (ui.themeMenuModal?.classList.contains("visible")) {
      if (ui.mapSubmenu && !ui.mapSubmenu.hidden) setMapSubmenuOpen(false);
      else if (ui.themeSubmenu && !ui.themeSubmenu.hidden) setThemeSubmenuOpen(false);
      else closeThemeMenu();
      return;
    }
    if (ui.gameMenuModal?.classList.contains("visible")) closeGameMenu();
  });
  ui.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMode = button.dataset.mode;
      ui.modeButtons.forEach((item) => item.classList.toggle("selected", item === button));
      if (ui.modeDescription) ui.modeDescription.textContent = button.dataset.description || "";
    });
  });

  ui.mapButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSize = Number(button.dataset.boardSize) || 5;
      const applySize = () => {
        state.selectedBoardSize = nextSize;
        syncBoardSizeUi();
        setMapSubmenuOpen(false);
      };
      if (nextSize === 3) {
        if (typeof window.requestBoardSizeAccess !== "function") {
          showToast("GM 验证不可用", "请刷新页面后重试。");
          return;
        }
        window.requestBoardSizeAccess(applySize);
        return;
      }
      applySize();
    });
  });

  ui.themeButtons.forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.theme));
  });

  ui.startGameBtn.addEventListener("click", () => {
    window.startRandomGame?.(state.selectedMode);
  });
  ui.submitActionBtn.addEventListener("click", () => {
    window.submitCurrentAction?.();
  });
  ui.cancelSelectionBtn.addEventListener("click", cancelSelection);
  ui.restartBtn.addEventListener("click", () => {
    closeGameMenu();
    window.startRandomGame?.(state.game?.mode || state.selectedMode);
  });
  ui.backMenuBtn.addEventListener("click", () => {
    closeGameMenu();
    window.resetToMenu?.();
  });
  ui.resultNextLevelBtn?.addEventListener("click", () => window.beginNextChallengeLevel?.());
  ui.resultRestartBtn.addEventListener("click", () => {
    if (state.online?.role === "spectator") return;
    if (state.game?.mode === "pve-challenge") {
      state.challengeLevel = 1;
      state.challengePlayerTraitIds = [];
      state.pendingChallengeRewardChoices = null;
      state.pendingChallengeRewardLevel = null;
    }
    window.startRandomGame?.(state.game?.mode || state.selectedMode);
  });
  ui.resultMenuBtn.addEventListener("click", () => window.resetToMenu?.());
  syncBoardSizeUi();
}

window.__CARD_DEMO_DEBUG__ = {
  state, ui, resetSelection, cloneCard, buildCampDeck, drawOneCard, getCardByUid,
  getBoardCardAt, getCampDisplayName, getCardDisplay, getCardDisplayName, getCardBaseAttack,
  getAvailableDeckKeys, getRandomDeckKey, applyTheme
};
window.resetToMenu = resetToMenu;
window.leaveOnlineSession = leaveOnlineSession;
window.closeGameMenu = closeGameMenu;
initializeTheme();
bindEvents();
