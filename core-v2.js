/* Core Rules V2: sequential turns with V2 card skills enabled. */
(() => {
  const CORE_BOARD_SIZE = 5;
  const CORE_MAX_TURNS = 30;
  const CORE_FIRST_TURN_ACTIONS = 1;
  const CORE_STANDARD_ACTIONS = 2;
  const CORE_TURN_TIME_LIMIT_SECONDS = 300;
  const CORE_TURN_TIME_LIMIT_MS = CORE_TURN_TIME_LIMIT_SECONDS * 1000;
  const CORE_TIMER_TICK_MS = 250;
  const CORE_CARD_DATA_VERSION = "card-info-v2-display-effect-isolation-20260908";
  const CORE_RUNTIME_SCHEMA_VERSION = "runtime-display-effect-isolation-20260909";
  const CORE_CARD_TEST_SCENE_VERSION = 2;
  // This is a client-side GM convenience gate, not a security boundary.
  const CORE_GM_3X3_PASSWORD = "dm0912";
  let coreRuntimeReady = true;
  let coreTimerEndingTurn = false;
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

  function corePersistPlayerId(name) {
    try { window.localStorage?.setItem("cardDemoPlayerId", name); } catch (_error) { /* storage may be unavailable */ }
  }

  function coreInitializePlayerIdentity() {
    let lastRoom = null;
    let stored = "";
    try {
      stored = window.localStorage?.getItem("cardDemoPlayerId") || "";
      lastRoom = JSON.parse(window.localStorage?.getItem("cardDemoOnlineRoom") || "null");
    } catch (_error) { /* storage may be unavailable or invalid */ }
    const valid = coreValidatePlayerId(stored || lastRoom?.playerName);
    if (valid.valid) {
      state.playerName = valid.value;
      if (ui.playerIdValue) ui.playerIdValue.textContent = valid.value;
      corePersistPlayerId(valid.value);
    } else if (!state.playerName) {
      coreShowPlayerIdModal(true);
    }
    if (lastRoom?.roomCode && lastRoom?.sessionToken && state.playerName && window.CardOnline) {
      state.online = { playerId: null, roomCode: lastRoom.roomCode, playerName: state.playerName, sessionToken: lastRoom.sessionToken, host: false, role: "player", rooms: [], reconnecting: true };
      state.online.unsubscribe = window.CardOnline.on(coreHandleOnlineMessage);
      window.CardOnline.connect();
    }
  }

  function corePlayer(game, playerId) {
    return game.players.find((player) => player.id === playerId) || null;
  }

  function coreViewerPlayerId(game) {
    const onlinePlayerId = Number(state.online?.playerId);
    return game?.mode === "online" && [1, 2].includes(onlinePlayerId) ? onlinePlayerId : 1;
  }

  function coreIsSpectator() {
    return state.online?.role === "spectator";
  }

  function coreCanViewerInteract(game) {
    if (!game) return false;
    if (game.mode !== "online") return true;
    return !coreIsSpectator() && coreViewerPlayerId(game) === game.activePlayerId;
  }

  function coreIsOpponentTurn(game) {
    return Boolean(game && game.activePlayerId !== coreViewerPlayerId(game));
  }

  function coreStartTurnTimer(game, now = Date.now()) {
    if (!game || game.winner) return null;
    game.turnDeadlineAt = Number(now) + CORE_TURN_TIME_LIMIT_MS;
    return game.turnDeadlineAt;
  }

  function coreTurnSecondsRemaining(game, now = Date.now()) {
    if (game?.turnDeadlineAt === null || game?.turnDeadlineAt === undefined) return null;
    const deadline = Number(game?.turnDeadlineAt);
    if (!Number.isFinite(deadline)) return null;
    return Math.max(0, Math.ceil((deadline - Number(now)) / 1000));
  }

  function coreFormatTurnTime(seconds) {
    const safeSeconds = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function coreTimerIsAuthority(game) {
    return game?.mode !== "online" || Boolean(state.online?.host);
  }

  function coreUpdateTurnTimerUi(game, now = Date.now()) {
    if (!ui.turnTimer || !ui.turnTimerValue) return;
    const seconds = coreTurnSecondsRemaining(game, now);
    const isRunning = Boolean(game && !game.winner && game.currentPhase === "行动阶段" && seconds !== null);
    ui.turnTimer.hidden = !isRunning;
    if (!isRunning) return;
    const active = corePlayer(game, game.activePlayerId);
    const opponentTurn = coreIsOpponentTurn(game);
    ui.turnTimerValue.textContent = coreFormatTurnTime(seconds);
    ui.turnTimer.classList.toggle("is-opponent-turn", opponentTurn);
    ui.turnTimer.classList.toggle("is-warning", seconds <= 30 && seconds > 10);
    ui.turnTimer.classList.toggle("is-critical", seconds <= 10);
    ui.turnTimer.setAttribute("aria-label", `${active?.name || "当前玩家"}本回合剩余 ${seconds} 秒`);
  }

  function coreEscapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function coreCardDisplay(cardOrId) {
    const display = typeof getCardDisplay === "function"
      ? getCardDisplay(cardOrId)
      : { name: "未知卡牌", camp: "无势力", rarity: "普通", skill: "无", effect: "无技能效果。" };
    return cardOrId?.customName ? { ...display, name: cardOrId.customName, skill: "无", effect: "无技能效果。" } : display;
  }

  function coreCardName(cardOrId) {
    return coreCardDisplay(cardOrId).name;
  }

  function coreCardBaseAttack(cardOrId) {
    if (typeof getCardBaseAttack === "function") return getCardBaseAttack(cardOrId);
    const displayValue = Number(coreCardDisplay(cardOrId)?.baseAttack);
    if (Number.isFinite(displayValue)) return displayValue;
    const runtimeValue = typeof cardOrId === "object" ? Number(cardOrId?.attack) : NaN;
    return Number.isFinite(runtimeValue) ? Math.max(0, runtimeValue) : 0;
  }

  function coreSkillEffectText(card) {
    if (!card || card.isGuard) return "无";
    const effect = coreCardDisplay(card).effect;
    return effect === undefined || effect === null ? "无技能效果。" : String(effect);
  }

  function coreSkillEffectHtml(card) {
    return `<span class="skill-effect-line">${coreEscapeHtml(coreSkillEffectText(card))}</span>`;
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

  const CORE_RUNTIME_DISPLAY_FIELDS = Object.freeze(["name", "camp", "rarity", "quality", "skill", "effect"]);

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
    const previousSnapshotAt = game.turnTimerSnapshotAt;
    game.turnTimerSnapshotAt = Date.now();
    try {
      return JSON.stringify(coreStripRuntimeDisplayData(game), (_key, value) => value instanceof Set ? { __coreSet: [...value] } : value);
    } finally {
      if (previousSnapshotAt === undefined) delete game.turnTimerSnapshotAt;
      else game.turnTimerSnapshotAt = previousSnapshotAt;
    }
  }

  function coreDeserializeOnlineGame(serialized) {
    const game = JSON.parse(serialized, (_key, value) => value && value.__coreSet ? new Set(value.__coreSet) : value);
    if (game?.ruleset !== "core-v2" || game.cardDataVersion !== CORE_CARD_DATA_VERSION
      || game.runtimeSchemaVersion !== CORE_RUNTIME_SCHEMA_VERSION) {
      throw new Error("旧版对局状态与当前卡牌运行时不兼容。");
    }
    const hasDeadline = game.turnDeadlineAt !== null && game.turnDeadlineAt !== undefined;
    const deadline = Number(game.turnDeadlineAt);
    const snapshotAt = Number(game.turnTimerSnapshotAt);
    if (hasDeadline && Number.isFinite(deadline) && Number.isFinite(snapshotAt)) {
      game.turnDeadlineAt = Date.now() + Math.max(0, deadline - snapshotAt);
    }
    delete game.turnTimerSnapshotAt;
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

  function coreRequestBoardSizeAccess(onApproved) {
    if (!ui.playerIdModal) return;
    ui.playerIdModal.innerHTML = `
      <section class="player-id-card gm-access-card" role="dialog" aria-modal="true" aria-label="验证 3x3 地图权限">
        <button id="gm-access-close" class="overlay-close" type="button" aria-label="取消">取消</button>
        <p class="phase-banner-eyebrow">GM ACCESS</p>
        <h2>解锁 3x3 战场</h2>
        <p>3x3 为 GM 调试地图，请输入 6 位密码后继续。</p>
        <label>GM 密码<input id="gm-access-input" maxlength="6" minlength="6" inputmode="text" autocomplete="off" spellcheck="false" autofocus></label>
        <p id="gm-access-error" class="player-id-error" aria-live="polite"></p>
        <button id="gm-access-confirm" class="primary-btn" type="button">验证并进入 3x3</button>
      </section>
    `;
    ui.playerIdModal.classList.add("visible");
    const input = document.getElementById("gm-access-input");
    const error = document.getElementById("gm-access-error");
    const close = () => {
      ui.playerIdModal.classList.remove("visible");
      ui.playerIdModal.innerHTML = "";
    };
    document.getElementById("gm-access-confirm")?.addEventListener("click", () => {
      const password = String(input?.value || "").trim();
      if (!/^[A-Za-z0-9]{6}$/.test(password)) {
        error.textContent = "密码必须为 6 位数字或英文字母。";
        input?.focus();
        return;
      }
      if (password.toLowerCase() !== CORE_GM_3X3_PASSWORD) {
        error.textContent = "GM 密码不正确。";
        input?.select();
        return;
      }
      close();
      onApproved?.();
    });
    document.getElementById("gm-access-close")?.addEventListener("click", close);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") document.getElementById("gm-access-confirm")?.click();
      if (event.key === "Escape") close();
    });
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

  function coreIsPveMode(modeOrGame) {
    const mode = typeof modeOrGame === "string" ? modeOrGame : modeOrGame?.mode;
    return mode === "pve" || mode === "pve-challenge";
  }

  function coreIsPveChallenge(modeOrGame) {
    const mode = typeof modeOrGame === "string" ? modeOrGame : modeOrGame?.mode;
    return mode === "pve-challenge";
  }

  function coreEliteAiTraitIds() {
    const ids = coreCanonicalEliteAiTraitIds();
    const aliases = Object.keys(window.ELITE_AI_EFFECT_ID_ALIASES_V2 || {});
    return [...ids, ...aliases];
  }

  function coreCanonicalEliteAiTraitIds() {
    const effects = window.ELITE_AI_EFFECTS_V2 || {};
    const info = window.ELITE_AI_EFFECT_INFO_V2 || {};
    return Object.keys(effects).filter((id) => /^\d+$/.test(id) && info[id]);
  }

  function coreNormalizeEliteAiTraitId(id) {
    const value = String(id || "");
    return window.ELITE_AI_EFFECT_ID_ALIASES_V2?.[value] || value;
  }

  function coreEliteAiTraitInfo(game) {
    const id = typeof game === "string" ? game : game?.eliteAiEffectId;
    return id ? window.ELITE_AI_EFFECT_INFO_V2?.[coreNormalizeEliteAiTraitId(id)] || null : null;
  }

  function coreEliteAiTraitInfos(game) {
    const ids = game?.eliteAiEffectId && (!Array.isArray(game?.eliteAiEffectIds) || !game.eliteAiEffectIds.length || game.eliteAiEffectId !== game.eliteAiEffectIds[0])
      ? [game.eliteAiEffectId]
      : game?.eliteAiEffectIds || [];
    const seen = new Set();
    return ids.map((id) => coreNormalizeEliteAiTraitId(id))
      .filter((id) => id && !seen.has(id) && seen.add(id))
      .map((id) => window.ELITE_AI_EFFECT_INFO_V2?.[id])
      .filter(Boolean);
  }

  function coreEliteAiPlayer(game) {
    return game?.players?.find((player) => player.isAI) || null;
  }

  function coreEliteAiTraitOwner(game) {
    const ownerId = Number(game?.eliteAiTraitOwnerId);
    return game?.players?.find((player) => player.id === ownerId) || coreEliteAiPlayer(game);
  }

  function coreChallengeTraitBindings(game) {
    if (!coreIsPveChallenge(game)) return [];
    const aiOwner = coreEliteAiTraitOwner(game);
    const playerOwner = corePlayer(game, 1);
    return [
      { owner: aiOwner, ids: coreEliteAiTraitIdsForGame(game), source: "opponent" },
      { owner: playerOwner, ids: [...new Set((game.challengePlayerTraitIds || []).map(coreNormalizeEliteAiTraitId).filter(Boolean))], source: "player" }
    ].filter((binding) => binding.owner && binding.ids.length);
  }

  function coreHandLimitForPlayer(game, player) {
    if (!coreIsPveChallenge(game) || !player) return HAND_LIMIT;
    const limits = coreResolveEliteAiRule(game, "handLimit", { player });
    return Math.max(1, Math.min(HAND_LIMIT, limits.reduce((limit, value) => Number.isFinite(Number(value)) ? Math.min(limit, Number(value)) : limit, HAND_LIMIT)));
  }

  function coreEliteAiTraitIdsForGame(game) {
    const ids = game?.eliteAiEffectId && (!Array.isArray(game?.eliteAiEffectIds) || !game.eliteAiEffectIds.length || game.eliteAiEffectId !== game.eliteAiEffectIds[0])
      ? [game.eliteAiEffectId]
      : game?.eliteAiEffectIds || [];
    return [...new Set(ids.map(coreNormalizeEliteAiTraitId).filter(Boolean))];
  }

  function coreEliteAiTraitContext(game, event, payload, log, binding = null) {
    const ai = binding?.owner || coreEliteAiTraitOwner(game);
    const operations = {
      handLimit: event === "handLimit" ? HAND_LIMIT : coreHandLimitForPlayer(game, ai),
      adjust: (card, amount, temporary = false, isolated = true) => {
        const previous = state.game;
        state.game = game;
        try { coreAdjustAttack(card, amount, temporary, isolated); } finally { state.game = previous; }
      },
      adjustScoped: (card, amount, isolated = true) => {
        if (!card) return;
        card.eliteTraitTempBonusUntilOwnTurn = (Number(card.eliteTraitTempBonusUntilOwnTurn) || 0) + amount;
        card.eliteTraitTempBonusAffectedByCards = card.eliteTraitTempBonusAffectedByCards || !isolated;
        operations.adjust(card, amount, true, isolated);
      },
      addActions: (count = 1) => { game.extraActions = (Number(game.extraActions) || 0) + count; },
      applyPlacementSkill: (card) => coreApplyV2PlacementSkill(game, corePlayer(game, card?.ownerId), card, log),
      cardName: (card) => coreCardName(card),
      drawCard: (player) => coreDrawOneCard(game, player, log),
      addToDrawPile: (player, cards) => coreAddCardsToDrawPile(game, player, cards, log),
      setPlayerState: (player, key, value) => {
        if (!player || !key) return;
        player.eliteTraitState ||= {};
        player.eliteTraitState[key] = value;
      },
      getPlayerState: (player, key) => player?.eliteTraitState?.[key],
      drawReinforcement: () => coreDrawEliteReinforcement(game, ai, log),
      setCardState: (card, key, value) => {
        if (!card || !key) return;
        card.eliteTraitState ||= {};
        card.eliteTraitState[key] = value;
      },
      getCardState: (card, key) => card?.eliteTraitState?.[key],
      claimFirstPlacement: (key) => {
        const claimKey = `${ai?.id || 0}:${key}`;
        game.eliteAiFirstPlacementClaims ||= {};
        if (game.eliteAiFirstPlacementClaims[claimKey] === game.turn) return false;
        game.eliteAiFirstPlacementClaims[claimKey] = game.turn;
        return true;
      },
      hasFirstPlacementClaim: (key) => game.eliteAiFirstPlacementClaims?.[`${ai?.id || 0}:${key}`] === game.turn,
      pickRandom: (cards) => corePickRandom(cards || []),
      preventRest: (card) => { if (card && card.restedTurn === game.turn) card.restedTurn = null; },
      trimHandToOne: () => coreTrimEliteAiHand(game, payload.player || ai),
      logMessage: (message) => log.push(message)
    };
    return { game, event, ai, traitSource: binding?.source || "opponent", player: payload.player || null, card: payload.card || null, boardCards: game.boardCards, log, operations, ...payload };
  }

  function coreResolveEliteAiRule(game, hook, payload = {}, log = []) {
    if (!coreIsPveChallenge(game)) return [];
    return coreChallengeTraitBindings(game).flatMap((binding) => {
      const context = coreEliteAiTraitContext(game, hook, payload, log, binding);
      return binding.ids.map((id) => {
        const handler = window.ELITE_AI_EFFECTS_V2?.[id]?.[hook];
        return typeof handler === "function" ? handler(context) : undefined;
      });
    });
  }

  function coreEliteAiRuleAllows(game, hook, payload = {}, log = []) {
    return coreResolveEliteAiRule(game, hook, payload, log).every((result) => result !== false);
  }

  function coreEliteAiRuleAny(game, hook, payload = {}, log = []) {
    return coreResolveEliteAiRule(game, hook, payload, log).some((result) => result === true);
  }

  function coreApplyEliteAiTraitEvent(game, event, payload = {}, log = []) {
    if (!coreIsPveChallenge(game)) return null;
    let prevented = false;
    coreChallengeTraitBindings(game).forEach((binding) => {
      if (event === "turnStart" && payload.player?.id !== binding.owner.id) return;
      const context = coreEliteAiTraitContext(game, event, payload, log, binding);
      binding.ids.forEach((id) => {
        const definition = window.ELITE_AI_EFFECTS_V2?.[id];
        const handler = definition?.[`on${event[0].toUpperCase()}${event.slice(1)}`];
        if (typeof handler !== "function") return;
        const result = handler(context);
        if (result === false) prevented = true;
      });
    });
    return prevented ? false : null;
  }

  function coreChallengeTraitPlan(level = 1) {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    const plan = [];
    const highCount = Math.floor(safeLevel / 3);
    for (let index = 0; index < highCount; index += 1) plan.push("advanced");
    const remainder = safeLevel % 3;
    if (remainder === 1) plan.push("beginner");
    if (remainder === 2) plan.push("intermediate");
    return plan.length ? plan : ["advanced"];
  }

  function corePickChallengeTraits(level = 1) {
    const info = window.ELITE_AI_EFFECT_INFO_V2 || {};
    const ids = coreCanonicalEliteAiTraitIds();
    const selected = [];
    coreChallengeTraitPlan(level).forEach((tier) => {
      const candidates = ids.filter((id) => info[id]?.level === tier && !selected.includes(id));
      if (candidates.length) selected.push(candidates[randomInt(0, candidates.length - 1)]);
    });
    return selected;
  }

  function corePickWeightedChallengeTraitTier(roll = Math.random()) {
    const value = Math.max(0, Math.min(0.999999999, Number(roll) || 0));
    if (value < 0.9) return "beginner";
    if (value < 0.99) return "intermediate";
    return "advanced";
  }

  function corePickChallengeRewardTraits(ownedIds = [], count = 3) {
    const info = window.ELITE_AI_EFFECT_INFO_V2 || {};
    const excluded = new Set((ownedIds || []).map(coreNormalizeEliteAiTraitId));
    const available = coreCanonicalEliteAiTraitIds().filter((id) => !excluded.has(id));
    const selected = [];
    while (selected.length < Math.min(Math.max(0, Number(count) || 0), available.length)) {
      const tier = corePickWeightedChallengeTraitTier();
      const tierCandidates = available.filter((id) => info[id]?.level === tier && !selected.includes(id));
      const fallback = available.filter((id) => !selected.includes(id));
      const candidates = tierCandidates.length ? tierCandidates : fallback;
      selected.push(candidates[randomInt(0, candidates.length - 1)]);
    }
    return selected;
  }

  function coreEliteAiTraitMarkup(traits) {
    return traits.map((trait) => {
      const name = coreEscapeHtml(trait.name);
      const description = coreEscapeHtml(trait.description);
      const tierColor = { beginner: "blue", intermediate: "purple", advanced: "orange" }[trait.level] || "blue";
      return `<div class="ai-effect-item" tabindex="0" title="${description}" data-tooltip="${description}"><strong class="elite-tier-${tierColor}">${name}</strong></div>`;
    }).join("");
  }

  function coreApplyEliteAiTrait(game, ai, log = []) {
    if (!coreIsPveChallenge(game) || !ai) return;
    coreApplyEliteAiTraitEvent(game, "turnStart", { player: ai }, log);
    if (game.currentPhase !== "开局展示") {
      coreMaintainEliteAiHand(game, ai, log);
    }
    coreEnforceElitePowerBounds(game);
  }

  function coreTrimEliteAiHand(game, owner = coreEliteAiTraitOwner(game)) {
    const ai = owner;
    if (!ai) return 0;
    let removed = 0;
    while (ai.hand.length > 1) {
      const index = randomInt(0, ai.hand.length - 1);
      const discardedCard = ai.hand.splice(index, 1)[0];
      if (game.currentPhase !== "开局展示" && typeof queueCardFlowAnimation === "function") {
        queueCardFlowAnimation(game, "discard", ai, discardedCard, {
          reason: "精英词条【断粮】",
          flowPrompt: `${ai.name || "精英 AI"} 因精英词条【断粮】弃置 ${coreCardName(discardedCard)}。`
        });
      }
      removed += 1;
    }
    return removed;
  }

  function coreCreateEliteReinforcementCard(ai) {
    return {
      id: `elite-reinforcement-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customName: "援兵",
      attack: 1,
      currentAttack: 1,
      uid: `elite-reinforcement-${Math.random().toString(36).slice(2, 9)}`,
      ownerId: ai.id,
      v2PermanentBonus: 0,
      v2TempBonus: 0,
      movesTaken: 0,
      hasPlaced: false
    };
  }

  function coreDrawEliteReinforcement(game, ai, log = []) {
    if (!ai || ai.hand.length >= coreHandLimitForPlayer(game, ai)) return { status: "not-created" };
    const card = coreCreateEliteReinforcementCard(ai);
    ai.hand.push(card);
    if (game.currentPhase !== "开局展示" && typeof queueCardFlowAnimation === "function") {
      queueCardFlowAnimation(game, "draw", ai, card, {
        sourceLabel: "援军效果",
        flowPrompt: `${ai.name || "精英 AI"} 从援军效果抽取援兵。`
      });
    }
    log.push(`精英特性【援军】使 ${ai.name || "词条持有者"} 抽出 1 张战力为 1 的援兵。`);
    return { status: "drawn", card };
  }

  function coreMaintainEliteAiHand(game, ai = coreEliteAiTraitOwner(game), log = []) {
    if (!ai) return;
    coreResolveEliteAiRule(game, "handState", { player: ai }, log);
  }

  function coreExpireEliteScopedBonuses(game, ownerId) {
    game.boardCards.forEach((card) => {
      const amount = Number(card.eliteTraitTempBonusUntilOwnTurn) || 0;
      if (!amount || Number(card.eliteTraitTempBonusOwnerId) !== Number(ownerId)) return;
      const previous = state.game;
      state.game = game;
      const isolated = !card.eliteTraitTempBonusAffectedByCards;
      try { coreAdjustAttack(card, -amount, true, isolated); } finally { state.game = previous; }
      delete card.eliteTraitTempBonusUntilOwnTurn;
      delete card.eliteTraitTempBonusAffectedByCards;
      delete card.eliteTraitTempBonusOwnerId;
    });
  }

  function coreEnforceElitePowerBounds(game) {
    coreResolveEliteAiRule(game, "powerBounds");
  }

  function coreModeLabel(mode) {
    if (mode === "pve-challenge") return "PVE 挑战";
    if (mode === "pve") return "PVE";
    if (mode === "online") return "联网";
    return "本地 1v1";
  }

  function coreActionLimit(game) {
    const base = game.turn === 1 ? CORE_FIRST_TURN_ACTIONS : CORE_STANDARD_ACTIONS;
    const bonus = coreResolveEliteAiRule(game, "actionLimit", { player: corePlayer(game, game.activePlayerId) })
      .reduce((total, value) => total + (Number(value) || 0), 0);
    return base + bonus + (Number(game.extraActions) || 0);
  }

  function coreHasFreeAction(game, card) {
    return Boolean(card && (
      (coreCardEffectHasFlag(card, "freeAction") && card.freeActionTurn === game.turn)
      || (coreCardEffectHasFlag(card, "freeMove") && game.boardCards?.includes(card))
    ));
  }

  function coreCanUseAction(game, card = null) {
    if (coreTurnSecondsRemaining(game) === 0) return false;
    const activePlayer = corePlayer(game, game.activePlayerId);
    const traitFreeAction = coreEliteAiRuleAny(game, "freeAction", { player: activePlayer, card });
    return (Number(game.actionsUsed) || 0) < coreActionLimit(game) || coreHasFreeAction(game, card) || traitFreeAction;
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
      controlCounts: () => ({ ...coreControlMap(game).counts }),
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
      preventRest: (target = card) => {
        if (!target || target.restedTurn !== game.turn) return false;
        target.restedTurn = null;
        return true;
      },
      setAttack: (target, value, temporary = true) => coreSetAttack(game, target, value, temporary),
      draw: (targetPlayer = player) => coreDrawOneCard(game, targetPlayer, log).status === "drawn",
      addToDrawPile: (targetPlayer, cards) => coreAddCardsToDrawPile(game, targetPlayer, cards, log),
      drawFromEnemyDeck: (count = 1) => coreDrawFromEnemyDeck(game, card.ownerId, count, log),
      discard: (targetPlayer, count = 1) => {
        if (!targetPlayer?.hand?.length) return 0;
        const amount = Math.min(count, targetPlayer.hand.length);
        for (let index = 0; index < amount; index += 1) {
          const discardedCard = targetPlayer.hand.splice(randomInt(0, targetPlayer.hand.length - 1), 1)[0];
          if (typeof queueCardFlowAnimation === "function") {
            queueCardFlowAnimation(game, "discard", targetPlayer, discardedCard, {
              flowPrompt: `${targetPlayer.name || `玩家 ${targetPlayer.id}`} 弃置 ${coreCardName(discardedCard)}。`
            });
          }
        }
        if (amount > 0 && targetPlayer.hand.length === 0) coreMaintainEliteAiHand(game, targetPlayer, log);
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
      emitMoved: (moved, source, target) => coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, {
        card: moved,
        source,
        target,
        visual: "skill-move"
      }),
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
        const incomingKeys = new Set(cells.map((cell) => cellKey(cell.row, cell.col)));
        game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => {
          const incoming = incomingKeys.has(cellKey(entry.row, entry.col));
          if (entry.sourceUid === card.uid) return options.retainExisting && !incoming;
          return !incoming || !entry.invalidateOnAnyControl;
        });
        cells.forEach((cell) => game.v2ControlCells.push({
          row: cell.row,
          col: cell.col,
          ownerId: options.ownerId ?? card.ownerId,
          sourceUid: card.uid,
          untilTurn: options.untilTurn ?? Infinity,
          ...(options.startsAtTurn ? { startsAtTurn: options.startsAtTurn } : {}),
          ...(options.persistent ? { persistent: true } : {}),
          ...(options.invalidateOnEnemyEntry ? { invalidateOnEnemyEntry: true } : {}),
          ...(options.invalidateOnAnyEntry ? { invalidateOnAnyEntry: true } : {}),
          ...(options.invalidateOnAnyControl ? { invalidateOnAnyControl: true } : {})
        }));
      },
      addBrokenCell: (position) => {
        if (!position || isBrokenCell(game, position.row, position.col) || game.brokenCells.length >= 5) return false;
        game.brokenCells.push({ row: position.row, col: position.col });
        // 新规则：生成破坏格时，在其正上方的所有卡牌必定会被摧毁，无视任何效果
        const destroyLog = [];
        for (let row = position.row - 1; row >= 0; row -= 1) {
          const cardAbove = getBoardCardAt(game, row, position.col);
          if (!cardAbove) continue;
          // 强制摧毁，绕过所有防护效果
          const index = game.boardCards.findIndex((item) => item.uid === cardAbove.uid);
          if (index >= 0) {
            game.boardCards.splice(index, 1);
            cardAbove.destroyedAt = { row, col: position.col };
            const destroyedAttack = cardAbove.currentAttack;
            coreRunOtherV2DestroyEffects(game, cardAbove, { row, col: position.col }, null, destroyLog);
            coreEmitV2Event(game, CORE_V2_EVENT.CARD_DESTROYED, { destroyedCard: cardAbove, original: { row, col: position.col }, causeCard: null, log: destroyLog });
            destroyLog.forEach((entry) => log.push(entry));
          }
        }
        return true;
      },
      spawnNeutralGuard: (position, attack = 2) => coreSpawnNeutralGuard(game, position, attack),
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

  function coreCreateNeutralGuard(row, col, attack = 2) {
    const power = Math.max(0, Number(attack) || 0);
    return {
      uid: `guard-${row}-${col}-${Math.random().toString(36).slice(2, 8)}`,
      id: "guard", attack: power, currentAttack: power,
      v2PermanentBonus: 0, v2TempBonus: 0,
      ownerId: null, row, col, isGuard: true, restedTurn: null, lastMovedTurn: null
    };
  }

  function coreSpawnNeutralGuard(game, position, attack = 2) {
    if (!position || !coreIsInsideBoard(position.row, position.col, game)
      || isBrokenCell(game, position.row, position.col)
      || getBoardCardAt(game, position.row, position.col)) return null;
    const guard = coreCreateNeutralGuard(position.row, position.col, attack);
    game.boardCards.push(guard);
    coreInvalidateControlCellOnEntry(game, guard);
    return guard;
  }

  function corePickGuards(boardSize = CORE_BOARD_SIZE) {
    const guards = [];
    while (guards.length < 2) {
      const row = randomInt(0, boardSize - 1);
      const col = randomInt(0, boardSize - 1);
      if (!guards.some((card) => card.row === row && card.col === col)) {
        const attack = Math.random() < 0.5 ? 2 : 3;
        guards.push(coreCreateNeutralGuard(row, col, attack));
      }
    }
    return guards;
  }

  function coreCreateGame(mode, selectedDecks, boardSize = state.selectedBoardSize || CORE_BOARD_SIZE, firstPlayerIdOverride = null, challengeLevel = state.challengeLevel || 1, challengeTraitIds = null, playerTraitIds = null) {
    const selectedSize = Number(boardSize);
    const size = Number.isInteger(selectedSize) && selectedSize >= 3 && selectedSize <= 5 ? selectedSize : CORE_BOARD_SIZE;
    const playerOneCatalog = buildCampDeck(selectedDecks[1]);
    const playerTwoCatalog = buildCampDeck(selectedDecks[2]);
    const challengeMode = coreIsPveChallenge(mode);
    const playerTwoName = coreIsPveMode(mode) ? (challengeMode ? "精英 AI" : "AI") : "玩家 2";
    const firstPlayerId = [1, 2].includes(Number(firstPlayerIdOverride)) ? Number(firstPlayerIdOverride) : (Math.random() < 0.5 ? 1 : 2);
    const game = {
      ruleset: "core-v2",
      cardDataVersion: CORE_CARD_DATA_VERSION,
      runtimeSchemaVersion: CORE_RUNTIME_SCHEMA_VERSION,
      mode,
      challengeMode,
      challengeLevel: challengeMode ? Math.max(1, Math.floor(Number(challengeLevel) || 1)) : 0,
      eliteAiEffectId: null,
      eliteAiEffectIds: [],
      eliteAiTraitOwnerId: 2,
      eliteAiFirstPlacementClaims: {},
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
        createPlayer(2, playerTwoName, selectedDecks[2], playerTwoCatalog, coreIsPveMode(mode))
      ],
      firstPlayerId,
      activePlayerId: firstPlayerId,
      activePlannerIndex: firstPlayerId - 1,
      actionsUsed: 0,
      turnDeadlineAt: null,
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

    if (challengeMode) {
      const suppliedTraits = Array.isArray(challengeTraitIds)
        ? [...new Set(challengeTraitIds.map(coreNormalizeEliteAiTraitId))].filter((id) => window.ELITE_AI_EFFECT_INFO_V2?.[id] && window.ELITE_AI_EFFECTS_V2?.[id])
        : [];
      game.eliteAiEffectIds = suppliedTraits.length ? suppliedTraits : corePickChallengeTraits(game.challengeLevel);
      game.eliteAiEffectId = game.eliteAiEffectIds[0] || null;
      const suppliedPlayerTraits = Array.isArray(playerTraitIds)
        ? [...new Set(playerTraitIds.map(coreNormalizeEliteAiTraitId))].filter((id) => window.ELITE_AI_EFFECT_INFO_V2?.[id] && window.ELITE_AI_EFFECTS_V2?.[id])
        : [];
      game.challengePlayerTraitIds = suppliedPlayerTraits;
    }

    game.players.forEach((player) => {
      const openingHand = coreHandLimitForPlayer(game, player) === 1
        ? 1
        : player.id === firstPlayerId ? 2 : 3;
      for (let index = 0; index < openingHand; index += 1) {
        drawOneCard(game, player);
      }
    });
    return game;
  }

  function coreDrawAtTurnStart(game, player) {
    const handBefore = player.hand.length;
    const result = coreDrawOneCard(game, player, game.roundLog || []);
    if (result.status === "hand-full") {
      showToast("手牌已满", `${player.name} 当前已有 ${HAND_LIMIT} 张手牌，本回合不抽牌。`);
      return `${player.name} 手牌已满 ${HAND_LIMIT} 张，跳过抽牌。`;
    }
    if (result.status === "deck-empty") {
      if (player.hand.length > handBefore) return `${player.name} 牌库已空，精英特性【援军】抽出 1 张援兵。`;
      showToast("牌库已空", `${player.name} 的牌库已空，本回合无法抽牌。`);
      return `${player.name} 牌库已空，本回合无法抽牌。`;
    }
    return `${player.name} 从自己的牌库抽取 1 张卡牌。`;
  }

  function coreStartTurn(game) {
    const active = corePlayer(game, game.activePlayerId);
    if (active && active.id === coreEliteAiTraitOwner(game)?.id) {
      coreExpireEliteScopedBonuses(game);
      game.eliteAiFirstPlacementClaims = {};
    }
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
      }
      if (card.ownerId === active.id && card.restedTurn !== null && card.restedTurn !== game.turn) {
        card.restedTurn = null;
      }
    });
    corePruneV2TimedState(game);
    game.roundLog = [`${active.name} 的${game.turn === 1 ? "第一个" : "本"}回合开始。`];
    const drawLog = coreDrawAtTurnStart(game, active);
    game.roundLog.push(drawLog);
    let wonAtStart = coreRunStartSkills(game, active);
    const eliteTraitOwnerId = Number(game.eliteAiTraitOwnerId) || coreEliteAiTraitOwner(game)?.id;
    if (!wonAtStart && active.id === eliteTraitOwnerId) {
      const eliteTraitLog = [];
      coreApplyEliteAiTrait(game, active, eliteTraitLog);
      eliteTraitLog.forEach((entry) => coreAppendLog(game, entry));
      wonAtStart = coreCheckVictory(game);
    }
    game.currentPhase = wonAtStart ? "胜负结算" : "行动阶段";
    if (wonAtStart) game.turnDeadlineAt = null;
    else coreStartTurnTimer(game);
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
        coreEmitV2Event(game, CORE_V2_EVENT.TURN_START, { player: active, card, skipDuplicateWatchers: true });
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
    return won;
  }

  function coreNotifyV2AttackIncrease(game, card, amount, temporary) {
    if (!game || !card || amount <= 0 || !game.boardCards?.includes(card) || game.v2PowerIncreaseWatcherDepth) return;
    const watchers = game.boardCards.filter((watcher) => (
      watcher.ownerId === card.ownerId
      && typeof coreCardEffectDefinition(watcher)?.onOwnCardAttackIncreased === "function"
    ));
    if (!watchers.length) return;
    game.v2PowerIncreaseWatcherDepth = (Number(game.v2PowerIncreaseWatcherDepth) || 0) + 1;
    try {
      watchers.forEach((watcher) => {
        const effectDefinition = coreCardEffectDefinition(watcher);
        effectDefinition.onOwnCardAttackIncreased(coreCreateCardEffectContext(
          game,
          corePlayer(game, watcher.ownerId),
          watcher,
          game.roundLog || [],
          { increasedCard: card, increaseAmount: amount, temporary }
        ));
      });
    } finally {
      game.v2PowerIncreaseWatcherDepth -= 1;
    }
  }

  function coreAdjustAttack(card, delta, temporary = false, isolated = false) {
    if (!card || !delta) return;
    const game = state.game;
    const previous = Number(card.currentAttack ?? card.attack) || 0;
    if (delta < 0 && !isolated && !coreCanReduceAttack(game, card)) return;
    if (temporary) card.v2TempBonus = (Number(card.v2TempBonus) || 0) + delta;
    else card.v2PermanentBonus = (Number(card.v2PermanentBonus) || 0) + delta;
    card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0) + (Number(card.v2TempBonus) || 0));
    if (game) coreEnforceElitePowerBounds(game);
    const actualDelta = card.currentAttack - previous;
    if (game && actualDelta && game.boardCards?.includes(card) && typeof queuePowerAnimation === "function") {
      queuePowerAnimation(game, card, actualDelta, previous, card.currentAttack);
    }
    if (card.currentAttack > previous && !isolated) coreNotifyV2AttackIncrease(game, card, card.currentAttack - previous, temporary);
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
    if (game) coreEnforceElitePowerBounds(game);
    const actualDelta = card.currentAttack - previous;
    if (actualDelta && game?.boardCards?.includes(card) && typeof queuePowerAnimation === "function") {
      queuePowerAnimation(game, card, actualDelta, previous, card.currentAttack);
    }
    if (next > previous) coreNotifyV2AttackIncrease(game, card, next - previous, temporary);
    return true;
  }

  function coreQueueV2StartSkillExtra(game, card) {
    const startContext = game.v2StartContext;
    if (!startContext || startContext.processed.has(card.uid)) {
      return coreRunV2StartSkill(game, corePlayer(game, card.ownerId), card, { skipDuplicateWatchers: true });
    }
    startContext.pendingExtras.set(card.uid, (startContext.pendingExtras.get(card.uid) || 0) + 1);
    return null;
  }

  function coreCaptureStartSkillState(game) {
    const cards = new Map((game.boardCards || []).map((item) => [item.uid, {
      name: coreCardName(item),
      attack: Number(item.currentAttack ?? item.attack) || 0,
      row: item.row,
      col: item.col
    }]));
    const players = new Map((game.players || []).map((player) => [player.id, {
      name: player.name || `玩家 ${player.id}`,
      hand: Array.isArray(player.hand) ? player.hand.length : 0,
      drawPile: Array.isArray(player.drawPile) ? player.drawPile.length : 0
    }]));
    let control = { 1: 0, 2: 0 };
    try { control = { ...control, ...(coreControlMap(game).counts || {}) }; } catch (_error) { /* partial test games may omit board metadata */ }
    return {
      cards,
      players,
      control,
      extraActions: Number(game.extraActions) || 0,
      controlCells: Array.isArray(game.v2ControlCells) ? game.v2ControlCells.length : 0
    };
  }

  function coreBuildStartSkillResult(game, card, snapshot, log, logStart) {
    const messages = [];
    const append = (message) => {
      const value = String(message || "").trim();
      if (value && !messages.includes(value)) messages.push(value);
    };
    (log || []).slice(logStart).forEach(append);
    const currentCards = new Map((game.boardCards || []).map((item) => [item.uid, item]));
    snapshot.cards.forEach((before, uid) => {
      const after = currentCards.get(uid);
      if (!after) {
        append(`${before.name}${uid === card.uid ? "已被摧毁" : "被摧毁"}。`);
        return;
      }
      const attack = Number(after.currentAttack ?? after.attack) || 0;
      if (attack !== before.attack) {
        const delta = attack - before.attack;
        append(`${before.name} 战力 ${before.attack} → ${attack}（${delta > 0 ? "+" : ""}${delta}）。`);
      }
      if (after.row !== before.row || after.col !== before.col) {
        append(`${before.name} 移动至 ${Number(after.row) + 1}-${Number(after.col) + 1}。`);
      }
    });
    (game.players || []).forEach((player) => {
      const before = snapshot.players.get(player.id);
      if (!before) return;
      const handDelta = (Array.isArray(player.hand) ? player.hand.length : 0) - before.hand;
      if (handDelta) append(`${before.name} 手牌 ${handDelta > 0 ? "+" : ""}${handDelta}。`);
      const deckDelta = (Array.isArray(player.drawPile) ? player.drawPile.length : 0) - before.drawPile;
      if (deckDelta) append(`${before.name} 牌库 ${deckDelta > 0 ? "+" : ""}${deckDelta}。`);
    });
    let control = { 1: 0, 2: 0 };
    try { control = { ...control, ...(coreControlMap(game).counts || {}) }; } catch (_error) { /* ignore incomplete metadata */ }
    [1, 2].forEach((ownerId) => {
      const delta = (control[ownerId] || 0) - (snapshot.control[ownerId] || 0);
      if (delta) append(`玩家 ${ownerId} 占领区域 ${delta > 0 ? "+" : ""}${delta} 格。`);
    });
    const actionDelta = (Number(game.extraActions) || 0) - snapshot.extraActions;
    if (actionDelta) append(`本回合额外行动 ${actionDelta > 0 ? "+" : ""}${actionDelta}。`);
    const controlCellDelta = (Array.isArray(game.v2ControlCells) ? game.v2ControlCells.length : 0) - snapshot.controlCells;
    if (controlCellDelta && !messages.some((message) => message.includes("占领区域"))) {
      append(`新增 ${controlCellDelta} 个临时占领格。`);
    }
    if (!messages.length) append("条件未满足，本次未产生场面变化。");
    return messages.join(" ");
  }

  function coreRunV2StartSkill(game, player, card, options = {}) {
    const resolvingStartSkills = game.v2ResolvingStartSkills || new Set();
    game.v2ResolvingStartSkills = resolvingStartSkills;
    if (resolvingStartSkills.has(card.uid)) return;
    resolvingStartSkills.add(card.uid);
    try {
      const effectDefinition = coreCardEffectDefinition(card);
      const eliteSuppressed = !coreEliteAiRuleAllows(game, "allowCardStartSkill", { player, card });
      if (typeof effectDefinition?.onTurnStart === "function") {
        const log = game.roundLog || (game.roundLog = []);
        const logStart = log.length;
        const snapshot = coreCaptureStartSkillState(game);
        const visualEvent = typeof queueSkillAnimation === "function"
          ? queueSkillAnimation(game, card, null, "turn-start")
          : null;
        let result;
        if (eliteSuppressed) {
          result = "本回合未触发：被精英词条压制。";
        } else {
          effectDefinition.onTurnStart(coreCreateCardEffectContext(game, player, card, log));
          result = coreBuildStartSkillResult(game, card, snapshot, log, logStart);
        }
        if (visualEvent) {
          visualEvent.fullEffect = coreSkillEffectText(card);
          visualEvent.result = result;
          visualEvent.flowPrompt = `${coreCardName(card)}：${coreCardDisplay(card).skill}。${result}`;
          if (eliteSuppressed) {
            visualEvent.effectType = "danger";
            visualEvent.glyph = "×";
            visualEvent.tag = "已压制";
          }
        }
      }
    } finally {
      resolvingStartSkills.delete(card.uid);
    }
    if (options.skipDuplicateWatchers || !game.boardCards?.includes(card)) return;
    game.boardCards
      .filter((watcher) => watcher.uid !== card.uid
        && watcher.ownerId === card.ownerId
        && coreCardEffectHasFlag(watcher, "repeatFriendlyTurnStart"))
      .forEach(() => coreQueueV2StartSkillExtra(game, card));
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

  function coreDrawOneCard(game, player, log = []) {
    const result = player?.hand?.length >= coreHandLimitForPlayer(game, player)
      ? { status: "hand-full" }
      : drawOneCard(game, player);
    if (result.status === "drawn") {
      if (typeof queueCardFlowAnimation === "function") {
        queueCardFlowAnimation(game, "draw", player, result.card);
      }
      coreEmitV2Event(game, CORE_V2_EVENT.CARD_DRAWN, { player, drawnCard: result.card, log });
    } else {
      if (typeof queueCardFlowAnimation === "function") {
        queueCardFlowAnimation(game, "draw-failed", player, null, { reason: result.status });
      }
      coreEmitV2Event(game, CORE_V2_EVENT.DRAW_FAILED, { player, reason: result.status, log });
    }
    return result;
  }

  function coreAddCardsToDrawPile(game, player, cards, log = []) {
    if (!player || !Array.isArray(cards) || !cards.length) return 0;
    cards.forEach((card) => {
      if (!card) return;
      card.ownerId = player.id;
      player.drawPile.push(card);
    });
    const added = cards.filter(Boolean).length;
    if (added) coreEmitV2Event(game, CORE_V2_EVENT.DRAW_PILE_CHANGED, { player, addedCount: added, log });
    return added;
  }

  function coreDrawFromEnemyDeck(game, ownerId, count, log) {
    const owner = corePlayer(game, ownerId);
    const enemy = corePlayer(game, otherPlayerId(ownerId));
    let drawn = 0;
    for (let index = 0; index < count; index += 1) {
      if (!owner || !enemy) break;
      if (owner.hand.length >= HAND_LIMIT) {
        if (typeof queueCardFlowAnimation === "function") {
          queueCardFlowAnimation(game, "draw-failed", owner, null, {
            reason: "hand-full",
            sourceLabel: `${enemy?.name || "敌方"}牌库`,
            flowPrompt: `${owner.name || `玩家 ${owner.id}`} 从${enemy?.name || "敌方"}牌库抽卡失败：手牌已满。`
          });
        }
        coreEmitV2Event(game, CORE_V2_EVENT.DRAW_FAILED, { player: owner, reason: "hand-full", log: log || [] });
        break;
      }
      if (!enemy.drawPile.length) {
        if (typeof queueCardFlowAnimation === "function") {
          queueCardFlowAnimation(game, "draw-failed", owner, null, {
            reason: "deck-empty",
            sourceLabel: `${enemy.name || "敌方"}牌库`,
            flowPrompt: `${owner.name || `玩家 ${owner.id}`} 从${enemy.name || "敌方"}牌库抽卡失败：牌库已空。`
          });
        }
        coreEmitV2Event(game, CORE_V2_EVENT.DRAW_FAILED, { player: owner, reason: "deck-empty", log: log || [] });
        break;
      }
      const card = enemy.drawPile.shift();
      card.ownerId = owner.id;
      owner.hand.push(card);
      drawn += 1;
      if (typeof queueCardFlowAnimation === "function") {
        queueCardFlowAnimation(game, "draw", owner, card, {
          sourceLabel: `${enemy.name || "敌方"}牌库`,
          flowPrompt: `${owner.name || `玩家 ${owner.id}`} 从${enemy.name || "敌方"}牌库抽取 ${coreCardName(card)}。`
        });
      }
      coreEmitV2Event(game, CORE_V2_EVENT.CARD_DRAWN, { player: owner, drawnCard: card, log: log || [] });
    }
    if (drawn && log) log.push(`从敌方牌库抽取 ${drawn} 张牌。`);
    return drawn;
  }

  function coreAdjacentCards(game, card, diagonal = false) {
    const cells = diagonal ? getEightNeighbors(card.row, card.col) : getOrthogonalNeighbors(card.row, card.col);
    return cells.map((cell) => getBoardCardAt(game, cell.row, cell.col)).filter(Boolean);
  }

  function coreInvalidateControlCellOnEntry(game, card) {
    game.v2ControlCells = (game.v2ControlCells || []).filter((entry) => {
      if (entry.row !== card.row || entry.col !== card.col) return true;
      if (entry.invalidateOnAnyEntry) return false;
      return !entry.invalidateOnEnemyEntry || entry.ownerId === card.ownerId;
    });
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
    coreInvalidateControlCellOnEntry(game, card);
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

  function coreRunV2DrawFailedEffects(game, player, reason, log) {
    [...game.boardCards]
      .filter((card) => card.ownerId === player.id)
      .forEach((card) => {
        if (!game.boardCards.includes(card)) return;
        const effectDefinition = coreCardEffectDefinition(card);
        if (typeof effectDefinition?.onDrawFailed === "function") {
          effectDefinition.onDrawFailed(coreCreateCardEffectContext(game, player, card, log, {
            drawFailureReason: reason,
            drawingPlayer: player
          }));
        }
    });
  }

  function coreRunV2OtherDrawEffects(game, player, drawnCard, log) {
    [...game.boardCards].forEach((card) => {
      if (!game.boardCards.includes(card)) return;
      const effectDefinition = coreCardEffectDefinition(card);
      if (typeof effectDefinition?.onOtherDrawn !== "function") return;
      effectDefinition.onOtherDrawn(coreCreateCardEffectContext(
        game,
        corePlayer(game, card.ownerId),
        card,
        log,
        { drawingPlayer: player, drawnCard }
      ));
    });
  }

  const CORE_V2_EVENT = Object.freeze({
    TURN_START: "turnStart",
    CARD_PLACED: "cardPlaced",
    CARD_MOVED: "cardMoved",
    CARD_DRAWN: "cardDrawn",
    DRAW_FAILED: "drawFailed",
    DRAW_PILE_CHANGED: "drawPileChanged",
    CARD_DESTROYED: "cardDestroyed",
    TURN_END: "turnEnd"
  });

  function coreEmitV2Event(game, event, payload = {}) {
    if (event === CORE_V2_EVENT.TURN_START && payload.card && payload.player) {
      return coreRunV2StartSkill(game, payload.player, payload.card, {
        skipDuplicateWatchers: Boolean(payload.skipDuplicateWatchers)
      });
    }
    if (event === CORE_V2_EVENT.CARD_PLACED && payload.card && payload.player) {
      coreApplyEliteAiTraitEvent(game, "cardPlaced", payload, payload.log || []);
      const result = coreTriggerOtherV2PlacementEffects(game, payload.player, payload.card, payload.log || []);
      coreMaintainEliteAiHand(game, coreEliteAiTraitOwner(game), payload.log || []);
      coreEnforceElitePowerBounds(game);
      return result;
    }
    if (event === CORE_V2_EVENT.CARD_MOVED && payload.card && payload.source && payload.target) {
      if (payload.visual === "skill-move" && typeof queueSkillMoveAnimation === "function") {
        queueSkillMoveAnimation(game, payload.card, payload.source, payload.target, payload.detail || "技能移动");
      }
      const result = coreRunV2MoveEffects(game, payload.card, payload.source, payload.target, payload.successful !== false);
      coreApplyEliteAiTraitEvent(game, "cardMoved", payload, payload.log || game.roundLog || []);
      coreEnforceElitePowerBounds(game);
      return result;
    }
    if (event === CORE_V2_EVENT.CARD_DRAWN && payload.player) {
      const result = coreRunV2OtherDrawEffects(game, payload.player, payload.drawnCard, payload.log || []);
      coreApplyEliteAiTraitEvent(game, "cardDrawn", { ...payload, card: payload.drawnCard }, payload.log || []);
      if (game.currentPhase !== "开局展示") {
        coreTrimEliteAiHand(game);
      }
      return result;
    }
    if (event === CORE_V2_EVENT.DRAW_FAILED && payload.player) {
      const result = coreRunV2DrawFailedEffects(game, payload.player, payload.reason, payload.log || []);
      coreApplyEliteAiTraitEvent(game, "drawFailed", { ...payload, drawFailureReason: payload.reason }, payload.log || []);
      return result;
    }
    if (event === CORE_V2_EVENT.DRAW_PILE_CHANGED && payload.player) {
      return coreApplyEliteAiTraitEvent(game, "drawPileChanged", payload, payload.log || []);
    }
    if (event === CORE_V2_EVENT.CARD_DESTROYED && payload.destroyedCard) return coreApplyEliteAiTraitEvent(game, "cardDestroyed", payload, payload.log || []);
    if (event === CORE_V2_EVENT.TURN_END && payload.player) return coreRunV2EndSkills(game, payload.player, payload.log || []);
    return null;
  }

  function coreValidateV2CardData() {
    const cards = window.CARD_LIBRARY?.cardSlots || [];
    const seen = new Set();
    const duplicateIds = [];
    const invalidCards = [];
    const missingEffectIds = [];
    cards.forEach((card) => {
      if (seen.has(card.id)) duplicateIds.push(card.id);
      seen.add(card.id);
      const id = String(card.id || "");
      const sequence = Number(id.slice(3));
      const validId = /^0[1-3][1-5]\d{2}$/.test(id) && sequence >= 1 && sequence <= 20;
      if (!validId || !card.name || !card.skill || !card.effect || !card.camp || !card.rarity
        || !Number.isFinite(Number(card.attack))) {
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

    // Trigger onBeforeAttack effects on attacker
    const attackerDef = coreCardEffectDefinition(attacker);
    if (typeof attackerDef?.onBeforeAttack === "function") {
      attackerDef.onBeforeAttack(coreCreateCardEffectContext(game, player, attacker, log, {
        targetCard: defender
      }));
    }

    // Trigger onUnderAttack effects on defender
    const defenderPlayer = corePlayer(game, defender.ownerId);
    const defenderDef = coreCardEffectDefinition(defender);
    if (typeof defenderDef?.onUnderAttack === "function") {
      defenderDef.onUnderAttack(coreCreateCardEffectContext(game, defenderPlayer, defender, log, {
        attacker
      }));
    }

    const attackerValue = attacker.currentAttack;
    const defenderValue = defender.currentAttack;
    const sourcePosition = { row: attacker.row, col: attacker.col };
    const targetPosition = { row: defender.row, col: defender.col };
    // During combat, the attacker is treated as having entered the target cell.
    // This lets destruction/combat effects resolve from the post-move position.
    attacker.row = targetPosition.row;
    attacker.col = targetPosition.col;
    let attackerDestroyed = false;
    let defenderDestroyed = false;
    if (attackerValue > defenderValue) {
      defenderDestroyed = coreDestroyV2Card(game, defender, log, attacker);
      if (defenderDestroyed && game.boardCards.includes(attacker)) {
        coreEmitV2Event(game, CORE_V2_EVENT.CARD_MOVED, {
          card: attacker,
          source: sourcePosition,
          target: targetPosition,
          visual: "skill-move",
          detail: "技能攻击移动"
        });
      }
    } else if (attackerValue < defenderValue) attackerDestroyed = coreDestroyV2Card(game, attacker, log, defender);
    else {
      attackerDestroyed = coreDestroyV2Card(game, attacker, log, defender);
      defenderDestroyed = coreDestroyV2Card(game, defender, log, attacker);
    }
    coreRunV2CombatEffects(game, attacker, defender, attackerDestroyed, defenderDestroyed, log);
    if (game.boardCards.includes(attacker) && !(attackerValue > defenderValue && defenderDestroyed)) {
      attacker.row = sourcePosition.row;
      attacker.col = sourcePosition.col;
    }
  }

  function coreRunOtherV2DestroyEffects(game, destroyedCard, original, causeCard, log) {
    const watchers = [...game.boardCards]
      .filter((watcher) => (
        watcher.uid !== destroyedCard.uid
        && (watcher.ownerId === destroyedCard.ownerId || coreCardEffectHasFlag(watcher, "watchAllDestroyed"))
      ))
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
    if (coreApplyEliteAiTraitEvent(game, "beforeDestroy", { card, causeCard, original }, log) === false) {
      log.push(`精英特性【城下盟】使 ${coreCardName(card)} 在持有者回合内免于摧毁。`);
      return false;
    }
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
    const adjacentProtectionSources = game.boardCards.filter((item) => (
      item.ownerId === card.ownerId
      && item.uid !== card.uid
      && Math.abs(item.row - card.row) + Math.abs(item.col - card.col) === 1
      && typeof coreCardEffectDefinition(item)?.onBeforeAdjacentAllyDestroy === "function"
    ));
    for (const protector of adjacentProtectionSources) {
      const result = coreCardEffectDefinition(protector).onBeforeAdjacentAllyDestroy(coreCreateCardEffectContext(
        game,
        corePlayer(game, protector.ownerId),
        protector,
        log,
        { protectedCard: card, original, causeCard }
      ));
      if (result === false) return false;
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
    coreEmitV2Event(game, CORE_V2_EVENT.CARD_DESTROYED, { destroyedCard: card, original, causeCard, log });
    coreEnforceElitePowerBounds(game);
    return true;
  }

  function coreRunV2MoveEffects(game, card, source, target, successful) {
    if (!successful) return;
    coreInvalidateControlCellOnEntry(game, card);
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

  function coreCanPlaceCard(game, card) {
    if (!card) return false;
    return coreEliteAiRuleAllows(game, "allowPlacement", { card });
  }

  function coreValidMoves(game, card) {
    if (!card || card.isGuard || coreCardEffectHasFlag(card, "cannotMove") || card.ownerId !== game.activePlayerId || card.restedTurn === game.turn || game.moveLocks?.[card.uid] === game.turn) {
      return [];
    }
    // Check if card can move (accounting for extra move from onPlace effects)
    if (!coreEliteAiRuleAllows(game, "allowMovement", { card })) {
      if (!(card.v2ExtraMoveAllowed && card.v2ExtraMoveUsed !== game.turn)) return [];
    }
    // Mark extra move as used this turn if being used
    if (card.v2ExtraMoveAllowed && card.v2ExtraMoveUsed !== game.turn && card.lastMovedTurn === game.turn) {
      card.v2ExtraMoveUsed = game.turn;
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
    if (!player) return null;
    const selection = game.selection;
    if (selection.handCardUid && selection.targetCell) {
      if (!coreCanUseAction(game)) return null;
      const card = player.hand.find((item) => item.uid === selection.handCardUid);
      const legal = corePlacementAvailability(game).cells.some((cell) => (
        cell.row === selection.targetCell.row && cell.col === selection.targetCell.col
      ));
      return card && legal && coreCanPlaceCard(game, card)
        ? { type: "place", playerId: player.id, cardUid: card.uid, target: { ...selection.targetCell } }
        : null;
    }
    if (selection.boardCardUid && selection.targetCell) {
      const card = game.boardCards.find((item) => item.uid === selection.boardCardUid && item.ownerId === player.id);
      if (!coreCanUseAction(game, card)) return null;
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
    if (!player || !card || !coreCanUseAction(game, card) || (action.type === "place" && !coreCanPlaceCard(game, card))) {
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
      const extraPlacementSourceUid = player.v2NextPlacementExtraTurn === game.turn
        ? player.v2NextPlacementExtra
        : null;
      if (player.v2NextPlacementExtra && !extraPlacementSourceUid) {
        player.v2NextPlacementExtra = null;
        player.v2NextPlacementExtraTurn = null;
      }
      const originalPlacingPlayerId = card.ownerId;
      coreApplyV2PlacementSkill(game, player, card, skillLog);
      coreInvalidateControlCellOnEntry(game, card);
      if (extraPlacementSourceUid && extraPlacementSourceUid !== card.uid) {
        // The marker belongs to this placement even when the original skill removes the card.
        if (game.boardCards.includes(card)) coreApplyV2PlacementSkill(game, player, card, skillLog);
        if (player.v2NextPlacementExtra === extraPlacementSourceUid) {
          player.v2NextPlacementExtra = null;
          player.v2NextPlacementExtraTurn = null;
        }
        skillLog.push(`${coreCardName(card)} 的放置技能额外结算 1 次。`);
      }
      coreEmitV2Event(game, CORE_V2_EVENT.CARD_PLACED, { player: corePlayer(game, originalPlacingPlayerId), card, log: skillLog });
      if (skillLog.length) skillLog.forEach((entry) => coreAppendLog(game, entry));
      game.effectBoardCards = null;
      const restMessage = card.restedTurn === game.turn ? "该卡本回合进入休整。" : "该卡本回合不进入休整。";
      coreAppendLog(game, `${player.name} 将 ${coreCardName(card)} 放置在 ${formatCell(card.row, card.col)}，${restMessage}`);
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
        const targetPosition = { row: action.target.row, col: action.target.col };
        // Treat the move as completed before combat effects resolve. If the
        // attacker does not successfully capture the target, it is restored
        // after all combat and destruction effects have finished.
        card.row = targetPosition.row;
        card.col = targetPosition.col;
        const combatLog = [];

        // Trigger onBeforeAttack effects on attacker
        const attackerDef = coreCardEffectDefinition(card);
        if (typeof attackerDef?.onBeforeAttack === "function") {
          attackerDef.onBeforeAttack(coreCreateCardEffectContext(game, player, card, combatLog, { targetCard: defender }));
        }

        // Trigger onUnderAttack effects on defender
        const defenderDef = coreCardEffectDefinition(defender);
        if (typeof defenderDef?.onUnderAttack === "function") {
          defenderDef.onUnderAttack(coreCreateCardEffectContext(game, corePlayer(game, defender.ownerId), defender, combatLog, { attacker: card }));
        }

        const attackerValue = Number(card.currentAttack ?? card.attack) || 0;
        const defenderValue = Number(defender.currentAttack ?? defender.attack) || 0;
        const outcome = attackerValue > defenderValue ? "a" : attackerValue < defenderValue ? "b" : "both";
        let attackerDestroyed = false;
        let defenderDestroyed = false;
        if (outcome === "a") {
          const defenderPosition = { row: defender.row, col: defender.col };
          defenderDestroyed = coreDestroyV2Card(game, defender, combatLog, card);
          if (defenderDestroyed && game.boardCards.includes(card)) {
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
        if (game.boardCards.includes(card) && !(outcome === "a" && defenderDestroyed)) {
          card.row = sourcePosition.row;
          card.col = sourcePosition.col;
        }
        combatLog.forEach((entry) => coreAppendLog(game, entry));
        game.effectBoardCards = null;
        await finishCombatAnimation(game, combatScene, game.boardCards);
      }
    }

    coreEnforceElitePowerBounds(game);
    syncPlayerBoardIds(game);
    if (typeof flushPendingAnimations === "function") await flushPendingAnimations(game);
    const traitConsumesAction = coreEliteAiRuleAllows(game, "consumeAction", { player, card, action });
    const consumesAction = traitConsumesAction && (action.type === "place" || !coreHasFreeAction(game, card));
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

  function coreMarkGameSettlement(game, winnerId, text) {
    game.currentPhase = "胜负结算";
    game.lastResolution = text;
    game.turnDeadlineAt = null;
    game.selection = resetSelection();
    if (game.winner?.playerId !== winnerId) {
      game.winner = { playerId: winnerId, text };
    }
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
      const retainedEliteBonus = Number(card.eliteTraitTempBonusUntilOwnTurn) || 0;
      card.v2TempBonus = retainedEliteBonus;
      card.currentAttack = Math.max(0, (Number(card.attack) || 0) + (Number(card.v2PermanentBonus) || 0) + retainedEliteBonus);
    });
    coreEnforceElitePowerBounds(game);
    active.v2NextPlacementExtra = null;
    active.v2NextPlacementExtraTurn = null;
    game.extraActions = 0;
  }

  async function coreStartTurnWithAnimations(game) {
    if (!game) return false;
    game.isAnimating = true;
    game.flowPrompt = `第 ${game.turn} 回合开始：正在依次结算卡牌技能。`;
    let wonAtStart = false;
    try {
      wonAtStart = coreStartTurn(game);
      coreRender();
      if (typeof flushPendingAnimations === "function") await flushPendingAnimations(game);
      game.flowPrompt = "";
      return wonAtStart;
    } finally {
      game.isAnimating = false;
      coreRender();
    }
  }

  async function coreEndTurn(game = state.game, automatic = false) {
    if (!game || game.isAnimating || game.winner) {
      return;
    }
    game.turnDeadlineAt = null;
    coreUpdateTurnTimerUi(game);
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
    const wonAtStart = await coreStartTurnWithAnimations(game);
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

  async function coreTickTurnTimer(now = Date.now()) {
    const game = state.game;
    coreUpdateTurnTimerUi(game, now);
    if (!game || game.winner || game.currentPhase !== "行动阶段"
      || coreTurnSecondsRemaining(game, now) !== 0
      || !coreTimerIsAuthority(game) || game.isAnimating || coreTimerEndingTurn) return false;
    const active = corePlayer(game, game.activePlayerId);
    if (!active) return false;
    coreTimerEndingTurn = true;
    game.turnDeadlineAt = null;
    const message = `${active.name} 的 ${CORE_TURN_TIME_LIMIT_SECONDS} 秒行动时间已用尽，系统自动结束回合。`;
    coreAppendLog(game, message);
    game.lastResolution = message;
    coreRender();
    showToast("回合超时", message);
    try {
      await coreEndTurn(game, true);
    } finally {
      coreTimerEndingTurn = false;
    }
    return true;
  }

  function coreScheduleTurnTimerTick() {
    window.setTimeout(async () => {
      try {
        await coreTickTurnTimer();
      } finally {
        coreScheduleTurnTimerTick();
      }
    }, CORE_TIMER_TICK_MS);
  }

  async function coreSurrender(game = state.game, surrenderingPlayerId = game?.activePlayerId) {
    if (!game || game.isAnimating || game.winner) return;
    const surrenderingPlayer = corePlayer(game, Number(surrenderingPlayerId));
    const winner = surrenderingPlayer && corePlayer(game, otherPlayerId(surrenderingPlayer.id));
    if (!surrenderingPlayer || !winner) return;
    const control = coreControlMap(game);
    game.players.forEach((player) => { player.lastControlCount = control.counts[player.id]; });
    game.finalControlCounts = { ...control.counts };
    game.winner = {
      playerId: winner.id,
      text: `${surrenderingPlayer.name} 已认输，${winner.name} 获胜。`
    };
    game.currentPhase = "胜负结算";
    game.turnDeadlineAt = null;
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

  // The scorer is intentionally heuristic: generic positional terms apply to all
  // cards, while the card-id branches below encode deck-specific play patterns on
  // top of the data-driven effects. New cards work without touching this function;
  // the id branches only sharpen how the AI values cards it already plays well.
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
    const movableCards = game.boardCards.filter((card) => card.ownerId === player.id && !card.isGuard && coreCanUseAction(game, card));
    movableCards.forEach((card) => coreValidMoves(game, card).forEach((target) => {
      const score = coreAiMoveScore(game, player, card, target);
      if (Number.isFinite(score)) candidates.push({ score, action: { type: "move", playerId: player.id, cardUid: card.uid, source: { row: card.row, col: card.col }, target } });
    }));
    if (player.hand.some((card) => coreCanUseAction(game, card) && coreCanPlaceCard(game, card))) {
      const cells = corePlacementAvailability(game).cells;
      player.hand.filter((card) => coreCanUseAction(game, card) && coreCanPlaceCard(game, card)).forEach((card) => cells.forEach((target) => candidates.push({
        score: coreAiPlacementScore(game, player, card, target),
        action: { type: "place", playerId: player.id, cardUid: card.uid, target }
      })));
    }
    if (!candidates.length) return null;
    const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
    const shortlist = candidates.filter((candidate) => candidate.score >= bestScore - 0.35);
    return shortlist[randomInt(0, shortlist.length - 1)].action;
  }

  function coreCheckAiSurrender(game, player) {
    if (!game || !player) return false;
    const handEmpty = player.hand.length === 0;
    const deckEmpty = player.drawPile.length === 0;
    const boardEmpty = !game.boardCards.some((card) => card.ownerId === player.id && !card.isGuard);
    return handEmpty && deckEmpty && boardEmpty;
  }

  function coreCalculatePositionAdvantage(game, player) {
    const control = coreControlMap(game).counts;
    const ownControl = control[player.id] || 0;
    const enemyControl = control[otherPlayerId(player.id)] || 0;
    const ownPower = game.boardCards
      .filter((card) => card.ownerId === player.id && !card.isGuard)
      .reduce((sum, card) => sum + (Number(card.currentAttack ?? card.attack) || 0), 0);
    const enemyPower = game.boardCards
      .filter((card) => card.ownerId !== player.id && !card.isGuard)
      .reduce((sum, card) => sum + (Number(card.currentAttack ?? card.attack) || 0), 0);
    return {
      controlDiff: ownControl - enemyControl,
      powerDiff: ownPower - enemyPower,
      totalAdvantage: (ownControl - enemyControl) * 10 + (ownPower - enemyPower)
    };
  }

  function coreEvaluateCardEffectRisk(game, player, card, isPlacement = false) {
    const definition = coreCardEffectDefinition(card);
    if (!definition) return 0;

    let riskScore = 0;

    if (isPlacement) {
      if (definition.onPlace) {
        if (coreCardEffectHasFlag(card, "hasDangerousEffect")) riskScore -= 5;
        if (coreCardEffectHasFlag(card, "needsSetup")) riskScore -= 3;
      }
    }

    if (definition.onCombatResolved) {
      if (coreCardEffectHasFlag(card, "hasDangerousEffect")) riskScore -= 4;
    }

    if (definition.onOwnCardAttackIncreased || definition.onOwnCardAttackDecreased) {
      if (coreCardEffectHasFlag(card, "buffsAllies")) riskScore += 2;
    }

    return riskScore;
  }

  function coreSimulateActionOutcome(game, player, action) {
    const before = coreCalculatePositionAdvantage(game, player);
    const enemy = otherPlayerId(player.id);

    if (action.type === "place") {
      const cell = action.target;
      const card = player.hand.find((c) => c.uid === action.cardUid);
      if (!card) return null;

      const cardAttack = Number(card.currentAttack ?? card.attack) || 0;
      const neighbors = getOrthogonalNeighbors(cell.row, cell.col)
        .filter((c) => coreIsInsideBoard(c.row, c.col, game))
        .map((c) => getBoardCardAt(game, c.row, c.col))
        .filter(Boolean);

      let powerChange = cardAttack;
      let controlChange = 1;
      let effectRisk = coreEvaluateCardEffectRisk(game, player, card, true);

      for (const neighbor of neighbors) {
        if (neighbor.ownerId === player.id) {
          continue;
        }
        const defenderAttack = Number(neighbor.currentAttack ?? neighbor.attack) || 0;
        if (cardAttack > defenderAttack) {
          powerChange += defenderAttack;
          controlChange += 1;

          const defenderDef = coreCardEffectDefinition(neighbor);
          if (defenderDef?.onCombatResolved && coreCardEffectHasFlag(neighbor, "retaliate")) {
            effectRisk -= 3;
          }
        } else if (cardAttack === defenderAttack) {
          powerChange -= cardAttack;
        } else {
          powerChange -= cardAttack;
          if (coreCardEffectHasFlag(neighbor, "retaliate")) {
            effectRisk -= 4;
          }
        }
      }

      return {
        controlDiff: before.controlDiff + controlChange,
        powerDiff: before.powerDiff + powerChange,
        totalAdvantage: before.totalAdvantage + controlChange * 10 + powerChange + effectRisk
      };
    } else if (action.type === "move") {
      const card = game.boardCards.find((c) => c.uid === action.cardUid);
      if (!card || card.ownerId !== player.id) return null;

      const targetCell = action.target;
      const targetCard = getBoardCardAt(game, targetCell.row, targetCell.col);

      if (!targetCard) {
        const moveRisk = coreEvaluateCardEffectRisk(game, player, card, false);
        return {
          controlDiff: before.controlDiff,
          powerDiff: before.powerDiff,
          totalAdvantage: before.totalAdvantage + moveRisk
        };
      }

      if (targetCard.ownerId === player.id) {
        return null;
      }

      const attackerAttack = Number(card.currentAttack ?? card.attack) || 0;
      const defenderAttack = Number(targetCard.currentAttack ?? targetCard.attack) || 0;

      let powerChange = 0;
      let controlChange = 0;
      let effectRisk = 0;

      const cardDef = coreCardEffectDefinition(card);
      const targetDef = coreCardEffectDefinition(targetCard);

      if (attackerAttack > defenderAttack) {
        powerChange = defenderAttack;
        controlChange = 1;

        if (targetDef?.onCombatResolved && coreCardEffectHasFlag(targetCard, "retaliate")) {
          effectRisk -= 2;
        }
      } else if (attackerAttack === defenderAttack) {
        powerChange = -attackerAttack - defenderAttack;
        controlChange = 0;

        if (cardDef?.onCombatResolved && coreCardEffectHasFlag(card, "hasDangerousEffect")) {
          effectRisk -= 3;
        }
      } else {
        powerChange = -attackerAttack;
        controlChange = 0;

        if (coreCardEffectHasFlag(card, "avoidCombatWhenBehind")) {
          effectRisk -= 5;
        }

        if (targetDef?.onCombatResolved && coreCardEffectHasFlag(targetCard, "retaliate")) {
          effectRisk -= 4;
        }
      }

      return {
        controlDiff: before.controlDiff + controlChange,
        powerDiff: before.powerDiff + powerChange,
        totalAdvantage: before.totalAdvantage + controlChange * 10 + powerChange + effectRisk
      };
    }

    return null;
  }

  function coreIsActionBeneficial(game, player, action) {
    const after = coreSimulateActionOutcome(game, player, action);
    if (!after) return true;

    const before = coreCalculatePositionAdvantage(game, player);

    if (before.totalAdvantage >= 0) {
      return after.totalAdvantage >= before.totalAdvantage;
    } else {
      return after.totalAdvantage >= before.totalAdvantage;
    }
  }

  async function coreRunAiTurn(game) {
    const ai = corePlayer(game, game.activePlayerId);
    if (!game || game.winner || !ai?.isAI || game.isAnimating) {
      return;
    }

    if (coreCheckAiSurrender(game, ai)) {
      await coreSurrender(game, ai.id);
      return;
    }

    while (!game.winner && game.activePlayerId === ai.id && coreHasExecutableAction(game)) {
      const action = corePlanAiAction(game, ai);
      if (!action) {
        await coreEndTurn(game, false);
        return;
      }

      if (!coreIsActionBeneficial(game, ai, action)) {
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
    const canInteract = coreCanViewerInteract(game);
    const selectedHand = canInteract ? active.hand.find((card) => card.uid === game.selection.handCardUid) || null : null;
    const placeTargets = selectedHand ? corePlacementAvailability(game).cells : [];
    const selectedBoard = canInteract ? game.boardCards.find((card) => card.uid === game.selection.boardCardUid) || null : null;
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
        cell.disabled = game.isAnimating || !canInteract;
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
      : `${display.name}，战力 ${card.currentAttack}，${getCampDisplayName(display.camp)}。技能：${display.skill}。`);
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
      <div class="unit-tooltip" role="tooltip">
        <div class="tooltip-section tooltip-power"><span class="tooltip-section-label">当前战力</span><strong>${card.currentAttack}</strong></div>
        <div class="tooltip-section"><span class="tooltip-section-label">完整技能效果</span><span class="skill-effect-list">${coreSkillEffectHtml(card)}</span></div>
        <div class="tooltip-section tooltip-status"><span class="tooltip-section-label">当前状态</span><span class="unit-tooltip-state">${card.restedTurn === game.turn ? "休整中：本回合不能主动移动。" : "可行动：未处于休整状态。"}</span></div>
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
    if (coreIsSpectator()) {
      const notice = document.createElement("div");
      notice.className = "spectator-hand-notice";
      notice.innerHTML = "<strong>观战模式</strong><span>双方手牌不可见，当前为只读视角。</span>";
      ui.handCards.appendChild(notice);
      return;
    }
    active.hand.forEach((card) => {
      const display = coreCardDisplay(card);
      const element = document.createElement("button");
      element.type = "button";
      element.className = `card rarity-${display.rarity || "普通"}`;
      element.disabled = game.isAnimating || !coreCanViewerInteract(game);
      if (game.selection.handCardUid === card.uid) element.classList.add("selected");
      element.innerHTML = `
        <div class="card-top"><h3>${coreEscapeHtml(display.name)}</h3><strong>ATK ${coreCardBaseAttack(card)}</strong></div>
        <p class="card-stats">${coreEscapeHtml(getCardTierLabel(card))} · ${coreEscapeHtml(getCampDisplayName(display.camp))}</p>
        <p class="card-effect">${coreEscapeHtml(display.skill)}</p>
        <span class="hand-skill-tooltip" role="tooltip">
          <span class="tooltip-section tooltip-power"><span class="tooltip-section-label">当前战力</span><strong>${card.currentAttack ?? card.attack}</strong></span>
          <span class="tooltip-section"><span class="tooltip-section-label">完整技能效果</span><span class="skill-effect-list">${coreSkillEffectHtml(card)}</span></span>
          <span class="tooltip-section tooltip-status"><span class="tooltip-section-label">当前状态</span><span>手牌中：可放置。</span></span>
        </span>
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
    const spectator = coreIsSpectator();
    const ownPlayer = spectator ? corePlayer(game, 1) : corePlayer(game, coreViewerPlayerId(game)) || game.players[0];
    const opponentPlayer = spectator ? corePlayer(game, 2) : corePlayer(game, otherPlayerId(ownPlayer.id)) || game.players.find((player) => player.id !== ownPlayer.id);
    const opponentTurn = coreIsOpponentTurn(game);
    const handOwner = game.mode === "online"
      ? ownPlayer
      : active;
    const control = coreControlMap(game);
    const target = coreVictoryTarget(game);
    ui.modeLabel.textContent = `${coreModeLabel(game.mode)} · ${game.boardSize}x${game.boardSize}`;
    ui.turnLabel.textContent = `第 ${game.turn} / ${CORE_MAX_TURNS} 回合`;
    const levelLabel = document.getElementById("challenge-level-label");
    if (levelLabel) {
      if (levelLabel.parentElement) levelLabel.parentElement.hidden = !coreIsPveChallenge(game);
      levelLabel.textContent = coreIsPveChallenge(game) ? `第 ${game.challengeLevel} 关` : "";
    }
    ui.phaseLabel.textContent = game.currentPhase;
    ui.deckLabel.textContent = `${game.players[0].id} VS ${game.players[1].id}`;
    ui.statusMessage.textContent = game.flowPrompt || game.lastResolution;
    ui.statusSubtext.textContent = game.isAnimating
      ? "正在展示本次行动与交战结果。"
      : `占领 ${target} 格即可立即获胜；当前行动位 ${game.actionsUsed}/${coreActionLimit(game)}。`;
    ui.actingPlayerLabel.textContent = `${active.name}${active.id === game.firstPlayerId ? "（先手）" : "（后手）"}`;
    ui.actionsLabel.textContent = `${game.actionsUsed} / ${coreActionLimit(game)}`;
    ui.actionsLabel.classList.toggle("is-opponent-turn", opponentTurn);
    const handActionPanel = document.getElementById("hand-action-count");
    handActionPanel?.classList.toggle("is-complete", game.actionsUsed >= coreActionLimit(game) && !coreHasExecutableAction(game));
    handActionPanel?.classList.toggle("is-opponent-turn", opponentTurn);
    const handActionCount = document.querySelector("#hand-action-count strong");
    if (handActionCount) handActionCount.textContent = `${game.actionsUsed} / ${coreActionLimit(game)}`;
    coreUpdateTurnTimerUi(game);
    const controlCompare = document.getElementById("control-compare-label");
    if (controlCompare) {
      controlCompare.querySelector(".control-player-one .control-player-score").textContent = control.counts[1];
      controlCompare.querySelector(".control-player-two .control-player-score").textContent = control.counts[2];
    }
    const renderPlayerPanel = (player, controlElement, summaryElement) => {
      if (!player) return;
      const campName = getCampDisplayName(player.deckKey);
      controlElement.textContent = `${control.counts[player.id]} / ${target} 格`;
      summaryElement.setAttribute("aria-label", `${player.name}，${campName}，手牌 ${player.hand.length}/${HAND_LIMIT}，牌库 ${player.drawPile.length}`);
      summaryElement.innerHTML = `
        <span class="player-summary-name">${coreEscapeHtml(player.name)}</span>
        <span class="player-summary-camp">${coreEscapeHtml(campName)}</span>
        <span class="player-resource-row">
          <span class="player-resource"><small>手牌</small><strong>${player.hand.length} / ${HAND_LIMIT}</strong></span>
          <span class="player-resource"><small>牌库</small><strong>${player.drawPile.length}</strong></span>
        </span>
      `;
    };
    renderPlayerPanel(opponentPlayer, ui.opponentPlayerControl, ui.opponentPlayerSummary);
    renderPlayerPanel(ownPlayer, ui.ownPlayerControl, ui.ownPlayerSummary);
    if (ui.opponentPlayerTitle) ui.opponentPlayerTitle.textContent = spectator ? "玩家 2" : "对方玩家";
    if (ui.ownPlayerTitle) ui.ownPlayerTitle.textContent = spectator ? "玩家 1" : "我方玩家";
    if (ui.opponentAiEffect) {
      const traits = opponentPlayer?.isAI && coreIsPveChallenge(game) ? coreEliteAiTraitInfos(game) : [];
      ui.opponentAiEffect.hidden = !traits.length;
      ui.opponentAiEffect.innerHTML = traits.length
        ? `<span class="ai-effect-label">本关精英词条</span>${coreEliteAiTraitMarkup(traits)}`
        : "";
    }
    if (ui.ownChallengeEffects) {
      if (coreIsPveChallenge(game) && !spectator) {
        const playerTraitIds = game.challengePlayerTraitIds || [];
        const info = window.ELITE_AI_EFFECT_INFO_V2 || {};
        const traits = playerTraitIds.map((id) => ({ ...info[id], name: info[id]?.name || id, description: info[id]?.description || "", level: info[id]?.level || "beginner" })).filter(Boolean);
        ui.ownChallengeEffects.hidden = !traits.length;
        ui.ownChallengeEffects.innerHTML = traits.length
          ? `<span class="ai-effect-label">我的词条奖励</span>${coreEliteAiTraitMarkup(traits)}`
          : "";
      } else {
        ui.ownChallengeEffects.hidden = true;
      }
    }
    ui.handTitle.textContent = spectator ? "观战视角" : `${handOwner.name} 的手牌`;
    ui.submitActionBtn.hidden = true;
    ui.submitActionBtn.disabled = true;
    ui.cancelSelectionBtn.hidden = spectator;
    ui.cancelSelectionBtn.disabled = game.isAnimating || !coreCanViewerInteract(game);
    coreUi.endTurnBtn.hidden = spectator;
    coreUi.endTurnBtn.disabled = game.isAnimating || !coreCanViewerInteract(game);
    coreUi.endTurnBtn.classList.toggle("is-highlighted", !spectator && coreCanViewerInteract(game) && !game.isAnimating && !game.winner && !coreHasExecutableAction(game));
    if (coreUi.surrenderBtn) {
      coreUi.surrenderBtn.hidden = spectator;
      coreUi.surrenderBtn.disabled = game.isAnimating || Boolean(game.winner) || (game.mode !== "online" && active.isAI);
    }
    ui.restartBtn.hidden = spectator;
    ui.restartBtn.disabled = game.isAnimating;
    ui.backMenuBtn.disabled = game.isAnimating;
    ui.backMenuBtn.textContent = spectator ? "退出观战" : "返回主菜单";
    if (spectator) {
      ui.selectionSummary.textContent = "观战模式为只读视角，不可操作卡牌或棋盘。";
    } else if (game.selection.handCardUid) {
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
      ? `${getCampDisplayName(selectedDisplay.camp)} · 当前战力 ${selectedCard.currentAttack} · 基础战力 ${coreCardBaseAttack(selectedCard)}`
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
    coreRenderHand(game, handOwner);
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => coreFitSingleLineText(ui.board));
    else window.setTimeout(() => coreFitSingleLineText(ui.board), 0);
  }

  function coreHandleHandClick(cardUid) {
    const game = state.game;
    if (!game || game.isAnimating || !coreCanViewerInteract(game)) return;
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
    if (!game || game.isAnimating || !coreCanViewerInteract(game) || isBrokenCell(game, row, col)) return;
    const active = corePlayer(game, game.activePlayerId);
    const target = getBoardCardAt(game, row, col);
    const selectedCard = game.boardCards.find((item) => item.uid === game.selection.boardCardUid);
    const actionCard = target?.ownerId === active.id ? target : selectedCard;
    if (!coreCanUseAction(game, actionCard)) {
      showToast("行动次数已用完", "本回合不能继续行动，请结束回合。");
      coreRender();
      return;
    }
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
    if (!game || game.isAnimating || game.winner || !coreCanViewerInteract(game)) return;
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

  function coreValidatedOnlinePlayerName() {
    const playerName = state.playerName;
    if (corePlayerNameIsValid(playerName)) return playerName;
    showToast("玩家 ID 无效", "请输入 1-6 个中文字符，或 1-12 个英文字母。");
    return null;
  }

  function coreRoomStatusLabel(room) {
    if (room.ended) return "已结束";
    if (room.started) return "对局中";
    if (room.playerCount >= room.playerCapacity) return "等待开局";
    return "等待玩家";
  }

  function coreFallbackCopyText(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }

  async function coreCopyRoomCode(roomCode) {
    const code = String(roomCode || "").trim();
    if (!code) {
      showToast("复制失败", "当前没有可复制的房间码。");
      return false;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else if (!coreFallbackCopyText(code)) {
        throw new Error("Clipboard API unavailable");
      }
      showToast("房间码已复制", coreEscapeHtml(code));
      return true;
    } catch (_error) {
      try {
        if (coreFallbackCopyText(code)) {
          showToast("房间码已复制", coreEscapeHtml(code));
          return true;
        }
      } catch (_fallbackError) { /* clipboard access may be blocked */ }
      showToast("复制失败", "请手动复制房间码。");
      return false;
    }
  }

  function coreAttachRoomCopyButtons(root = document) {
    root.querySelectorAll("[data-copy-room-code]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await coreCopyRoomCode(button.dataset.copyRoomCode);
      });
    });
  }

  function coreRenderRoomList(rooms = state.online?.rooms || []) {
    const list = document.getElementById("online-room-list");
    const count = document.getElementById("online-room-count");
    if (!list) return;
    if (count) count.textContent = `${rooms.length} 个房间`;
    if (!rooms.length) {
      list.innerHTML = '<p class="online-room-empty">暂无公开房间，可先创建一个房间。</p>';
      return;
    }
    list.innerHTML = rooms.map((room) => {
      const roomCode = coreEscapeHtml(room.roomCode);
      const names = [room.names?.[1], room.names?.[2]].filter(Boolean).map(coreEscapeHtml).join(" vs ") || "等待玩家";
      const action = room.canJoin
        ? `<button class="secondary-btn online-room-action" type="button" data-room-action="join" data-room-code="${roomCode}">加入对局</button>`
        : room.canSpectate
          ? `<button class="primary-btn online-room-action" type="button" data-room-action="spectate" data-room-code="${roomCode}">进入观战</button>`
          : `<button class="secondary-btn online-room-action" type="button" disabled>${room.ended ? "对局已结束" : room.spectatorCount >= room.spectatorCapacity ? "观战已满" : "暂不可加入"}</button>`;
      const boardSize = Number(room.boardSize) || 4;
      return `
        <div class="online-room-row">
          <div class="online-room-identity">
            <div class="online-room-code-line">
              <strong>${roomCode}</strong>
              <button class="online-room-copy-btn" type="button" data-copy-room-code="${roomCode}" aria-label="复制房间码 ${roomCode}" title="复制房间码">复制</button>
            </div>
            <span>${names}</span>
          </div>
          <span class="online-room-state state-${room.ended ? "ended" : room.started ? "playing" : "waiting"}">${coreRoomStatusLabel(room)}</span>
          <span class="online-room-map">${boardSize}x${boardSize}</span>
          <span class="online-room-seats"><small>玩家</small><strong>${Number(room.playerCount) || 0}/${Number(room.playerCapacity) || 2}</strong></span>
          <span class="online-room-seats"><small>观战</small><strong>${Number(room.spectatorCount) || 0}/${Number(room.spectatorCapacity) || 2}</strong></span>
          ${action}
        </div>
      `;
    }).join("");
    coreAttachRoomCopyButtons(list);
    list.querySelectorAll("[data-room-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const playerName = coreValidatedOnlinePlayerName();
        if (!playerName) return;
        const roomCode = button.dataset.roomCode;
        const sent = button.dataset.roomAction === "spectate"
          ? window.CardOnline.joinSpectator(roomCode, playerName)
          : window.CardOnline.joinRoom(roomCode, playerName);
        if (!sent) showToast("联网未连接", "请稍候再加入房间。");
      });
    });
  }

  function coreShowSpectatorWaiting(roomState = state.online?.roomState || {}) {
    const names = roomState.names || {};
    const spectators = Object.values(roomState.spectatorNames || {}).filter(Boolean).map(coreEscapeHtml);
    const boardSize = Number(roomState.boardSize || state.selectedBoardSize) || 4;
    const roomCode = coreEscapeHtml(state.online?.roomCode);
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card online-room-card" role="dialog" aria-modal="true" aria-label="观战等待">
        <button id="spectator-leave-room" class="overlay-close" type="button" aria-label="退出观战">退出观战</button>
        <p class="phase-banner-eyebrow">SPECTATOR</p>
        <div class="online-room-heading">
          <h2 class="deck-reveal-title">观战房间 ${roomCode}</h2>
          <button class="online-room-copy-btn" type="button" data-copy-room-code="${roomCode}" aria-label="复制房间码 ${roomCode}" title="复制房间码">复制</button>
        </div>
        <p class="deck-reveal-copy">${roomState.started ? "正在载入对局状态……" : "玩家正在准备，开局后将自动进入观战。"}</p>
        <div class="online-room-players">
          <div><small>玩家 1</small><strong>${coreEscapeHtml(names[1] || "等待玩家")}</strong></div>
          <div><small>玩家 2</small><strong>${coreEscapeHtml(names[2] || "等待玩家")}</strong></div>
        </div>
        <p class="spectator-readonly-note">只读观战 · ${boardSize}x${boardSize} 地图 · 观战席 ${Number(roomState.spectatorCount) || spectators.length}/2</p>
        <p class="deck-reveal-copy">${spectators.length ? `当前观战：${spectators.join("、")}` : ""}</p>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachRoomCopyButtons(ui.deckReveal);
    document.getElementById("spectator-leave-room")?.addEventListener("click", () => window.resetToMenu?.());
  }

  function coreShowOnlineWaiting(roomState = state.online.roomState || {}) {
    const roomCode = coreEscapeHtml(state.online.roomCode);
    const ownId = state.online.playerId;
    const ownDeck = state.online.deckKey || "三国~蜀";
    const deckOptions = getAvailableDeckKeys().map((deck) => `<option value="${deck}" ${deck === ownDeck ? "selected" : ""}>${getCampDisplayName(deck)}</option>`).join("");
    const playerStateText = (id) => roomState.names?.[id] && roomState.connectedPlayers?.[id] === false
      ? "等待重连"
      : roomState.ready?.[id] ? "已准备" : "未准备";
    const disconnectedPlayerId = [1, 2].find((id) => roomState.names?.[id] && roomState.connectedPlayers?.[id] === false);
    const waitingStatus = disconnectedPlayerId
      ? `玩家 ${disconnectedPlayerId} 已断线，席位保留 5 分钟……`
      : roomState.hasPlayers?.[2] ? "等待双方准备……" : "等待玩家 2 加入……";
    const ownReady = Boolean(roomState.ready?.[ownId]);
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card online-room-card" role="dialog" aria-modal="true" aria-label="等待联网玩家">
        <button id="online-leave-room" class="overlay-close" type="button" aria-label="退出房间">退出房间</button>
        <p class="phase-banner-eyebrow">ONLINE MATCH</p>
        <div class="online-room-heading">
          <h2 class="deck-reveal-title">房间 ${roomCode}</h2>
          <button class="online-room-copy-btn" type="button" data-copy-room-code="${roomCode}" aria-label="复制房间码 ${roomCode}" title="复制房间码">复制</button>
        </div>
        <p class="deck-reveal-copy">地图：${roomState.boardSize || state.selectedBoardSize}x${roomState.boardSize || state.selectedBoardSize}。请将房间号发送给另一位玩家。</p>
        <div class="online-room-players">
          <div><strong>${coreEscapeHtml(roomState.names?.[1] || (ownId === 1 ? state.playerName : "等待玩家"))}</strong><span>${playerStateText(1)}</span></div>
          <div><strong>${coreEscapeHtml(roomState.names?.[2] || (ownId === 2 ? state.playerName : "等待加入"))}</strong><span>${playerStateText(2)}</span></div>
        </div>
        <label class="online-deck-choice">我的卡组<select id="online-deck-choice" ${ownReady ? "disabled" : ""}>${deckOptions}</select></label>
        <button id="online-ready-btn" class="primary-btn" type="button">${ownReady ? "取消准备" : "准备"}</button>
        <p id="online-room-status" class="deck-reveal-copy">${waitingStatus}</p>
        <p class="spectator-capacity-note">观战席 ${Number(roomState.spectatorCount) || 0}/${Number(roomState.spectatorCapacity) || 2}</p>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachRoomCopyButtons(ui.deckReveal);
    document.getElementById("online-leave-room")?.addEventListener("click", () => {
      if (!window.confirm("确定退出房间吗？")) return;
      coreCloseOverlay();
      window.resetToMenu?.();
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
    window.setTimeout(async () => {
      if (!state.game || state.game.currentPhase !== "开局展示") return;
      coreCloseOverlay();
      const wonAtStart = await coreStartTurnWithAnimations(state.game);
      if (wonAtStart) showResult();
      else coreOnlineSendState(state.game);
    }, 5000);
  }

  function coreUpdateOnlineStatus(text) {
    const status = document.getElementById("online-lobby-status");
    if (status) status.textContent = text;
  }

  function coreSaveOnlineRoom(roomCode, playerName, sessionToken) {
    try { window.localStorage?.setItem("cardDemoOnlineRoom", JSON.stringify({ roomCode, playerName, sessionToken })); } catch (_error) { /* ignore */ }
  }

  function coreHandleOnlineConnected(message) {
    if (state.online?.roomCode && state.online?.sessionToken && state.online?.role === "player") {
      coreUpdateOnlineStatus("已重新连接，正在恢复房间……");
      state.online.reconnecting = true;
      window.CardOnline.resumeRoom(state.online.roomCode, state.online.playerName || state.playerName, state.online.sessionToken);
      return;
    }
    coreUpdateOnlineStatus("已连接，房间列表会自动更新。");
    window.CardOnline?.listRooms?.();
  }

  function coreHandleOnlineDisconnected(message) {
    coreUpdateOnlineStatus("连接已中断，正在自动重连……");
    if (state.online?.roomCode && !state.online.reconnecting) showToast("连接已中断", "正在自动重连，玩家席位将保留 5 分钟。");
    state.online.reconnecting = true;
  }

  function coreHandleOnlineReconnecting(message) {
    coreUpdateOnlineStatus(`正在进行第 ${message.attempt || 1} 次重连……`);
  }

  function coreHandleOnlineRoomList(message) {
    state.online.rooms = Array.isArray(message.rooms) ? message.rooms : [];
    coreRenderRoomList(state.online.rooms);
  }

  function coreHandleOnlineRoomCreated(message) {
    state.online = { ...state.online, playerId: 1, roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken, host: true, role: "player", reconnecting: false };
    coreSaveOnlineRoom(message.roomCode, message.playerName, message.sessionToken);
    coreStartOnlineHost();
  }

  function coreHandleOnlineRoomJoined(message) {
    const playerId = Number(message.playerId) || 2;
    state.online = { ...state.online, playerId, roomCode: message.roomCode, playerName: message.playerName, sessionToken: message.sessionToken, host: playerId === 1, role: "player", reconnecting: false };
    coreSaveOnlineRoom(message.roomCode, message.playerName, message.sessionToken);
    coreCloseOverlay();
    state.selectedBoardSize = message.boardSize || state.selectedBoardSize;
    state.online.deckKey = getAvailableDeckKeys()[0] || "三国~蜀";
    showToast("已加入房间", `你已加入 ${message.opponentName || "另一位玩家"} 所在的房间。`);
    coreShowOnlineWaiting({ roomCode: message.roomCode, boardSize: state.selectedBoardSize, names: { [playerId]: state.playerName, [otherPlayerId(playerId)]: message.opponentName }, ready: { 1: false, 2: false }, hasPlayers: { 1: true, 2: true } });
  }

  function coreHandleOnlineSpectatorJoined(message) {
    state.online = { ...state.online, playerId: null, roomCode: message.roomCode, spectatorId: message.spectatorId, playerName: message.spectatorName, host: false, role: "spectator", roomState: message.roomState };
    state.selectedBoardSize = Number(message.boardSize) || state.selectedBoardSize;
    state.game = null;
    try { window.localStorage?.removeItem("cardDemoOnlineRoom"); } catch (_error) { /* storage may be unavailable */ }
    coreShowSpectatorWaiting(message.roomState);
    showToast("已进入观战", "观战席为只读状态，可随时退出。");
  }

  function coreHandleOnlinePeerJoined(message) {
    if (state.online.host) {
      showToast("玩家已加入", `${message.playerName || "玩家 2"} 已加入房间。`);
    }
  }

  function coreHandleOnlineRoomState(message) {
    if (!state.online.roomCode || message.state?.roomCode !== state.online.roomCode) return;
    state.online.roomState = message.state;
    if (coreIsSpectator()) {
      if (!state.game) coreShowSpectatorWaiting(message.state);
    } else if (!state.online.roomCode || !state.game || state.game.currentPhase === "开局展示") {
      coreShowOnlineWaiting(message.state);
    }
  }

  function coreHandleOnlineMatchStart(message) {
    if (!state.online.roomCode || (message.roomCode && message.roomCode !== state.online.roomCode)) return;
    showToast("双方已准备", "对局即将开始。");
    if (coreIsSpectator()) {
      state.online.roomState = { ...(state.online.roomState || {}), started: true, names: message.names, boardSize: message.boardSize };
      coreShowSpectatorWaiting(state.online.roomState);
    } else {
      coreStartOnlineMatch(message);
    }
  }

  function coreHandleOnlineRoomResumed(message) {
    const playerName = message.playerName || state.online.playerName || state.playerName;
    state.online = { ...state.online, playerId: message.playerId, roomCode: message.roomCode, playerName, sessionToken: message.sessionToken, deckKey: message.deckKey || state.online.deckKey, host: message.playerId === 1, role: "player", reconnecting: false, roomState: message.roomState };
    state.playerName = playerName;
    if (ui.playerIdValue) ui.playerIdValue.textContent = playerName;
    corePersistPlayerId(playerName);
    coreSaveOnlineRoom(message.roomCode, playerName, message.sessionToken);
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
      state.game = null;
      coreShowOnlineWaiting(message.roomState || { roomCode: message.roomCode, boardSize: message.boardSize, names: { [message.playerId]: playerName }, ready: {}, hasPlayers: { [message.playerId]: true } });
      showToast("已恢复房间", "已返回断线前的玩家席位。");
    }
  }

  function coreHandleOnlineResumeFailed(message) {
    try { window.localStorage?.removeItem("cardDemoOnlineRoom"); } catch (_error) { /* ignore */ }
    state.game = null;
    state.online = { ...state.online, playerId: null, roomCode: null, sessionToken: null, host: false, role: null, reconnecting: false };
    coreCloseOverlay();
    switchScreen("menu");
    showToast("房间已失效", message.message || "原房间不存在。");
  }

  function coreHandleOnlineSessionReplaced(message) {
    window.CardOnline?.disconnect?.();
    state.game = null;
    state.online = { ...state.online, playerId: null, roomCode: null, sessionToken: null, host: false, role: null, reconnecting: false };
    coreCloseOverlay();
    switchScreen("menu");
    showToast("连接已转移", message.message || "本房间已在另一个页面恢复。");
  }

  function coreHandleOnlineAutoSurrender(message) {
    if (state.game?.mode === "online") {
      state.game.winner = { playerId: state.online.playerId, text: message.message || "对方断线超过 5 分钟，视为自动认输。" };
      state.game.currentPhase = "胜负结算";
      state.game.lastResolution = state.game.winner.text;
      coreRender();
      showResult();
    }
  }

  function coreHandleOnlineStateSync(message) {
    if (!state.online.roomCode || (!message.roomCode || message.roomCode === state.online.roomCode) || !(coreIsSpectator() || !state.online.host) || !message.state) return;
    try {
      state.game = coreDeserializeOnlineGame(message.state);
    } catch (_error) {
      state.game = null;
      switchScreen("menu");
      showToast("对局数据不兼容", "收到的对局仍使用旧版卡牌数据，请重新进入房间。");
      return;
    }
    if (coreIsSpectator()) coreCloseOverlay();
    switchScreen("game");
    coreRender();
    if (state.game.winner) showResult();
  }

  function coreHandleOnlineSpectatorSessionEnded(message) {
    if (state.game?.mode === "online") {
      state.game.winner = { playerId: Number(message.winnerId) || 0, text: message.message || "本次观战已结束。" };
      state.game.finalControlCounts = coreControlMap(state.game).counts;
      state.game.currentPhase = "胜负结算";
      state.game.lastResolution = state.game.winner.text;
      coreRender();
      showResult();
    } else {
      window.resetToMenu?.();
      showToast("观战已结束", message.message || "本次观战已结束。");
    }
  }

  function coreHandleOnlineServerShutdown(message) {
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

  function coreHandleOnlineMessage(message) {
    if (!message) return;
    const handlers = {
      "connected": coreHandleOnlineConnected,
      "disconnected": coreHandleOnlineDisconnected,
      "reconnecting": coreHandleOnlineReconnecting,
      "room-list": coreHandleOnlineRoomList,
      "room-created": coreHandleOnlineRoomCreated,
      "room-joined": coreHandleOnlineRoomJoined,
      "spectator-joined": coreHandleOnlineSpectatorJoined,
      "peer-joined": coreHandleOnlinePeerJoined,
      "room-state": coreHandleOnlineRoomState,
      "match-start": coreHandleOnlineMatchStart,
      "room-resumed": coreHandleOnlineRoomResumed,
      "resume-failed": coreHandleOnlineResumeFailed,
      "session-replaced": coreHandleOnlineSessionReplaced,
      "auto-surrender": coreHandleOnlineAutoSurrender,
      "state-sync": coreHandleOnlineStateSync,
      "spectator-read-only": () => showToast("观战模式", message.message || "观战席不能执行对局操作。"),
      "spectator-session-ended": coreHandleOnlineSpectatorSessionEnded,
      "action-request": () => { if (state.online.host && state.game && message.playerId === state.game.activePlayerId) coreResolveAction(state.game, { ...message.action, playerId: message.playerId }); },
      "end-turn-request": () => { if (state.online.host && state.game && message.playerId === state.game.activePlayerId) coreEndTurn(state.game); },
      "surrender-request": () => { if (state.online.host && state.game && [1, 2].includes(Number(message.playerId))) coreSurrender(state.game, Number(message.playerId)); },
      "action-rejected": () => { showToast("行动未执行", message.message || "服务器拒绝了本次行动。"); if (state.game) coreRender(); },
      "error": () => showToast("联网房间", message.message || "联网操作失败。"),
      "peer-left": () => showToast("玩家已断线", message.reconnectDeadline ? "对方席位保留 5 分钟，重新连接后可继续。" : "房间已释放该玩家席位，可以等待新玩家加入。"),
      "peer-reconnected": () => showToast("玩家已重连", "对方已返回房间。"),
      "server-shutdown": coreHandleOnlineServerShutdown
    };
    const handler = handlers[message.type];
    if (handler) handler(message);
  }

  function coreShowOnlineLobby() {
    if (!window.CardOnline) {
      showToast("联网不可用", "当前页面没有加载联网客户端。");
      return;
    }
    state.online?.unsubscribe?.();
    state.online = { playerId: null, roomCode: null, playerName: state.playerName, host: false, role: null, rooms: [] };
    state.online.unsubscribe = window.CardOnline.on(coreHandleOnlineMessage);
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card online-lobby-card" role="dialog" aria-modal="true" aria-label="联网对战房间">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">ONLINE MATCH</p>
        <h2 class="deck-reveal-title">联网对战</h2>
        <p class="deck-reveal-copy">创建新房间，或从列表中加入玩家席与观战席。</p>
        <div class="online-lobby-actions">
          <button id="online-create-room" class="primary-btn">创建房间</button>
          <label>房间码<input id="online-room-code" maxlength="6" autocomplete="off" placeholder="例如 A1B2C3"></label>
          <button id="online-join-room" class="secondary-btn">加入房间</button>
        </div>
        <p id="online-lobby-status" class="deck-reveal-copy">正在连接联网服务……</p>
        <div class="online-room-list-head">
          <div><strong>公开房间</strong><span id="online-room-count">0 个房间</span></div>
          <button id="online-refresh-rooms" class="secondary-btn" type="button">刷新</button>
        </div>
        <div id="online-room-list" class="online-room-list" aria-live="polite"></div>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    document.getElementById("online-create-room").addEventListener("click", () => {
      const playerName = coreValidatedOnlinePlayerName();
      if (playerName && !window.CardOnline.createRoom(playerName, state.selectedBoardSize)) showToast("联网未连接", "请稍候再创建房间。");
    });
    document.getElementById("online-join-room").addEventListener("click", () => {
      const roomCode = document.getElementById("online-room-code").value;
      const playerName = coreValidatedOnlinePlayerName();
      if (playerName && !window.CardOnline.joinRoom(roomCode, playerName)) showToast("联网未连接", "请稍候再加入房间。");
    });
    document.getElementById("online-refresh-rooms").addEventListener("click", () => {
      if (!window.CardOnline.listRooms()) showToast("联网未连接", "请稍候再刷新房间列表。");
    });
    coreRenderRoomList([]);
    window.CardOnline.connect();
    window.CardOnline.listRooms();
  }

  function coreShowDeckSelector(mode) {
    if (mode === "online") {
      coreShowOnlineLobby();
      return;
    }
    const camps = getAvailableDeckKeys();
    const optionMarkup = camps.map((camp) => `<option value="${camp}">${getCampDisplayName(camp)}</option>`).join("");
    if (coreIsPveChallenge(mode) && !Array.isArray(state.pendingChallengeTraitIds)) {
      state.pendingChallengeTraitIds = corePickChallengeTraits(state.challengeLevel || 1);
    }
    const challengeTraits = coreIsPveChallenge(mode)
      ? (state.pendingChallengeTraitIds || []).map((id) => window.ELITE_AI_EFFECT_INFO_V2?.[id]).filter(Boolean)
      : [];
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="选择卡组">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">Core Rules V2</p>
        <h2 class="deck-reveal-title">选择本局卡组</h2>
        <p class="deck-reveal-copy">${state.selectedBoardSize || CORE_BOARD_SIZE}x${state.selectedBoardSize || CORE_BOARD_SIZE} 战场；可选择势力预设牌库，或选择“混沌”在每局随机生成 20 张牌。${coreIsPveChallenge(mode) ? "挑战模式：仅根据随机词条强化持有者。" : ""}</p>
        ${challengeTraits.length ? `<div class="elite-trait-reveal challenge-trait-selection"><span class="ai-effect-label">第 ${state.challengeLevel || 1} 关 AI 精英词条</span>${coreEliteAiTraitMarkup(challengeTraits)}</div>` : ""}
        <div class="deck-reveal-matchup">
          <label class="deck-reveal-side"><span class="label">玩家 1</span><select id="core-deck-p1">${optionMarkup}</select></label>
          <div class="deck-reveal-versus">VS</div>
          <label class="deck-reveal-side"><span class="label">${coreIsPveMode(mode) ? (coreIsPveChallenge(mode) ? "精英 AI（随机）" : "AI（随机）") : "玩家 2"}</span>${coreIsPveMode(mode) ? "<p>系统将在开始时随机选择</p>" : `<select id="core-deck-p2">${optionMarkup}</select>`}</label>
        </div>
        <button id="core-deck-confirm" class="primary-btn">确认卡组</button>
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    document.getElementById("core-deck-confirm").addEventListener("click", () => {
      const playerOneDeck = document.getElementById("core-deck-p1").value;
      const playerTwoDeck = coreIsPveMode(mode) ? getRandomDeckKey() : document.getElementById("core-deck-p2").value;
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
    const pendingTraits = state.selectedMode === "pve-challenge" ? state.pendingChallengeTraitIds : null;
    state.game = coreCreateGame(state.selectedMode, state.selectedDecks, state.selectedBoardSize, null, state.challengeLevel, pendingTraits);
    state.pendingChallengeTraitIds = null;

    switchScreen("game");
    coreShowOpeningReveal(state.game);
  }

  function coreBeginNextChallengeLevel() {
    const previous = state.game;
    if (!previous || !coreIsPveChallenge(previous) || Number(previous.winner?.playerId) !== 1 || Number(previous.challengeLevel) >= 12) return false;
    state.challengeLevel = Math.max(1, Number(previous.challengeLevel) || 1) + 1;
    state.selectedMode = "pve-challenge";
    state.selectedDecks = {
      1: previous.players?.find((player) => player.id === 1)?.deckKey || state.selectedDecks[1] || getRandomDeckKey(),
      2: getRandomDeckKey()
    };
    state.pendingChallengeTraitIds = null;
    const playerTraits = (state.challengePlayerTraitIds || []).map(coreNormalizeEliteAiTraitId).filter(Boolean);
    state.game = coreCreateGame("pve-challenge", state.selectedDecks, state.selectedBoardSize, null, state.challengeLevel, null, playerTraits);
    switchScreen("game");
    coreShowOpeningReveal(state.game);
    return true;
  }

  function coreShowOpeningReveal(game) {
    const first = corePlayer(game, game.firstPlayerId);
    const second = corePlayer(game, otherPlayerId(game.firstPlayerId));
    ui.deckReveal.innerHTML = `
      <section class="deck-reveal-card" role="dialog" aria-modal="true" aria-label="本局先后手">
        <button id="overlay-close" class="overlay-close" type="button" aria-label="关闭弹窗">关闭</button>
        <p class="phase-banner-eyebrow">Opening Order</p>
        <h2 class="deck-reveal-title">${first.name} 获得先手</h2>
        <p class="deck-reveal-copy">${game.boardSize}x${game.boardSize} 战场；${first.name} 初始 ${first.hand.length} 张手牌；${second.name} 初始 ${second.hand.length} 张手牌。全局第 1 回合仅有 1 次行动，其余回合有 2 次行动。</p>
        ${(() => { const traits = coreEliteAiTraitInfos(game); return traits.length ? `<div class="elite-trait-reveal"><span class="ai-effect-label">第 ${game.challengeLevel} 关精英词条</span>${coreEliteAiTraitMarkup(traits)}</div>` : ""; })()}
        ${(() => {
          const playerTraitIds = game.challengePlayerTraitIds || [];
          if (!playerTraitIds.length) return "";
          const info = window.ELITE_AI_EFFECT_INFO_V2 || {};
          const traits = playerTraitIds.map((id) => ({ ...info[id], name: info[id]?.name || id, description: info[id]?.description || "", level: info[id]?.level || "beginner" })).filter(Boolean);
          return traits.length ? `<div class="elite-trait-reveal"><span class="ai-effect-label">玩家词条奖励</span>${coreEliteAiTraitMarkup(traits)}</div>` : "";
        })()}
        <div class="deck-reveal-matchup">
          <article class="deck-reveal-side"><p class="label">${first.name} · 先手</p><h3>${getCampDisplayName(first.deckKey)}</h3><p>${summarizeDeck(first.deckCatalog, first.deckKey)}</p></article>
          <div class="deck-reveal-versus">VS</div>
          <article class="deck-reveal-side"><p class="label">${second.name} · 后手</p><h3>${getCampDisplayName(second.deckKey)}</h3><p>${summarizeDeck(second.deckCatalog, second.deckKey)}</p></article>
        </div>
        ${game.mode === "online" ? "" : `<button id="core-opening-start" class="primary-btn">开始第 ${game.challengeLevel || 1} 关</button>`}
      </section>
    `;
    ui.deckReveal.classList.add("visible");
    coreAttachOverlayClose();
    document.getElementById("core-opening-start")?.addEventListener("click", () => {
      ui.deckReveal.classList.remove("visible");
      window.setTimeout(async () => {
        ui.deckReveal.innerHTML = "";
        const wonAtStart = await coreStartTurnWithAnimations(game);
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
  window.requestBoardSizeAccess = coreRequestBoardSizeAccess;
  // The test runner loads a separate suite and accesses only this stable API.
  window.__CARD_DEMO_CORE_V2_TEST_API__ = Object.freeze({
    cloneCard, coreActionLimit, coreAdjustAttack, coreAiPlacementScore, coreApplyEliteAiTrait, coreApplyEliteAiTraitEvent, coreApplyV2PlacementSkill, coreBuildPendingAction, coreCanPlaceCard, coreCanUseAction, coreCanViewerInteract, coreDrawOneCard, coreEnforceElitePowerBounds, coreHasFreeAction,
    coreAddCardsToDrawPile, coreControlMap, coreCreateGame, coreDeserializeOnlineGame, coreDestroyV2Card, coreHandLimitForPlayer, coreMaintainEliteAiHand,
    coreChallengeTraitPlan, coreEliteAiTraitInfo, coreEliteAiTraitInfos, coreEliteAiTraitIds, corePickChallengeTraits, corePickChallengeRewardTraits,
    coreFormatTurnTime, coreIsOpponentTurn, coreIsSpectator, coreLoadCardTestSetup, corePlanAiAction, corePlayer, coreResolveSkillAttack,
    coreRunV2EndSkills, coreRunV2MoveEffects, coreRunV2StartSkill, coreSerializeOnlineGame, coreStartTurn,
    coreStartTurnTimer, coreStripRuntimeDisplayData, coreTriggerOtherV2PlacementEffects, coreTurnSecondsRemaining, coreValidMoves, coreViewerPlayerId,
    coreVictoryTarget, coreCheckAiSurrender, coreCalculatePositionAdvantage, coreEvaluateCardEffectRisk, coreSimulateActionOutcome, coreIsActionBeneficial,
    CORE_TURN_TIME_LIMIT_SECONDS, HAND_LIMIT, state
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
    if (mode === "pve-challenge" && !state.challengeLevel) state.challengeLevel = 1;
    state.game = null;
    coreShowDeckSelector(mode);
  };
  window.beginGame = coreBeginGame;
  window.beginNextChallengeLevel = coreBeginNextChallengeLevel;
  window.showChallengeRewardSelection = (rewardChoices) => {
    state.pendingChallengeRewardChoices = rewardChoices || [];
    const modal = ui.challengeRewardModal;
    if (!modal) return;
    const choices = rewardChoices || [];
    const traitsInfo = window.ELITE_AI_EFFECT_INFO_V2 || {};
    const choicesHtml = choices.map((traitId, index) => {
      const trait = traitsInfo[traitId];
      if (!trait) return "";
      const tierColor = { beginner: "blue", intermediate: "purple", advanced: "orange" }[trait.level] || "blue";
      return `<button class="reward-choice-btn elite-tier-${tierColor}" data-choice-index="${index}" type="button">
        <strong>${coreEscapeHtml(trait.name)}</strong>
        <small>${coreEscapeHtml(trait.description)}</small>
      </button>`;
    }).join("");
    const choicesContainer = modal.querySelector(".reward-choices-container");
    if (choicesContainer) choicesContainer.innerHTML = choicesHtml;
    modal.hidden = false;
    modal.querySelectorAll(".reward-choice-btn").forEach((btn, index) => {
      btn.addEventListener("click", () => {
        if (typeof window.selectChallengeReward === "function") {
          window.selectChallengeReward(index);
        }
      });
    });
    // 添加跳过按钮事件处理 - 随机选择一个
    const skipBtn = modal.querySelector("#challenge-reward-skip");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        if (choices.length > 0) {
          const randomIndex = randomInt(0, choices.length - 1);
          if (typeof window.selectChallengeReward === "function") {
            window.selectChallengeReward(randomIndex);
          }
        }
      });
    }
  };
  window.selectChallengeReward = (choiceIndex) => {
    const choices = state.pendingChallengeRewardChoices || [];
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= choices.length) return;
    const selectedTraitId = choices[choiceIndex];
    state.challengePlayerTraitIds ||= [];
    state.challengePlayerTraitIds.push(coreNormalizeEliteAiTraitId(selectedTraitId));
    const modal = ui.challengeRewardModal;
    if (modal) modal.hidden = true;
    state.pendingChallengeRewardChoices = null;
    // 第1关首次选择词条后显示游戏开始动画，其他情况进入下一关
    if (state.challengeLevel === 1) {
      coreShowOpeningReveal(state.game);
    } else if (typeof window.beginNextChallengeLevel === "function") {
      window.beginNextChallengeLevel();
    }
  };
  window.loadCardTestSetupForCore = coreLoadCardTestSetup;

  function coreHasExecutableAction(game) {
    const active = corePlayer(game, game.activePlayerId);
    if (!active) return false;
    if (corePlacementAvailability(game).cells.length > 0
      && active.hand.some((card) => coreCanUseAction(game, card) && coreCanPlaceCard(game, card))) return true;
    return game.boardCards.some((card) => card.ownerId === active.id && coreCanUseAction(game, card) && coreValidMoves(game, card).length > 0);
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
    if (!game || game.isAnimating || game.winner || !coreCanViewerInteract(game)) return;
    if (coreHasExecutableAction(game) && !window.confirm("本回合仍有可执行操作，确定要结束回合吗？")) return;
    if (game.mode === "online") {
      if (!window.CardOnline?.send({ type: "end-turn-request" })) showToast("联网未连接", "请等待联网服务连接后再结束回合。");
      return;
    }
    coreEndTurn();
  });
  coreUi.surrenderBtn?.addEventListener("click", async () => {
    const game = state.game;
    if (!game || game.isAnimating || game.winner || coreIsSpectator()) return;
    const surrenderingPlayer = game.mode === "online" ? corePlayer(game, coreViewerPlayerId(game)) : corePlayer(game, game.activePlayerId);
    if (!surrenderingPlayer || surrenderingPlayer.isAI || !window.confirm(`确定让 ${surrenderingPlayer.name} 认输吗？认输后将立即判负，且无法撤销。`)) return;
    window.closeGameMenu?.();
    if (game.mode === "online") {
      if (!window.CardOnline?.send({ type: "surrender-request" })) showToast("联网未连接", "请等待联网服务连接后再认输。");
      return;
    }
    await coreSurrender(game, surrenderingPlayer.id);
  });
  ui.editPlayerIdBtn?.addEventListener("click", () => coreShowPlayerIdModal(false));
  coreScheduleTurnTimerTick();
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
