// PostgreSQL 数据库驱动
// 当环境变量 DATABASE_URL 存在时自动使用 PostgreSQL
// 格式：postgresql://user:password@host:port/database

const crypto = require("crypto");

const PRESET_ACCOUNTS = [
  "player1", "player2", "player3", "player4", "player5",
  "player6", "player7", "player8", "player9", "player10", "admin"
];
const PRESET_PASSWORD = "password123";

let pool = null;
let poolReady = null;

async function initPool() {
  if (!poolReady) poolReady = openPool().catch(error => { poolReady = null; throw error; });
  return poolReady;
}

async function openPool() {

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
    console.warn("PostgreSQL 初始化失败，未切换存储。");
    if (pool) await pool.end().catch(() => {});
    pool = null;
    throw new Error('数据库不可用，请稍后再试。');
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
      challenge_progress INTEGER NOT NULL DEFAULT 0,
      challenge_progress_saved_at TIMESTAMPTZ,
      challenge_highest_level INTEGER NOT NULL DEFAULT 0,
      challenge_clear_count INTEGER NOT NULL DEFAULT 0,
      custom_decks JSONB NOT NULL DEFAULT '{}'::jsonb,
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

    CREATE TABLE IF NOT EXISTS gacha_profiles (
      username TEXT PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
      revision INTEGER NOT NULL,
      profile JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_sessions (
      token_hash TEXT PRIMARY KEY,
      username TEXT NOT NULL REFERENCES users(username) ON DELETE CASCADE,
      expires_at BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_game_records_username ON game_records(username);
    CREATE INDEX IF NOT EXISTS idx_profiles_wins ON profiles(wins DESC);
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_decks JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_progress INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_progress_saved_at TIMESTAMPTZ;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_highest_level INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS challenge_clear_count INTEGER NOT NULL DEFAULT 0;
    UPDATE profiles
    SET challenge_highest_level = GREATEST(challenge_highest_level, challenge_progress),
        challenge_clear_count = CASE
          WHEN challenge_progress >= 12 AND challenge_clear_count = 0 THEN 1
          ELSE challenge_clear_count
        END;
  `;

  try {
    await pool.query(createTablesSQL);
    const passwordHash = hashPassword(PRESET_PASSWORD);
    await pool.query(
      `INSERT INTO users (username, password_hash, is_preset)
       SELECT preset.username, $2, true
       FROM unnest($1::text[]) AS preset(username)
       ON CONFLICT (username) DO NOTHING`,
      [PRESET_ACCOUNTS, passwordHash]
    );
    await pool.query(
      `INSERT INTO profiles (username, nickname)
       SELECT username, username FROM users WHERE username = ANY($1::text[])
       ON CONFLICT (username) DO NOTHING`,
      [PRESET_ACCOUNTS]
    );
    await pool.query(
      `INSERT INTO cards (username, card_data)
       SELECT username, '{}'::jsonb FROM users WHERE username = ANY($1::text[])
       ON CONFLICT (username) DO NOTHING`,
      [PRESET_ACCOUNTS]
    );
  } catch (e) {
    throw e;
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
      `SELECT nickname, wins, pve_wins, pvp_wins, total_games, best_deck, last_login,
              challenge_highest_level, challenge_clear_count, custom_decks
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
      challengeHighestLevel: Number(row.challenge_highest_level) || 0,
      challengeClearCount: Number(row.challenge_clear_count) || 0,
      customDecks: row.custom_decks || {},
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

async function getCustomDecks(username) {
  const pool = await initPool();
  if (!pool) return null;
  try {
    const result = await pool.query("SELECT custom_decks FROM profiles WHERE username = $1", [username]);
    return result.rows.length ? (result.rows[0].custom_decks || {}) : null;
  } catch (e) {
    console.error("数据库错误:", e);
    throw e;
  }
}

async function saveCustomDeck(username, campKey, deckData) {
  const pool = await initPool();
  if (!pool) return { error: "数据库不可用" };
  try {
    const result = await pool.query(
      `UPDATE profiles
       SET custom_decks = jsonb_set(COALESCE(custom_decks, '{}'::jsonb), ARRAY[$2]::text[], $3::jsonb, true)
       WHERE username = $1`,
      [username, campKey, JSON.stringify(deckData)]
    );
    return result.rowCount ? { success: true } : { error: "用户不存在" };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "保存卡组失败" };
  }
}

async function resetCustomDeck(username, campKey) {
  const pool = await initPool();
  if (!pool) return { error: "数据库不可用" };
  try {
    const result = await pool.query(
      "UPDATE profiles SET custom_decks = COALESCE(custom_decks, '{}'::jsonb) - $2 WHERE username = $1",
      [username, campKey]
    );
    return result.rowCount ? { success: true } : { error: "用户不存在" };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "重置卡组失败" };
  }
}

async function getChallengeProgress(username) {
  const pool = await initPool();
  if (!pool) return null;
  try {
    const result = await pool.query(
      `SELECT challenge_progress, challenge_progress_saved_at
       FROM profiles WHERE username = $1`,
      [username]
    );
    if (!result.rows.length) return null;
    const row = result.rows[0];
    const savedAt = row.challenge_progress_saved_at;
    if (savedAt && Date.now() - new Date(savedAt).getTime() > 72 * 60 * 60 * 1000) {
      return { level: 0, expired: true };
    }
    return {
      level: Number(row.challenge_progress) || 0,
      savedAt: savedAt ? new Date(savedAt).toISOString() : null,
      expired: false
    };
  } catch (e) {
    console.error("数据库错误:", e);
    return null;
  }
}

async function saveChallengeProgress(username, level) {
  const normalizedLevel = Number(level);
  if (!Number.isInteger(normalizedLevel) || normalizedLevel < 1 || normalizedLevel > 12) {
    return { error: "挑战关卡无效" };
  }

  const pool = await initPool();
  if (!pool) return { error: "数据库不可用" };
  try {
    const result = await pool.query(
      `UPDATE profiles
       SET challenge_clear_count = COALESCE(challenge_clear_count, 0) + CASE
             WHEN $2 = 12 AND COALESCE(challenge_progress, 0) < 12 THEN 1 ELSE 0
           END,
           challenge_highest_level = GREATEST(
             COALESCE(challenge_highest_level, 0),
             COALESCE(challenge_progress, 0),
             $2
           ),
           challenge_progress = $2,
           challenge_progress_saved_at = CURRENT_TIMESTAMP
       WHERE username = $1
       RETURNING challenge_progress, challenge_highest_level, challenge_clear_count`,
      [username, normalizedLevel]
    );
    if (!result.rows.length) return { error: "用户不存在" };
    const row = result.rows[0];
    return {
      success: true,
      level: Number(row.challenge_progress),
      challengeHighestLevel: Number(row.challenge_highest_level),
      challengeClearCount: Number(row.challenge_clear_count)
    };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "保存进度失败" };
  }
}

async function clearChallengeProgress(username) {
  const pool = await initPool();
  if (!pool) return { error: "数据库不可用" };
  try {
    const result = await pool.query(
      `UPDATE profiles
       SET challenge_progress = 0, challenge_progress_saved_at = NULL
       WHERE username = $1`,
      [username]
    );
    return result.rowCount ? { success: true } : { error: "用户不存在" };
  } catch (e) {
    console.error("数据库错误:", e);
    return { error: "清除进度失败" };
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

async function getGachaProfile(username) {
  const connection = await initPool();
  if (!connection) throw new Error('数据库不可用');
  const result = await connection.query('SELECT profile FROM gacha_profiles WHERE username = $1', [username]);
  return result.rows[0]?.profile || null;
}
async function saveGachaProfile(username, expectedRevision, profile) {
  const connection = await initPool();
  if (!connection) throw new Error('数据库不可用');
  const result = expectedRevision === null
    ? await connection.query('INSERT INTO gacha_profiles (username, revision, profile) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [username, profile.revision, JSON.stringify(profile)])
    : await connection.query('UPDATE gacha_profiles SET revision=$2, profile=$3 WHERE username=$1 AND revision=$4', [username, profile.revision, JSON.stringify(profile), expectedRevision]);
  return result.rowCount === 1;
}
async function putAccountSession(hash, username, expiresAt) {
  const connection = await initPool();
  if (!connection) throw new Error('数据库不可用');
  await connection.query('DELETE FROM account_sessions WHERE expires_at < $1', [Date.now()]);
  await connection.query('INSERT INTO account_sessions VALUES ($1,$2,$3)', [hash, username, expiresAt]);
}
async function getAccountSession(hash) {
  const connection = await initPool();
  if (!connection) throw new Error('数据库不可用');
  const result = await connection.query('SELECT username, expires_at FROM account_sessions WHERE token_hash=$1', [hash]);
  return result.rows[0] ? { username: result.rows[0].username, expiresAt: Number(result.rows[0].expires_at) } : null;
}
async function deleteAccountSession(hash) {
  const connection = await initPool();
  if (!connection) throw new Error('数据库不可用');
  await connection.query('DELETE FROM account_sessions WHERE token_hash=$1', [hash]);
}

module.exports = {
  getGachaProfile, saveGachaProfile, putAccountSession, getAccountSession, deleteAccountSession,
  initPool,
  loginUser,
  getUserProfile,
  updateNickname,
  getCustomDecks,
  saveCustomDeck,
  resetCustomDeck,
  getChallengeProgress,
  saveChallengeProgress,
  clearChallengeProgress,
  saveGameRecord,
  getLeaderboard
};
