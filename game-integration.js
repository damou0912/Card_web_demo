// 游戏与认证系统集成模块
const gameIntegration = (() => {
  let currentUser = null;
  const ui = {};

  function initUI() {
    // 获取 DOM 元素引用
    ui.authModal = document.getElementById("auth-modal");
    ui.authModalClose = document.getElementById("auth-modal-close");
    ui.authLoginForm = document.getElementById("auth-login-form");
    ui.authRegisterForm = document.getElementById("auth-register-form");
    ui.authSuccess = document.getElementById("auth-success");
    ui.authTabs = document.querySelectorAll(".auth-tab");
    ui.loginUsername = document.getElementById("login-username");
    ui.loginPassword = document.getElementById("login-password");
    ui.loginBtn = document.getElementById("login-btn");
    ui.registerUsername = document.getElementById("register-username");
    ui.registerPassword = document.getElementById("register-password");
    ui.registerPasswordConfirm = document.getElementById("register-password-confirm");
    ui.registerBtn = document.getElementById("register-btn");
    ui.authError = document.getElementById("auth-error");
    ui.registerError = document.getElementById("register-error");
    ui.authUsernameDisplay = document.getElementById("auth-username-display");
    ui.authContinueBtn = document.getElementById("auth-continue-btn");
    ui.playerIdValue = document.getElementById("player-id-value");
    ui.editPlayerIdBtn = document.getElementById("edit-player-id-btn");
    ui.loginMenuBtn = document.getElementById("login-menu-btn");

    setupEventListeners();
  }

  function setupEventListeners() {
    // 认证模态框关闭
    ui.authModalClose?.addEventListener("click", () => closeAuthModal());

    // 加载预设账号列表
    loadPresetAccounts();

    // 登录
    ui.loginBtn?.addEventListener("click", async () => {
      const username = ui.loginUsername.value.trim();
      const password = ui.loginPassword.value;
      if (!username || !password) {
        ui.authError.textContent = "请选择账号并输入密码";
        return;
      }
      ui.loginBtn.disabled = true;
      ui.authError.textContent = "";
      const result = await authClient.login(username, password);
      ui.loginBtn.disabled = false;
      if (result.success) {
        currentUser = username;
        showAuthSuccess(username);
      } else {
        ui.authError.textContent = result.error || "登录失败";
      }
    });

    // 继续按钮
    ui.authContinueBtn?.addEventListener("click", () => {
      closeAuthModal();
      updateUserDisplay();
    });

    // 编辑昵称
    ui.editPlayerIdBtn?.addEventListener("click", () => {
      if (currentUser) {
        showNicknameModal();
      } else {
        alert("请先登录账号");
      }
    });

    // 登录按钮
    ui.loginMenuBtn?.addEventListener("click", () => {
      showAuthModal();
    });
  }

  async function loadPresetAccounts() {
    const presets = await authClient.getPresetAccounts();
    const select = ui.loginUsername;
    if (select && Array.isArray(presets.accounts)) {
      presets.accounts.forEach((account) => {
        const option = document.createElement("option");
        option.value = account;
        option.textContent = account;
        select.appendChild(option);
      });
    }
  }

  function showAuthModal() {
    if (ui.authModal) {
      ui.authModal.setAttribute("aria-hidden", "false");
      ui.authModal.classList.add("visible");
    }
  }

  function closeAuthModal() {
    if (ui.authModal) {
      ui.authModal.setAttribute("aria-hidden", "true");
      ui.authModal.classList.remove("visible");
    }
    // 清空表单
    ui.loginUsername.value = "";
    ui.loginPassword.value = "";
    ui.registerUsername.value = "";
    ui.registerPassword.value = "";
    ui.registerPasswordConfirm.value = "";
    ui.authError.textContent = "";
    ui.registerError.textContent = "";
  }

  function showAuthSuccess(username) {
    ui.authLoginForm.hidden = true;
    ui.authRegisterForm.hidden = true;
    ui.authSuccess.hidden = false;
    ui.authUsernameDisplay.textContent = `欢迎，${username}!`;
  }

  function updateUserDisplay() {
    if (currentUser && ui.playerIdValue) {
      ui.playerIdValue.textContent = currentUser;
      ui.playerIdValue.classList.add("user-logged-in");
    }
  }

  async function showNicknameModal() {
    const profile = await authClient.getProfile(currentUser);
    if (!profile) return;

    const nickname = prompt("请输入新昵称:", profile.nickname || "");
    if (nickname === null) return;

    if (nickname.trim().length === 0) {
      alert("昵称不能为空");
      return;
    }

    const result = await authClient.updateNickname(currentUser, nickname.trim());
    if (result.success) {
      alert("昵称已更新");
      updateUserDisplay();
    } else {
      alert("更新昵称失败：" + (result.error || "未知错误"));
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  function setCurrentUser(username) {
    currentUser = username;
  }

  // 游戏结束时保存记录
  async function saveGameResult(gameType, result, deckUsed, score) {
    if (!currentUser) return { message: "未登录，不记录" };

    // 如果是挑战模式且胜利，保存进度
    if (gameType === "pve-challenge" && result === "win" && score?.challengeLevel) {
      await authClient.saveChallengeProgress(currentUser, score.challengeLevel);
    }

    return await authClient.saveGameRecord(currentUser, gameType, result, deckUsed, score);
  }

  // 加载挑战模式进度
  async function loadChallengeProgress() {
    if (!currentUser) return { level: 0, expired: false };
    return await authClient.getChallengeProgress(currentUser);
  }

  // 清除挑战模式进度
  async function clearChallengeProgress() {
    if (!currentUser) return { error: "未登录" };
    return await authClient.clearChallengeProgress(currentUser);
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initUI();
        const storedUser = authClient.loadUser();
        if (storedUser) {
          setCurrentUser(storedUser);
          updateUserDisplay();
        }
        // 不主动弹出登录框，用户可自行点击登录
      });
    } else {
      initUI();
      const storedUser = authClient.loadUser();
      if (storedUser) {
        setCurrentUser(storedUser);
        updateUserDisplay();
      }
    }
  }

  return {
    init,
    getCurrentUser,
    setCurrentUser,
    saveGameResult,
    showAuthModal,
    closeAuthModal
  };
})();

// 初始化
gameIntegration.init();
