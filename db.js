const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_FILE = path.join(__dirname, "game-data.json");

// 预设账号列表
const PRESET_ACCOUNTS = [
  "player1", "player2", "player3", "player4", "player5",
  "player6", "player7", "player8", "player9", "player10", "admin"
];

const PRESET_PASSWORD = "password123";

function ensureDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: {},
      profiles: {},
      cards: {},
      gameRecords: []
    };

    // 初始化预设账号
    PRESET_ACCOUNTS.forEach((username) => {
      initialData.users[username] = {
        passwordHash: hashPassword(PRESET_PASSWORD),
        createdAt: new Date().toISOString(),
        isPreset: true
      };

      initialData.profiles[username] = {
        nickname: username,
        wins: 0,
        bestStreak: 0,
        bestDeck: null,
        pveWins: 0,
        pvpWins: 0,
        totalGames: 0,
        lastLogin: null,
        challengeProgress: 0,
        challengeProgressSavedAt: null,
        customDecks: {}
      };

      initialData.cards[username] = {
        owned: generateDefaultCards(),
        deckSlots: {
          deck1: Array.from({ length: 60 }, (_, i) => i),
          deck2: Array.from({ length: 60 }, (_, i) => i),
          deck3: Array.from({ length: 60 }, (_, i) => i)
        }
      };
    });

    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), "utf-8");
  }
}

function readDB() {
  ensureDB();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// 密码加密：简单的 PBKDF2 + base64（不如 bcrypt 但无需外部依赖）
function hashPassword(password, salt = null) {
  if (!salt) salt = crypto.randomBytes(32).toString("base64");
  const hash = crypto
    .pbkdf2Sync(password, Buffer.from(salt, "base64"), 100000, 32, "sha256")
    .toString("base64");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const newHash = crypto
    .pbkdf2Sync(password, Buffer.from(salt, "base64"), 100000, 32, "sha256")
    .toString("base64");
  return newHash === hash;
}

// ===== User 操作 =====
function createUser(username, password) {
  // 禁用自由注册 - 只允许预设账号
  return { error: "账号注册已禁用。请使用预设账号登录。" };
}

function getPresetAccounts() {
  return PRESET_ACCOUNTS;
}

function loginUser(username, password) {
  const db = readDB();
  if (!db.users[username]) return { error: "账号不存在" };

  if (!verifyPassword(password, db.users[username].passwordHash)) {
    return { error: "密码错误" };
  }

  db.profiles[username].lastLogin = new Date().toISOString();
  writeDB(db);

  return { success: true, username };
}

function getUserProfile(username) {
  const db = readDB();
  if (!db.profiles[username]) return null;
  return db.profiles[username];
}

function updateNickname(username, nickname) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };

  db.profiles[username].nickname = nickname;
  writeDB(db);
  return { success: true };
}

// ===== 卡牌操作 =====
function generateDefaultCards() {
  // 生成 60 张卡牌（0-59 索引）
  return {
    cardCount: 60,
    cards: {}
  };
}

function getUserCards(username) {
  const db = readDB();
  return db.cards[username] || null;
}

function addCard(username, cardId) {
  const db = readDB();
  if (!db.cards[username]) return { error: "用户不存在" };

  if (!db.cards[username].cards[cardId]) {
    db.cards[username].cards[cardId] = 1;
  } else {
    // 额外卡牌处理（预留接口）
    db.cards[username].cards[cardId] += 1;
    // TODO: 实现转资源功能
  }

  writeDB(db);
  return { success: true };
}

// ===== 游戏记录 =====
function saveGameRecord(username, gameType, result, deckUsed, score) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };

  // 更新游戏记录
  const record = {
    username,
    gameType,
    result,
    deckUsed,
    score,
    timestamp: new Date().toISOString()
  };

  db.gameRecords.push(record);

  // 更新玩家档案
  const profile = db.profiles[username];
  profile.totalGames += 1;

  if (result === "win") {
    if (gameType === "pve") profile.pveWins += 1;
    else profile.pvpWins += 1;
    profile.wins += 1;
    profile.bestDeck = deckUsed;
  }

  writeDB(db);
  return { success: true, record };
}

// ===== 查询接口 =====
function getGameHistory(username, limit = 50) {
  const db = readDB();
  return db.gameRecords
    .filter((r) => r.username === username)
    .slice(-limit)
    .reverse();
}

// ===== 挑战模式进度 =====
function getChallengeProgress(username) {
  const db = readDB();
  if (!db.profiles[username]) return null;

  const profile = db.profiles[username];
  const savedAt = profile.challengeProgressSavedAt
    ? new Date(profile.challengeProgressSavedAt)
    : null;
  const now = new Date();

  // 检查是否超过 72 小时
  if (savedAt && now - savedAt > 72 * 60 * 60 * 1000) {
    return { level: 0, expired: true };
  }

  return {
    level: profile.challengeProgress || 0,
    savedAt: profile.challengeProgressSavedAt || null,
    expired: false
  };
}

function saveChallengeProgress(username, level) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };

  db.profiles[username].challengeProgress = level;
  db.profiles[username].challengeProgressSavedAt = new Date().toISOString();
  writeDB(db);

  return { success: true, level };
}

function clearChallengeProgress(username) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };

  db.profiles[username].challengeProgress = 0;
  db.profiles[username].challengeProgressSavedAt = null;
  writeDB(db);

  return { success: true };
}

// ===== 清空PVP数据 =====
function clearAllPVPData() {
  const db = readDB();

  // 清空所有游戏记录
  db.gameRecords = [];

  // 重置所有玩家的PVP数据
  Object.keys(db.profiles || {}).forEach((username) => {
    const profile = db.profiles[username];
    profile.pvpWins = 0;
    profile.wins = 0;
    profile.bestStreak = 0;
    profile.bestDeck = null;
    profile.totalGames = 0;
  });

  writeDB(db);
  return { success: true, message: "已清空所有本地PVP数据" };
}

function getLeaderboard() {
  const db = readDB();
  const leaderboard = Object.entries(db.profiles || {})
    .map(([username, profile]) => ({
      username,
      nickname: profile.nickname || username,
      winCount: profile.winCount || 0,
      totalGames: profile.totalGames || 0,
      winRate: profile.totalGames > 0
        ? ((profile.winCount || 0) / profile.totalGames * 100).toFixed(2)
        : 0
    }))
    .sort((a, b) => b.winCount - a.winCount)
    .slice(0, 100);

  return leaderboard;
}

function getCustomDecks(username) {
  const db = readDB();
  if (!db.profiles[username]) return null;
  return db.profiles[username].customDecks || {};
}

function saveCustomDeck(username, campKey, deckData) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };
  if (!db.profiles[username].customDecks) db.profiles[username].customDecks = {};

  db.profiles[username].customDecks[campKey] = deckData;
  writeDB(db);
  return { success: true };
}

function resetCustomDeck(username, campKey) {
  const db = readDB();
  if (!db.profiles[username]) return { error: "用户不存在" };
  if (!db.profiles[username].customDecks) db.profiles[username].customDecks = {};

  delete db.profiles[username].customDecks[campKey];
  writeDB(db);
  return { success: true };
}

module.exports = {
  createUser,
  getPresetAccounts,
  loginUser,
  getUserProfile,
  updateNickname,
  getUserCards,
  addCard,
  saveGameRecord,
  getGameHistory,
  getLeaderboard,
  getChallengeProgress,
  saveChallengeProgress,
  clearChallengeProgress,
  getCustomDecks,
  saveCustomDeck,
  resetCustomDeck,
  clearAllPVPData
};
