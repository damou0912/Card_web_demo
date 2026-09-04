const TEST_BOARD_SIZE = 4;
const testState = { cards: [], brokenCells: [], selectedTemplate: null, selectedCardUid: null, ownerId: 1, camp: "全部" };

const testUi = {
  board: document.getElementById("test-board"),
  library: document.getElementById("card-library"),
  libraryCount: document.getElementById("library-count"),
  campFilter: document.getElementById("camp-filter"),
  search: document.getElementById("card-search"),
  brokenMode: document.getElementById("broken-mode"),
  hint: document.getElementById("placement-hint"),
  summary: document.getElementById("board-summary"),
  empty: document.getElementById("inspector-empty"),
  content: document.getElementById("inspector-content"),
  preview: document.getElementById("selected-preview"),
  owner: document.getElementById("edit-owner"),
  attack: document.getElementById("edit-attack"),
  effect: document.getElementById("selected-effect"),
  state: document.getElementById("selected-state"),
  sceneData: document.getElementById("scene-data"),
  validation: document.getElementById("scene-validation"),
  toast: document.getElementById("test-toast")
};

const allTemplates = (window.CARD_LIBRARY?.cardSlots || []).map((card) => ({ ...card }));

function makeTestCard(template, row, col, ownerId, attack = template.attack) {
  const index = allTemplates.findIndex((item) => item.id === template.id) % 20;
  const rarity = template.rarity || (index < 7 ? "普通" : index < 12 ? "稀有" : index < 15 ? "史诗" : index === 15 ? "传说" : "特殊");
  return {
    id: template.id,
    uid: `${template.id}-${Math.random().toString(36).slice(2, 9)}`,
    name: template.name,
    camp: template.camp,
    skill: template.skill || "无",
    summary: template.summary || template.skill || "无技能。",
    effect: template.effect || "无技能。",
    rarity,
    attack: Number(attack),
    ownerId,
    row,
    col
  };
}

function getSelectedCard() {
  return testState.cards.find((card) => card.uid === testState.selectedCardUid) || null;
}

function getTemplateById(id) {
  return allTemplates.find((card) => String(card.id) === String(id));
}

function isBroken(row, col) {
  return testState.brokenCells.some((cell) => cell.row === row && cell.col === col);
}

function getCardAt(row, col) {
  return testState.cards.find((card) => card.row === row && card.col === col);
}

function showToast(text) {
  testUi.toast.textContent = text;
  testUi.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => testUi.toast.classList.remove("show"), 1900);
}

function renderFilters() {
  const camps = ["全部", ...new Set(allTemplates.map((card) => card.camp))];
  testUi.campFilter.innerHTML = camps.map((camp) => `<button class="filter-btn ${camp === testState.camp ? "active" : ""}" data-camp="${camp}">${camp.replace("三国~", "")}</button>`).join("");
}

function renderLibrary() {
  const keyword = testUi.search.value.trim().toLowerCase();
  const list = allTemplates.filter((card) => {
    const haystack = `${card.name} ${card.camp} ${card.skill} ${card.effect}`.toLowerCase();
    return (testState.camp === "全部" || card.camp === testState.camp) && (!keyword || haystack.includes(keyword));
  });
  testUi.libraryCount.textContent = `${list.length} 张`;
  testUi.library.innerHTML = list.map((card) => `
    <button class="library-card ${testState.selectedTemplate?.id === card.id ? "selected" : ""}" data-card-id="${card.id}">
      <span class="library-attack">${card.attack}</span>
      <span><p>${card.name}</p><small>${card.camp.replace("三国~", "")} · ${card.rarity} · ${card.skill || "无技能"}</small><small class="library-summary">${card.summary || card.skill || "无技能。"}</small></span>
    </button>
  `).join("");
}

function renderBoard() {
  const cells = [];
  for (let row = 0; row < TEST_BOARD_SIZE; row += 1) {
    for (let col = 0; col < TEST_BOARD_SIZE; col += 1) {
      const card = getCardAt(row, col);
      const broken = isBroken(row, col);
      cells.push(`<div class="test-cell ${broken ? "broken" : ""}" data-row="${row}" data-col="${col}">${card ? renderBoardCard(card) : ""}</div>`);
    }
  }
  testUi.board.innerHTML = cells.join("");
  const p1 = testState.cards.filter((card) => card.ownerId === 1).length;
  const p2 = testState.cards.filter((card) => card.ownerId === 2).length;
  testUi.summary.textContent = `玩家 1：${p1} 张 · 玩家 2：${p2} 张 · 破坏格：${testState.brokenCells.length}`;
}

function renderBoardCard(card) {
  return `<article class="test-unit player${card.ownerId} ${card.uid === testState.selectedCardUid ? "selected" : ""}" draggable="true" data-card-uid="${card.uid}">
    <span class="unit-camp">${card.camp.replace("三国~", "")}</span><strong class="unit-name">${card.name}</strong><span class="unit-skill">${card.skill}</span><span class="unit-attack">${card.attack}</span>
  </article>`;
}

function renderInspector() {
  const card = getSelectedCard();
  testUi.empty.hidden = Boolean(card);
  testUi.content.hidden = !card;
  testUi.state.textContent = card ? "正在编辑" : "未选择";
  if (!card) return;
  testUi.preview.className = `preview-card player${card.ownerId}`;
  testUi.preview.innerHTML = `<h2>${card.name} <small>${card.attack}</small></h2><p>${card.camp} · ${card.rarity}</p><p>${card.skill}</p>`;
  testUi.owner.value = String(card.ownerId);
  testUi.attack.value = String(card.attack);
  testUi.effect.textContent = card.summary || card.skill || "无技能。";
}

function render() {
  renderFilters();
  renderLibrary();
  renderBoard();
  renderInspector();
  renderSceneValidation();
  if (testState.selectedTemplate) {
    testUi.hint.textContent = `待放置：${testState.selectedTemplate.name}（玩家 ${testState.ownerId}），点击任意非破坏格。`;
  } else if (testUi.brokenMode.checked) {
    testUi.hint.textContent = "破坏格编辑中：点击格子可切换破坏状态。";
  } else {
    testUi.hint.textContent = "从左侧选择一张卡牌，再点击战场格子放置。";
  }
}

function placeTemplate(row, col) {
  if (!testState.selectedTemplate) return;
  if (isBroken(row, col)) return showToast("破坏格不能放置卡牌。");
  const existing = getCardAt(row, col);
  if (existing) testState.cards = testState.cards.filter((card) => card.uid !== existing.uid);
  const card = makeTestCard(testState.selectedTemplate, row, col, testState.ownerId);
  testState.cards.push(card);
  testState.selectedCardUid = card.uid;
  render();
}

function selectCard(uid) {
  testState.selectedCardUid = uid;
  testState.selectedTemplate = null;
  render();
}

function toggleBroken(row, col) {
  const existingCard = getCardAt(row, col);
  if (existingCard) {
    testState.cards = testState.cards.filter((card) => card.uid !== existingCard.uid);
    if (testState.selectedCardUid === existingCard.uid) testState.selectedCardUid = null;
  }
  if (isBroken(row, col)) {
    testState.brokenCells = testState.brokenCells.filter((cell) => cell.row !== row || cell.col !== col);
  } else {
    testState.brokenCells.push({ row, col });
  }
  render();
}

function buildScene() {
  return { version: 1, boardSize: TEST_BOARD_SIZE, cards: testState.cards.map(({ id, ownerId, row, col, attack }) => ({ id, ownerId, row, col, attack })), brokenCells: testState.brokenCells };
}

function formatTestCell(row, col) {
  return `${row + 1}-${col + 1} 格`;
}

function getSceneIssues() {
  const issues = [];
  const occupied = new Set();
  const broken = new Set();
  testState.brokenCells.forEach((cell) => {
    const valid = Number.isInteger(cell.row) && Number.isInteger(cell.col) && cell.row >= 0 && cell.row < TEST_BOARD_SIZE && cell.col >= 0 && cell.col < TEST_BOARD_SIZE;
    if (!valid) issues.push("存在越界的破坏格。");
    else broken.add(`${cell.row},${cell.col}`);
  });
  if (broken.size > 5) issues.push("破坏格超过上限 5 个。");
  testState.cards.forEach((card) => {
    const key = `${card.row},${card.col}`;
    const valid = Number.isInteger(card.row) && Number.isInteger(card.col) && card.row >= 0 && card.row < TEST_BOARD_SIZE && card.col >= 0 && card.col < TEST_BOARD_SIZE;
    if (!valid) issues.push(`${card.name} 位于战场外。`);
    else if (occupied.has(key)) issues.push(`${formatTestCell(card.row, card.col)} 有多张卡牌重叠。`);
    else occupied.add(key);
    if (broken.has(key)) issues.push(`${card.name} 位于破坏格。`);
  });
  return [...new Set(issues)];
}

function renderSceneValidation() {
  const issues = getSceneIssues();
  if (!issues.length) {
    testUi.validation.className = "scene-validation is-valid";
    testUi.validation.textContent = `场景可带入 V2 对局：${testState.cards.length} 张卡牌，${testState.brokenCells.length} 个破坏格。`;
    return;
  }
  testUi.validation.className = "scene-validation is-invalid";
  testUi.validation.textContent = `无法带入：${issues.join(" ")}`;
}

function loadScene(scene) {
  if (!scene || !Array.isArray(scene.cards)) throw new Error("场景数据格式不正确。");
  testState.cards = scene.cards.map((entry) => {
    const template = getTemplateById(entry.id);
    if (!template) throw new Error(`找不到卡牌：${entry.id}`);
    return makeTestCard(template, entry.row, entry.col, Number(entry.ownerId) === 2 ? 2 : 1, entry.attack);
  });
  testState.brokenCells = Array.isArray(scene.brokenCells) ? scene.brokenCells.filter((cell) => Number.isInteger(cell.row) && Number.isInteger(cell.col)) : [];
  testState.selectedCardUid = null;
  testState.selectedTemplate = null;
  render();
}

function loadDuelPreset() {
  const find = (name) => allTemplates.find((card) => card.name === name) || allTemplates[0];
  testState.cards = [makeTestCard(find("关羽"), 2, 1, 1), makeTestCard(find("曹仁"), 2, 3, 2), makeTestCard(find("周瑜"), 1, 2, 1)];
  testState.brokenCells = [];
  testState.selectedCardUid = null;
  testState.selectedTemplate = null;
  render();
  showToast("已载入交战预设，可继续自由修改。");
}

testUi.search.addEventListener("input", renderLibrary);
testUi.campFilter.addEventListener("click", (event) => {
  const button = event.target.closest("[data-camp]");
  if (!button) return;
  testState.camp = button.dataset.camp;
  render();
});
testUi.library.addEventListener("click", (event) => {
  const button = event.target.closest("[data-card-id]");
  if (!button) return;
  testState.selectedTemplate = getTemplateById(button.dataset.cardId);
  testState.selectedCardUid = null;
  render();
});
document.querySelectorAll(".owner-btn").forEach((button) => button.addEventListener("click", () => {
  testState.ownerId = Number(button.dataset.owner);
  document.querySelectorAll(".owner-btn").forEach((item) => item.classList.toggle("active", item === button));
  render();
}));
testUi.brokenMode.addEventListener("change", render);
testUi.board.addEventListener("click", (event) => {
  const unit = event.target.closest("[data-card-uid]");
  if (unit) return selectCard(unit.dataset.cardUid);
  const cell = event.target.closest(".test-cell");
  if (!cell) return;
  const row = Number(cell.dataset.row), col = Number(cell.dataset.col);
  if (testUi.brokenMode.checked) return toggleBroken(row, col);
  placeTemplate(row, col);
});
testUi.board.addEventListener("contextmenu", (event) => {
  const unit = event.target.closest("[data-card-uid]");
  if (!unit) return;
  event.preventDefault();
  testState.cards = testState.cards.filter((card) => card.uid !== unit.dataset.cardUid);
  if (testState.selectedCardUid === unit.dataset.cardUid) testState.selectedCardUid = null;
  render();
});
testUi.board.addEventListener("dragstart", (event) => {
  const unit = event.target.closest("[data-card-uid]");
  if (unit) event.dataTransfer.setData("text/plain", unit.dataset.cardUid);
});
testUi.board.addEventListener("dragover", (event) => event.preventDefault());
testUi.board.addEventListener("drop", (event) => {
  event.preventDefault();
  const cell = event.target.closest(".test-cell");
  const uid = event.dataTransfer.getData("text/plain");
  const card = testState.cards.find((item) => item.uid === uid);
  if (!cell || !card || isBroken(Number(cell.dataset.row), Number(cell.dataset.col))) return;
  const other = getCardAt(Number(cell.dataset.row), Number(cell.dataset.col));
  if (other) { other.row = card.row; other.col = card.col; }
  card.row = Number(cell.dataset.row); card.col = Number(cell.dataset.col);
  render();
});
testUi.owner.addEventListener("change", () => { const card = getSelectedCard(); if (card) { card.ownerId = Number(testUi.owner.value); render(); } });
testUi.attack.addEventListener("change", () => { const card = getSelectedCard(); if (card) { card.attack = Number(testUi.attack.value); render(); } });
document.getElementById("delete-card").addEventListener("click", () => { const card = getSelectedCard(); if (!card) return; testState.cards = testState.cards.filter((item) => item.uid !== card.uid); testState.selectedCardUid = null; render(); });
document.getElementById("duplicate-card").addEventListener("click", () => { const card = getSelectedCard(); if (!card) return; testState.selectedTemplate = getTemplateById(card.id); testState.ownerId = card.ownerId; testState.selectedCardUid = null; render(); showToast("已复制为待放置卡牌。"); });
document.getElementById("clear-board").addEventListener("click", () => { testState.cards = []; testState.brokenCells = []; testState.selectedCardUid = null; render(); });
document.getElementById("load-duel").addEventListener("click", loadDuelPreset);
document.getElementById("copy-scene").addEventListener("click", async () => { const text = JSON.stringify(buildScene()); testUi.sceneData.value = text; await navigator.clipboard?.writeText(text); showToast("场景数据已复制。"); });
document.getElementById("import-scene").addEventListener("click", () => { try { loadScene(JSON.parse(testUi.sceneData.value)); showToast("场景已导入。"); } catch (error) { showToast(error.message); } });
document.getElementById("open-in-game").addEventListener("click", () => {
  const issues = getSceneIssues();
  if (issues.length) return showToast(`请先修正场景：${issues[0]}`);
  localStorage.setItem("cardDemoCardTestSetup", JSON.stringify(buildScene()));
  window.location.href = "index.html?card-test=1";
});

render();
