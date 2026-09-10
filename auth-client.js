// 前端认证和用户管理模块
const authClient = (() => {
  const STORAGE_KEY = "card-demo-user";

  function saveUser(username) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ username, timestamp: Date.now() }));
    } catch (_) {}
  }

  function loadUser() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored).username : null;
    } catch (_) {
      return null;
    }
  }

  function clearUser() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  async function getPresetAccounts() {
    try {
      const response = await fetch("/api/auth/presets");
      if (response.ok) {
        return await response.json();
      }
      return { accounts: [], password: "password123" };
    } catch (e) {
      return { accounts: [], password: "password123" };
    }
  }

  async function register(username, password) {
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      return { error: data.error || "注册已禁用" };
    } catch (e) {
      return { error: "网络错误：" + e.message };
    }
  }

  async function login(username, password) {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        saveUser(username);
        return { success: true, username };
      }
      return { error: data.error || "登录失败" };
    } catch (e) {
      return { error: "网络错误：" + e.message };
    }
  }

  async function getProfile(username) {
    try {
      const response = await fetch(`/api/profile/${encodeURIComponent(username)}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function updateNickname(username, nickname) {
    try {
      const response = await fetch("/api/profile/nickname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, nickname })
      });
      return await response.json();
    } catch (e) {
      return { error: "网络错误：" + e.message };
    }
  }

  async function getCards(username) {
    try {
      const response = await fetch(`/api/cards/${encodeURIComponent(username)}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async function getLeaderboard() {
    try {
      const response = await fetch("/api/leaderboard");
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  async function saveGameRecord(username, gameType, result, deckUsed, score) {
    try {
      const response = await fetch("/api/game/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, gameType, result, deckUsed, score })
      });
      return await response.json();
    } catch (e) {
      return { error: "保存游戏记录失败：" + e.message };
    }
  }

  return {
    register,
    login,
    getProfile,
    updateNickname,
    getCards,
    getLeaderboard,
    saveGameRecord,
    saveUser,
    loadUser,
    clearUser
  };
})();
