'use strict';
// Presentation only: consumes committed rewards; never draws, charges or saves.
class GachaReveal {
  // Presentation vocabulary, not probability or card-strength rankings. Special is its own category.
  static quality(rarity) {
    const profiles = {
      '普通': {key:'common', label:'普通 · 白', cue:0, hold:420, featured:false},
      '稀有': {key:'rare', label:'稀有 · 蓝', cue:180, hold:650, featured:false},
      '史诗': {key:'epic', label:'史诗 · 紫', cue:380, hold:1500, featured:true},
      '传说': {key:'legendary', label:'传说 · 橙', cue:700, hold:2400, featured:true},
      '特殊': {key:'special', label:'特殊 · 青绿', cue:200, hold:750, featured:false}
    };
    return profiles[rarity] || profiles['普通'];
  }
  constructor(view, options = {}) {
    this.view = view;
    this.fast = !!options.reducedMotion;
    this.pending = new Set();
    // Call browser timers on Window, not as methods of this controller.
    this.setTimer = options.setTimer || ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer || (timer => clearTimeout(timer));
    this.closed = false;
  }
  open() {
    if (!this.closed && !this.fast) this.view.open(() => this.skip());
  }
  skip() {
    this.fast = true;
    for (const finish of [...this.pending]) finish();
    if (!this.closed) this.view.waiting(); // A pending server request is NOT cancelled or retried.
  }
  wait(ms) {
    if (this.fast || ms === 0) return Promise.resolve();
    return new Promise(resolve => {
      let timer;
      const finish = () => { this.clearTimer(timer); this.pending.delete(finish); resolve(); };
      this.pending.add(finish); timer = this.setTimer(finish, ms);
    });
  }
  async play(rewards, cardFor) {
    try {
      await this.wait(650);
      if (this.closed) return;
      this.view.deal(rewards.length, rewards.filter(r => r.guarantee).length);
      await this.wait(450);
      if (this.closed) return;
      for (let i = 0; i < rewards.length; i++) {
        const reward = rewards[i], card = cardFor(reward.cardId);
        const quality = GachaReveal.quality(card.rarity);
        this.view.prepare(reward, card, i, this.fast);
        await this.wait(quality.cue);
        if (this.closed) return;
        this.view.reveal(reward, card, i, this.fast);
        // A duplicate or guarantee is still this quality; do not shorten its presentation.
        await this.wait(quality.hold);
        if (this.closed) return;
      }
      this.view.complete(rewards);
      await this.wait(650);
    } finally { this.close(); }
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.fast = true;
    for (const finish of [...this.pending]) finish();
    this.view.close();
  }
}
if (typeof module !== 'undefined') module.exports = GachaReveal;
