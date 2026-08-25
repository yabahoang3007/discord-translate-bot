function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gioi han so request/phut (sliding window) danh cho Gemini free tier.
// Neu hang doi da day it nhat 1 "cua so" (max request), bo qua ngay thay vi
// don ngay cang dai -> ban dich khong bi tre hang phut khi kenh chat dong.
class RateLimiter {
  constructor(maxPerMinute) {
    this.max = Math.max(1, maxPerMinute);
    this.timestamps = [];
    this.pending = 0;
    this._chain = Promise.resolve();
  }

  async schedule(fn) {
    if (this.pending >= this.max) {
      throw new Error("Đã vượt hàng đợi giới hạn tốc độ Gemini API, bỏ qua yêu cầu này.");
    }

    this.pending += 1;
    const slot = this._chain.then(() => this._waitForSlot());
    this._chain = slot;

    try {
      await slot;
      this.pending -= 1;
      return await fn();
    } catch (error) {
      this.pending -= 1;
      throw error;
    }
  }

  async _waitForSlot() {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < 60000);
      if (this.timestamps.length < this.max) {
        this.timestamps.push(now);
        return;
      }
      const waitMs = 60000 - (now - this.timestamps[0]) + 10;
      await sleep(waitMs);
    }
  }
}

module.exports = { RateLimiter };
