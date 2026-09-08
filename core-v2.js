/* Core Rules V2: sequential turns with V2 card skills enabled. */
(() => {
  const CORE_BOARD_SIZE = 4;
  const CORE_MAX_TURNS = 30;
  const CORE_FIRST_TURN_ACTIONS = 1;
  const CORE_STANDARD_ACTIONS = 2;
  const CORE_CARD_DATA_VERSION = "card-info-v2-display-effect-isolation-20260908";
  const CORE_RUNTIME_SCHEMA_VERSION = "runtime-display-effect-isolation-20260908";
  const CORE_CARD_TEST_SCENE_VERSION = 2;
  let coreRuntimeReady = true;
  const coreUi = {
    endTurnBtn: document.getElementById("end-turn-btn"),
    surrenderBtn: document.getElementById("surrender-btn")
  };

  const PLAYER_ID_MAX_UNITS = 12;
  const PLAYER_ID_ALLOWED = /^[A-Za-z0-9_\-\.\!\?@#\+=\u3400-\u9fff]+$/;

  function corePlayerIdUnits(value) {
    return [...String(value || "")].reduce((total, char) => total + (/^[\u3400-\u9fff]$/.test(char) ? 2 : 1), 0);
  }

  function coreValidatePlayerId(value) {
    const name = String(value || "").trim();
    if (!name) return { valid: false, message: "请输入玩家 ID。" };
    if (!PLAYER_ID_ALLOWED.test(name)) return { valid: false, message: "仅允许中文、英文、数字及 _ - . ! ? @ # + =。" };
    if (corePlayerIdUnits(name) > PLAYER_ID_MAX_UNITS) return { valid: false, message: "玩家 ID 最多 12 个字符单位，中文每字按 2 个单位计算。" };
    return { valid: true, value: name };
  }

  async function coreGetPublicIp() {
    if (typeof fetch !== "function") return null;
    try {
      const response = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data.ip === "string" && data.ip ? data.ip : null;
    } catch (_error) {
      return null;
    }
  }

  function coreShowPlayerIdModal(required = false) {
    if (!ui.playerIdModal) return;
    ui.playerIdModal.innerHTML = `
      <section class="player-id-card" role="dialog" aria-modal="true" aria-label="设置玩家 ID">
        ${required ? "" : '<button id="player-id-modal-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>'}
        <p class="phase-banner-eyebrow">PLAYER ID</p>
        <h2>${required ? "首次设置玩家 ID" : "修改玩家 ID"}</h2>
        <p>最多 12 个字符单位；中文每字 2 个单位，英文、数字和常用英文符号每个 1 个单位。</p>
        <label>玩家 ID<input id="player-id-input" maxlength="12" autocomplete="nickname" value="${String(state.playerName || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}" autofocus></label>
        <p id="player-id-error" class="player-id-error" aria-live="polite"></p>
        <button id="player-id-confirm" class="primary-btn" type="button">确认 ID</button>
      </section>
    `;
    ui.playerIdModal.classList.add("visible");
    const input = document.getElementById("player-id-input");
    const error = document.getElementById("player-id-error");
    document.getElementById("player-id-confirm")?.addEventListener("click", () => {
      const result = coreValidatePlayerId(input.value);
      if (!result.valid) { error.textContent = result.message; return; }
      state.playerName = result.value;
      ui.playerIdValue.textContent = result.value;
      ui.playerIdModal.classList.remove("visible");
      ui.playerIdModal.innerHTML = "";
      corePersistPlayerId(result.value);
    });
    document.getElementById("player-id-modal-close")?.addEventListener("click", () => {
      ui.playerIdModal.classList.remove("visible");
      ui.playerIdModal.innerHTML = "";
    });
  }

  async function corePersistPlayerId(name) {
    const ip = await coreGetPublicIp();
    if (!ip) return;
    try { window.localStorage?.setItem(`cardDemoPlayerId:${ip}`, name); } catch (_error) { /* storage may be unavailable */ }
  }

  async function coreInitializePlayerIdentity() {
    const ip = await coreGetPublicIp();
    let stored = "";
    if (ip) {
      try { stored = window.localStorage?.getItem(`cardDemoPlayerId:${ip}`) || ""; } catch (_error) { stored = ""; }
    }
    const valid = coreValidatePlayerId(stored);
    if (valid.valid) {
      state.playerName = valid.value;
      if (ui.playerIdValue) ui.playerIdValue.textContent = valid.value;
    } else if (!state.playerName) {
      coreShowPlayerIdModal(true);
    }
    try {
      const lastRoom = JSON.parse(window.localStorage?.getItem("cardDemoOnlineRoom") || "null");
      if (lastRoom?.roomCode && state.playerName && window.CardOnline) {
        state.online = { playerId: null, roomCode: lastRoom.roomCode, playerName: state.playerName, host: false };
        state.online.unsubscribe = window.CardOnline.on(coreHandleOnlineMessage);
        window.CardOnline.connect();
        window.setTimeout(() => window.CardOnline.resumeRoom(lastRoom.roomCode, state.playerName, lastRoom.sessionToken), 250);
      }
    } catch (_error) { /* ignore invalid saved room */ }
  }

  function corePlayer(game, playerId) {
    return game.players.find((player) => player.id === playerId) || null;
  }

  function coreEscapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function coreCardDisplay(cardOrId) {
    return typeof getCardDisplay === "function"
      ? getCardDisplay(cardOrId)
      : { name: "未知卡牌", camp: "无势力", rarity: "普通", skill: "无", effect: "无技能效果。", effectTags: [] };
  }

  function coreCardName(cardOrId) {
    return coreCardDisplay(cardOrId).name;
  }

  function coreSkillEffectLines(card) {
    if (!card || card.isGuard) return ["无"];
    const lines = String(coreCardDisplay(card).effect || "无技能效果。").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.length ? lines : ["无技能效果。"];
  }

  function coreEffectTags(card) {
    if (!card || card.isGuard) return [];
    const tags = coreCardDisplay(card).effectTags;
    return Array.isArray(tags) ? tags.filter(Boolean) : [];
  }

  function coreEffectTagTitle(tag) {
    return ({ 起势: "回合开始前", 收势: "回合结束时", 遗志: "卡牌被摧毁时触发后续效果", 入阵: "卡牌放置时", 行军: "卡牌移动后" })[tag] || tag;
  }

  function coreEffectTagBadges(card, className = "effect-keyword") {
    return coreEffectTags(card).map((tag) => `<b class="${className}" title="${coreEscapeHtml(coreEffectTagTitle(tag))}">${coreEscapeHtml(tag)}</b>`).join("");
  }

  function coreSkillEffectHtml(card) {
    const lines = coreSkillEffectLines(card);
    return lines.map((line, index) => {
      const normalized = line.replace(/^\d+\s*[.、)）]\s*/, "");
      return lines.length > 1
        ? `<span class="skill-effect-line"><strong>${index + 1}.</strong>${coreEscapeHtml(normalized)}</span>`
        : `<span class="skill-effect-line">${coreEscapeHtml(normalized)}</span>`;
    }).join("");
  }

  function coreSkillEffectText(card) {
    return coreSkillEffectLines(card).map((line, index, lines) => {
      const normalized = line.replace(/^\d+\s*[.、)）]\s*/, "");
      return lines.length > 1 ? `${index + 1}. ${normalized}` : normalized;
    }).join("\n");
  }

  function coreFitSingleLineText(root) {
    if (!root) return;
    root.querySelectorAll(".unit-name, .unit-skill, .card-top h3").forEach((element) => {
      const computed = Number.parseFloat(window.getComputedStyle(element).fontSize) || 14;
      const minimum = element.matches(".unit-name, .card-top h3") ? 8 : 7;
      let size = computed;
      element.style.fontSize = `${size}px`;
      while (element.scrollWidth > element.clientWidth && size > minimum) {
        size = Math.max(minimum, size - 0.5);
        element.style.fontSize = `${size}px`;
      }
    });
  }

  const CORE_RUNTIME_DISPLAY_FIELDS = Object.freeze(["name", "camp", "rarity", "quality", "skill", "effect", "effectTags", "effectTag"]);

  function coreStripRuntimeDisplayData(game) {
    const cards = [game?.boardCards];
    (game?.players || []).forEach((player) => cards.push(player.hand, player.drawPile, player.deckCatalog));
    const seen = new Set();
    cards.flatMap((collection) => Array.isArray(collection) ? collection : []).forEach((card) => {
      if (!card || seen.has(card)) return;
      seen.add(card);
      CORE_RUNTIME_DISPLAY_FIELDS.forEach((field) => { delete card[field]; });
    });
    return game;
  }

  function coreSerializeOnlineGame(game) {
    return JSON.stringify(coreStripRuntimeDisplayData(game), (_key, value) => value instanceof Set ? { __coreSet: [...value] } : value);
  }

  function coreDeserializeOnlineGame(serialized) {
    const game = JSON.parse(serialized, (_key, value) => value && value.__coreSet ? new Set(value.__coreSet) : value);
    if (game?.ruleset !== "core-v2" || game.cardDataVersion !== CORE_CARD_DATA_VERSION
      || game.runtimeSchemaVersion !== CORE_RUNTIME_SCHEMA_VERSION) {
      throw new Error("旧版对局状态与当前卡牌运行时不兼容。");
    }
    return coreStripRuntimeDisplayData(game);
  }

  function coreOnlineSendState(game) {
    if (game?.mode === "online" && state.online?.host && window.CardOnline?.connected) {
      window.CardOnline.send({ type: "state-sync", state: coreSerializeOnlineGame(game) });
    }
  }

  function coreCloseOverlay() {
    ui.deckReveal.classList.remove("visible");
    ui.deckReveal.innerHTML = "";
  }

  function coreAttachOverlayClose() {
    document.getElementById("overlay-close")?.addEventListener("click", () => {
      coreCloseOverlay();
      if (!state.game) switchScreen("menu");
    });
  }

  function corePlayerNameIsValid(name) {
    return coreValidatePlayerId(name).valid;
  }

  function coreActionLimit(game) {
    return (game.turn === 1 ? CORE_FIRST_TURN_ACTIONS : CORE_STANDARD_ACTIONS) + (Number(game.extraActions) || 0);
  }

  function coreBoardSize(game) {
    const size = Number(game?.boardSize);
    return Number.isInteger(size) && size >= 3 && size <= 5 ? size : CORE_BOARD_SIZE;
  }

  function coreControlMap(game) {
    const influence = new Map();
    const addInfluence = (row, col, ownerId) => {
      if (!ownerId || !coreIsInsideBoard(row, col, game) || isBrokenCell(game, row, col)) return;
      const key = cellKey(row, col);
      const data = influence.get(key) || { owners: new Set() };
      data.owners.add(ownerId);
      influence.set(key, data);
    };
    game.boardCards.forEach((card) => {
      if (!card.isGuard) addInfluence(card.row, card.col, card.ownerId);
    });
    (game.v2ControlCells || []).forEach((entry) => {
      if (!coreIsV2TimedEntryActive(game, entry)) return;
      if (entry.persistent && !game.boardCards.some((card) => card.uid === entry.sourceUid)) return;
      const occupied = game.boardCards.some((card) => card.row === entry.row && card.col === entry.col);
      if (occupied || isBrokenCell(game, entry.row, entry.col)) return;
      addInfluence(entry.row, entry.col, entry.ownerId);
    });
    const counts = { 1: 0, 2: 0 };
    influence.forEach((data) => {
      if (data.owners.size !== 1) return;
      const [ownerId] = [...data.owners];
      if (counts[ownerId] !== undefined) counts[ownerId] += 1;
    });
    return { influence, counts };
  }

  function coreSettlementCounts(game) {
    return { ...coreControlMap(game).counts };
  }

  function coreVictoryTarget(game) {
    const size = coreBoardSize(game);
    return Math.floor((size * size - game.brokenCells.length) / 2) + 1;
  }

  function coreIsInsideBoard(row, col, game = state.game) {
    const size = coreBoardSize(game);
    return row >= 0 && row < size && col >= 0 && col < size;
  }

  function coreIsV2TimedEntryActive(game, entry) {
    return Boolean(entry)
      && (!Number.isFinite(entry.untilTurn) || entry.untilTurn >= game.turn)
      && (!entry.startsAtTurn || game.turn >= entry.startsAtTurn);
  }

  function coreNextOwnerTurn(game, ownerId) {
    return game.activePlayerId === ownerId ? game.turn + 2 : game.turn + 1;
  }

  // Card effects are resolved through a small, data-only context. The context
  // deliberately exposes generic operations instead of card-number dispatch.
  function coreCardEffectDefinition(card) {
    if (!card || card.isGuard) return null;
    const prefix = String(card.id || "").slice(0, 2);
    const group = prefix === "01" ? "shu" : prefix === "02" ? "wei" : prefix === "03" ? "wu" : "";
    return group && window.CARD_EFFECTS_V2?.[group]?.[String(card.id)] || null;
  }

  function coreCardEffectHasFlag(card, flag) {
    return Boolean(coreCardEffectDefinition(card)?.flags?.[flag]);
  }

  function coreCreateCardEffectContext(game, player, card, log, extra = {}) {
    const adjacent = (subject = card) => coreAdjacentCards(game, subject);
    const allies = (subject = card) => adjacent(subject).filter((target) => target.ownerId === subject.ownerId && target.uid !== subject.uid);
    const enemies = (subject = card) => adjacent(subject).filter((target) => target.ownerId !== subject.ownerId);
    const withGame = (callback) => {
      const previous = state.game;
      state.game = game;
      try { return callback(); } finally { state.game = previous; }
    };
    return {
      game, player, card, logEntries: log, handLimit: HAND_LIMIT,
      otherPlayer: corePlayer(game, otherPlayerId(player?.id ?? card?.ownerId)),
      board: game.boardCards,
      allies,
      enemies,
      enemiesOf: enemies,
      otherAllies: () => game.boardCards.filter((target) => (
        target.ownerId === card.ownerId && target.uid !== card.uid && !target.isGuard
      )),
      adjacent,
      eightAdjacent: (subject = card) => coreAdjacentCards(game, subject, true),
      pickRandom: corePickRandom,
      adjust: (target, delta, temporary = false) => withGame(() => {
        const before = target?.currentAttack;
        coreAdjustAttack(target, delta, temporary);
        return target && target.currentAttack !== before;
      }),
      setAttack: (target, value, temporary = true) => coreSetAttack(game, target, value, temporary),
      draw: (targetPlayer = player) => drawOneCard(game, targetPlayer).status === "drawn",
      drawFromEnemyDeck: (count = 1) => coreDrawFromEnemyDeck(game, card.ownerId, count, log),
      discard: (targetPlayer, count = 1) => {
        if (!targetPlayer?.hand?.length) return 0;
        const amount = Math.min(count, targetPlayer.hand.length);
        for (let index = 0; index < amount; index += 1) targetPlayer.hand.splice(randomInt(0, targetPlayer.hand.length - 1), 1);
        return amount;
      },
      destroy: (target, cause = card) => coreDestroyV2Card(game, target, log, cause),
      reenter: (target, position) => coreAddReplacedCard(game, target, target, position, log),
      skillAttack: (attacker, defender) => coreResolveSkillAttack(game, attacker, defender, corePlayer(game, attacker?.ownerId), log),
      canFight: (attacker, defender) => coreCanCardsFight(game, attacker, defender),
      position: (target) => ({ row: target.row, col: target.col }),
      swapPositions: (left, right) => {
        const leftPosition = { row: left.row, col: left.col };
        left.row = right.row; left.col = right.col;
        right.row = leftPosition.row; right.col = leftPosition.col;
      },
      emitMoved: (moved, source, target) => coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card: moved, source, target }),
      connectedAllies: () => {
        const seen = new Set([card.uid]); const queue = [...allies(card)]; const result = [];
        while (queue.length) {
          const target = queue.shift();
          if (!target || seen.has(target.uid)) continue;
          seen.add(target.uid); result.push(target);
          adjacent(target).filter((next) => next.ownerId === card.ownerId && !seen.has(next.uid)).forEach((next) => queue.push(next));
        }
        return result;
      },
      isOnBoard: (target) => game.boardCards.includes(target),
      isEdge: (target = card) => target.row === 0 || target.col === 0 || target.row === coreBoardSize(game) - 1 || target.col === coreBoardSize(game) - 1,
      orthogonalCells: (target = card) => getOrthogonalNeighbors(target.row, target.col)
        .filter((cell) => coreIsInsideBoard(cell.row, cell.col, game)),
      placementCells: (ownerId = card.ownerId) => corePlacementAvailability(game, ownerId).cells,
      nextOwnerTurn: (ownerId = card.ownerId) => coreNextOwnerTurn(game, ownerId),
      replaceControlCells: (cells, options = {}) => {
        game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => entry.sourceUid !== card.uid);
        cells.forEach((cell) => game.v2ControlCells.push({
          row: cell.row,
          col: cell.col,
          ownerId: options.ownerId ?? card.ownerId,
          sourceUid: card.uid,
          untilTurn: options.untilTurn ?? Infinity,
          ...(options.startsAtTurn ? { startsAtTurn: options.startsAtTurn } : {}),
          ...(options.persistent ? { persistent: true } : {}),
          ...(options.invalidateOnEnemyEntry ? { invalidateOnEnemyEntry: true } : {})
        }));
      },
      addBrokenCell: (position) => {
        if (!position || isBrokenCell(game, position.row, position.col) || game.brokenCells.length >= 5) return false;
        game.brokenCells.push({ row: position.row, col: position.col });
        return true;
      },
      addActions: (count = 1) => { game.extraActions = (game.extraActions || 0) + count; },
      triggerTurnStart: (target) => {
        const startContext = game.v2StartContext;
        const targetPlayer = corePlayer(game, target.ownerId);
        if (!startContext || startContext.processed.has(target.uid)) {
          return coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player: targetPlayer, card: target });
        }
        startContext.pendingExtras.set(target.uid, (startContext.pendingExtras.get(target.uid) || 0) + 1);
        return null;
      },
      triggerDestroyEffect: (target) => {
        const definition = coreCardEffectDefinition(target);
        if (typeof definition?.onDestroy !== "function") return false;
        definition.onDestroy(coreCreateCardEffectContext(
          game,
          corePlayer(game, target.ownerId),
          target,
          log,
          {
            original: { row: target.row, col: target.col },
            causeCard: null,
            destroyedAttack: target.currentAttack,
            virtual: true
          }
        ));
        return true;
      },
      logMessage: (message) => log.push(message),
      log: (message) => log.push(message),
      ...extra
    };
  }

  function coreCanReduceAttack(game, card) {
    if (!card || !card.ownerId) return true;
    return !game?.boardCards?.some((unit) => unit.ownerId === card.ownerId
      && coreCardEffectHasFlag(unit, "preventReduction"));
  }

  function corePruneV2TimedState(game) {
    game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => (
      coreIsV2TimedEntryActive(game, entry)
      && (!entry.persistent || game.boardCards.some((card) => card.uid === entry.sourceUid))
    ));
    game.v2PlacementLocks = (game.v2PlacementLocks || []).filter((entry) => coreIsV2TimedEntryActive(game, entry));
  }

  function corePickGuards(boardSize = CORE_BOARD_SIZE) {
    const guards = [];
    while (guards.length < 2) {
      const row = randomInt(0, boardSize - 1);
      const col = randomInt(0, boardSize - 1);
      if (!guards.some((card) => card.row === row && card.col === col)) {
        const attack = Math.random() < 0.5 ? 2 : 3;
        guards.push({
          uid: `guard-${row}-${col}-${Math.random().toString(36).slice(2, 8)}`,
          id: "guard", attack, currentAttack: attack,
          ownerId: null, row, col, isGuard: true, restedTurn: null, lastMovedTurn: null
        });
      }
    }
    return guards;
  }

  function coreCreateGame(mode, selectedDecks, boardSize = state.selectedBoardSize || CORE_BOARD_SIZE, firstPlayerIdOverride = null) {
    const selectedSize = Number(boardSize);
    const size = Number.isInteger(selectedSize) && selectedSize >= 3 && selectedSize <= 5 ? selectedSize : CORE_BOARD_SIZE;
    const playerOneCatalog = buildCampDeck(selectedDecks[1]);
    const playerTwoCatalog = buildCampDeck(selectedDecks[2]);
    const playerTwoName = mode === "pve" ? "AI" : "玩家 2";
    const firstPlayerId = [1, 2].includes(Number(firstPlayerIdOverride)) ? Number(firstPlayerIdOverride) : (Math.random() < 0.5 ? 1 : 2);
    const game = {
      ruleset: "core-v2",
      cardDataVersion: CORE_CARD_DATA_VERSION,
      runtimeSchemaVersion: CORE_RUNTIME_SCHEMA_VERSION,
      mode,
      turn: 1,
      currentPhase: "开局展示",
      boardSize: size,
      boardCards: corePickGuards(size),
      brokenCells: [],
      moveLocks: {},
      placeLockTurn: { 1: 0, 2: 0 },
      processingRealtime: false,
      effectBoardCards: null,
      v2ControlCells: [],
      v2PlacementLocks: [],
      players: [
        createPlayer(1, "玩家 1", selectedDecks[1], playerOneCatalog, false),
        createPlayer(2, playerTwoName, selectedDecks[2], playerTwoCatalog, mode === "pve")
      ],
      firstPlayerId,
      activePlayerId: firstPlayerId,
      activePlannerIndex: firstPlayerId - 1,
      actionsUsed: 0,
      selection: resetSelection(),
      winner: null,
      isAnimating: false,
      effectBoardCards: null,
      pendingAnimations: [],
      consumedDestructionAnimationIds: new Set(),
      flowPrompt: "",
      roundLog: [],
      actionHistory: [],
      lastResolvedTurn: 0,
      lastResolution: "卡组已确定，等待展示先后手。"
    };

    game.players.forEach((player) => {
      const openingHand = player.id === firstPlayerId ? 2 : 3;
      for (let index = 0; index < openingHand; index += 1) {
        drawOneCard(game, player);
      }
    });
    return game;
  }

  function coreDrawAtTurnStart(game, player) {
    const result = drawOneCard(game, player);
    if (result.status === "hand-full") {
      showToast("手牌已满", `${player.name} 当前已有 ${HAND_LIMIT} 张手牌，本回合不抽牌。`);
      return `${player.name} 手牌已满 ${HAND_LIMIT} 张，跳过抽牌。`;
    }
    if (result.status === "deck-empty") {
      showToast("牌库已空", `${player.name} 的牌库已空，本回合无法抽牌。`);
      return `${player.name} 牌库已空，本回合无法抽牌。`;
    }
    return `${player.name} 从自己的牌库抽取 1 张卡牌。`;
  }

  function coreStartTurn(game) {
    const active = corePlayer(game, game.activePlayerId);
    game.currentPhase = "准备阶段";
    game.actionsUsed = 0;
    game.selection = resetSelection();
    game.activePlannerIndex = game.activePlayerId - 1;
    game.boardCards.forEach((card) => {
      card.v2StartAttack = card.currentAttack;
      card.v2StartTurn = game.turn;
      if (card.ownerId === active.id) {
        card.v2TempBonus = 0;
        card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0));
        card.v2StartAttack = card.currentAttack;
        if (coreCardEffectHasFlag(card, "replacementWatcher")) card.v2ReplacedThisTurn = new Set();
      }
      if (card.ownerId === active.id && card.restedTurn !== null && card.restedTurn !== game.turn) {
        card.restedTurn = null;
      }
    });
    corePruneV2TimedState(game);
    game.roundLog = [`${active.name} 的${game.turn === 1 ? "第一个" : "本"}回合开始。`];
    const drawLog = coreDrawAtTurnStart(game, active);
    game.roundLog.push(drawLog);
    const wonAtStart = coreRunStartSkills(game, active);
    game.currentPhase = wonAtStart ? "胜负结算" : "行动阶段";
    game.lastResolvedTurn = game.turn;
    game.lastResolution = wonAtStart ? game.winner.text : `${active.name} 行动中：本回合可执行 ${coreActionLimit(game)} 次行动。`;
    return wonAtStart;
  }

  function coreRunStartSkills(game, active) {
    game.effectBoardCards = game.boardCards;
    const snapshot = [...game.boardCards];
    const previousStartContext = game.v2StartContext;
    const startContext = { processed: new Set(), pendingExtras: new Map() };
    game.v2StartContext = startContext;
    const flushExtras = (card) => {
      const count = startContext.pendingExtras.get(card.uid) || 0;
      if (!count || !game.boardCards.includes(card)) return;
      startContext.pendingExtras.delete(card.uid);
      for (let index = 0; index < count; index += 1) {
        if (!game.boardCards.includes(card)) break;
        coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player: active, card });
      }
    };
    try {
      for (const card of snapshot) {
        if (card.ownerId !== active.id || !game.boardCards.includes(card)) continue;
        coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player: active, card });
        startContext.processed.add(card.uid);
        // Any extra trigger queued before this card's normal skill now resolves immediately after it.
        flushExtras(card);
        if (coreCheckVictory(game)) break;
      }
    } finally {
      game.v2StartContext = previousStartContext;
    }
    const won = coreCheckVictory(game);
    game.effectBoardCards = null;
    if (typeof flushPendingAnimations === "function" && game.pendingAnimations?.length) flushPendingAnimations(game);
    return won;
  }

  function coreAdjustAttack(card, delta, temporary = false) {
    if (!card || !delta) return;
    const game = state.game;
    if (delta < 0 && !coreCanReduceAttack(game, card)) return;
    if (temporary) card.v2TempBonus = (Number(card.v2TempBonus) || 0) + delta;
    else card.v2PermanentBonus = (Number(card.v2PermanentBonus) || 0) + delta;
    card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0) + (Number(card.v2TempBonus) || 0));
    if (game && game.boardCards?.includes(card) && typeof queuePowerAnimation === "function") queuePowerAnimation(game, card, delta);
  }

  function coreSetAttack(game, card, nextAttack, temporary = true) {
    if (!card) return false;
    const previous = Number(card.currentAttack ?? card.attack) || 0;
    const next = Math.max(0, Number(nextAttack) || 0);
    if (next < previous && !coreCanReduceAttack(game, card)) return false;
    const base = Number(card.attack) || 0;
    const permanent = Number(card.v2PermanentBonus) || 0;
    const temporaryBonus = Number(card.v2TempBonus) || 0;
    if (temporary) card.v2TempBonus = next - base - permanent;
    else card.v2PermanentBonus = next - base - temporaryBonus;
    card.currentAttack = next;
    if (next !== previous && game?.boardCards?.includes(card) && typeof queuePowerAnimation === "function") {
      queuePowerAnimation(game, card, next - previous);
    }
    return true;
  }

  function coreRunV2StartSkill(game, player, card) {
    const resolvingStartSkills = game.v2ResolvingStartSkills || new Set();
    game.v2ResolvingStartSkills = resolvingStartSkills;
    if (resolvingStartSkills.has(card.uid)) return;
    resolvingStartSkills.add(card.uid);
    try {
      const effectDefinition = coreCardEffectDefinition(card);
      if (typeof effectDefinition?.onTurnStart === "function") {
        effectDefinition.onTurnStart(coreCreateCardEffectContext(game, player, card, game.roundLog || []));
      }
    } finally {
      resolvingStartSkills.delete(card.uid);
    }
  }

  function corePickRandom(items) {
    return items.length ? items[randomInt(0, items.length - 1)] : null;
  }

  function coreEnemyNeighbors(game, card, diagonal = false) {
    const cells = diagonal ? getEightNeighbors(card.row, card.col) : getOrthogonalNeighbors(card.row, card.col);
    return cells.map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter((target) => target && target.ownerId !== card.ownerId);
  }

  function coreIsFightLocked(game, card) {
    if (!card || !coreCardEffectHasFlag(card, "avoidCombatWhenBehind") || !card.ownerId) return false;
    const control = coreControlMap(game).counts;
    return control[card.ownerId] < control[otherPlayerId(card.ownerId)];
  }

  function coreCanCardsFight(game, attacker, defender) {
    return Boolean(attacker && defender && attacker.ownerId !== defender.ownerId && !coreIsFightLocked(game, attacker) && !coreIsFightLocked(game, defender));
  }

  function coreDrawFromEnemyDeck(game, ownerId, count, log) {
    const owner = corePlayer(game, ownerId);
    const enemy = corePlayer(game, otherPlayerId(ownerId));
    let drawn = 0;
    for (let index = 0; index < count; index += 1) {
      if (!owner || !enemy || owner.hand.length >= HAND_LIMIT || !enemy.drawPile.length) break;
      const card = enemy.drawPile.shift();
      card.ownerId = owner.id;
      owner.hand.push(card);
      drawn += 1;
    }
    if (drawn && log) log.push(`从敌方牌库抽取 ${drawn} 张牌。`);
    return drawn;
  }

  function coreAdjacentCards(game, card, diagonal = false) {
    const cells = diagonal ? getEightNeighbors(card.row, card.col) : getOrthogonalNeighbors(card.row, card.col);
    return cells.map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter(Boolean);
  }

  function coreInvalidateEnemyControlCell(game, card) {
    game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => (
      !entry.invalidateOnEnemyEntry
      || entry.ownerId === card.ownerId
      || entry.row !== card.row
      || entry.col !== card.col
    ));
  }

  function coreAddReplacedCard(game, card, target, position, log) {
    if (!card || !target || game.boardCards.includes(card) || getBoardCardAt(game, position.row, position.col)) return false;
    card.attack = Number(card.attack) || 0;
    card.currentAttack = card.attack;
    card.v2PermanentBonus = 0;
    card.v2TempBonus = 0;
    card.v2StartAttack = undefined;
    card.v2StartTurn = undefined;
    card.v2EnteredTurn = game.turn;
    card.row = position.row;
    card.col = position.col;
    card.restedTurn = game.turn;
    card.lastMovedTurn = null;
    card.v2LongMoveUsed = false;
    game.boardCards.push(card);
    coreApplyV2PlacementSkill(game, corePlayer(game, card.ownerId), card, log);
    coreEmitV2Event(game, CORE_V2_EVENT.CARD_PLACED, { player: corePlayer(game, card.ownerId), card, log });
    return true;
  }

  function coreApplyV2PlacementSkill(game, player, card, log) {
    const effectDefinition = coreCardEffectDefinition(card);
    if (typeof effectDefinition?.onPlace === "function") {
      effectDefinition.onPlace(coreCreateCardEffectContext(game, player, card, log));
    }
  }

  function coreTriggerOtherV2PlacementEffects(game, player, placedCard, log) {
    const watchers = game.boardCards.filter((card) => card.ownerId === player.id && card.uid !== placedCard.uid);
    watchers.forEach((card) => {
      const effectDefinition = coreCardEffectDefinition(card);
      if (effectDefinition?.onOtherPlaced) {
        effectDefinition.onOtherPlaced(coreCreateCardEffectContext(game, player, card, log, { placedCard }));
      }
    });
  }

  const CORE_V2_EVENT = Object.freeze({
    TURN_START: "turnStart",
    CARD_PLACED: "cardPlaced",
    CARD_MOVED: "cardMoved",
    TURN_END: "turnEnd"
  });

  function coreEmitV2Event(game, event, payload = {}) {
    if (event === CORE_V2_EVENT.TURN_START && payload.card && payload.player) return coreRunV2StartSkill(game, payload.player, payload.card);
    if (event === CORE_V2_EVENT.CARD_PLACED && payload.card && payload.player) return coreTriggerOtherV2PlacementEffects(game, payload.player, payload.card, payload.log || []);
    if (event === CORE_V2_EVENT.CARD_MOVED && payload.card && payload.source && payload.target) return coreRunV2MoveEffects(game, payload.card, payload.source, payload.target, payload.successful !== false);
    if (event === CORE_V2_EVENT.TURN_END && payload.player) return coreRunV2EndSkills(game, payload.player, payload.log || []);
    return null;
  }

  function coreValidateV2CardData() {
    const cards = window.CARD_LIBRARY?.cardSlots || [];
    const allowedEffectTags = new Set(["起势", "收势", "遗志", "入阵", "行军"]);
    const seen = new Set();
    const duplicateIds = [];
    const invalidCards = [];
    const missingEffectIds = [];
    cards.forEach((card) => {
      if (seen.has(card.id)) duplicateIds.push(card.id);
      seen.add(card.id);
      const effectTags = Array.isArray(card.effectTags) ? card.effectTags : [];
      const id = String(card.id || "");
      const sequence = Number(id.slice(3));
      const validId = /^0[1-3][1-5]\d{2}$/.test(id) && sequence >= 1 && sequence <= 20;
      if (!validId || !card.name || !card.skill || !card.effect || !card.camp || !card.rarity
        || !Number.isFinite(Number(card.attack))
        || effectTags.some((tag) => !allowedEffectTags.has(tag) || [...String(tag)].length !== 2)) {
        invalidCards.push(card.id || "<missing-id>");
      }
      if (validId && !coreCardEffectDefinition(card)) missingEffectIds.push(id);
    });
    return {
      cardDataVersion: window.CARD_LIBRARY?.version || null,
      cardCount: cards.length,
      duplicateIds,
      invalidCards,
      missingEffectIds
    };
  }

  function coreRunV2CombatEffects(game, attacker, defender, attackerDestroyed, defenderDestroyed, log) {
    [
      { card: attacker, opponent: defender, selfDestroyed: attackerDestroyed, opponentDestroyed: defenderDestroyed },
      { card: defender, opponent: attacker, selfDestroyed: defenderDestroyed, opponentDestroyed: attackerDestroyed }
    ].forEach((entry) => {
      const definition = coreCardEffectDefinition(entry.card);
      if (typeof definition?.onCombatResolved !== "function") return;
      definition.onCombatResolved(coreCreateCardEffectContext(
        game,
        corePlayer(game, entry.card.ownerId),
        entry.card,
        log,
        entry
      ));
    });
  }

  function coreResolveSkillAttack(game, attacker, defender, player, log) {
    if (!attacker || !defender || !game.boardCards.includes(attacker) || !game.boardCards.includes(defender) || !coreCanCardsFight(game, attacker, defender)) return;
    const attackerValue = attacker.currentAttack;
    const defenderValue = defender.currentAttack;
    let attackerDestroyed = false;
    let defenderDestroyed = false;
    if (attackerValue > defenderValue) {
      const pos = { row: defender.row, col: defender.col };
      defenderDestroyed = coreDestroyV2Card(game, defender, log, attacker);
      if (defenderDestroyed) {
        const from = { row: attacker.row, col: attacker.col };
        attacker.row = pos.row; attacker.col = pos.col;
        if (typeof queueSkillMoveAnimation === "function") queueSkillMoveAnimation(game, attacker, from, pos, "技能攻击移动");
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card: attacker, source: from, target: pos });
      }
    } else if (attackerValue < defenderValue) attackerDestroyed = coreDestroyV2Card(game, attacker, log, defender);
    else {
      attackerDestroyed = coreDestroyV2Card(game, attacker, log, defender);
      defenderDestroyed = coreDestroyV2Card(game, defender, log, attacker);
    }
    coreRunV2CombatEffects(game, attacker, defender, attackerDestroyed, defenderDestroyed, log);
  }

  function coreRunOtherV2DestroyEffects(game, destroyedCard, original, causeCard, log) {
    const watchers = [...game.boardCards]
      .filter((watcher) => watcher.ownerId === destroyedCard.ownerId && watcher.uid !== destroyedCard.uid)
      .sort((left, right) => game.boardCards.indexOf(left) - game.boardCards.indexOf(right));
    watchers.forEach((watcher) => {
      const effectDefinition = coreCardEffectDefinition(watcher);
      if (!effectDefinition?.onOtherDestroyed || !game.boardCards.includes(watcher)) return;
      effectDefinition.onOtherDestroyed(coreCreateCardEffectContext(
        game,
        corePlayer(game, watcher.ownerId),
        watcher,
        log,
        { destroyedCard, original, causeCard }
      ));
    });
  }

  function coreDestroyV2Card(game, card, log, causeCard = null) {
    if (!card || !game.boardCards.some((item) => item.uid === card.uid)) return false;
    const original = { row: card.row, col: card.col };
    const ownEffectDefinition = coreCardEffectDefinition(card);
    if (typeof ownEffectDefinition?.onBeforeDestroy === "function") {
      const result = ownEffectDefinition.onBeforeDestroy(coreCreateCardEffectContext(
        game,
        corePlayer(game, card.ownerId),
        card,
        log,
        { original, causeCard }
      ));
      if (result === false) return false;
    }
    // A card's own destruction replacement takes precedence over protections granted by another card.
    if (card.v2ProtectedUntilTurn === game.turn) {
      card.v2ProtectedUntilTurn = null;
      coreSetAttack(game, card, 1, true);
      log.push(`${coreCardName(card)} 触发保护，保留在原格并将战力变为1。`);
      return false;
    }
    const adjacentProtectors = coreCardEffectHasFlag(card, "substituteAdjacent") ? [] : game.boardCards.filter((item) => (
      item.ownerId === card.ownerId
      && coreCardEffectHasFlag(item, "substituteAdjacent")
      && item.uid !== card.uid
      && Math.abs(item.row - card.row) + Math.abs(item.col - card.col) === 1
    ));
    const adjacentProtector = corePickRandom(adjacentProtectors);
    if (adjacentProtector) { coreDestroyV2Card(game, adjacentProtector, log, causeCard); log.push(`${coreCardName(adjacentProtector)} 代替 ${coreCardName(card)} 被摧毁。`); return false; }
    const weiProtector = game.boardCards.find((item) => item.ownerId === card.ownerId
      && coreCardEffectHasFlag(item, "protectAdjacent")
      && item.uid !== card.uid
      && Math.abs(item.row - card.row) + Math.abs(item.col - card.col) === 1
      && card.currentAttack > 1);
    if (weiProtector) {
      if (!coreCanReduceAttack(game, card)) {
        // Cao Cao blocks the attack reduction, but does not cancel Cao Ren's protection.
        log.push(`${coreCardName(weiProtector)} 使 ${coreCardName(card)} 保留；曹操使其战力维持不变。`);
        return false;
      }
      if (coreSetAttack(game, card, 0, false)) {
        log.push(`${coreCardName(weiProtector)} 使 ${coreCardName(card)} 保留且战力变为0。`);
        return !game.boardCards.includes(card);
      }
    }
    const index = game.boardCards.findIndex((item) => item.uid === card.uid);
    game.boardCards.splice(index, 1);
    card.destroyedAt = original;
    const destroyedAttack = card.currentAttack;
    if (ownEffectDefinition?.onDestroy) {
      ownEffectDefinition.onDestroy(coreCreateCardEffectContext(game, corePlayer(game, card.ownerId), card, log, {
        original,
        causeCard,
        destroyedAttack
      }));
    }
    coreRunOtherV2DestroyEffects(game, card, original, causeCard, log);
    // A replacement watcher may have re-entered this card. In that case the
    // original destruction did not clear its square for combat movement.
    if (game.boardCards.includes(card)) return false;
    return true;
  }

  function coreRunV2MoveEffects(game, card, source, target, successful) {
    if (!successful) return;
    coreInvalidateEnemyControlCell(game, card);
    game.boardCards.filter((watcher) => watcher.uid !== card.uid).forEach((watcher) => {
      const effectDefinition = coreCardEffectDefinition(watcher);
      if (effectDefinition?.onOtherMoved) {
        effectDefinition.onOtherMoved(coreCreateCardEffectContext(game, corePlayer(game, watcher.ownerId), watcher, game.roundLog || [], { movedCard: card, source, target }));
      }
    });
  }

  function corePlacementAvailability(game, playerId = game.activePlayerId) {
    const cells = [];
    const boardSize = coreBoardSize(game);
    for (let row = 0; row < boardSize; row += 1) {
      for (let col = 0; col < boardSize; col += 1) {
        const locked = (game.v2PlacementLocks || []).some((entry) => entry.row === row && entry.col === col && entry.untilTurn >= game.turn && entry.ownerId === playerId);
        if (!locked && !isBrokenCell(game, row, col) && !getBoardCardAt(game, row, col)) {
          cells.push({ row, col });
        }
      }
    }
    return {
      cells,
      reason: cells.length > 0 ? "" : "战场已没有未被破坏且未被占据的空格。"
    };
  }

  function coreValidMoves(game, card) {
    if (!card || card.isGuard || card.ownerId !== game.activePlayerId || card.restedTurn === game.turn || card.lastMovedTurn === game.turn || game.moveLocks?.[card.uid] === game.turn) {
      return [];
    }
    const cells = [];
    const directions = [{ row: -1, col: 0 }, { row: 1, col: 0 }, { row: 0, col: -1 }, { row: 0, col: 1 }];
    const canUseLongMove = coreCardEffectHasFlag(card, "longMove") && !card.v2LongMoveUsed;
    // Charge movement remains available for the turn; start effects only change combat power.
    const canCharge = coreCardEffectHasFlag(card, "chargeMove");
    const maxSteps = canUseLongMove
      ? coreBoardSize(game)
      : canCharge ? 2 : 1;
    directions.forEach((dir) => {
      for (let step = 1; step <= maxSteps; step += 1) {
        cells.push({ row: card.row + dir.row * step, col: card.col + dir.col * step });
      }
    });
    return cells.filter((cell) => {
      if (!coreIsInsideBoard(cell.row, cell.col, game) || isBrokenCell(game, cell.row, cell.col)) {
        return false;
      }
      const target = getBoardCardAt(game, cell.row, cell.col);
      if (target && target.ownerId !== card.ownerId && !coreCanCardsFight(game, card, target)) return false;
      const distance = Math.abs(cell.row - card.row) + Math.abs(cell.col - card.col);
      if ((canCharge || canUseLongMove) && distance >= 2) {
        const stepRow = Math.sign(cell.row - card.row); const stepCol = Math.sign(cell.col - card.col);
        for (let step = 1; step < distance; step += 1) {
          if (isBrokenCell(game, card.row + stepRow * step, card.col + stepCol * step) || getBoardCardAt(game, card.row + stepRow * step, card.col + stepCol * step)) return false;
        }
      }
      return (!target || target.ownerId !== card.ownerId) && (canCharge || canUseLongMove || !target || distance === 1);
    });
  }

  function coreBuildPendingAction(game) {
    const player = corePlayer(game, game.activePlayerId);
    if (!player || game.actionsUsed >= coreActionLimit(game)) return null;
    const selection = game.selection;
    if (selection.handCardUid && selection.targetCell) {
      const card = player.hand.find((item) => item.uid === selection.handCardUid);
      const legal = corePlacementAvailability(game).cells.some((cell) => (
        cell.row === selection.targetCell.row && cell.col === selection.targetCell.col
      ));
      return card && legal
        ? { type: "place", playerId: player.id, cardUid: card.uid, target: { ...selection.targetCell } }
        : null;
    }
    if (selection.boardCardUid && selection.targetCell) {
      const card = game.boardCards.find((item) => item.uid === selection.boardCardUid && item.ownerId === player.id);
      const legal = coreValidMoves(game, card).some((cell) => (
        cell.row === selection.targetCell.row && cell.col === selection.targetCell.col
      ));
      return card && legal
        ? {
          type: "move",
          playerId: player.id,
          cardUid: card.uid,
          source: { row: card.row, col: card.col },
          target: { ...selection.targetCell }
        }
        : null;
    }
    return null;
  }

  function coreAppendLog(game, message) {
    game.roundLog.push(message);
    game.actionHistory.push(`第 ${game.turn} 回合：${message}`);
    game.lastResolvedTurn = game.turn;
  }

  function coreCheckVictory(game) {
    const control = coreControlMap(game);
    game.players.forEach((player) => {
      player.lastControlCount = control.counts[player.id];
    });
    const target = coreVictoryTarget(game);
    const winners = game.players.filter((player) => player.lastControlCount >= target);
    if (winners.length === 0) {
      return false;
    }
    if (winners.length > 1) {
      game.winner = { playerId: 0, text: `双方同时占领 ${target} 格以上，本局判定为平局。` };
    } else {
      const winner = winners[0];
      game.winner = {
        playerId: winner.id,
        text: `${winner.name} 占领 ${winner.lastControlCount} 格，达到当前胜利所需的 ${target} 格。`
      };
    }
    game.finalControlCounts = { ...control.counts };
    return true;
  }

  async function coreResolveAction(game, action) {
    const player = corePlayer(game, action.playerId);
    const card = getCardByUid(game, action.cardUid);
    if (!player || !card) {
      return false;
    }
    if (action.type === "move" && (!action.source || card.row !== action.source.row || card.col !== action.source.col
      || !action.target || (card.row === action.target.row && card.col === action.target.col))) {
      return false;
    }
    game.isAnimating = true;
    game.flowPrompt = "";
    game.currentPhase = "行动阶段";
    game.selection = resetSelection();
    coreRender();
    await playActionAnimations(game, [action]);

    let combatScene = null;
    if (action.type === "place") {
      const handIndex = player.hand.findIndex((item) => item.uid === card.uid);
      if (handIndex < 0) {
        game.isAnimating = false;
        return false;
      }
      player.hand.splice(handIndex, 1);
      card.ownerId = player.id;
      card.row = action.target.row;
      card.col = action.target.col;
      card.restedTurn = game.turn;
      card.lastMovedTurn = null;
      card.v2LongMoveUsed = false;
      card.hasPlaced = false;
      game.boardCards.push(card);
      game.effectBoardCards = game.boardCards;
      const skillLog = [];
      const extraPlacementSourceUid = player.v2NextPlacementExtra;
      coreApplyV2PlacementSkill(game, player, card, skillLog);
      coreInvalidateEnemyControlCell(game, card);
      if (extraPlacementSourceUid && extraPlacementSourceUid !== card.uid) {
        // The marker belongs to this placement even when the original skill removes the card.
        if (game.boardCards.includes(card)) coreApplyV2PlacementSkill(game, player, card, skillLog);
        if (player.v2NextPlacementExtra === extraPlacementSourceUid) player.v2NextPlacementExtra = null;
        skillLog.push(`${coreCardName(card)} 的放置技能额外结算 1 次。`);
      }
      coreEmitV2Event(game, CORE_V2_EVENT.CARD_PLACED, { player: corePlayer(game, card.ownerId), card, log: skillLog });
      if (skillLog.length) skillLog.forEach((entry) => coreAppendLog(game, entry));
      game.effectBoardCards = null;
      coreAppendLog(game, `${player.name} 将 ${coreCardName(card)} 放置在 ${formatCell(card.row, card.col)}，该卡本回合进入休整。`);
    } else {
      const defender = getBoardCardAt(game, action.target.row, action.target.col);
      if (defender?.uid === card.uid) {
        game.isAnimating = false;
        coreAppendLog(game, `${player.name} 的 ${coreCardName(card)} 移动请求无效：目标卡牌与自身相同。`);
        coreRender();
        return false;
      }
      const sourcePosition = { row: card.row, col: card.col };
      if (coreCardEffectHasFlag(card, "longMove") && !card.v2LongMoveUsed) card.v2LongMoveUsed = true;
      card.lastMovedTurn = game.turn;
      card.movesTaken = Number(card.movesTaken) || 0;
      if (!defender) {
        card.row = action.target.row;
        card.col = action.target.col;
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card, source: sourcePosition, target: { row: card.row, col: card.col } });
        coreAppendLog(game, `${player.name} 的 ${coreCardName(card)} 从 ${formatCell(action.source.row, action.source.col)} 移动至 ${formatCell(card.row, card.col)}。`);
      } else {
        combatScene = await playCombatClashAnimation(game, card, defender, action.target.row, action.target.col, "交战");
        game.effectBoardCards = game.boardCards;
        const attackerValue = Number(card.currentAttack ?? card.attack) || 0;
        const defenderValue = Number(defender.currentAttack ?? defender.attack) || 0;
        const outcome = attackerValue > defenderValue ? "a" : attackerValue < defenderValue ? "b" : "both";
        const combatLog = [];
        let attackerDestroyed = false;
        let defenderDestroyed = false;
        if (outcome === "a") {
          const defenderPosition = { row: defender.row, col: defender.col };
          defenderDestroyed = coreDestroyV2Card(game, defender, combatLog, card);
          if (defenderDestroyed) {
            card.row = defenderPosition.row;
            card.col = defenderPosition.col;
            coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card, source: sourcePosition, target: defenderPosition });
          }
          coreAppendLog(game, `${coreCardName(card)} 攻击 ${coreCardName(defender)} 并获胜。`);
        } else if (outcome === "b") {
          attackerDestroyed = coreDestroyV2Card(game, card, combatLog, defender);
          coreAppendLog(game, `${coreCardName(card)} 攻击 ${coreCardName(defender)} 失败，攻击方被摧毁。`);
        } else {
          attackerDestroyed = coreDestroyV2Card(game, card, combatLog, defender);
          defenderDestroyed = coreDestroyV2Card(game, defender, combatLog, card);
          coreAppendLog(game, `${coreCardName(card)} 与 ${coreCardName(defender)} 同归于尽。`);
        }
        coreRunV2CombatEffects(game, card, defender, attackerDestroyed, defenderDestroyed, combatLog);
        combatLog.forEach((entry) => coreAppendLog(game, entry));
        game.effectBoardCards = null;
        await finishCombatAnimation(game, combatScene, game.boardCards);
      }
    }

    syncPlayerBoardIds(game);
    if (typeof flushPendingAnimations === "function") await flushPendingAnimations(game);
    const consumesAction = !(coreCardEffectHasFlag(card, "freeAction") && card.freeActionTurn === game.turn);
    if (consumesAction) game.actionsUsed += 1;
    const won = coreCheckVictory(game);
    game.isAnimating = false;
    if (won) {
      game.currentPhase = "胜负结算";
      game.lastResolution = game.winner.text;
      coreRender();
      await coreAnimateVictoryCells(game, game.winner.playerId);
      showResult();
      coreOnlineSendState(game);
      return true;
    }
    game.lastResolution = `${player.name} 已完成 1 次行动，还可执行 ${coreActionLimit(game) - game.actionsUsed} 次行动。`;
    coreRender();
    coreOnlineSendState(game);
    return true;
  }

  function coreFinishTurnLimit(game) {
    const control = coreControlMap(game);
    const playerOne = corePlayer(game, 1);
    const playerTwo = corePlayer(game, 2);
    playerOne.lastControlCount = control.counts[1];
    playerTwo.lastControlCount = control.counts[2];
    game.finalControlCounts = coreSettlementCounts(game);
    if (playerOne.lastControlCount === playerTwo.lastControlCount) {
      game.winner = {
        playerId: 0,
        text: `第 ${CORE_MAX_TURNS} 回合结束，双方各占领 ${playerOne.lastControlCount} 格，本局平局。`
      };
      return;
    }
    const winner = playerOne.lastControlCount > playerTwo.lastControlCount ? playerOne : playerTwo;
    game.winner = {
      playerId: winner.id,
      text: `第 ${CORE_MAX_TURNS} 回合结束，${winner.name} 以占领 ${winner.lastControlCount} 格获胜。`
    };
  }

  function coreRunV2EndSkills(game, active, log) {
    game.boardCards.filter((card) => card.ownerId === active.id).forEach((source) => {
      const effectDefinition = coreCardEffectDefinition(source);
      if (effectDefinition?.onTurnEnd) {
        effectDefinition.onTurnEnd(coreCreateCardEffectContext(game, active, source, log));
        return;
      }
    });
    game.moveLocks = {};
    // "本回合" effects expire with the active global turn, including buffs applied to the non-active player.
    game.boardCards.forEach((card) => {
      card.v2TempBonus = 0;
      card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0));
      if (card.ownerId === active.id && coreCardEffectHasFlag(card, "replacementWatcher")) card.v2ReplacedThisTurn = new Set();
    });
    active.v2NextPlacementExtra = null;
    game.extraActions = 0;
  }

  async function coreEndTurn(game = state.game, automatic = false) {
    if (!game || game.isAnimating || game.winner) {
      return;
    }
    const active = corePlayer(game, game.activePlayerId);
    if (!automatic) {
      coreAppendLog(game, `${active.name} 主动结束回合，放弃剩余 ${coreActionLimit(game) - game.actionsUsed} 次行动。`);
    }
    game.effectBoardCards = game.boardCards;
    const endSkillLog = [];
    coreEmitV2Event(game, CORE_V2_EVENT.TURN_END, { player: active, log: endSkillLog });
    endSkillLog.forEach((entry) => coreAppendLog(game, entry));
    if (typeof flushPendingAnimations === "function") await flushPendingAnimations(game);
    game.effectBoardCards = null;
    if (coreCheckVictory(game)) {
      game.currentPhase = "胜负结算";
      game.lastResolution = game.winner.text;
      coreRender();
      await coreAnimateVictoryCells(game, game.winner.playerId);
      showResult();
      coreOnlineSendState(game);
      return;
    }
    if (game.turn >= CORE_MAX_TURNS) {
      coreFinishTurnLimit(game);
      game.currentPhase = "胜负结算";
      game.lastResolution = game.winner.text;
      coreRender();
      await coreAnimateVictoryCells(game, 0);
      showResult();
      coreOnlineSendState(game);
      return;
    }
    game.turn += 1;
    game.activePlayerId = otherPlayerId(game.activePlayerId);
    const wonAtStart = coreStartTurn(game);
    coreRender();
    if (wonAtStart) {
      await coreAnimateVictoryCells(game, game.winner.playerId);
      showResult();
      return;
    }
    showPhaseBanner("切换回合", `第 ${game.turn} / ${CORE_MAX_TURNS} 回合，${corePlayer(game, game.activePlayerId).name} 开始行动。`);
    if (corePlayer(game, game.activePlayerId).isAI) {
      window.setTimeout(() => coreRunAiTurn(game), 650);
    }
    coreOnlineSendState(game);
  }

  async function coreSurrender(game = state.game) {
    if (!game || game.isAnimating || game.winner) return;
    const active = corePlayer(game, game.activePlayerId);
    const winner = active && corePlayer(game, otherPlayerId(active.id));
    if (!active || !winner) return;
    const control = coreControlMap(game);
    game.players.forEach((player) => { player.lastControlCount = control.counts[player.id]; });
    game.finalControlCounts = { ...control.counts };
    game.winner = {
      playerId: winner.id,
      text: `${active.name} 已认输，${winner.name} 获胜。`
    };
    game.currentPhase = "胜负结算";
    game.lastResolution = game.winner.text;
    game.selection = resetSelection();
    coreRender();
    await coreAnimateVictoryCells(game, winner.id);
    showResult();
    coreOnlineSendState(game);
  }

  function coreAiRarityValue(card) {
    return { 普通: 0, 稀有: 1.2, 史诗: 2.2, 传说: 3.2, 特殊: 1.6 }[getCardQuality(card)] || 0;
  }

  function coreAiNeighbors(game, row, col, diagonal = false) {
    const cells = diagonal ? getEightNeighbors(row, col) : getOrthogonalNeighbors(row, col);
    return cells.map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter(Boolean);
  }

  function coreAiPlacementScore(game, player, card, cell) {
    const allies = coreAiNeighbors(game, cell.row, cell.col).filter((target) => target.ownerId === player.id);
    const enemies = coreAiNeighbors(game, cell.row, cell.col).filter((target) => target.ownerId !== player.id);
    const attack = Number(card.currentAttack ?? card.attack) || 0;
    const centerDistance = Math.abs(cell.row - 1.5) + Math.abs(cell.col - 1.5);
    let score = attack * 1.4 + coreAiRarityValue(card) + (3 - centerDistance) * 0.8;
    const control = coreControlMap(game).counts;
    const victoryTarget = coreVictoryTarget(game);
    const openNeighbors = getOrthogonalNeighbors(cell.row, cell.col)
      .filter((target) => coreIsInsideBoard(target.row, target.col, game) && !isBrokenCell(game, target.row, target.col) && !getBoardCardAt(game, target.row, target.col)).length;
    const winningAdjacentTargets = enemies.filter((target) => attack > (Number(target.currentAttack ?? target.attack) || 0));
    const losingAdjacentTargets = enemies.filter((target) => attack < (Number(target.currentAttack ?? target.attack) || 0));
    const allyPower = allies.reduce((sum, target) => sum + (Number(target.currentAttack ?? target.attack) || 0), 0);
    score += allies.length * 2.8 + enemies.length * 0.8;
    score += openNeighbors * 0.55;
    // A card placed next to a weaker enemy creates a realistic attack next turn.
    score += winningAdjacentTargets.length * 4.5;
    score -= losingAdjacentTargets.length * 2.2;
    score += Math.min(3, allyPower * 0.35);

    // Prefer a contested front line when the card can hold it; otherwise place behind support.
    const enemyDistance = Math.min(...game.boardCards
      .filter((target) => target.ownerId !== player.id)
      .map((target) => Math.abs(cell.row - target.row) + Math.abs(cell.col - target.col)), 4);
    score += enemies.length ? (attack >= Math.max(...enemies.map((target) => Number(target.currentAttack ?? target.attack) || 0)) ? 2.5 : -2.5) : Math.max(0, 3 - enemyDistance) * 0.35;

    // A rested card cannot move immediately, so avoid placing it beside a stronger threat.
    const strongestEnemy = Math.max(...enemies.map((target) => Number(target.currentAttack ?? target.attack) || 0), -1);
    if (strongestEnemy > attack) score -= Math.min(6, (strongestEnemy - attack) * 1.6);
    const immediateThreats = enemies.filter((target) => (Number(target.currentAttack ?? target.attack) || 0) >= attack);
    score -= immediateThreats.reduce((total, target) => total + 2.2 + Math.max(0, (Number(target.currentAttack ?? target.attack) || 0) - attack) * 0.9, 0);

    const cardId = String(card.id);
    if (cardId === "02106" && (cell.row === 0 || cell.row === coreBoardSize(game) - 1 || cell.col === 0 || cell.col === coreBoardSize(game) - 1)) score += 4;
    if (["02102", "02313", "02517"].includes(cardId)) score += enemies.length * 4;
    if (["02103", "02104", "02107", "02416", "02519"].includes(cardId)) score += allies.length * 3;
    if (["02209", "02210", "02315", "02520"].includes(cardId)) score += allies.length * 2.5;
    if (cardId === "01520") score += openNeighbors * 1.8;
    if (cardId.startsWith("01")) score += allies.length * 1.4;
    if (["01105", "01106", "01209", "01210", "01212", "01517"].includes(cardId)) score += enemies.length * 1.8;
    if (["02105", "02518"].includes(cardId)) score += 2;
    if (cardId === "02208") score += game.players.find((target) => target.id !== player.id)?.hand.length ? 1.5 : -1;
    // One direct placement can end the match. Never trade that for a local combat setup.
    if (control[player.id] + 1 >= victoryTarget) score += 1000;
    // Score global and delayed effects by the units they can actually affect, not only by adjacency.
    if (cardId === "02416") score += game.boardCards.filter((target) => target.ownerId === player.id).length * 2.1;
    if (cardId === "01520") score += openNeighbors * 1.4;
    if (cardId === "02518") score += Math.min(HAND_LIMIT - player.hand.length, player.drawPile.length) * 1.25;
    if (cardId === "02208") score += Math.min(2, game.players.find((target) => target.id !== player.id)?.hand.length || 0) * 1.2;
    if (cardId === "02519") score += winningAdjacentTargets.length * 3.5;
    if (cardId === "02314" && !game.boardCards.some((target) => target.currentAttack === 0 && target.uid !== card.uid)) {
      const enemyValue = game.boardCards.filter((target) => target.ownerId !== player.id).reduce((total, target) => total + (Number(target.currentAttack ?? target.attack) || 0), 0);
      const allyValue = game.boardCards.filter((target) => target.ownerId === player.id).reduce((total, target) => total + (Number(target.currentAttack ?? target.attack) || 0), 0);
      score += (enemyValue - allyValue) * 0.45;
    }
    if (cardId === "02315") score += game.boardCards.filter((target) => target.ownerId === player.id && target.id !== "02315").length * 0.9;
    if (cardId === "02517") {
      const tradeTarget = enemies.reduce((best, target) => Math.max(best, Number(target.currentAttack ?? target.attack) || 0), -1);
      score += tradeTarget > attack ? (tradeTarget - attack) * 5 : -4;
    }
    return score;
  }

  function coreAiMoveScore(game, player, card, target) {
    const defender = getBoardCardAt(game, target.row, target.col);
    const attack = Number(card.currentAttack ?? card.attack) || 0;
    const distance = Math.abs(target.row - card.row) + Math.abs(target.col - card.col);
    let score = 0;
    if (defender) {
      if (defender.ownerId === player.id) return -Infinity;
      const defense = Number(defender.currentAttack ?? defender.attack) || 0;
      if (attack > defense) {
        score = 100 + defense * 6 + (defender.isGuard ? 2 : 5);
      } else if (attack === defense) {
        score = 12 - attack;
      } else {
        return -80 - (defense - attack) * 5;
      }
    } else {
      const enemyCards = game.boardCards.filter((item) => item.ownerId !== player.id);
      const nearestEnemy = Math.min(...enemyCards.map((enemy) => Math.abs(target.row - enemy.row) + Math.abs(target.col - enemy.col)), 4);
      const sourceNearestEnemy = Math.min(...enemyCards.map((enemy) => Math.abs(card.row - enemy.row) + Math.abs(card.col - enemy.col)), 4);
      score += (4 - nearestEnemy) * 2.2 + (sourceNearestEnemy - nearestEnemy) * 1.4;
      score += coreAiNeighbors(game, target.row, target.col).filter((item) => item.ownerId === player.id).length * 1.4;
      const threateningEnemies = coreAiNeighbors(game, target.row, target.col).filter((item) => item.ownerId !== player.id && (Number(item.currentAttack ?? item.attack) || 0) >= attack);
      score -= threateningEnemies.length * 3.2;
      score += (3 - (Math.abs(target.row - 1.5) + Math.abs(target.col - 1.5))) * 0.6;
    }
    if (card.id === "02211" && distance > 1) score += 2;
    if (card.id === "01209" && distance === 2) score += 2;
    return score;
  }

  function corePlanAiAction(game, player) {
    const candidates = [];
    const movableCards = game.boardCards.filter((card) => card.ownerId === player.id && !card.isGuard);
    movableCards.forEach((card) => coreValidMoves(game, card).forEach((target) => {
      const score = coreAiMoveScore(game, player, card, target);
      if (Number.isFinite(score)) candidates.push({ score, action: { type: "move", playerId: player.id, cardUid: card.uid, source: { row: card.row, col: card.col }, target } });
    }));
    const cells = corePlacementAvailability(game).cells;
    player.hand.forEach((card) => cells.forEach((target) => candidates.push({
      score: coreAiPlacementScore(game, player, card, target),
      action: { type: "place", playerId: player.id, cardUid: card.uid, target }
    })));
    if (!candidates.length) return null;
    const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
    const shortlist = candidates.filter((candidate) => candidate.score >= bestScore - 0.35);
    return shortlist[randomInt(0, shortlist.length - 1)].action;
  }

  async function coreRunAiTurn(game) {
    const ai = corePlayer(game, game.activePlayerId);
    if (!game || game.winner || !ai?.isAI || game.isAnimating) {
      return;
    }
    while (!game.winner && game.activePlayerId === ai.id && game.actionsUsed < coreActionLimit(game)) {
      const action = corePlanAiAction(game, ai);
      if (!action) {
        await coreEndTurn(game, false);
        return;
      }
      await coreResolveAction(game, action);
      await wait(420);
    }
    if (!game.winner && game.activePlayerId === ai.id) {
      await coreEndTurn(game, true);
    }
  }

  function coreRenderBoard(game, active, controlMap) {
    ui.board.innerHTML = "";
    ui.boardAnimationLayer.innerHTML = "";
    const selectedHand = active.hand.find((card) => card.uid === game.selection.handCardUid) || null;
    const placeTargets = selectedHand ? corePlacementAvailability(game).cells : [];
    const selectedBoard = game.boardCards.find((card) => card.uid === game.selection.boardCardUid) || null;
    const moveTargets = selectedBoard ? coreValidMoves(game, selectedBoard) : [];

    const boardSize = coreBoardSize(game);
    ui.board.style.gridTemplateColumns = `repeat(${boardSize}, minmax(0, 1fr))`;
    ui.board.style.gridTemplateRows = `repeat(${boardSize}, minmax(0, 1fr))`;
    for (let row = 0; row < boardSize; row += 1) {
      for (let col = 0; col < boardSize; col += 1) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "cell";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.disabled = game.isAnimating;
        if (isBrokenCell(game, row, col)) {
          cell.classList.add("blocked");
        }
        const owner = controlMap.influence.get(cellKey(row, col))?.owners;
        if (owner?.has(1)) cell.classList.add("control-1");
        if (owner?.has(2)) cell.classList.add("control-2");
        const isPlaceTarget = placeTargets.some((target) => target.row === row && target.col === col);
        const isMoveTarget = moveTargets.some((target) => target.row === row && target.col === col);
        const targetCard = getBoardCardAt(game, row, col);
        if (selectedHand && !targetCard && !isBrokenCell(game, row, col) && !isPlaceTarget) {
          cell.classList.add("core-place-blocked");
        }
        if (isPlaceTarget) cell.classList.add("selectable", "core-place-target");
        if (isMoveTarget) {
          cell.classList.add("selectable");
          if (targetCard && targetCard.ownerId !== active.id) cell.classList.add("core-attack-target");
          else cell.classList.add("core-move-target");
        }
        if (selectedBoard && targetCard && targetCard.ownerId !== active.id && isMoveTarget) {
          const attackerValue = selectedBoard.currentAttack;
          const defenderValue = targetCard.currentAttack;
          cell.classList.add(attackerValue === defenderValue ? "trade" : attackerValue > defenderValue ? "capture" : "danger");
        }
        if (game.selection.targetCell?.row === row && game.selection.targetCell?.col === col) cell.classList.add("pending");

        const coord = document.createElement("span");
        coord.className = "cell-coord";
        coord.textContent = `${row + 1}-${col + 1}`;
        cell.appendChild(coord);
        if (targetCard) {
          cell.appendChild(coreCreateUnitElement(targetCard, game));
        } else if (isBrokenCell(game, row, col)) {
          const label = document.createElement("span");
          label.className = "unit-meta";
          label.textContent = "破坏格";
          cell.appendChild(label);
        }
        cell.addEventListener("click", () => coreHandleBoardClick(row, col));
        ui.board.appendChild(cell);
      }
    }
  }

  function coreCreateUnitElement(card, game) {
    const display = coreCardDisplay(card);
    const element = document.createElement("div");
    element.className = `unit ${card.isGuard ? "guard" : `player${card.ownerId}`} rarity-${display.rarity || "普通"} ${card.restedTurn === game.turn ? "is-rested" : ""}`;
    element.dataset.cardUid = card.uid;
    element.tabIndex = 0;
    element.setAttribute("aria-label", card.isGuard
      ? `守军，战力 ${card.currentAttack}，中立卡牌，技能无。`
      : `${display.name}，战力 ${card.currentAttack}，${getCampDisplayName(display.camp)}。词条：${coreEffectTags(card).join("、") || "无"}。技能：${display.skill}。`);
    element.innerHTML = `
      <div class="unit-main">
        <div class="unit-identity">
          <span class="unit-name">${coreEscapeHtml(display.name)}</span>
          <span class="unit-camp">${coreEscapeHtml(getCampDisplayName(display.camp))}</span>
        </div>
        <span class="unit-attack" title="当前战力 ${card.currentAttack}">
          <strong>${card.currentAttack}</strong><small>战力</small>
        </span>
      </div>
        <span class="unit-skill">${coreEscapeHtml(display.skill)}</span>
        ${coreEffectTags(card).length ? `<span class="unit-effect-tags">${coreEffectTagBadges(card, "unit-effect-tag")}</span>` : ""}
        ${card.restedTurn === game.turn ? '<span class="rested-badge">休整中</span>' : ""}
      <div class="unit-tooltip" role="tooltip">
        <span class="unit-tooltip-label">触发时机 ${coreEffectTagBadges(card)}</span>
        <span class="skill-effect-list">${coreSkillEffectHtml(card)}</span>
        ${card.restedTurn === game.turn ? '<span class="unit-tooltip-state">当前状态：休整中，本回合不能主动移动。</span>' : ""}
      </div>
    `;
    element.addEventListener("mouseenter", () => {
      const cell = element.closest(".cell");
      if (cell) cell.style.zIndex = "1000";
    });
    element.addEventListener("mouseleave", () => {
      const cell = element.closest(".cell");
      if (cell) cell.style.zIndex = "";
    });
    return element;
  }

  function coreRenderHand(game, active) {
    ui.handCards.innerHTML = "";
    active.hand.forEach((card) => {
      const display = coreCardDisplay(card);
      const element = document.createElement("button");
      element.type = "button";
      element.className = `card rarity-${display.rarity || "普通"}`;
      element.disabled = game.isAnimating;
      if (game.selection.handCardUid === card.uid) element.classList.add("selected");
      element.innerHTML = `
        <div class="card-top"><h3>${coreEscapeHtml(display.name)}</h3><strong>ATK ${card.attack}</strong></div>
        <p class="card-stats">${coreEscapeHtml(getCardTierLabel(card))} · ${coreEscapeHtml(getCampDisplayName(display.camp))}</p>
        <p class="card-effect">${coreEscapeHtml(display.skill)}</p>
        ${coreEffectTags(card).length ? `<div class="card-tags">${coreEffectTagBadges(card, "card-tag alt")}</div>` : ""}
        <span class="hand-skill-tooltip" role="tooltip"><strong>触发时机 ${coreEffectTagBadges(card)}</strong><span class="skill-effect-list">${coreSkillEffectHtml(card)}</span></span>
      `;
      element.addEventListener("click", () => coreHandleHandClick(card.uid));
      ui.handCards.appendChild(element);
    });
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => coreFitSingleLineText(ui.handCards));
    else window.setTimeout(() => coreFitSingleLineText(ui.handCards), 0);
  }

  function coreRender() {
    const game = state.game;
    if (!game) return;
    const active = corePlayer(game, game.activePlayerId);
    const handOwner = game.mode === "online"
      ? corePlayer(game, state.online?.playerId) || active
      : active;
    const control = coreControlMap(game);
    const target = coreVictoryTarget(game);
    ui.modeLabel.textContent = `${game.mode === "pve" ? "PVE" : "本地 1v1"} · ${game.boardSize}x${game.boardSize}`;
    ui.turnLabel.textContent = `第 ${game.turn} / ${CORE_MAX_TURNS} 回合`;
    ui.phaseLabel.textContent = game.currentPhase;
    ui.deckLabel.textContent = `P1 ${game.players[0].drawPile.length} / P2 ${game.players[1].drawPile.length}`;
    ui.statusMessage.textContent = game.flowPrompt || game.lastResolution;
    ui.statusSubtext.textContent = game.isAnimating
      ? "正在展示本次行动与交战结果。"
      : `占领 ${target} 格即可立即获胜；当前行动位 ${game.actionsUsed}/${coreActionLimit(game)}。`;
    ui.actingPlayerLabel.textContent = `${active.name}${active.id === game.firstPlayerId ? "（先手）" : "（后手）"}`;
    ui.actionsLabel.textContent = `${game.actionsUsed} / ${coreActionLimit(game)}`;
    const handActionPanel = document.getElementById("hand-action-count");
    handActionPanel?.classList.toggle("is-complete", game.actionsUsed >= coreActionLimit(game));
    const handActionCount = document.querySelector("#hand-action-count strong");
    if (handActionCount) handActionCount.textContent = `${game.actionsUsed} / ${coreActionLimit(game)}`;
    const controlCompare = document.getElementById("control-compare-label");
    if (controlCompare) {
      controlCompare.querySelector(".control-player-one .control-player-score").textContent = control.counts[1];
      controlCompare.querySelector(".control-player-two .control-player-score").textContent = control.counts[2];
    }
    game.players.forEach((player) => {
      const copy = `${getCampDisplayName(player.deckKey)} · 占领 ${control.counts[player.id]} 格 · 手牌 ${player.hand.length}/${HAND_LIMIT} · 牌库 ${player.drawPile.length}`;
      if (player.id === 1) {
        ui.player1Control.textContent = `${control.counts[1]} / ${target} 格`;
        ui.player1Summary.textContent = copy;
      } else {
        ui.player2Control.textContent = `${control.counts[2]} / ${target} 格`;
        ui.player2Summary.textContent = copy;
      }
    });
    ui.handTitle.textContent = `${handOwner.name} 的手牌`;
    ui.submitActionBtn.hidden = true;
    ui.submitActionBtn.disabled = true;
    ui.cancelSelectionBtn.disabled = game.isAnimating;
    coreUi.endTurnBtn.disabled = game.isAnimating;
    coreUi.endTurnBtn.classList.toggle("is-highlighted", !game.isAnimating && !game.winner && !coreHasExecutableAction(game));
    if (coreUi.surrenderBtn) coreUi.surrenderBtn.disabled = game.isAnimating || Boolean(game.winner) || active.isAI;
    ui.restartBtn.disabled = game.isAnimating;
    ui.backMenuBtn.disabled = game.isAnimating;
    if (game.selection.handCardUid) {
      const availability = corePlacementAvailability(game);
      ui.selectionSummary.textContent = availability.cells.length > 0 ? "已选中手牌，请选择一个空格放置。" : `当前无法放置：${availability.reason}`;
    } else if (game.selection.boardCardUid) {
      const card = game.boardCards.find((item) => item.uid === game.selection.boardCardUid);
      ui.selectionSummary.textContent = card?.restedTurn === game.turn
        ? `${coreCardName(card)} 本回合处于休整状态，不能主动移动。`
        : `${card ? coreCardName(card) : "卡牌"} 每回合最多主动移动一次；进入敌方格会立即交战。`;
    } else {
      ui.selectionSummary.textContent = "选择手牌放置，或选择未休整且未移动过的己方卡牌移动。";
    }
    const selectedCard = game.boardCards.find((card) => card.uid === game.selection.boardCardUid)
      || handOwner.hand.find((card) => card.uid === game.selection.handCardUid);
    const selectedDisplay = selectedCard ? coreCardDisplay(selectedCard) : null;
    ui.detailRarity.textContent = selectedCard ? getCardTierLabel(selectedCard) : "未选择";
    ui.detailName.textContent = selectedDisplay ? selectedDisplay.name : "选择一张卡牌";
    ui.detailSkill.textContent = selectedDisplay ? selectedDisplay.skill : "悬停或选择卡牌查看技能";
    ui.detailSummary.textContent = selectedCard
      ? `${getCampDisplayName(selectedDisplay.camp)} · 当前战力 ${selectedCard.currentAttack} · 基础战力 ${selectedCard.attack}`
      : "卡牌详情将在此显示。";
    ui.detailTags.innerHTML = selectedCard ? `<span class="detail-tag">${selectedCard.isGuard ? "中立守军" : "玩家卡牌"}</span><span class="detail-tag">${selectedCard.restedTurn === game.turn ? "休整中" : "可行动"}</span>${coreEffectTagBadges(selectedCard, "detail-tag effect-tag")}` : "";
    ui.detailLines.innerHTML = selectedCard ? `<div class="detail-line"><strong>${coreEffectTags(selectedCard).length ? `触发时机 ${coreEffectTagBadges(selectedCard)}` : "技能效果"}</strong><span class="skill-effect-list">${coreSkillEffectHtml(selectedCard)}</span></div><div class="detail-line"><strong>状态</strong><span>${selectedCard.restedTurn === game.turn ? "本回合休整，不能主动移动" : "可进行移动"}</span></div>` : "";
    ui.actionLogTurn.textContent = `第 ${game.turn} 回合`;
    ui.actionLogList.innerHTML = "";
    (game.roundLog.length ? game.roundLog : ["本回合尚无行动记录。"]).forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "action-log-item";
      item.innerHTML = `<strong>${String(index + 1).padStart(2, "0")}</strong><span>${entry}</span>`;
      ui.actionLogList.appendChild(item);
    });
    coreRenderBoard(game, active, control);
    coreRenderHand(game, handOwner);
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => coreFitSingleLineText(ui.board));
    else window.setTimeout(() => coreFitSingleLineText(ui.board), 0);
  }

  function coreHandleHandClick(cardUid) {
    const game = state.game;
    if (!game || game.isAnimating) return;
    const active = corePlayer(game, game.activePlayerId);
    if (game.actionsUsed >= coreActionLimit(game)) {
      showToast("行动次数已用完", "本回合不能继续放置卡牌，请结束回合。");
      coreRender();
      return;
    }
    if (!active.hand.some((card) => card.uid === cardUid)) return;
    const availability = corePlacementAvailability(game);
    if (availability.cells.length === 0) {
      showToast("无法放置", availability.reason);
      return;
    }
    game.selection = { handCardUid: game.selection.handCardUid === cardUid ? null : cardUid, boardCardUid: null, targetCell: null };
    coreRender();
  }

  function coreHandleBoardClick(row, col) {
    const game = state.game;
    if (!game || game.isAnimating || isBrokenCell(game, row, col)) return;
    const active = corePlayer(game, game.activePlayerId);
    if (game.actionsUsed >= coreActionLimit(game)) {
      showToast("行动次数已用完", "本回合不能继续行动，请结束回合。");
      coreRender();
      return;
    }
    const target = getBoardCardAt(game, row, col);
    if (game.selection.handCardUid) {
      if (!target && corePlacementAvailability(game).cells.some((cell) => cell.row === row && cell.col === col)) {
        game.selection.targetCell = { row, col };
        const action = coreBuildPendingAction(game);
        if (action) {
          if (game.mode === "online") {
            game.selection = resetSelection();
            if (!window.CardOnline?.send({ type: "action-request", action })) showToast("联网未连接", "请等待联网服务连接后再操作。");
            coreRender();
          } else {
            coreResolveAction(game, action);
          }
          return;
        }
      }
      coreRender();
      return;
    }
    if (game.selection.boardCardUid) {
      const card = game.boardCards.find((item) => item.uid === game.selection.boardCardUid);
      if (coreValidMoves(game, card).some((cell) => cell.row === row && cell.col === col)) {
        game.selection.targetCell = { row, col };
        const action = coreBuildPendingAction(game);
        if (action) {
          if (game.mode === "online") {
            game.selection = resetSelection();
            if (!window.CardOnline?.send({ type: "action-request", action })) showToast("联网未连接", "请等待联网服务连接后再操作。");
            coreRender();
          } else {
            coreResolveAction(game, action);
          }
          return;
        }
        coreRender();
        return;
      }
    }
    if (target?.ownerId === active.id) {
      if (target.restedTurn === game.turn) {
        showToast("卡牌休整中", `${coreCardName(target)} 是本回合新放置的卡牌，不能主动移动。`);
      } else if (target.lastMovedTurn === game.turn) {
        showToast("已完成移动", `${coreCardName(target)} 本回合已经主动移动过一次。`);
      } else {
        game.selection = { handCardUid: null, boardCardUid: game.selection.boardCardUid === target.uid ? null : target.uid, targetCell: null };
      }
    }
    coreRender();
  }

  async function coreSubmitAction() {
    const game = state.game;
    if (!game || game.isAnimating || game.winner) return;
    const action = coreBuildPendingAction(game);
    if (!action) {
      showToast("请选择行动", "请先选择一张手牌与落点，或选择一张可移动的己方卡牌与目标格。");
      return;
    }
    if (game.mode === "online") {
      game.selection = resetSelection();
      if (!window.CardOnline?.send({ type: "action-request", action })) showToast("联网未连接", "请等待联网服务连接后再操作。");
      coreRender();
      return;
    }
    await coreResolveAction(game, action);
  }

  function coreShowOnlineWaiting(roomState = state.online.roomState || {}) {
    const roomCode = state.online.roomCode;
    const ownId = state.online.playerId;
    const ownDeck = state.online.deckKey || "三国~蜀";
    const deckOptions = getAvailableDeckKeys().map((deck) => `<option value="${deck}" ${deck === ownDeck ? "selected" : ""}>${getCampDisplayName(deck)}</option>`).join("");
    const readyText = (id) => roomState.ready?.[id] ? "已准备" : "未准备";
    const ownReady = Boolean(roomState.ready?.[ownId]);
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card online-room-card" role="dialog" aria-modal="true" aria-label="等待联网玩家">
        <button id="online-leave-room" class="overlay-close" type="button" aria-label="退出房间">退出房间</button>
        <p class="phase-banner-eyebrow">ONLINE MATCH</p>
        <h2 class="deck-reveal-title">房间 ${roomCode}</h2>
        <p class="deck-reveal-copy">地图：${roomState.boardSize || state.selectedBoardSize}x${roomState.boardSize || state.selectedBoardSize}。请将房间号发送给另一位玩家。</p>
        <div class="online-room-players">
          <div><strong>${roomState.names?.[1] || (ownId === 1 ? state.playerName : "等待玩家")}</strong><span>${readyText(1)}</span></div>
          <div><strong>${roomState.names?.[2] || (ownId === 2 ? state.playerName : "等待加入")}</strong><span>${readyText(2)}</span></div>
        </div>
        <label class="online-deck-choice">我的势力牌库<select id="online-deck-choice" ${ownReady ? "disabled" : ""}>${deckOptions}</select></label>
        <button id="online-ready-btn" class="primary-btn" type="button">${ownReady ? "取消准备" : "准备"}</button>
        <p id="online-room-status" class="deck-reveal-copy">${roomState.hasPlayers?.[2] ? "等待双方准备……" : "等待玩家 2 加入……"}</p>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    document.getElementById("online-leave-room")?.addEventListener("click", () => {
      if (!window.confirm("确定退出房间吗？")) return;
      window.CardOnline?.send({ type: "leave-room" });
      coreCloseOverlay();
      state.online = { playerId: null, roomCode: null, host: false };
      switchScreen("menu");
    });
    document.getElementById("online-deck-choice")?.addEventListener("change", (event) => {
      state.online.deckKey = event.target.value;
      window.CardOnline?.send({ type: "set-deck", deckKey: state.online.deckKey });
    });
    document.getElementById("online-ready-btn")?.addEventListener("click", () => {
      const nextReady = !ownReady;
      if (!state.online.deckKey) state.online.deckKey = ownDeck;
      window.CardOnline?.send({ type: "set-deck", deckKey: state.online.deckKey });
      window.CardOnline?.send({ type: "set-ready", ready: nextReady });
    });
  }

  function coreStartOnlineHost() {
    state.game = null;
    state.online.deckKey = getAvailableDeckKeys()[0] || "三国~蜀";
    coreShowOnlineWaiting({ roomCode: state.online.roomCode, boardSize: state.selectedBoardSize, names: { 1: state.playerName }, ready: { 1: false, 2: false }, hasPlayers: { 1: true, 2: false } });
  }

  function coreStartOnlineMatch(message) {
    state.selectedDecks = message.decks;
    state.selectedBoardSize = Number(message.boardSize) || 4;
    state.game = coreCreateGame("online", state.selectedDecks, state.selectedBoardSize, message.firstPlayerId);
    state.game.players[0].name = message.names?.[1] || "玩家 1";
    state.game.players[1].name = message.names?.[2] || "玩家 2";
    switchScreen("game");
    coreShowOpeningReveal(state.game);
    window.setTimeout(() => {
      if (!state.game || state.game.currentPhase !== "开局展示") return;
      coreCloseOverlay();
      const wonAtStart = coreStartTurn(state.game);
      coreRender();
      if (wonAtStart) showResult();
      else coreOnlineSendState(state.game);
    }, 5000);
  }

  function coreHandleOnlineMessage(message) {
    if (!message) return;
    if (message.type === "room-created") {
      state.online = { ...state.online, playerId: 1, roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken, host: true };
      try { window.localStorage?.setItem("cardDemoOnlineRoom", JSON.stringify({ roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken })); } catch (_error) { /* ignore */ }
      coreStartOnlineHost();
      state.game.players[0].name = message.playerName;
      return;
    }
    if (message.type === "room-joined") {
      state.online = { ...state.online, playerId: 2, roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken, host: false };
      try { window.localStorage?.setItem("cardDemoOnlineRoom", JSON.stringify({ roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken })); } catch (_error) { /* ignore */ }
      coreCloseOverlay();
      state.selectedBoardSize = message.boardSize || state.selectedBoardSize;
      state.online.deckKey = getAvailableDeckKeys()[0] || "三国~蜀";
      showToast("已加入房间", `你已加入 ${message.opponentName || "玩家 1"} 创建的房间。`);
      coreShowOnlineWaiting({ roomCode: message.roomCode, boardSize: state.selectedBoardSize, names: { 1: message.opponentName, 2: state.playerName }, ready: { 1: false, 2: false }, hasPlayers: { 1: true, 2: true } });
      return;
    }
    if (message.type === "peer-joined" && state.online.host) {
      showToast("玩家已加入", `${message.playerName || "玩家 2"} 已加入房间。`);
      return;
    }
    if (message.type === "room-state") {
      state.online.roomState = message.state;
      if (!state.online.roomCode || !state.game || state.game.currentPhase === "开局展示") coreShowOnlineWaiting(message.state);
      return;
    }
    if (message.type === "match-start") {
      showToast("双方已准备", "对局即将开始。");
      coreStartOnlineMatch(message);
      return;
    }
    if (message.type === "room-resumed") {
      state.online = { ...state.online, playerId: message.playerId, roomCode: message.roomCode, sessionToken: message.sessionToken, host: message.playerId === 1 };
      if (message.started && message.state) {
        try {
          state.game = coreDeserializeOnlineGame(message.state);
        } catch (_error) {
          try { window.localStorage?.removeItem("cardDemoOnlineRoom"); } catch (_storageError) { /* ignore */ }
          state.game = null;
          coreCloseOverlay();
          switchScreen("menu");
          showToast("对局数据已过期", "旧版对局不能载入当前卡牌数据，请重新创建房间。");
          return;
        }
        switchScreen("game");
        coreRender();
        showToast("已恢复对局", "已回到断线前的对局状态。");
      } else {
        coreShowOnlineWaiting(message.state || { roomCode: message.roomCode, boardSize: message.boardSize, names: {}, ready: {}, hasPlayers: {} });
      }
      return;
    }
    if (message.type === "resume-failed") {
      try { window.localStorage?.removeItem("cardDemoOnlineRoom"); } catch (_error) { /* ignore */ }
      state.game = null;
      coreCloseOverlay();
      switchScreen("menu");
      showToast("房间已失效", message.message || "原房间不存在。");
      return;
    }
    if (message.type === "auto-surrender") {
      if (state.game?.mode === "online") {
        state.game.winner = { playerId: state.online.playerId, text: message.message || "对方断线超过 5 分钟，视为自动认输。" };
        state.game.currentPhase = "胜负结算";
        state.game.lastResolution = state.game.winner.text;
        coreRender();
        showResult();
      }
      return;
    }
    if (message.type === "state-sync" && !state.online.host && message.state) {
      try {
        state.game = coreDeserializeOnlineGame(message.state);
      } catch (_error) {
        state.game = null;
        switchScreen("menu");
        showToast("对局数据不兼容", "收到的对局仍使用旧版卡牌数据，请重新进入房间。");
        return;
      }
      switchScreen("game");
      coreRender();
      if (state.game.winner) showResult();
      return;
    }
    if (message.type === "action-request" && state.online.host && state.game && message.playerId === state.game.activePlayerId) {
      coreResolveAction(state.game, { ...message.action, playerId: message.playerId });
      return;
    }
    if (message.type === "end-turn-request" && state.online.host && state.game && message.playerId === state.game.activePlayerId) {
      coreEndTurn(state.game);
      return;
    }
    if (message.type === "surrender-request" && state.online.host && state.game && message.playerId === state.game.activePlayerId) {
      coreSurrender(state.game);
      return;
    }
    if (message.type === "action-rejected") {
      showToast("行动未执行", message.message || "服务器拒绝了本次行动。");
      if (state.game) coreRender();
      return;
    }
    if (message.type === "error") showToast("联网房间", message.message || "联网操作失败。");
    if (message.type === "peer-left") {
      if (state.game?.mode === "online") showToast("玩家已断线", "对方已断开连接，5 分钟内重新连接可继续对局。");
      else showToast("玩家已退出", "房间已释放该玩家席位，可以等待新玩家加入。");
      return;
    }
    if (message.type === "server-shutdown") {
      coreCloseOverlay();
      if (state.game?.mode === "online") {
        state.game.winner = { playerId: 0, text: message.message || "服务器重启，本局平局。" };
        state.game.finalControlCounts = coreControlMap(state.game).counts;
        state.game.currentPhase = "胜负结算";
        state.game.lastResolution = state.game.winner.text;
        coreRender();
        showResult();
      } else {
        state.game = null;
        switchScreen("menu");
        showToast("房间已失效", "服务器重启，等待中的房间已销毁。");
      }
    }
  }

  function coreShowOnlineLobby() {
    if (!window.CardOnline) {
      showToast("联网不可用", "当前页面没有加载联网客户端。");
      return;
    }
    window.CardOnline.connect();
    state.online?.unsubscribe?.();
    state.online = { playerId: null, roomCode: null, playerName: "", host: false };
    state.online.unsubscribe = window.CardOnline.on(coreHandleOnlineMessage);
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="联网对战房间">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">ONLINE MATCH</p>
        <h2 class="deck-reveal-title">联网对战</h2>
        <p class="deck-reveal-copy">先设定玩家 ID，再创建房间或输入其他玩家提供的房间码加入。</p>
        <div class="online-lobby-actions">
          <button id="online-create-room" class="primary-btn">创建房间</button>
          <label>房间码<input id="online-room-code" maxlength="6" autocomplete="off" placeholder="例如 A1B2C3"></label>
          <button id="online-join-room" class="secondary-btn">加入房间</button>
        </div>
        <p id="online-lobby-status" class="deck-reveal-copy">正在连接联网服务……</p>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    const getPlayerName = () => state.playerName;
    const validatePlayerName = () => {
      const playerName = getPlayerName();
      if (corePlayerNameIsValid(playerName)) return playerName;
      showToast("玩家 ID 无效", "请输入 1-6 个中文字符，或 1-12 个英文字母。");
      return null;
    };
    document.getElementById("online-create-room").addEventListener("click", () => {
      const playerName = validatePlayerName();
      if (playerName && !window.CardOnline.createRoom(playerName, state.selectedBoardSize)) showToast("联网未连接", "请稍候再创建房间。");
    });
    document.getElementById("online-join-room").addEventListener("click", () => {
      const roomCode = document.getElementById("online-room-code").value;
      const playerName = validatePlayerName();
      if (playerName && !window.CardOnline.joinRoom(roomCode, playerName)) showToast("联网未连接", "请稍候再加入房间。");
    });
  }

  function coreShowDeckSelector(mode) {
    if (mode === "online") {
      coreShowOnlineLobby();
      return;
    }
    const camps = getAvailableDeckKeys();
    const optionMarkup = camps.map((camp) => `<option value="${camp}">${getCampDisplayName(camp)}</option>`).join("");
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="选择势力牌库">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">Core Rules V2</p>
        <h2 class="deck-reveal-title">选择本局势力牌库</h2>
        <p class="deck-reveal-copy">${state.selectedBoardSize || CORE_BOARD_SIZE}x${state.selectedBoardSize || CORE_BOARD_SIZE} 战场；当前使用每个势力预设的 20 张牌库，卡牌技能按 V2 规则自动结算。</p>
        <div class="deck-reveal-matchup">
          <label class="deck-reveal-side"><span class="label">玩家 1</span><select id="core-deck-p1">${optionMarkup}</select></label>
          <div class="deck-reveal-versus">VS</div>
          <label class="deck-reveal-side"><span class="label">${mode === "pve" ? "AI（随机）" : "玩家 2"}</span>${mode === "pve" ? "<p>系统将在开始时随机选择</p>" : `<select id="core-deck-p2">${optionMarkup}</select>`}</label>
        </div>
        <button id="core-deck-confirm" class="primary-btn">确认卡组</button>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    document.getElementById("core-deck-confirm").addEventListener("click", () => {
      const playerOneDeck = document.getElementById("core-deck-p1").value;
      const playerTwoDeck = mode === "pve" ? getRandomDeckKey() : document.getElementById("core-deck-p2").value;
      state.selectedDecks = { 1: playerOneDeck, 2: playerTwoDeck };
      coreBeginGame();
    });
  }

  function coreLoadCardTestSetup(setupOverride = null) {
    const fromStorage = !setupOverride;
    let setup = setupOverride;
    if (!setup) {
      try {
        setup = JSON.parse(window.localStorage?.getItem("cardDemoCardTestSetup") || "null");
      } catch (_error) {
        try { window.localStorage?.removeItem("cardDemoCardTestSetup"); } catch (_storageError) { /* ignore */ }
        return false;
      }
    }
    if (!setup || setup.version !== CORE_CARD_TEST_SCENE_VERSION
      || setup.cardDataVersion !== CORE_CARD_DATA_VERSION || !Array.isArray(setup.cards)) {
      if (fromStorage) {
        try { window.localStorage?.removeItem("cardDemoCardTestSetup"); } catch (_error) { /* ignore */ }
      }
      return false;
    }
    const firstCamp = (ownerId, fallback) => {
      const entry = setup.cards.find((card) => Number(card.ownerId) === ownerId);
      const template = entry && window.CARD_LIBRARY?.cardSlots?.find((card) => String(card.id) === String(entry.id));
      return template?.camp || fallback;
    };
    const game = coreCreateGame("pvp", {
      1: firstCamp(1, "三国~蜀"),
      2: firstCamp(2, "三国~魏")
    });
    const brokenCells = (setup.brokenCells || []).filter((cell) => coreIsInsideBoard(cell.row, cell.col, game)).slice(0, 5);
    const brokenKeys = new Set(brokenCells.map((cell) => cellKey(cell.row, cell.col)));
    const occupied = new Set();
    game.boardCards = [];
    setup.cards.forEach((entry) => {
      const template = window.CARD_LIBRARY?.cardSlots?.find((card) => String(card.id) === String(entry.id));
      const key = cellKey(entry.row, entry.col);
      if (!template || !coreIsInsideBoard(entry.row, entry.col, game) || brokenKeys.has(key) || occupied.has(key)) return;
      occupied.add(key);
      const card = cloneCard(makeCardTemplate(template));
      const currentAttack = Number(entry.attack);
      card.ownerId = Number(entry.ownerId) === 2 ? 2 : 1;
      card.row = entry.row;
      card.col = entry.col;
      card.attack = Number.isFinite(currentAttack) ? Math.max(0, currentAttack) : card.attack;
      card.currentAttack = card.attack;
      card.v2PermanentBonus = 0;
      card.v2TempBonus = 0;
      card.restedTurn = null;
      card.lastMovedTurn = null;
      game.boardCards.push(card);
    });
    game.brokenCells = brokenCells;
    game.players.forEach((player) => { player.hand = []; player.drawPile = []; });
    game.turn = 1;
    game.activePlayerId = 1;
    game.actionsUsed = 0;
    game.currentPhase = "行动阶段";
    game.roundLog = ["已从 Card Test 导入 V2 自定义场景。"];
    game.lastResolution = "玩家 1 可在此场面下验证 V2 放置、移动、交战与技能结算。";
    syncPlayerBoardIds(game);
    state.game = game;
    return true;
  }

  function coreBeginGame() {
    state.game = coreCreateGame(state.selectedMode, state.selectedDecks, state.selectedBoardSize);
    switchScreen("game");
    coreShowOpeningReveal(state.game);
  }

  function coreShowOpeningReveal(game) {
    const first = corePlayer(game, game.firstPlayerId);
    const second = corePlayer(game, otherPlayerId(game.firstPlayerId));
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="本局先后手">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">Opening Order</p>
        <h2 class="deck-reveal-title">${first.name} 获得先手</h2>
        <p class="deck-reveal-copy">${game.boardSize}x${game.boardSize} 战场；先手初始 2 张手牌；后手 ${second.name} 初始 3 张手牌。全局第 1 回合仅有 1 次行动，其余回合有 2 次行动。</p>
        <div class="deck-reveal-matchup">
          <article class="deck-reveal-side"><p class="label">${first.name} · 先手</p><h3>${getCampDisplayName(first.deckKey)}</h3><p>${summarizeDeck(first.deckCatalog, first.deckKey)}</p></article>
          <div class="deck-reveal-versus">VS</div>
          <article class="deck-reveal-side"><p class="label">${second.name} · 后手</p><h3>${getCampDisplayName(second.deckKey)}</h3><p>${summarizeDeck(second.deckCatalog, second.deckKey)}</p></article>
        </div>
        ${game.mode === "online" ? "" : '<button id="core-opening-start" class="primary-btn">开始第 1 回合</button>'}
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    document.getElementById("core-opening-start")?.addEventListener("click", () => {
      ui.deckReveal.classList.remove("visible");
      window.setTimeout(() => {
        ui.deckReveal.innerHTML = "";
        const wonAtStart = coreStartTurn(game);
        coreRender();
        if (wonAtStart) {
          coreAnimateVictoryCells(game, game.winner.playerId).then(() => showResult());
          return;
        }
        showPhaseBanner("先手行动", `第 1 / ${CORE_MAX_TURNS} 回合，${first.name} 先手行动。`);
        if (first.isAI) window.setTimeout(() => coreRunAiTurn(game), 650);
      }, 180);
    });
  }

  window.createGame = coreCreateGame;
  window.getActionLimit = coreActionLimit;
  window.getPlannerPlayer = (game) => corePlayer(game, game.activePlayerId);
  window.updateCurrentPlannerForMode = () => {
    if (state.game) state.game.activePlannerIndex = state.game.activePlayerId - 1;
  };
  window.getValidMoves = coreValidMoves;
  window.getPlacementAvailability = corePlacementAvailability;
  window.getPlaceableCells = (game) => corePlacementAvailability(game).cells;
  window.buildPendingAction = coreBuildPendingAction;
  window.computeControlMap = coreControlMap;
  window.resolveAttackValue = (_game, card) => (typeof card?.currentAttack === "number" ? card.currentAttack : card?.attack || 0);
  window.finishGameByTurnLimit = coreFinishTurnLimit;
  window.validateCoreV2CardData = coreValidateV2CardData;
  // The test runner loads a separate suite and accesses only this stable API.
  window.__CARD_DEMO_CORE_V2_TEST_API__ = Object.freeze({
    cloneCard, coreAdjustAttack, coreAiPlacementScore, coreApplyV2PlacementSkill,
    coreControlMap, coreCreateGame, coreDeserializeOnlineGame, coreDestroyV2Card,
    coreLoadCardTestSetup, corePlanAiAction, corePlayer, coreResolveSkillAttack,
    coreRunV2EndSkills, coreRunV2MoveEffects, coreRunV2StartSkill, coreSerializeOnlineGame, coreStartTurn,
    coreStripRuntimeDisplayData, coreTriggerOtherV2PlacementEffects, coreValidMoves,
    coreVictoryTarget, HAND_LIMIT, state
  });
  window.render = coreRender;
  window.renderBoard = coreRenderBoard;
  window.renderHand = coreRenderHand;
  window.handleHandCardClick = coreHandleHandClick;
  window.handleBoardClick = coreHandleBoardClick;
  window.submitCurrentAction = coreSubmitAction;
  window.maybeAutoPlanAI = () => {
    const game = state.game;
    if (game && corePlayer(game, game.activePlayerId)?.isAI) coreRunAiTurn(game);
  };
  window.startRandomGame = (mode) => {
    if (!coreRuntimeReady) {
      showToast("卡牌数据不可用", "请刷新页面以加载当前版本的卡牌数据与技能文件。");
      return;
    }
    state.selectedMode = mode;
    state.game = null;
    coreShowDeckSelector(mode);
  };
  window.beginGame = coreBeginGame;
  window.loadCardTestSetupForCore = coreLoadCardTestSetup;

  function coreHasExecutableAction(game) {
    const active = corePlayer(game, game.activePlayerId);
    if (!active || game.actionsUsed >= coreActionLimit(game)) return false;
    if (corePlacementAvailability(game).cells.length > 0 && active.hand.length > 0) return true;
    return game.boardCards.some((card) => card.ownerId === active.id && coreValidMoves(game, card).length > 0);
  }

  async function coreAnimateVictoryCells(game, winnerId) {
    const cells = [...ui.board.querySelectorAll(".cell")].filter((cell) => {
      const card = getBoardCardAt(game, Number(cell.dataset.row), Number(cell.dataset.col));
      return card && !card.isGuard && (winnerId === 0 || card.ownerId === winnerId);
    });
    for (const cell of cells) {
      cell.classList.add("victory-lit");
      await wait(120);
    }
    await wait(260);
  }

  coreUi.endTurnBtn.addEventListener("click", () => {
    const game = state.game;
    if (!game || game.isAnimating || game.winner) return;
    if (coreHasExecutableAction(game) && !window.confirm("本回合仍有可执行操作，确定要结束回合吗？")) return;
    if (game.mode === "online") {
      if (!window.CardOnline?.send({ type: "end-turn-request" })) showToast("联网未连接", "请等待联网服务连接后再结束回合。");
      return;
    }
    coreEndTurn();
  });
  coreUi.surrenderBtn?.addEventListener("click", async () => {
    const game = state.game;
    if (!game || game.isAnimating || game.winner) return;
    const active = corePlayer(game, game.activePlayerId);
    if (!active || active.isAI || !window.confirm(`确定让 ${active.name} 认输吗？认输后将立即判负，且无法撤销。`)) return;
    if (game.mode === "online") {
      if (!window.CardOnline?.send({ type: "surrender-request" })) showToast("联网未连接", "请等待联网服务连接后再认输。");
      return;
    }
    await coreSurrender(game);
  });
  ui.editPlayerIdBtn?.addEventListener("click", () => coreShowPlayerIdModal(false));
  coreInitializePlayerIdentity();
  const coreDataValidation = coreValidateV2CardData();
  coreRuntimeReady = coreDataValidation.cardDataVersion === CORE_CARD_DATA_VERSION
    && coreDataValidation.cardCount > 0
    && !coreDataValidation.duplicateIds.length
    && !coreDataValidation.invalidCards.length
    && !coreDataValidation.missingEffectIds.length;
  if (!coreRuntimeReady) {
    console.error("V2 卡牌运行时校验失败", coreDataValidation);
    if (ui.startGameBtn) {
      ui.startGameBtn.disabled = true;
      ui.startGameBtn.title = "卡牌数据或技能文件版本不完整，请刷新页面。";
    }
  }
  if (new URLSearchParams(window.location.search).get("card-test") === "1" && coreLoadCardTestSetup()) {
    switchScreen("game");
    coreRender();
    showToast("Card Test 场景已导入", "当前场景已切换为 V2 规则核心。");
  }
  window.__CARD_DEMO_CORE_V2__ = { coreCreateGame, coreStartTurn, coreResolveAction, coreEndTurn, coreSurrender, coreVictoryTarget, coreDataValidation };
})();
