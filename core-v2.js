/* Core Rules V2: sequential turns with V2 card skills enabled. */
(() => {
  const CORE_BOARD_SIZE = 4;
  const CORE_MAX_TURNS = 30;
  const CORE_FIRST_TURN_ACTIONS = 1;
  const CORE_STANDARD_ACTIONS = 2;
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

  function coreSkillEffectLines(card) {
    if (!card || card.isGuard) return ["无"];
    const lines = String(card.effect || "无技能效果。").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines.length ? lines : ["无技能效果。"];
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

  function coreSerializeOnlineGame(game) {
    return JSON.stringify(game, (_key, value) => value instanceof Set ? { __coreSet: [...value] } : value);
  }

  function coreDeserializeOnlineGame(serialized) {
    return JSON.parse(serialized, (_key, value) => value && value.__coreSet ? new Set(value.__coreSet) : value);
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

  function coreCanReduceAttack(game, card) {
    if (!card || !card.ownerId) return true;
    return !game?.boardCards?.some((unit) => unit.id === "0216" && unit.ownerId === card.ownerId);
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
          id: "guard", name: "守军", camp: "无势力", skill: "无",
          effect: "中立守军：双方均视为敌方卡牌。", attack, currentAttack: attack,
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
        if (card.id === "0215") card.v2ReplacedThisTurn = new Set();
        if (card.id === "0113") card.v2Protected = false;
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
    for (const card of snapshot) {
      if (card.ownerId !== active.id || !game.boardCards.includes(card)) continue;
      coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player: active, card });
      if (coreCheckVictory(game)) break;
    }
    coreEnforceZeroDestroy(game, game.roundLog);
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
    if (game && card.currentAttack === 0 && !game.enforcingZeroDestroy) coreEnforceZeroDestroy(game, game.roundLog || []);
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

  function coreEnforceZeroDestroy(game, log) {
    if (game.enforcingZeroDestroy || !game.boardCards.some((card) => card.id === "0214")) return;
    game.enforcingZeroDestroy = true;
    const sources = game.boardCards.filter((card) => card.id === "0214");
    let destroyedCount = 0;
    [...game.boardCards]
      .filter((card) => card.currentAttack <= 0 && sources.some((source) => source.uid !== card.uid))
      .forEach((card) => {
        if (game.boardCards.includes(card) && coreDestroyV2Card(game, card, log)) destroyedCount += 1;
      });
    if (destroyedCount) sources.filter((source) => game.boardCards.includes(source)).forEach((source) => coreAdjustAttack(source, destroyedCount));
    game.enforcingZeroDestroy = false;
  }

  function coreRunV2StartSkill(game, player, card) {
    const resolvingStartSkills = game.v2ResolvingStartSkills || new Set();
    game.v2ResolvingStartSkills = resolvingStartSkills;
    if (resolvingStartSkills.has(card.uid)) return;
    resolvingStartSkills.add(card.uid);
    try {
    const allies = getOrthogonalNeighbors(card.row, card.col).map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter((target) => target && target.ownerId === player.id);
    const enemies = coreEnemyNeighbors(game, card);
    if (card.id === "0101") coreAdjustAttack(card, allies.length, true);
    if (card.id === "0102") allies.forEach((ally) => coreAdjustAttack(ally, 1));
    if (card.id === "0103") { const max = Math.max(...allies.map((ally) => ally.currentAttack), -1); const target = corePickRandom(allies.filter((ally) => ally.currentAttack === max)); if (target) coreAdjustAttack(target, 1); }
    if (card.id === "0104") {
      const max = Math.max(...allies.map((ally) => ally.currentAttack), -1);
      const tied = allies.filter((ally) => ally.currentAttack === max);
      const candidates = tied.filter((ally) => coreEnemyNeighbors(game, ally).length);
      const pool = candidates.length ? candidates : tied;
      const attacker = corePickRandom(pool); const target = attacker && corePickRandom(coreEnemyNeighbors(game, attacker).filter((enemy) => coreCanCardsFight(game, attacker, enemy)));
      if (attacker && target) coreResolveSkillAttack(game, attacker, target, player, game.roundLog);
    }
    if (card.id === "0105" && enemies.length) coreAdjustAttack(card, 1);
    if (card.id === "0106") { const target = corePickRandom(enemies); if (target) coreAdjustAttack(target, -2, true); }
    if (card.id === "0107" && player.hand.length <= 3) drawOneCard(game, player);
    if (card.id === "0109" && enemies.length) coreAdjustAttack(card, 2, true);
    if (card.id === "0112" && enemies.length) coreAdjustAttack(card, 1, true);
    if (card.id === "0110") { const targets = game.boardCards.filter((target) => target.ownerId !== player.id && (target.row === card.row || target.col === card.col)); const target = corePickRandom(targets); if (target) coreAdjustAttack(target, -2, true); }
    if (card.id === "0111") { const own = game.boardCards.filter((target) => target.ownerId === player.id).length; const enemy = game.boardCards.filter((target) => target.ownerId !== player.id).length; if (own < enemy) coreAdjustAttack(card, 2, true); else allies.filter((ally) => ally.uid !== card.uid).forEach((ally) => coreAdjustAttack(ally, 1, true)); }
    if (card.id === "0113" && card.currentAttack < 4) coreSetAttack(game, card, 4, true);
    if (card.id === "0114") {
      [...game.boardCards]
        .filter((target) => target.ownerId === player.id && target.uid !== card.uid && game.boardCards.includes(target))
        .forEach((target) => coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player, card: target }));
    }
    if (card.id === "0115") {
      if (game.boardCards.filter((target) => target.ownerId === player.id).length < game.boardCards.filter((target) => target.ownerId !== player.id).length) game.extraActions = (game.extraActions || 0) + 1;
      else if (game.boardCards.filter((target) => target.ownerId === player.id).length > game.boardCards.filter((target) => target.ownerId !== player.id).length) game.boardCards.filter((target) => target.ownerId === player.id).forEach((ally) => coreAdjustAttack(ally, 1, true));
    }
    if (card.id === "0116") { coreAdjustAttack(card, 2, true); card.freeActionTurn = game.turn; }
    if (card.id === "0117") game.boardCards.filter((target) => target.uid !== card.uid && (target.row === card.row || target.col === card.col)).forEach((target) => coreAdjustAttack(target, -1));
    if (card.id === "0119") { const result = drawOneCard(game, player); if (result.status !== "drawn" && player.hand.length >= HAND_LIMIT) { const ally = corePickRandom(game.boardCards.filter((target) => target.ownerId === player.id && target.uid !== card.uid)); if (ally) coreAdjustAttack(ally, 2); } }
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
    if (!card || card.id !== "0114" || !card.ownerId) return false;
    const control = coreControlMap(game).counts;
    return control[card.ownerId] < control[otherPlayerId(card.ownerId)];
  }

  function coreCanCardsFight(game, attacker, defender) {
    return Boolean(attacker && defender && attacker.ownerId !== defender.ownerId && !coreIsFightLocked(game, attacker) && !coreIsFightLocked(game, defender));
  }

  function coreApplyV2PlacementSkill(game, player, card, log) {
    const allies = getOrthogonalNeighbors(card.row, card.col)
      .map((cell) => getBoardCardAt(game, cell.row, cell.col))
      .filter((target) => target && target.ownerId === player.id && target.uid !== card.uid);
    const enemies = coreEnemyNeighbors(game, card);
    if (card.id === "0120") {
      const startsAtTurn = coreNextOwnerTurn(game, player.id);
      game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => entry.sourceUid !== card.uid);
      getOrthogonalNeighbors(card.row, card.col)
        .filter((cell) => !getBoardCardAt(game, cell.row, cell.col) && !isBrokenCell(game, cell.row, cell.col))
        .forEach((cell) => game.v2ControlCells.push({ ...cell, ownerId: player.id, sourceUid: card.uid, persistent: true, startsAtTurn, untilTurn: Infinity }));
      if (game.v2ControlCells.some((entry) => entry.sourceUid === card.uid)) log.push(`${card.name} 将从下个己方回合起占领相邻空格。`);
    }
    if (["0201", "0205"].includes(card.id) && player.hand.length < HAND_LIMIT) {
      const enemy = corePlayer(game, otherPlayerId(player.id));
      if (card.id === "0205" || player.hand.length <= (enemy?.hand.length || 0)) {
        if (drawOneCard(game, player).status === "drawn") log.push(`${card.name} 触发放置技能，抽取 1 张牌。`);
      }
    }
    if (card.id === "0202") {
      const target = corePickRandom(enemies);
      if (target) { coreAdjustAttack(target, -1); log.push(`${card.name} 使相邻敌方 ${target.name} 永久战力-1。`); }
    }
    if (["0203", "0204"].includes(card.id)) {
      const targets = card.id === "0203" ? [corePickRandom(allies)].filter(Boolean) : allies;
      targets.forEach((target) => coreAdjustAttack(target, 1));
      if (targets.length) log.push(`${card.name} 使相邻友军战力永久+1。`);
    }
    if (card.id === "0206" && (card.row === 0 || card.row === coreBoardSize(game) - 1 || card.col === 0 || card.col === coreBoardSize(game) - 1)) {
      coreAdjustAttack(card, 1); log.push(`${card.name} 位于边缘，战力永久+1。`);
    }
    if (card.id === "0207") {
      const seen = new Set([card.uid]); const queue = [...allies];
      while (queue.length) { const target = queue.shift(); if (!target || seen.has(target.uid)) continue; seen.add(target.uid); coreAdjustAttack(target, 1, true); getOrthogonalNeighbors(target.row, target.col).map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter((next) => next && next.ownerId === player.id && !seen.has(next.uid)).forEach((next) => queue.push(next)); }
      if (seen.size > 1) log.push(`${card.name} 使相连友军本回合战力+1。`);
    }
    if (card.id === "0208") {
      const enemy = corePlayer(game, otherPlayerId(player.id));
      if (enemy?.hand.length) { enemy.hand.splice(randomInt(0, enemy.hand.length - 1), 1); log.push(`${card.name} 使敌方随机弃置 1 张手牌。`); }
    }
    if (card.id === "0209") {
      const target = corePickRandom(allies);
      if (target) {
        const cardFrom = { row: card.row, col: card.col }; const targetFrom = { row: target.row, col: target.col };
        card.row = targetFrom.row; card.col = targetFrom.col; target.row = cardFrom.row; target.col = cardFrom.col;
        coreAdjustAttack(card, 1); coreAdjustAttack(target, 1);
        if (typeof queueSkillMoveAnimation === "function") { queueSkillMoveAnimation(game, card, cardFrom, { row: card.row, col: card.col }, "技能交换"); queueSkillMoveAnimation(game, target, targetFrom, { row: target.row, col: target.col }, "技能交换"); }
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card, source: cardFrom, target: { row: card.row, col: card.col } });
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card: target, source: targetFrom, target: { row: target.row, col: target.col } });
        log.push(`${card.name} 与 ${target.name} 交换位置，双方战力永久+1。`);
      }
    }
    if (card.id === "0213") {
      let zeroedCount = 0;
      enemies.forEach((target) => { const before = target.currentAttack; coreAdjustAttack(target, -2, true); if (before > 0 && target.currentAttack === 0) { coreAdjustAttack(card, 1); zeroedCount += 1; } });
      if (enemies.length) log.push(`${card.name} 使 ${enemies.length} 张相邻敌军本回合战力-2${zeroedCount ? `，自身永久战力+${zeroedCount}` : ""}。`);
    }
    if (card.id === "0216") {
      const allOtherAllies = game.boardCards.filter((target) => target.ownerId === player.id && target.uid !== card.uid);
      allOtherAllies.forEach((target) => coreAdjustAttack(target, 1));
      card.v2Commander = true;
      if (allOtherAllies.length) log.push(`${card.name} 使所有其他友军战力永久+1。`);
    }
    if (card.id === "0217") {
      const target = corePickRandom(enemies);
      if (target) {
        [card, target]
          .sort((left, right) => game.boardCards.indexOf(left) - game.boardCards.indexOf(right))
          .forEach((participant) => coreDestroyV2Card(game, participant, log, participant === card ? target : card));
      }
    }
    if (card.id === "0218") {
      const handBefore = player.hand.length;
      while (player.hand.length < HAND_LIMIT && player.drawPile.length) drawOneCard(game, player);
      if (player.hand.length > handBefore) log.push(`${card.name} 抽取 ${player.hand.length - handBefore} 张牌。`);
    }
    if (card.id === "0219") {
      allies.forEach((target) => coreAdjustAttack(target, 1, true));
      const orderedAllies = [...allies].sort((a, b) => game.boardCards.indexOf(a) - game.boardCards.indexOf(b));
      orderedAllies.forEach((ally) => {
        if (!game.boardCards.includes(ally)) return;
        const target = corePickRandom(coreEnemyNeighbors(game, ally).filter((enemy) => coreCanCardsFight(game, ally, enemy)));
        if (target) {
          log.push(`${card.name} 令 ${ally.name} 自动攻击 ${target.name}。`);
          coreResolveSkillAttack(game, ally, target, player, log);
        }
      });
      if (allies.length) log.push(`${card.name} 使相邻友军本回合战力+1，并按放置顺序自动攻击。`);
    }
    if (card.id === "0212") { player.v2NextPlacementExtra = card.uid; log.push(`${card.name} 使本回合下一张友军的放置技能额外结算1次。`); }
    if (card.id === "0214") {
      if (!game.boardCards.some((target) => target.uid !== card.uid && target.currentAttack === 0)) game.boardCards.filter((target) => target.uid !== card.uid).forEach((target) => coreAdjustAttack(target, -1));
      coreEnforceZeroDestroy(game, log);
    }
    if (card.id === "0215") { card.v2ReplacedThisTurn = new Set(); log.push(`${card.name} 本回合将尝试重新放置被摧毁的其他友军。`); }
    if (card.id === "0220") card.v2AdjacencyWatcher = true;
    if (card.id === "0108") {
      allies.forEach((target) => coreRunSingleStartSkill(game, player, target, log));
    }
  }

  function coreTriggerOtherV2PlacementEffects(game, player, placedCard, log) {
    const watchers = game.boardCards.filter((card) => card.ownerId === player.id && card.uid !== placedCard.uid);
    watchers.filter((card) => card.id === "0215" && card.currentAttack < 3).forEach((card) => coreAdjustAttack(card, 2));
    const commanders = watchers.filter((card) => card.id === "0216");
    commanders.forEach((card) => coreAdjustAttack(card, 1));
    if (commanders.length) log.push(`${commanders.map((card) => card.name).join("、")} 因友军 ${placedCard.name} 放置，战力永久+1。`);
    watchers.filter((card) => card.id === "0220" && Math.abs(card.row - placedCard.row) <= 1 && Math.abs(card.col - placedCard.col) <= 1).forEach((card) => coreAdjustAttack(card, 1));
  }

  function coreRunSingleStartSkill(game, player, card, log) {
    if (!card || !game.boardCards.includes(card)) return;
    coreRunV2StartSkill(game, player, card);
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
    const seen = new Set();
    const duplicateIds = [];
    const invalidCards = [];
    cards.forEach((card) => {
      if (seen.has(card.id)) duplicateIds.push(card.id);
      seen.add(card.id);
      if (!card.id || !card.name || !Number.isFinite(Number(card.attack)) || !card.effect || !card.rarity) invalidCards.push(card.id || "<missing-id>");
    });
    return { cardCount: cards.length, duplicateIds, invalidCards };
  }

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
      const occupiedA = makeCard("0101", 1, 0, 0);
      const occupiedB = makeCard("0102", 2, 0, 1);
      const controlGame = makeGame([occupiedA, occupiedB]);
      controlGame.v2ControlCells = [
        { row: 1, col: 1, ownerId: 1, sourceUid: "a", untilTurn: 9 },
        { row: 1, col: 1, ownerId: 1, sourceUid: "b", untilTurn: 9 },
        { row: 1, col: 2, ownerId: 1, sourceUid: "c", untilTurn: 9 },
        { row: 1, col: 2, ownerId: 2, sourceUid: "d", untilTurn: 9 }
      ];
      check("占领格重复与争议去重", coreControlMap(controlGame).counts[1] === 2 && coreControlMap(controlGame).counts[2] === 1);

      const caoCao = makeCard("0216", 1, 0, 0);
      const placed = makeCard("0205", 1, 1, 1);
      const placementGame = makeGame([caoCao, placed]); state.game = placementGame;
      coreTriggerOtherV2PlacementEffects(placementGame, placementGame.players[0], placed, []);
      check("曹操在友军放置后永久加一", caoCao.currentAttack === 1);

      const remoteAlly = makeCard("0205", 1, 3, 3);
      const commanderGame = makeGame([caoCao, placed, remoteAlly]); state.game = commanderGame;
      coreApplyV2PlacementSkill(commanderGame, commanderGame.players[0], caoCao, []);
      check("曹操放置时强化所有其他友军", placed.currentAttack === placed.attack + 1 && remoteAlly.currentAttack === remoteAlly.attack + 1);
      coreAdjustAttack(remoteAlly, -1);
      check("曹操在场时阻止友军战力降低", remoteAlly.currentAttack === remoteAlly.attack + 1);

      const grain = makeCard("0107", 1, 0, 0);
      const grainGame = makeGame([grain]); grainGame.players[0].drawPile = [makeCard("0101", 1, null, null)]; state.game = grainGame;
      coreRunV2StartSkill(grainGame, grainGame.players[0], grain);
      check("糜芳手牌不超过三张时抽牌", grainGame.players[0].hand.length === 1);

      const charge = makeCard("0109", 1, 1, 1);
      const threat = makeCard("0101", 2, 0, 1);
      const chargeGame = makeGame([charge, threat]); chargeGame.activePlayerId = 1;
      check("马超相邻敌军时获得两格移动", coreValidMoves(chargeGame, charge).some((cell) => cell.row === 3 && cell.col === 1));

      const raider = makeCard("0211", 1, 0, 0);
      const raiderGame = makeGame([raider]); raiderGame.activePlayerId = 1;
      check("夏侯渊首次可远袭", coreValidMoves(raiderGame, raider).some((cell) => cell.row === 0 && cell.col === 2));
      raider.v2LongMoveUsed = true;
      check("夏侯渊远袭使用后恢复一格移动", !coreValidMoves(raiderGame, raider).some((cell) => cell.row === 0 && cell.col === 2));

      const commander = makeCard("0214", 1, 0, 0);
      const zero = makeCard("0205", 2, 0, 1); zero.currentAttack = 0;
      const zeroGame = makeGame([commander, zero]); state.game = zeroGame;
      coreEnforceZeroDestroy(zeroGame, []);
      check("司马懿摧毁归零卡牌后永久加一", commander.currentAttack === 1 && !zeroGame.boardCards.includes(zero));

      const order = makeCard("0219", 1, 0, 0);
      const ally = makeCard("0101", 1, 0, 1);
      const enemy = makeCard("0102", 2, 0, 2);
      const attackGame = makeGame([order, ally, enemy]); state.game = attackGame;
      coreApplyV2PlacementSkill(attackGame, attackGame.players[0], order, []);
      check("奉诏征伐触发相邻友军自动攻击", !attackGame.boardCards.includes(enemy));

      const firstArray = makeCard("0118", 1, 0, 0);
      const secondArray = makeCard("0118", 1, 0, 1);
      const arrayGame = makeGame([firstArray, secondArray]); state.game = arrayGame;
      coreDestroyV2Card(arrayGame, firstArray, [], null);
      check("八阵图不会代替另一张八阵图被摧毁", !arrayGame.boardCards.includes(firstArray) && arrayGame.boardCards.includes(secondArray));

      const wangPing = makeCard("0102", 1, 1, 1);
      const movementGame = makeGame([wangPing]); movementGame.activePlayerId = 1;
      check("王平保留基础四向移动", coreValidMoves(movementGame, wangPing).some((cell) => cell.row === 1 && cell.col === 2));

      const jiangWei = makeCard("0111", 1, 1, 1); jiangWei.currentAttack = 3;
      const jiangWeiGame = makeGame([jiangWei]); jiangWeiGame.activePlayerId = 1;
      check("姜维不保留旧版斜向移动", !coreValidMoves(jiangWeiGame, jiangWei).some((cell) => cell.row === 0 && cell.col === 0));

      const zhuge = makeCard("0114", 1, 0, 0);
      const attacker = makeCard("0205", 2, 0, 1);
      const secondEnemy = makeCard("0201", 2, 1, 1);
      const zhugeGame = makeGame([zhuge, attacker, secondEnemy]); zhugeGame.activePlayerId = 2;
      check("诸葛亮占领落后时双方不能主动与其交战", !coreValidMoves(zhugeGame, attacker).some((cell) => cell.row === 0 && cell.col === 0));
      coreResolveSkillAttack(zhugeGame, attacker, zhuge, zhugeGame.players[1], []);
      check("诸葛亮不可交战状态同样阻止技能攻击", zhugeGame.boardCards.includes(zhuge) && zhugeGame.boardCards.includes(attacker));

      const edict = makeCard("0120", 1, 1, 1);
      const edictGame = makeGame([edict]); edictGame.activePlayerId = 1; state.game = edictGame;
      coreApplyV2PlacementSkill(edictGame, edictGame.players[0], edict, []);
      check("昭烈仁德令从下个己方回合开始占领", edictGame.v2ControlCells.length === 4 && edictGame.v2ControlCells.every((entry) => entry.startsAtTurn === 3));

      const activeCard = makeCard("0101", 1, 0, 0);
      const offTurnCard = makeCard("0301", 2, 0, 1); offTurnCard.v2TempBonus = 2; offTurnCard.currentAttack += 2;
      const expiryGame = makeGame([activeCard, offTurnCard]); state.game = expiryGame;
      coreRunV2EndSkills(expiryGame, expiryGame.players[0], []);
      check("敌方回合获得的临时战力在本回合结束时清除", offTurnCard.currentAttack === offTurnCard.attack);

      const hanDang = makeCard("0301", 1, 0, 0);
      const zhenJi = makeCard("0215", 1, 2, 2); zhenJi.v2ReplacedThisTurn = new Set();
      const wuAlly = makeCard("0101", 1, 0, 1);
      const reentryGame = makeGame([hanDang, zhenJi, wuAlly]); state.game = reentryGame;
      coreDestroyV2Card(reentryGame, hanDang, [], null);
      check("甄姬重新放置不会跳过吴国摧毁效果", reentryGame.boardCards.includes(hanDang) && zhenJi.currentAttack + wuAlly.currentAttack === 5);

      const simaYi = makeCard("0214", 1, 0, 0);
      const fragileTarget = makeCard("0205", 2, 0, 1);
      const zeroTriggerGame = makeGame([simaYi, fragileTarget]); state.game = zeroTriggerGame;
      coreAdjustAttack(fragileTarget, -1, true);
      check("司马懿会响应任意减益造成的归零", !zeroTriggerGame.boardCards.includes(fragileTarget) && simaYi.currentAttack === 1);

      const supply = makeCard("0119", 1, 0, 0);
      const remoteSupplyAlly = makeCard("0101", 1, 3, 3);
      const supplyGame = makeGame([supply, remoteSupplyAlly]); supplyGame.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("0101", 1, null, null)); state.game = supplyGame;
      coreRunV2StartSkill(supplyGame, supplyGame.players[0], supply);
      check("木牛流马满手时可强化非相邻友军", remoteSupplyAlly.currentAttack === remoteSupplyAlly.attack + 2);

      const pangTong = makeCard("0115", 1, 0, 0);
      const equalEnemy = makeCard("0201", 2, 0, 1);
      const pangTongGame = makeGame([pangTong, equalEnemy]); state.game = pangTongGame;
      coreRunV2StartSkill(pangTongGame, pangTongGame.players[0], pangTong);
      check("庞统双方卡牌数相同时不触发强化", pangTong.currentAttack === pangTong.attack && !pangTongGame.extraActions);

      const zhaoYun = makeCard("0113", 1, 0, 0);
      const zhaoYunGame = makeGame([zhaoYun]); state.game = zhaoYunGame;
      zhaoYun.v2Protected = true;
      coreRunV2EndSkills(zhaoYunGame, zhaoYunGame.players[0], []);
      check("赵云的免毁次数在己方回合结束时失效", zhaoYun.v2Protected === false);

      const leJin = makeCard("0212", 1, 0, 0);
      const leJinGame = makeGame([leJin]); leJinGame.players[0].v2NextPlacementExtra = leJin.uid; state.game = leJinGame;
      coreRunV2EndSkills(leJinGame, leJinGame.players[0], []);
      check("乐进的额外放置结算不会跨回合保留", !leJinGame.players[0].v2NextPlacementExtra);

      const endSimaYi = makeCard("0214", 1, 0, 0);
      const changedEnemy = makeCard("0201", 2, 0, 1); changedEnemy.v2StartTurn = 1; changedEnemy.v2StartAttack = changedEnemy.attack; changedEnemy.v2TempBonus = 1; changedEnemy.currentAttack += 1;
      const simaEndGame = makeGame([endSimaYi, changedEnemy]); state.game = simaEndGame;
      coreRunV2EndSkills(simaEndGame, simaEndGame.players[0], []);
      check("司马懿回合结束时会削弱满足条件的敌方卡牌", changedEnemy.currentAttack === changedEnemy.attack - 1);

      const fireBoat = makeCard("0318", 1, 1, 1);
      const brokenLimitGame = makeGame([fireBoat]); brokenLimitGame.brokenCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 0 }]; state.game = brokenLimitGame;
      coreDestroyV2Card(brokenLimitGame, fireBoat, [], null);
      check("破坏格达到上限后不再生成", brokenLimitGame.brokenCells.length === 5);

      const river = makeCard("0319", 1, 1, 1);
      const lockGame = makeGame([river]); lockGame.turn = 1; lockGame.activePlayerId = 1; state.game = lockGame;
      coreDestroyV2Card(lockGame, river, [], null);
      const lockedOnEnemyTurn = !corePlacementAvailability(lockGame, 2).cells.some((cell) => cell.row === 1 && cell.col === 0);
      lockGame.turn = 4; lockGame.activePlayerId = 2; coreStartTurn(lockGame);
      const releasedAfterOwnerTurn = corePlacementAvailability(lockGame, 2).cells.some((cell) => cell.row === 1 && cell.col === 0);
      check("长江天险在下个己方回合结束后解除封锁", lockedOnEnemyTurn && releasedAfterOwnerTurn);

      const weiYan = makeCard("0108", 1, 1, 1);
      const zhugeLiang = makeCard("0114", 1, 1, 2);
      const reentryGuardGame = makeGame([weiYan, zhugeLiang]); state.game = reentryGuardGame;
      coreApplyV2PlacementSkill(reentryGuardGame, reentryGuardGame.players[0], weiYan, []);
      check("魏延与诸葛亮相邻时不会无限递归", reentryGuardGame.v2ResolvingStartSkills.size === 0);

      const aiWinningCards = [];
      for (let index = 0; index < 8; index += 1) aiWinningCards.push(makeCard("0205", 2, Math.floor(index / 4), index % 4));
      const aiWinGame = makeGame(aiWinningCards); aiWinGame.activePlayerId = 2; aiWinGame.players[1].hand = [makeCard("0205", 2, null, null)];
      const aiWinningAction = corePlanAiAction(aiWinGame, aiWinGame.players[1]);
      check("AI优先选择可立即达成占领胜利的放置", aiWinningAction?.type === "place");

      const tigerCavalry = makeCard("0217", 1, null, null);
      const weakTarget = makeCard("0205", 2, 1, 2);
      const strongTarget = makeCard("0316", 2, 1, 2);
      const weakTradeGame = makeGame([weakTarget]);
      const strongTradeGame = makeGame([strongTarget]);
      check("AI虎豹骑更愿意交换高战力敌军", coreAiPlacementScore(strongTradeGame, strongTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }) > coreAiPlacementScore(weakTradeGame, weakTradeGame.players[0], tigerCavalry, { row: 1, col: 1 }));

      const imported = coreLoadCardTestSetup({
        cards: [
          { id: "0101", ownerId: 1, row: 1, col: 1, attack: 6 },
          { id: "0201", ownerId: 2, row: 2, col: 2, attack: 2 },
          { id: "0301", ownerId: 1, row: 1, col: 1, attack: 2 }
        ],
        brokenCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 }, { row: 1, col: 0 }, { row: 1, col: 3 }]
      });
      check("Card Test 场景会以 V2 核心导入并过滤非法重叠", imported && state.game.ruleset === "core-v2" && state.game.boardCards.length === 2 && state.game.boardCards[0].attack === 6 && state.game.brokenCells.length === 5);

      const winningCards = [];
      for (let index = 0; index < 9; index += 1) winningCards.push(makeCard("0218", 1, Math.floor(index / 4), index % 4));
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
      { const a = makeCard("0101", 1, 1, 1), ally = makeCard("0102", 1, 1, 2), g = makeGame([a, ally]); start(g, a); check("0101", "相邻友军提供临时战力", a.currentAttack === a.attack + 1); }
      { const a = makeCard("0102", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); start(g, a); check("0102", "相邻友军永久强化", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0103", 1, 1, 1), weak = makeCard("0101", 1, 1, 0), high = makeCard("0110", 1, 1, 2), g = makeGame([a, weak, high]); start(g, a); check("0103", "仅最高相邻友军获得强化", high.currentAttack === high.attack + 1 && weak.currentAttack === weak.attack); }
      { const a = makeCard("0104", 1, 1, 1), ally = makeCard("0110", 1, 1, 2), enemy = makeCard("0205", 2, 1, 3), g = makeGame([a, ally, enemy]); start(g, a); check("0104", "相邻最高友军自动攻击", !g.boardCards.includes(enemy)); }
      { const a = makeCard("0105", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("0105", "相邻敌军触发永久强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("0106", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("0106", "随机相邻敌军获得本回合减益", enemy.currentAttack === 0); }
      { const a = makeCard("0107", 1, 1, 1), g = makeGame([a]); g.players[0].hand = Array.from({ length: 3 }, () => makeCard("0101", 1, null, null)); g.players[0].drawPile = [makeCard("0101", 1, null, null)]; start(g, a); check("0107", "手牌等于三张时仍可额外抽牌", g.players[0].hand.length === 4); }
      { const a = makeCard("0108", 1, 1, 1), ally = makeCard("0102", 1, 1, 2), target = makeCard("0101", 1, 1, 3), g = makeGame([a, ally, target]); place(g, a); check("0108", "放置时触发相邻友军的开始技能", target.currentAttack === target.attack + 1); }
      { const a = makeCard("0109", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("0109", "相邻敌军强化且可两格直线移动", a.currentAttack === a.attack + 2 && coreValidMoves(g, a).some((cell) => cell.row === 3 && cell.col === 1)); }
      { const a = makeCard("0110", 1, 1, 1), diagonal = makeCard("0205", 2, 0, 0), other = makeCard("0205", 2, 2, 1), g = makeGame([a, diagonal, other]); start(g, a); check("0110", "同行或同列敌军会被烈弓选中", diagonal.currentAttack === diagonal.attack && other.currentAttack === 0); }
      { const a = makeCard("0111", 1, 1, 1), enemyA = makeCard("0201", 2, 0, 0), enemyB = makeCard("0201", 2, 0, 1), g = makeGame([a, enemyA, enemyB]); start(g, a); check("0111", "我方卡牌较少时强化自身", a.currentAttack === a.attack + 2); }
      { const a = makeCard("0112", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); start(g, a); check("0112", "相邻敌军触发本回合强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("0113", 1, 1, 1), g = makeGame([a]); a.currentAttack = 2; start(g, a); const restoredAtStart = a.currentAttack === 4; const protectedFirst = !destroy(g, a) && a.currentAttack === 1; const destroyedSecond = destroy(g, a); check("0113", "低战力恢复且免毁仅限本回合一次", restoredAtStart && protectedFirst && destroyedSecond && !g.boardCards.includes(a)); }
      { const a = makeCard("0114", 1, 1, 1), ally = makeCard("0105", 1, 1, 2), enemy = makeCard("0205", 2, 1, 3), g = makeGame([a, ally, enemy]); start(g, a); check("0114", "其他友军开始技能额外结算", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0115", 1, 1, 1), enemyA = makeCard("0201", 2, 0, 0), enemyB = makeCard("0201", 2, 0, 1), g = makeGame([a, enemyA, enemyB]); start(g, a); check("0115", "卡牌较少时增加行动位", g.extraActions === 1); }
      { const a = makeCard("0116", 1, 1, 1), g = makeGame([a]); start(g, a); check("0116", "回合开始强化并标记免费行动", a.currentAttack === a.attack + 2 && a.freeActionTurn === g.turn); }
      { const a = makeCard("0117", 1, 1, 1), row = makeCard("0201", 2, 1, 3), col = makeCard("0201", 2, 3, 1), diagonal = makeCard("0201", 2, 2, 2), g = makeGame([a, row, col, diagonal]); start(g, a); check("0117", "仅同行同列卡牌被永久削弱", row.currentAttack === row.attack - 1 && col.currentAttack === col.attack - 1 && diagonal.currentAttack === diagonal.attack); }
      { const a = makeCard("0118", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); const saved = !destroy(g, ally); check("0118", "代替相邻友军被摧毁", saved && !g.boardCards.includes(a) && g.boardCards.includes(ally)); }
      { const a = makeCard("0119", 1, 0, 0), ally = makeCard("0101", 1, 3, 3), g = makeGame([a, ally]); g.players[0].hand = Array.from({ length: HAND_LIMIT }, () => makeCard("0101", 1, null, null)); start(g, a); check("0119", "满手时改为强化任意其他友军", ally.currentAttack === ally.attack + 2); }
      { const a = makeCard("0120", 1, 1, 1), g = makeGame([a]); place(g, a); check("0120", "相邻空格从下个己方回合开始占领", g.v2ControlCells.length === 4 && g.v2ControlCells.every((entry) => entry.startsAtTurn === 3)); }

      // Wei: placement, protection and movement boundaries.
      { const a = makeCard("0201", 1, 1, 1), g = makeGame([a]); g.players[0].drawPile = [makeCard("0101", 1, null, null)]; g.players[1].hand = [makeCard("0201", 2, null, null)]; place(g, a); check("0201", "手牌不多于敌方时放置抽牌", g.players[0].hand.length === 1); }
      { const a = makeCard("0202", 1, 1, 1), enemy = makeCard("0101", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("0202", "放置时永久削弱相邻敌军", enemy.currentAttack === enemy.attack - 1); }
      { const a = makeCard("0203", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); place(g, a); check("0203", "放置时强化随机相邻友军", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0204", 1, 1, 1), left = makeCard("0101", 1, 1, 0), right = makeCard("0101", 1, 1, 2), g = makeGame([a, left, right]); place(g, a); check("0204", "放置时强化全部相邻友军", left.currentAttack === left.attack + 1 && right.currentAttack === right.attack + 1); }
      { const a = makeCard("0205", 1, 1, 1), g = makeGame([a]); g.players[0].drawPile = [makeCard("0101", 1, null, null)]; place(g, a); check("0205", "手牌未满时放置抽牌", g.players[0].hand.length === 1); }
      { const a = makeCard("0206", 1, 0, 1), g = makeGame([a]); place(g, a); check("0206", "边缘放置获得永久强化", a.currentAttack === a.attack + 1); }
      { const a = makeCard("0207", 1, 1, 1), allyA = makeCard("0101", 1, 1, 2), allyB = makeCard("0101", 1, 1, 3), g = makeGame([a, allyA, allyB]); place(g, a); check("0207", "连续连接友军获得临时强化", allyA.currentAttack === allyA.attack + 1 && allyB.currentAttack === allyB.attack + 1); }
      { const a = makeCard("0208", 1, 1, 1), g = makeGame([a]); g.players[1].hand = [makeCard("0101", 2, null, null)]; place(g, a); check("0208", "放置时敌方随机弃置手牌", g.players[1].hand.length === 0); }
      { const a = makeCard("0209", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); place(g, a); check("0209", "放置时交换相邻友军并强化双方", a.col === 2 && ally.col === 1 && a.currentAttack === a.attack + 1 && ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0210", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); const saved = !destroy(g, ally); check("0210", "相邻高战力友军改为归零保留", saved && ally.currentAttack === 0 && g.boardCards.includes(ally)); }
      { const a = makeCard("0211", 1, 0, 0), g = makeGame([a]); check("0211", "首次主动移动允许远距离直线移动", coreValidMoves(g, a).some((cell) => cell.row === 0 && cell.col === 3)); }
      { const a = makeCard("0212", 1, 1, 1), g = makeGame([a]); place(g, a); check("0212", "放置后标记下一张友军额外结算", g.players[0].v2NextPlacementExtra === a.uid); }
      { const a = makeCard("0213", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("0213", "敌军因放置减益归零时强化自身", enemy.currentAttack === 0 && a.currentAttack === a.attack + 1); }
      { const a = makeCard("0214", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("0214", "放置后摧毁其他归零卡牌并强化自身", !g.boardCards.includes(enemy) && a.currentAttack === a.attack + 1); }
      { const a = makeCard("0215", 1, 1, 1), placed = makeCard("0101", 1, 3, 3), g = makeGame([a, placed]); coreTriggerOtherV2PlacementEffects(g, g.players[0], placed, []); check("0215", "其他友军放置时自身低于三则强化", a.currentAttack === 2); }
      { const a = makeCard("0216", 1, 1, 1), ally = makeCard("0101", 1, 3, 3), g = makeGame([a, ally]); place(g, a); coreAdjustAttack(ally, -1); check("0216", "全场强化友军且阻止我方减益", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0217", 1, 1, 1), enemy = makeCard("0101", 2, 1, 2), g = makeGame([a, enemy]); place(g, a); check("0217", "放置时与相邻敌军同时摧毁", !g.boardCards.includes(a) && !g.boardCards.includes(enemy)); }
      { const a = makeCard("0218", 1, 1, 1), g = makeGame([a]); g.players[0].hand = [makeCard("0101", 1, null, null), makeCard("0101", 1, null, null)]; g.players[0].drawPile = [makeCard("0101", 1, null, null), makeCard("0101", 1, null, null), makeCard("0101", 1, null, null)]; place(g, a); check("0218", "放置时抽牌至手牌上限", g.players[0].hand.length === HAND_LIMIT); }
      { const a = makeCard("0219", 1, 1, 1), ally = makeCard("0110", 1, 1, 2), enemy = makeCard("0205", 2, 1, 3), g = makeGame([a, ally, enemy]); place(g, a); check("0219", "相邻友军强化后自动攻击", !g.boardCards.includes(enemy) && ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0220", 1, 1, 1), ally = makeCard("0101", 1, 2, 2), g = makeGame([a, ally]); coreTriggerOtherV2PlacementEffects(g, g.players[0], ally, []); coreRunV2MoveEffects(g, ally, { row: 2, col: 2 }, { row: 3, col: 2 }, true); check("0220", "相邻放置强化且成功离开相邻区域削弱", a.currentAttack === a.attack); }

      // Wu: destruction effects and their target boundaries.
      { const a = makeCard("0301", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); check("0301", "被摧毁时给予其他友军临时强化", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0302", 1, 1, 1), g = makeGame([a]); const first = !destroy(g, a); const second = destroy(g, a); check("0302", "仅首次被摧毁时保留在原格", first && second && !g.boardCards.includes(a)); }
      { const a = makeCard("0303", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); const saved = !destroy(g, ally); check("0303", "被摧毁时赋予友军一次免毁", saved && ally.currentAttack === 1); }
      { const a = makeCard("0304", 1, 1, 1), cause = makeCard("0201", 2, 1, 2), g = makeGame([a, cause]); destroy(g, a, cause); check("0304", "被摧毁时永久削弱仍在场的摧毁者", cause.currentAttack === cause.attack - 1); }
      { const a = makeCard("0305", 1, 1, 1), cause = makeCard("0201", 2, 1, 2), g = makeGame([a, cause]); destroy(g, a, cause); check("0305", "被摧毁时临时削弱摧毁者", cause.currentAttack === 0); }
      { const a = makeCard("0306", 1, 1, 1), g = makeGame([a]); destroy(g, a); check("0306", "被摧毁时临时占领相邻空格", g.v2ControlCells.length === 1); }
      { const a = makeCard("0307", 1, 1, 1), g = makeGame([a]); g.players[1].hand = [makeCard("0201", 2, null, null)]; destroy(g, a); check("0307", "被摧毁时敌方弃置一张手牌", g.players[1].hand.length === 0); }
      { const a = makeCard("0308", 1, 1, 1), cause = makeCard("0201", 2, 1, 2), g = makeGame([a, cause]); destroy(g, a, cause); check("0308", "被摧毁时永久削弱摧毁者两点", cause.currentAttack === cause.attack - 2); }
      { const a = makeCard("0309", 1, 1, 1), g = makeGame([a]); destroy(g, a); check("0309", "被摧毁时原格生成己方援兵", g.boardCards.length === 1 && g.boardCards[0].name === "援兵" && g.boardCards[0].ownerId === 1); }
      { const a = makeCard("0310", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); check("0310", "被摧毁时永久强化相邻友军", ally.currentAttack === ally.attack + 2); }
      { const a = makeCard("0311", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), enemyA = makeCard("0201", 2, 0, 0), enemyB = makeCard("0201", 2, 0, 1), g = makeGame([a, ally, enemyA, enemyB]); destroy(g, a); check("0311", "己方劣势时被摧毁强化其他友军", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0312", 1, 1, 1), cause = makeCard("0201", 2, 1, 2), g = makeGame([a, cause]); destroy(g, a, cause); check("0312", "被摧毁时锁定并永久削弱摧毁者", g.moveLocks[cause.uid] && cause.currentAttack === cause.attack - 1); }
      { const a = makeCard("0313", 1, 1, 1), enemy = makeCard("0205", 2, 1, 2), g = makeGame([a, enemy]); destroy(g, a); check("0313", "被摧毁时摧毁减益后归零的敌军", !g.boardCards.includes(enemy)); }
      { const a = makeCard("0314", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); g.players[1].hand = [makeCard("0201", 2, null, null), makeCard("0201", 2, null, null)]; destroy(g, a); check("0314", "被摧毁时弃置至多两张敌方手牌并强化友军", g.players[1].hand.length === 0 && ally.currentAttack === ally.attack + 2); }
      { const a = makeCard("0315", 1, 1, 1), low = makeCard("0205", 2, 1, 2), high = makeCard("0316", 2, 2, 2), g = makeGame([a, low, high]); destroy(g, a); check("0315", "仅摧毁八方相邻且战力不高于二的敌军", !g.boardCards.includes(low) && g.boardCards.includes(high)); }
      { const a = makeCard("0316", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); const first = !destroy(g, a); const second = destroy(g, a); check("0316", "首次保留，第二次摧毁改为强化友军", first && second && ally.currentAttack === ally.attack + 2); }
      { const a = makeCard("0317", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), g = makeGame([a, ally]); destroy(g, a); check("0317", "被摧毁时强化全部其他友军", ally.currentAttack === ally.attack + 1); }
      { const a = makeCard("0318", 1, 1, 1), g = makeGame([a]); destroy(g, a); check("0318", "被摧毁时原格生成破坏格", g.brokenCells.some((cell) => cell.row === 1 && cell.col === 1)); }
      { const a = makeCard("0319", 1, 1, 1), g = makeGame([a]); destroy(g, a); check("0319", "被摧毁时仅封锁相邻敌方放置", g.v2PlacementLocks.length === 4 && corePlacementAvailability(g, 2).cells.length === 12 && corePlacementAvailability(g, 1).cells.length === 16); }
      { const a = makeCard("0320", 1, 1, 1), ally = makeCard("0101", 1, 1, 2), enemy = makeCard("0201", 2, 2, 2), g = makeGame([a, ally, enemy]); destroy(g, a); check("0320", "被摧毁时削弱八方所有卡牌", ally.currentAttack === 0 && enemy.currentAttack === 0); }
    } catch (error) {
      results.push({ id: "runtime", name: "边界测试执行", passed: false, error: String(error) });
    } finally {
      state.game = previousGame;
    }
    return { passed: results.filter((result) => result.passed).length, failed: results.filter((result) => !result.passed).length, results };
  }

  function coreResolveSkillAttack(game, attacker, defender, player, log) {
    if (!attacker || !defender || !game.boardCards.includes(attacker) || !game.boardCards.includes(defender) || !coreCanCardsFight(game, attacker, defender)) return;
    const attackerValue = attacker.currentAttack;
    const defenderValue = defender.currentAttack;
    if (attackerValue > defenderValue) {
      const pos = { row: defender.row, col: defender.col };
      if (coreDestroyV2Card(game, defender, log, attacker)) {
        const from = { row: attacker.row, col: attacker.col };
        attacker.row = pos.row; attacker.col = pos.col;
        if (typeof queueSkillMoveAnimation === "function") queueSkillMoveAnimation(game, attacker, from, pos, "技能攻击移动");
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card: attacker, source: from, target: pos });
      }
    } else if (attackerValue < defenderValue) coreDestroyV2Card(game, attacker, log, defender);
    else { coreDestroyV2Card(game, attacker, log, defender); coreDestroyV2Card(game, defender, log, attacker); }
  }

  function coreDestroyV2Card(game, card, log, causeCard = null) {
    if (!card || !game.boardCards.some((item) => item.uid === card.uid)) return false;
    const original = { row: card.row, col: card.col };
    if (card.v2ProtectedUntilTurn === game.turn) {
      card.v2ProtectedUntilTurn = null;
      coreSetAttack(game, card, 1, true);
      log.push(`${card.name} 触发保护，保留在原格并将战力变为1。`);
      return false;
    }
    if (card.id === "0113" && !card.v2Protected) { card.v2Protected = true; coreSetAttack(game, card, 1, true); log.push(`${card.name} 首次被摧毁时保留在原格，战力变为1。`); return false; }
    if (card.id === "0302" && !card.v2DestroyTriggered && !isBrokenCell(game, card.row, card.col)) { card.v2DestroyTriggered = true; coreSetAttack(game, card, 1, true); log.push(`${card.name} 被摧毁时保留在原格，战力变为1。`); return false; }
    if (card.id === "0316" && !card.v2DestroyTriggered) { card.v2DestroyTriggered = true; coreSetAttack(game, card, 4, true); card.restedTurn = game.turn; card.v2CannotMoveTurn = game.turn; log.push(`${card.name} 首次被摧毁时保留并将战力变为4。`); return false; }
    const adjacentProtectors = card.id === "0118" ? [] : game.boardCards.filter((item) => item.ownerId === card.ownerId && item.id === "0118" && item.uid !== card.uid && Math.abs(item.row - card.row) + Math.abs(item.col - card.col) === 1);
    const adjacentProtector = adjacentProtectors[0];
    if (adjacentProtector) { coreDestroyV2Card(game, adjacentProtector, log, causeCard); log.push(`${adjacentProtector.name} 代替 ${card.name} 被摧毁。`); return false; }
    const weiProtector = game.boardCards.find((item) => item.ownerId === card.ownerId && item.id === "0210" && item.uid !== card.uid && Math.abs(item.row - card.row) + Math.abs(item.col - card.col) === 1 && card.currentAttack > 1);
    if (weiProtector && coreSetAttack(game, card, 0, false)) {
      log.push(`${weiProtector.name} 使 ${card.name} 保留且战力变为0。`);
      coreEnforceZeroDestroy(game, log);
      return !game.boardCards.includes(card);
    }
    const index = game.boardCards.findIndex((item) => item.uid === card.uid);
    game.boardCards.splice(index, 1);
    card.destroyedAt = original;
    const allies = game.boardCards.filter((item) => item.ownerId === card.ownerId && !item.isGuard);
    const enemyPlayer = corePlayer(game, otherPlayerId(card.ownerId));
    if (card.id === "0301") { const ally = corePickRandom(allies); if (ally) coreAdjustAttack(ally, 1, true); }
    if (card.id === "0303") { const ally = corePickRandom(allies); if (ally) ally.v2ProtectedUntilTurn = game.turn; }
    if (card.id === "0304" && causeCard && game.boardCards.includes(causeCard)) coreAdjustAttack(causeCard, -1);
    if (card.id === "0305" && causeCard && game.boardCards.includes(causeCard)) coreAdjustAttack(causeCard, -2, true);
    if (card.id === "0306") {
      const cells = getOrthogonalNeighbors(original.row, original.col).filter((cell) => coreIsInsideBoard(cell.row, cell.col, game) && !getBoardCardAt(game, cell.row, cell.col) && !isBrokenCell(game, cell.row, cell.col));
      const cell = corePickRandom(cells);
      if (cell) {
        const nextOwnerTurn = coreNextOwnerTurn(game, card.ownerId);
        game.v2ControlCells.push({ ...cell, ownerId: card.ownerId, sourceUid: card.uid, untilTurn: nextOwnerTurn - 1 });
        log.push(`${card.name} 使 ${formatCell(cell.row, cell.col)} 暂时视为己方占领。`);
      }
    }
    if (card.id === "0307" && enemyPlayer?.hand.length) { enemyPlayer.hand.splice(randomInt(0, enemyPlayer.hand.length - 1), 1); log.push(`${card.name} 使敌方随机弃置1张手牌。`); }
    if (card.id === "0308" && causeCard && game.boardCards.includes(causeCard)) { coreAdjustAttack(causeCard, -2); log.push(`${card.name} 使摧毁者 ${causeCard.name} 永久战力-2。`); }
    if (card.id === "0309") { const cell = !isBrokenCell(game, original.row, original.col) && !getBoardCardAt(game, original.row, original.col); if (cell) { const reinforcement = createReinforcementCard(card.ownerId); reinforcement.row = original.row; reinforcement.col = original.col; game.boardCards.push(reinforcement); log.push(`${card.name} 在原格留下援兵。`); } else if (card.ownerId && drawOneCard(game, corePlayer(game, card.ownerId)).status === "drawn") log.push(`${card.name} 的原格不可用，改为抽取1张牌。`); }
    if (card.id === "0310") { const ally = corePickRandom(allies.filter((item) => Math.abs(item.row - original.row) + Math.abs(item.col - original.col) === 1)); if (ally) { coreAdjustAttack(ally, 2); log.push(`${card.name} 使相邻友军 ${ally.name} 永久战力+2。`); } }
    if (card.id === "0311" && allies.length < game.boardCards.filter((item) => item.ownerId === otherPlayerId(card.ownerId)).length) allies.forEach((ally) => coreAdjustAttack(ally, 1, true));
    if (card.id === "0312" && causeCard && game.boardCards.includes(causeCard)) { game.moveLocks[causeCard.uid] = game.turn; coreAdjustAttack(causeCard, -1); }
    if (card.id === "0313") {
      const enemies = game.boardCards.filter((item) => item.ownerId !== card.ownerId);
      enemies.forEach((enemy) => coreAdjustAttack(enemy, -2, true));
      [...enemies].filter((enemy) => game.boardCards.includes(enemy) && enemy.currentAttack === 0).forEach((enemy) => coreDestroyV2Card(game, enemy, log, card));
      log.push(`${card.name} 使所有敌方卡牌战力-2，并摧毁战力为0的敌方卡牌。`);
      coreCheckVictory(game);
    }
    if (card.id === "0314" && enemyPlayer) { const count = Math.min(2, enemyPlayer.hand.length); for (let i = 0; i < count; i += 1) { enemyPlayer.hand.splice(randomInt(0, enemyPlayer.hand.length - 1), 1); const ally = corePickRandom(allies); if (ally) coreAdjustAttack(ally, 1); } }
    if (card.id === "0315") [...game.boardCards]
      .filter((item) => item.ownerId !== card.ownerId && Math.abs(item.row - original.row) <= 1 && Math.abs(item.col - original.col) <= 1 && item.currentAttack <= 2)
      .forEach((enemy) => coreDestroyV2Card(game, enemy, log, card));
    if (card.id === "0316" && card.v2DestroyTriggered) { const ally = corePickRandom(allies); if (ally) coreAdjustAttack(ally, 2); }
    if (card.id === "0317") allies.forEach((ally) => coreAdjustAttack(ally, 1, true));
    if (card.id === "0318" && !isBrokenCell(game, original.row, original.col) && game.brokenCells.length < 5) { game.brokenCells.push(original); log.push(`${card.name} 在原位置生成破坏格。`); }
    if (card.id === "0319") {
      const nextOwnerTurn = coreNextOwnerTurn(game, card.ownerId);
      getOrthogonalNeighbors(original.row, original.col)
        .filter((cell) => coreIsInsideBoard(cell.row, cell.col, game))
        .forEach((cell) => game.v2PlacementLocks.push({ ...cell, ownerId: otherPlayerId(card.ownerId), untilTurn: nextOwnerTurn }));
      log.push(`${card.name} 封锁相邻空格的敌方放置，直到下个己方回合结束。`);
    }
    if (card.id === "0320") game.boardCards.filter((item) => Math.abs(item.row - original.row) <= 1 && Math.abs(item.col - original.col) <= 1).forEach((enemy) => coreAdjustAttack(enemy, -2, true));
    const replacer = game.boardCards.find((item) => item.ownerId === card.ownerId && item.id === "0215" && item.uid !== card.uid && item.v2ReplacedThisTurn instanceof Set && !item.v2ReplacedThisTurn.has(card.uid));
    if (replacer) {
      const cells = corePlacementAvailability(game, card.ownerId).cells;
      const cell = corePickRandom(cells);
      if (cell) {
        replacer.v2ReplacedThisTurn.add(card.uid);
        card.currentAttack = Number(card.attack) || 0;
        card.v2PermanentBonus = 0; card.v2TempBonus = 0; card.v2StartAttack = undefined; card.v2StartTurn = undefined; card.v2EnteredTurn = game.turn; card.restedTurn = game.turn; card.lastMovedTurn = null; card.v2LongMoveUsed = false; card.row = cell.row; card.col = cell.col;
        game.boardCards.push(card);
        coreApplyV2PlacementSkill(game, corePlayer(game, card.ownerId), card, log);
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_PLACED, { player: corePlayer(game, card.ownerId), card, log });
        log.push(`${replacer.name} 使 ${card.name} 先结算摧毁技能，再恢复基础战力重新放置。`);
        return false;
      }
    }
    if (!game.enforcingZeroDestroy) coreEnforceZeroDestroy(game, log);
    return true;
  }

  function coreRunV2MoveEffects(game, card, source, target, successful) {
    if (!successful) return;
    game.boardCards.filter((watcher) => watcher.id === "0220" && watcher.uid !== card.uid).forEach((watcher) => {
      const wasAdjacent = Math.abs(source.row - watcher.row) <= 1 && Math.abs(source.col - watcher.col) <= 1;
      if (wasAdjacent) coreAdjustAttack(watcher, -1);
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
    const canUseLongMove = card.id === "0211" && !card.v2LongMoveUsed;
    const canCharge = card.id === "0109" && coreEnemyNeighbors(game, card).length > 0;
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
      return (!target || target.ownerId !== card.ownerId) && (card.id === "0109" || card.id === "0211" || !target || distance === 1);
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
      if (extraPlacementSourceUid && extraPlacementSourceUid !== card.uid && game.boardCards.includes(card)) {
        coreApplyV2PlacementSkill(game, player, card, skillLog);
        if (player.v2NextPlacementExtra === extraPlacementSourceUid) player.v2NextPlacementExtra = null;
        skillLog.push(`${card.name} 的放置技能额外结算 1 次。`);
      }
      coreEmitV2Event(game, CORE_V2_EVENT.CARD_PLACED, { player, card, log: skillLog });
      if (skillLog.length) skillLog.forEach((entry) => coreAppendLog(game, entry));
      game.effectBoardCards = null;
      coreAppendLog(game, `${player.name} 将 ${card.name} 放置在 ${formatCell(card.row, card.col)}，该卡本回合进入休整。`);
    } else {
      const defender = getBoardCardAt(game, action.target.row, action.target.col);
      const sourcePosition = { row: card.row, col: card.col };
      if (card.id === "0211" && !card.v2LongMoveUsed) card.v2LongMoveUsed = true;
      card.lastMovedTurn = game.turn;
      card.movesTaken = Number(card.movesTaken) || 0;
      if (!defender) {
        card.row = action.target.row;
        card.col = action.target.col;
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card, source: sourcePosition, target: { row: card.row, col: card.col } });
        coreAppendLog(game, `${player.name} 的 ${card.name} 从 ${formatCell(action.source.row, action.source.col)} 移动至 ${formatCell(card.row, card.col)}。`);
      } else {
        combatScene = await playCombatClashAnimation(game, card, defender, action.target.row, action.target.col, "交战");
        game.effectBoardCards = game.boardCards;
        const attackerValue = Number(card.currentAttack ?? card.attack) || 0;
        const defenderValue = Number(defender.currentAttack ?? defender.attack) || 0;
        const outcome = attackerValue > defenderValue ? "a" : attackerValue < defenderValue ? "b" : "both";
        const combatLog = [];
        if (outcome === "a") {
          const defenderPosition = { row: defender.row, col: defender.col };
          const destroyed = coreDestroyV2Card(game, defender, combatLog, card);
          if (destroyed) {
            card.row = defenderPosition.row;
            card.col = defenderPosition.col;
            coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, { card, source: sourcePosition, target: defenderPosition });
          }
          if (card.id === "0116" && destroyed) drawOneCard(game, player);
          coreAppendLog(game, `${card.name} 攻击 ${defender.name} 并获胜。`);
        } else if (outcome === "b") {
          coreDestroyV2Card(game, card, combatLog, defender);
          coreAppendLog(game, `${card.name} 攻击 ${defender.name} 失败，攻击方被摧毁。`);
        } else {
          coreDestroyV2Card(game, card, combatLog, defender);
          coreDestroyV2Card(game, defender, combatLog, card);
          if (card.id === "0116") drawOneCard(game, player);
          coreAppendLog(game, `${card.name} 与 ${defender.name} 同归于尽。`);
        }
        combatLog.forEach((entry) => coreAppendLog(game, entry));
        game.effectBoardCards = null;
        await finishCombatAnimation(game, combatScene, game.boardCards);
      }
    }

    syncPlayerBoardIds(game);
    if (typeof flushPendingAnimations === "function") await flushPendingAnimations(game);
    const consumesAction = !(card.id === "0116" && card.freeActionTurn === game.turn);
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
    game.boardCards.filter((card) => card.ownerId === active.id && card.id === "0214").forEach((source) => {
      game.boardCards.filter((card) => (
        card.uid !== source.uid
        && card.v2StartTurn === game.turn
        && card.v2EnteredTurn !== game.turn
        && card.currentAttack !== card.v2StartAttack
      )).forEach((card) => coreAdjustAttack(card, -1));
    });
    game.moveLocks = {};
    // "本回合" effects expire with the active global turn, including buffs applied to the non-active player.
    game.boardCards.forEach((card) => {
      card.v2TempBonus = 0;
      card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0));
      if (card.ownerId === active.id && card.id === "0113") card.v2Protected = false;
      if (card.ownerId === active.id && card.id === "0215") card.v2ReplacedThisTurn = new Set();
    });
    coreEnforceZeroDestroy(game, log);
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
    return { 普通: 0, 稀有: 1.2, 史诗: 2.2, 传说: 3.2, 特殊: 1.6 }[card?.rarity || card?.quality] || 0;
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

    // V2 cards use their numeric id as the stable skill key; older templates may carry effectId="none".
    const effectId = card.id || card.effectId;
    if (effectId === "0206" && (cell.row === 0 || cell.row === coreBoardSize(game) - 1 || cell.col === 0 || cell.col === coreBoardSize(game) - 1)) score += 4;
    if (["0202", "0213", "0217"].includes(effectId)) score += enemies.length * 4;
    if (["0203", "0204", "0207", "0216", "0219"].includes(effectId)) score += allies.length * 3;
    if (["0209", "0210", "0215", "0220"].includes(effectId)) score += allies.length * 2.5;
    if (effectId === "0120") score += openNeighbors * 1.8;
    if (effectId.startsWith("01")) score += allies.length * 1.4;
    if (["0105", "0106", "0109", "0110", "0112", "0117"].includes(effectId)) score += enemies.length * 1.8;
    if (["0205", "0218"].includes(effectId)) score += 2;
    if (effectId === "0208") score += game.players.find((target) => target.id !== player.id)?.hand.length ? 1.5 : -1;
    // One direct placement can end the match. Never trade that for a local combat setup.
    if (control[player.id] + 1 >= victoryTarget) score += 1000;
    // Score global and delayed effects by the units they can actually affect, not only by adjacency.
    if (effectId === "0216") score += game.boardCards.filter((target) => target.ownerId === player.id).length * 2.1;
    if (effectId === "0120") score += openNeighbors * 1.4;
    if (effectId === "0218") score += Math.min(HAND_LIMIT - player.hand.length, player.drawPile.length) * 1.25;
    if (effectId === "0208") score += Math.min(2, game.players.find((target) => target.id !== player.id)?.hand.length || 0) * 1.2;
    if (effectId === "0219") score += winningAdjacentTargets.length * 3.5;
    if (effectId === "0214" && !game.boardCards.some((target) => target.currentAttack === 0 && target.uid !== card.uid)) {
      const enemyValue = game.boardCards.filter((target) => target.ownerId !== player.id).reduce((total, target) => total + (Number(target.currentAttack ?? target.attack) || 0), 0);
      const allyValue = game.boardCards.filter((target) => target.ownerId === player.id).reduce((total, target) => total + (Number(target.currentAttack ?? target.attack) || 0), 0);
      score += (enemyValue - allyValue) * 0.45;
    }
    if (effectId === "0215") score += game.boardCards.filter((target) => target.ownerId === player.id && target.id !== "0215").length * 0.9;
    if (effectId === "0217") {
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
    if (card.id === "0211" && distance > 1) score += 2;
    if (card.id === "0109" && distance === 2) score += 2;
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
    const element = document.createElement("div");
    element.className = `unit ${card.isGuard ? "guard" : `player${card.ownerId}`} rarity-${card.rarity || "普通"} ${card.restedTurn === game.turn ? "is-rested" : ""}`;
    element.dataset.cardUid = card.uid;
    element.tabIndex = 0;
    element.setAttribute("aria-label", card.isGuard
      ? `守军，战力 ${card.currentAttack}，中立卡牌，技能无。`
      : `${card.name}，战力 ${card.currentAttack}，${getCampDisplayName(card.camp)}。技能：${card.skill}。`);
    element.innerHTML = `
      <div class="unit-main">
        <div class="unit-identity">
          <span class="unit-name">${card.name}</span>
          <span class="unit-camp">${getCampDisplayName(card.camp)}</span>
        </div>
        <span class="unit-attack" title="当前战力 ${card.currentAttack}">
          <strong>${card.currentAttack}</strong><small>战力</small>
        </span>
      </div>
        <span class="unit-skill">${card.isGuard ? "无" : card.skill}</span>
        ${card.restedTurn === game.turn ? '<span class="rested-badge">休整中</span>' : ""}
      <div class="unit-tooltip" role="tooltip">
        <span class="unit-tooltip-label">技能效果</span>
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
      const element = document.createElement("button");
      element.type = "button";
      element.className = `card rarity-${card.rarity || "普通"}`;
      element.disabled = game.isAnimating;
      if (game.selection.handCardUid === card.uid) element.classList.add("selected");
      element.innerHTML = `
        <div class="card-top"><h3>${card.name}</h3><strong>ATK ${card.attack}</strong></div>
        <p class="card-stats">${getCardTierLabel(card)} · ${getCampDisplayName(card.camp)}</p>
        <p class="card-effect">${card.skill}</p>
        <span class="hand-skill-tooltip" role="tooltip"><strong>技能效果</strong><span class="skill-effect-list">${coreSkillEffectHtml(card)}</span></span>
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
    ui.handTitle.textContent = `${active.name} 的手牌`;
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
        ? `${card.name} 本回合处于休整状态，不能主动移动。`
        : `${card?.name || "卡牌"} 每回合最多主动移动一次；进入敌方格会立即交战。`;
    } else {
      ui.selectionSummary.textContent = "选择手牌放置，或选择未休整且未移动过的己方卡牌移动。";
    }
    const selectedCard = game.boardCards.find((card) => card.uid === game.selection.boardCardUid)
      || active.hand.find((card) => card.uid === game.selection.handCardUid);
    ui.detailRarity.textContent = selectedCard ? getCardTierLabel(selectedCard) : "未选择";
    ui.detailName.textContent = selectedCard ? selectedCard.name : "选择一张卡牌";
    ui.detailSkill.textContent = selectedCard ? selectedCard.skill : "悬停或选择卡牌查看技能";
    ui.detailSummary.textContent = selectedCard
      ? `${getCampDisplayName(selectedCard.camp)} · 当前战力 ${selectedCard.currentAttack} · 基础战力 ${selectedCard.attack}`
      : "卡牌详情将在此显示。";
    ui.detailTags.innerHTML = selectedCard ? `<span class="detail-tag">${selectedCard.isGuard ? "中立守军" : "玩家卡牌"}</span><span class="detail-tag">${selectedCard.restedTurn === game.turn ? "休整中" : "可行动"}</span>` : "";
    ui.detailLines.innerHTML = selectedCard ? `<div class="detail-line"><strong>技能效果</strong><span class="skill-effect-list">${coreSkillEffectHtml(selectedCard)}</span></div><div class="detail-line"><strong>状态</strong><span>${selectedCard.restedTurn === game.turn ? "本回合休整，不能主动移动" : "可进行移动"}</span></div>` : "";
    ui.actionLogTurn.textContent = `第 ${game.turn} 回合`;
    ui.actionLogList.innerHTML = "";
    (game.roundLog.length ? game.roundLog : ["本回合尚无行动记录。"]).forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "action-log-item";
      item.innerHTML = `<strong>${String(index + 1).padStart(2, "0")}</strong><span>${entry}</span>`;
      ui.actionLogList.appendChild(item);
    });
    coreRenderBoard(game, active, control);
    coreRenderHand(game, active);
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
        showToast("卡牌休整中", `${target.name} 是本回合新放置的卡牌，不能主动移动。`);
      } else if (target.lastMovedTurn === game.turn) {
        showToast("已完成移动", `${target.name} 本回合已经主动移动过一次。`);
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
        state.game = coreDeserializeOnlineGame(message.state);
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
      state.game = coreDeserializeOnlineGame(message.state);
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
    let setup = setupOverride;
    if (!setup) {
      try {
        setup = JSON.parse(window.localStorage?.getItem("cardDemoCardTestSetup") || "null");
      } catch (_error) {
        return false;
      }
    }
    if (!setup || !Array.isArray(setup.cards)) return false;
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
      const card = cloneCard(makeCardTemplate(template.camp, template, 0));
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
  window.runCoreV2RegressionTests = coreRunV2RegressionTests;
  window.runCoreV2CardBoundaryTests = coreRunV2CardBoundaryTests;
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
  if (coreDataValidation.duplicateIds.length || coreDataValidation.invalidCards.length) {
    console.warn("V2 卡牌数据校验失败", coreDataValidation);
  }
  if (new URLSearchParams(window.location.search).get("card-test") === "1" && coreLoadCardTestSetup()) {
    switchScreen("game");
    coreRender();
    showToast("Card Test 场景已导入", "当前场景已切换为 V2 规则核心。");
  }
  window.__CARD_DEMO_CORE_V2__ = { coreCreateGame, coreStartTurn, coreResolveAction, coreEndTurn, coreSurrender, coreVictoryTarget, coreDataValidation, runRegressionTests: coreRunV2RegressionTests };
})();
