/* Guided practice scenes. Card text and all action/skill outcomes come from the live V2 runtime. */
(() => {
  const core = window.CardTutorialCore;
  const panel = document.getElementById("tutorial-panel");
  const entry = document.getElementById("start-tutorial-btn");
  if (!core || !panel || !entry) return;

  const COMPLETION_KEY = "card-demo-tutorial-v1-completed";
  const CARD = Object.freeze({
    reinforcement1: "tutorial-reinforcement-1", reinforcement2: "tutorial-reinforcement-2", reinforcement3: "tutorial-reinforcement-3",
    liaohua: "01101", wangping: "01102", weiyan: "01208"
  });
  const lessons = [
    {
      name: "放置与移动",
      steps: [
        { title: "你的第一张牌：无技能援军", description: "先用没有技能的援军练习。援军无势力，放置后归你所有，每张占领 1 格；棋盘上灰色的守军则是中立单位，不属于任何玩家。训练援军有 1、2、3 战力，数字越大，交战越强。", task: "准备好后，放置一张战力 3 的援军。", card: CARD.reinforcement3, next: "开始练习" },
        { title: "把援军放上战场", description: "正式对局先手开局拿 2 张牌，后手拿 3 张；回合开始再抽 1 张。本课固定你先手，所以现在有 3 张手牌，第一回合只有 1 次行动。", task: "点击战力 3 的手牌「援军」，再点击高亮的 4-2 格。", card: CARD.reinforcement3, action: "place", cardId: CARD.reinforcement3, target: [3, 1] },
        { title: "放置后，需要休整", description: "援军已经帮你占领 1 格。这次放置消耗了唯一的行动位，而且新放的牌本回合不能主动移动。下一次轮到你时，它会恢复。", task: "点击手牌区的「结束回合」。陪练会让过这一回合。", endTurn: true },
        { title: "向相邻空格移动", description: "又轮到你了：援军休整结束，你也抽了 1 张牌。现在有 2 次行动。通常每张牌每回合只能主动移动一次，方向是上下左右。", task: "点击场上的援军（4-2），再点击 3-2 格。", action: "move", cardId: CARD.reinforcement3, target: [2, 1] },
        { title: "学会了：放置与移动", description: "援军移动到了新位置，旧位置随即空出，所以你仍占领 1 格。每次行动都可以选择放置或移动，行动完成后立即结算。", task: "下一课，试着进入中立守军的格子。", next: "下一课：交战" }
      ]
    },
    {
      name: "战力与交战",
      steps: [
        { title: "进入敌方格，就会交战", description: "这是预设交战局面，两张无技能援军都已休整完毕。上方两张中立守军战力都是 2，没有技能，不主动移动，双方都视它们为敌方卡牌。", task: "先用战力 3 的援军攻击战力 2 的守军。", card: { id: "guard", isGuard: true }, next: "开始交战" },
        { title: "战力更高，攻下目标格", description: "选择自己的牌，再点击相邻敌方牌即可发起攻击。比较的是交战时的当前战力。", task: "点击战力 3 的援军（3-2），再点击上方的守军（2-2）。", action: "move", cardId: CARD.reinforcement3, target: [1, 1] },
        { title: "战力相同，双方摧毁", description: "援军获胜并进入了守军的格子，但原格空了出来，占领数没有增加。接下来用战力 2 的援军攻击另一张战力 2 的守军，观察同归于尽。", task: "点击战力 2 的援军（3-4），再点击上方的守军（2-4）。", card: CARD.reinforcement2, action: "move", cardId: CARD.reinforcement2, target: [1, 3] },
        { title: "出手前，先看当前战力", description: "同战力的双方都被摧毁，格子变空。如果低战力主动攻击高战力，攻击方也会被摧毁。刚才的援军和守军都没有技能，交战直接比较战力；接下来学习技能如何改变战力。", task: "下一课，加入武将牌给援军增加战力。", next: "下一课：技能配合" }
      ]
    },
    {
      name: "技能与配合",
      steps: [
        { title: "加入王平与廖化", description: "现在加入有技能的武将牌。「起势」在我方回合开始时触发。王平会给四方相邻的友军临时加 1 战力；廖化则按四方相邻友军的数量增强自己。先把他们摆在援军旁边。", task: "练习用站位触发配合。悬停卡牌也可以查看完整技能。", card: CARD.wangping, next: "布置阵形" },
        { title: "把王平放在援军右侧", description: "王平的「固守」能强化相邻友军。无技能援军同样能接受友军的强化。斜对角不属于四方相邻，放在紧邻位置才有效。", task: "点击手牌「王平」，放在 3-3 格。", card: CARD.wangping, action: "place", cardId: CARD.wangping, target: [2, 2] },
        { title: "再加入廖化", description: "本回合的第二次行动也可以放牌。把廖化放在援军上方，等下个自己的回合观察「整军」效果。", task: "点击手牌「廖化」，放在 2-2 格。", card: CARD.liaohua, action: "place", cardId: CARD.liaohua, target: [1, 1] },
        { title: "让起势技能触发", description: "刚放下王平和廖化时，起势技能不会立刻生效。结束回合，等下一次我方回合开始，系统会自动结算。", task: "点击「结束回合」，观察战力变化。", endTurn: true },
        { title: "看见配合的效果了", description: "王平让相邻的援军从 3 变成 4 战力；廖化身旁有援军，所以从 2 变成 3。这些技能写着「本回合」，加成会在回合结束时消失。", task: "再加入魏延，学习放置时触发的「入阵」。", card: CARD.weiyan, next: "加入魏延" },
        { title: "魏延入阵，再触发一次起势", description: "魏延的「奇谋」在被放置时立刻触发，让四方相邻友军再次结算起势。把他放在王平上方、廖化右侧，一次连接两位队友。", task: "点击手牌「魏延」，放在 2-3 格。", card: CARD.weiyan, action: "place", cardId: CARD.weiyan, target: [1, 2] },
        { title: "站位决定技能收益", description: "王平再次强化援军，援军达到 5 战力；廖化现在有两位相邻友军，又获得 2 战力，也达到 5。援军自身虽然没有技能，也能成为配合的一环。", task: "最后一课：把优势变成占领胜利。", next: "下一课：占领获胜" }
      ]
    },
      {
      name: "占领与胜利",
      steps: [
        { title: "目标是占领过半", description: "这是预设残局：4×4 战场共有 16 格，没有破坏格，因此需要占领 9 格。你已经占领 7 格，还剩 2 次行动。中立守军不减少可占领格数。", task: "连续放置两张牌，亲手触发一次胜利。", next: "拿下最后两格" },
        { title: "先占领第 8 格", description: "没有技能的援军也能帮你赢下对局。放置不必紧贴友军，只要目标格未被占据且不是破坏格即可。占领 8 格恰好是一半，还不够获胜。", task: "点击战力 3 的手牌「援军」，放在 2-4 格。", card: CARD.reinforcement3, action: "place", cardId: CARD.reinforcement3, target: [1, 3] },
        { title: "第 9 格，决定胜负", description: "现在再放置一张牌，达到严格超过一半的 9 格，系统会立即判胜，不需要等回合结束。", task: "点击战力 2 的手牌「援军」，放在 3-1 格。", card: CARD.reinforcement2, action: "place", cardId: CARD.reinforcement2, target: [2, 0] },
        { title: "教程完成，出阵吧！", description: "你已占领 9 / 16 格并获胜。正式对局最多 30 回合，到时比较占领数，相同则平局。每回合限时 5 分钟，手牌上限 5 张，满手跳过抽牌；牌库空了也不再抽牌。", task: "记住：放置扩张，移动交战，利用技能保护你的地盘。有破坏格时，胜利门槛按剩余可占领格数重新计算。", next: "开始 PVE 对战", complete: true }
      ]
    }
  ];
  let session = null;
  const node = (id) => document.getElementById(id);
  const currentStep = () => session && lessons[session.lesson].steps[session.step];
  const current = (game) => Boolean(session && session.game === game && core.getState().game === game);
  const sameCell = (position, coords) => position?.row === coords?.[0] && position?.col === coords?.[1];
  const busy = () => !session || session.busy || session.game.isAnimating;

  function updateEntry() {
    let completed = false;
    try { completed = window.localStorage?.getItem(COMPLETION_KEY) === "1"; } catch (_error) { /* Optional progress storage. */ }
    node("tutorial-entry-status").textContent = completed
      ? "已完成 · 随时回来重练 4 节实操"
      : "约 5 分钟 · 4 节实操 · 从第一张牌开始";
  }

  function installDeck(game, player, handIds, boardCards = [], reinforcementsOnly = false) {
    const availableIds = window.CARD_INFO.filter((card) => card.camp === player.deckKey).map((card) => card.id);
    const usedIds = new Set([...handIds, ...boardCards.map((card) => card.id)]);
    player.hand = handIds.map((id) => Object.assign(core.createCard(id), { ownerId: player.id }));
    player.drawPile = reinforcementsOnly
      ? Array.from({ length: 20 - handIds.length - boardCards.length }, () => core.createCard(CARD.reinforcement1))
      : availableIds.filter((id) => !usedIds.has(id)).slice(0, 20 - handIds.length - boardCards.length).map((id) => core.createCard(id));
    player.deckCatalog = [...boardCards, ...player.hand, ...player.drawPile].map((card) => ({ ...card }));
    player.boardCardIds = boardCards.map((card) => card.uid);
    game.boardCards.push(...boardCards);
  }

  function placed(id, row, col) {
    return Object.assign(core.createCard(id), {
      ownerId: 1, row, col, restedTurn: null, lastMovedTurn: null, v2PermanentBonus: 0, v2TempBonus: 0
    });
  }

  function loadLesson(index) {
    if (!session || busy()) return false;
    const game = core.createGame();
    if (!game) { showToast("教程暂不可用", "卡牌数据未完整加载，请刷新页面后重试。"); return false; }
    const previousGame = session.game;
    if (previousGame) previousGame.turnDeadlineAt = null;
    session.lesson = index;
    session.step = 0;
    session.game = game;
    session.feedback = "";
    session.busy = false;
    game.boardCards = [];
    game.turn = index === 0 ? 1 : index === 3 ? 15 : 3;
    game.currentPhase = "行动阶段";
    game.players[0].name = "你";
    game.players[1].name = "陪练";
    const guards = () => [core.createGuard(0, 0, 2), core.createGuard(0, 3, 2)];
    if (index === 0) {
      game.boardCards = guards();
      installDeck(game, game.players[0], [CARD.reinforcement3, CARD.reinforcement2], [], true);
    } else if (index === 1) {
      game.boardCards = [core.createGuard(1, 1, 2), core.createGuard(1, 3, 2)];
      installDeck(game, game.players[0], [CARD.reinforcement1], [placed(CARD.reinforcement3, 2, 1), placed(CARD.reinforcement2, 2, 3)], true);
    } else if (index === 2) {
      game.boardCards = guards();
      installDeck(game, game.players[0], [CARD.wangping, CARD.liaohua, CARD.weiyan], [placed(CARD.reinforcement3, 2, 1)]);
    } else {
      const army = Array.from({ length: 7 }, (_, i) => placed(CARD.reinforcement1, Math.floor(i / 4), i % 4));
      installDeck(game, game.players[0], [CARD.reinforcement3, CARD.reinforcement2], army, true);
      game.boardCards.push(core.createGuard(3, 2, 2), core.createGuard(3, 3, 2));
    }
    installDeck(game, game.players[1], [CARD.reinforcement1, CARD.reinforcement2, CARD.reinforcement3], [], true);
    core.getState().game = game;
    if (index === 0) core.startTurn(game);
    // Later lessons start from a declared mid-turn position; do not fire start skills a second time.
    game.pendingAnimations = [];
    game.lastResolution = `第 ${index + 1} 课：${lessons[index].name}。跟随左侧提示练习。`;
    game.roundLog = [game.lastResolution];
    game.cardFlowHistory = [];
    core.showGame();
    core.render();
    node("tutorial-title").focus({ preventScroll: true });
    panel.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    return true;
  }

  function start() {
    const state = core.getState();
    if (state.online?.roomCode || state.game?.mode === "online") {
      showToast("请先退出房间", "返回主菜单、退出当前联网房间后即可开始教程。");
      return false;
    }
    if (session) return false;
    session = { lesson: 0, step: 0, game: { isAnimating: false }, busy: false, feedback: "" };
    core.closeOverlay();
    if (!loadLesson(0)) { session = null; return false; }
    document.body.classList.add("tutorial-active");
    panel.hidden = false;
    return true;
  }

  function feedback() {
    if (!session) return false;
    session.feedback = currentStep().task;
    node("tutorial-feedback").textContent = `小提示：${session.feedback}`;
    return false;
  }

  function allowSelection(game, kind, value) {
    if (!current(game) || busy()) return false;
    const step = currentStep();
    if (!step.action) return feedback();
    if (kind === "hand") {
      return (step.action === "place" && game.players[0].hand.some((card) => card.uid === value && card.id === step.cardId)) || feedback();
    }
    const card = game.boardCards.find((item) => item.row === value.row && item.col === value.col);
    const selectingMover = step.action === "move" && card?.ownerId === 1 && card.id === step.cardId;
    return selectingMover || sameCell(value, step.target) || feedback();
  }

  function allowAction(game, action) {
    if (!current(game) || busy()) return false;
    const step = currentStep();
    const card = [...game.players[0].hand, ...game.boardCards].find((item) => item.uid === action.cardUid);
    return (action.playerId === 1 && game.activePlayerId === 1 && step.action === action.type
      && card?.id === step.cardId && sameCell(action.target, step.target)) || feedback();
  }

  function advance() {
    session.step += 1;
    session.feedback = "";
    if (currentStep()?.complete) {
      try { window.localStorage?.setItem(COMPLETION_KEY, "1"); } catch (_error) { /* Completion does not require storage. */ }
      updateEntry();
    }
  }

  function afterAction(game) {
    if (!current(game)) return;
    advance();
    game.lastResolution = currentStep().title;
  }

  function allowEndTurn(game, automatic) {
    if (!current(game)) return false;
    if (automatic) return session.busy && game.activePlayerId === 2;
    if (busy() || !currentStep().endTurn || game.activePlayerId !== 1) return feedback();
    return true;
  }

  async function afterEndTurn(game) {
    if (!current(game)) return;
    if (game.activePlayerId === 2) {
      session.busy = true;
      core.render();
      try {
        await core.endTurn(game, true);
      } finally {
        if (current(game)) { session.busy = false; core.render(); }
      }
    } else {
      advance();
      game.lastResolution = "陪练已让过回合，轮到你了。";
    }
  }

  function cleanup() {
    if (session) session.game.turnDeadlineAt = null;
    session = null;
    document.body.classList.remove("tutorial-active");
    panel.hidden = true;
    ui.restartBtn.textContent = "重新开始";
    document.querySelectorAll(".tutorial-highlight").forEach((element) => element.classList.remove("tutorial-highlight"));
    updateEntry();
  }

  function exitTutorial() {
    if (busy()) return;
    window.resetToMenu();
    entry.focus();
  }

  function restartLesson() {
    return session ? loadLesson(session.lesson) : false;
  }

  function next() {
    if (busy()) return;
    const step = currentStep();
    if (!step.next) return;
    if (step.complete) {
      window.resetToMenu();
      core.getState().selectedMode = "pve";
      ui.modeButtons.forEach((button) => button.classList.toggle("selected", button.dataset.mode === "pve"));
      ui.modeDescription.textContent = ui.modeButtons.find((button) => button.dataset.mode === "pve")?.dataset.description || "";
      window.startRandomGame("pve");
      return;
    }
    if (session.step === lessons[session.lesson].steps.length - 1) loadLesson(session.lesson + 1);
    else { advance(); core.render(); }
  }

  function render(game) {
    if (!current(game)) return;
    const step = currentStep();
    const lesson = lessons[session.lesson];
    const locked = busy();
    panel.hidden = false;
    document.body.classList.add("tutorial-active");
    node("tutorial-progress-label").textContent = `${session.lesson + 1} / ${lessons.length} 课`;
    node("tutorial-step-label").textContent = `${lesson.name} · ${session.step + 1} / ${lesson.steps.length}`;
    node("tutorial-title").textContent = step.title;
    node("tutorial-description").textContent = step.description;
    node("tutorial-task").textContent = locked ? "正在结算，请观察棋盘上的变化……" : step.task;
    node("tutorial-feedback").textContent = session.feedback ? `小提示：${session.feedback}` : "";
    const chapters = node("tutorial-chapters");
    chapters.replaceChildren();
    lessons.forEach((item, index) => {
      const chip = document.createElement("span");
      chip.className = `tutorial-chapter${index === session.lesson ? " is-current" : ""}${index < session.lesson ? " is-done" : ""}`;
      chip.textContent = `${index < session.lesson ? "✓" : index + 1} ${item.name}`;
      if (index === session.lesson) chip.setAttribute("aria-current", "step");
      chapters.appendChild(chip);
    });
    const preview = node("tutorial-card");
    preview.hidden = !step.card;
    preview.replaceChildren();
    if (step.card) {
      const display = core.display(step.card);
      const title = document.createElement("strong");
      title.textContent = `${display.name} · ${display.skill}`;
      const text = document.createElement("span");
      text.textContent = display.effect;
      preview.appendChild(title);
      preview.appendChild(text);
    }
    node("tutorial-next-btn").hidden = !step.next;
    node("tutorial-next-btn").textContent = step.next || "继续";
    node("tutorial-next-btn").disabled = locked;
    node("tutorial-retry-btn").disabled = locked;
    node("tutorial-exit-btn").disabled = locked;
    const end = node("end-turn-btn");
    end.disabled = locked || !step.endTurn;
    end.classList.toggle("tutorial-highlight", Boolean(step.endTurn && !locked));
    node("surrender-btn").hidden = true;
    ui.restartBtn.textContent = "重练本课";
    ui.restartBtn.disabled = locked;
    ui.backMenuBtn.disabled = locked;
    ui.turnTimer.hidden = true;
    ui.phaseLabel.textContent = step.complete ? "教程完成" : "跟随引导";
    ui.statusMessage.textContent = step.title;
    ui.statusSubtext.textContent = "训练没有倒计时，可以慢慢阅读。";
    ui.selectionSummary.textContent = step.task;
    const desiredHand = step.action === "place" && game.players[0].hand.find((card) => card.id === step.cardId);
    ui.handCards.querySelectorAll(".card").forEach((element) => {
      element.classList.toggle("tutorial-highlight", Boolean(desiredHand && element.dataset.cardUid === desiredHand.uid));
    });
    ui.board.querySelectorAll(".cell").forEach((cell) => {
      cell.classList.remove("selectable", "core-place-target", "core-move-target", "core-attack-target");
      const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
      const isTarget = sameCell({ row, col }, step.target);
      const isSource = step.action === "move" && game.boardCards.some((card) => card.id === step.cardId && card.ownerId === 1 && card.row === row && card.col === col);
      cell.classList.toggle("tutorial-highlight", Boolean(!locked && (isSource || isTarget)));
      if (isTarget) cell.classList.add("selectable");
    });
  }

  entry.addEventListener("click", start);
  node("tutorial-next-btn").addEventListener("click", next);
  node("tutorial-retry-btn").addEventListener("click", restartLesson);
  node("tutorial-exit-btn").addEventListener("click", exitTutorial);
  window.CardTutorial = Object.freeze({ start, cleanup, restartLesson, allowSelection, allowAction, allowEndTurn, afterAction, afterEndTurn, render });
  updateEntry();
})();
