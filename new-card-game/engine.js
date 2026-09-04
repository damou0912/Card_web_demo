/* Shared deterministic rules runtime. UI code only submits intents to this layer. */
(() => {
  const MAX_CHAIN_STEPS = 10;

  function create(game, log) {
    return {
      game,
      log,
      queue: [],
      steps: 0,
      active: false,
      enqueue(label, resolve) {
        this.queue.push({ label, resolve });
      },
      run() {
        if (this.active) return;
        this.active = true;
        while (this.queue.length && this.steps < MAX_CHAIN_STEPS) {
          const next = this.queue.shift();
          this.steps += 1;
          next.resolve();
          this.log(`技能结算：${next.label}`);
        }
        if (this.queue.length) {
          this.queue.length = 0;
          this.log(`技能链达到 ${MAX_CHAIN_STEPS} 次上限，剩余效果中断。`);
        }
        this.active = false;
      },
      resetChain() {
        this.queue.length = 0;
        this.steps = 0;
      },
      changePower(card, amount, { temporary = false, reason = "技能" } = {}) {
        if (!card || !this.game.board.includes(card)) return false;
        if (amount < 0 && this.game.board.some((item) => item.owner === card.owner && item.name === "曹操")) {
          this.log(`${card.name}受曹操保护，${reason}的战力降低无效。`);
          return false;
        }
        card.power = Math.max(0, card.power + amount);
        if (temporary) card.temporaryPower = (card.temporaryPower || 0) + amount;
        this.log(`${card.name}${amount >= 0 ? "+" : ""}${amount} 战力（${reason}）。`);
        return true;
      },
      clearTemporary() {
        this.game.board.forEach((card) => {
          if (!card.temporaryPower) return;
          const amount = card.temporaryPower;
          card.temporaryPower = 0;
          this.changePower(card, -amount, { reason: "本回合效果结束" });
        });
      }
    };
  }

  window.CardRulesEngine = { create, MAX_CHAIN_STEPS };
})();
