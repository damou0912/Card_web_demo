// PostgreSQL 数据库驱动
// 当环境变量 DATABASE_URL 存在时自动使用 PostgreSQL
// 格式：postgresql://user:password@host:port/database

const crypto = require("crypto");

let pool = null;

async function initPool() {
  if (pool) return pool;

  try {
    const { Pool } = require("pg");
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.log("⚠️  DATABASE_URL 未设置，将使用 JSON 文件存储");
      return null;
    }

    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    // 初始化数据库表
    await initDatabase(pool);
    console.log("✅ PostgreSQL 数据库已连接");
    return pool;
  } catch (e) {
    console.warn("⚠️  PostgreSQL 连接失败，回退到 JSON 存储:", e.message);
    return null;
  }
}

async function initDatabase(pool) {
  const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      is_preset BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS profiles (
      username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
      nickname TEXT NOT NULL,
      wins INTEGER DEFAULT 0,
      pve_wins INTEGER DEFAULT 0,
      pvp_wins INTEGER DEFAULT 0,
      total_games INTEGER DEFAULT 0,
      best_deck TEXT,
      last_login TIMESTAMP,
      FOREIGN KEY (username) REFERENCES users(username)
    );

    CREATE TABLE IF NOT EXISTS cards (
      username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
      card_data JSONB DEFAULT '{}'::jsonb,
      FOREIGN KEY (username) REFERENCES users(username)
    );

    CREATE TABLE IF NOT EXISTS game_records (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      game_type TEXT NOT NULL,
      result TEXT NOT NULL,
      deck_used TEXT,
      score JSONB,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (username) REFERENCES users(username)
    );

    CREATE INDEX IF NOT EXISTS idx_game_records_username ON game_records(username);
    CREATE INDEX IF NOT EXISTS idx_profiles_wins ON profiles(wins DESC);
  `;

  try {
    await pool.query(createTablesSQL);
  } catch (e) {
    console.warn("表已存在或创建失败:", e.message);
  }
}

// 密码加密函数（与 db.js 相同）
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

async function loginUser(username, password) {
  const pool = await initPool();
  if (!pool) return null; // 使用 JSON 驱动

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return { error: "账号不存在" };
    }

    if (!verifyPassword(password, result.rows[0].password_hash)) {
      return { error: "密码错误" };
    }

    await pool.query(
      "UPDATE profiles SET last_login = CURRENT_TIMESTAMP WHERE username = $1",
      [username]
    );

    return { success: true, username };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "登录失败" };
  }
}

async function getUserProfile(username) {
  const pool = await initPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT nickname, wins, pve_wins, pvp_wins, total_games, best_deck, last_login
       FROM profiles WHERE username = $1`,
      [username]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      nickname: row.nickname,
      wins: row.wins,
      pveWins: row.pve_wins,
      pvpWins: row.pvp_wins,
      totalGames: row.total_games,
      bestDeck: row.best_deck,
      lastLogin: row.last_login ? row.last_login.toISOString() : null
    };
  } catch (e) {
    console.error("数据库错误:", e);
    return null;
  }
}

async function updateNickname(username, nickname) {
  const pool = await initPool();
  if (!pool) return null;

  try {
    await pool.query("UPDATE profiles SET nickname = $1 WHERE username = $2", [
      nickname,
      username
    ]);
    return { success: true };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "更新失败" };
  }
}

async function saveGameRecord(username, gameType, result, deckUsed, score) {
  const pool = await initPool();
  if (!pool) return null;

  try {
    const isWin = result === "win" ? 1 : 0;
    await pool.query(
      `INSERT INTO game_records (username, game_type, result, deck_used, score)
       VALUES ($1, $2, $3, $4, $5)`,
      [username, gameType, result, deckUsed, JSON.stringify(score)]
    );

    // 更新档案
    if (gameType === "pve") {
      await pool.query(
        `UPDATE profiles SET pve_wins = pve_wins + $1, total_games = total_games + 1,
         best_deck = CASE WHEN $1 = 1 THEN $2 ELSE best_deck END
         WHERE username = $3`,
        [isWin, deckUsed, username]
      );
    } else {
      await pool.query(
        `UPDATE profiles SET pvp_wins = pvp_wins + $1, total_games = total_games + 1,
         best_deck = CASE WHEN $1 = 1 THEN $2 ELSE best_deck END
         WHERE username = $3`,
        [isWin, deckUsed, username]
      );
    }

    await pool.query(
      `UPDATE profiles SET wins = wins + $1 WHERE username = $2`,
      [isWin, username]
    );

    return {
      success: true,
      record: {
        username,
        gameType,
        result,
        deckUsed,
        score,
        timestamp: new Date().toISOString()
      }
    };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "保存失败" };
  }
}

async function getLeaderboard(limit = 100) {
  const pool = await initPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT username, nickname, wins, total_games
       FROM profiles
       ORDER BY wins DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      username: row.username,
      nickname: row.nickname,
      wins: row.wins,
      totalGames: row.total_games,
      winRate:
        row.total_games > 0
          ? ((row.wins / row.total_games) * 100).toFixed(2)
          : 0
    }));
  } catch (e) {
    console.error("数据库错误:", e);
    return [];
  }
}

module.exports = {
  initPool,
  loginUser,
  getUserProfile,
  updateNickname,
  saveGameRecord,
  getLeaderboard
};
