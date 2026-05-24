export class SlidingWindow {
  private hits = new Map<string, number[]>();
  constructor(private opts: { windowMs: number; max: number }) {}

  allow(key: string, nowMs: number = Date.now()): boolean {
    const arr = this.hits.get(key) ?? [];
    const cutoff = nowMs - this.opts.windowMs;
    const recent = arr.filter((t) => t > cutoff);
    if (recent.length >= this.opts.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }

  /**
   * Forget a key entirely. Call this when the entity behind the key
   * (a user, a socket) is gone, to prevent unbounded map growth.
   */
  forget(key: string): void {
    this.hits.delete(key);
  }

  /**
   * Drop every entry whose newest hit is older than the window.
   * Safe to call from a periodic timer.
   */
  sweep(nowMs: number = Date.now()): void {
    const cutoff = nowMs - this.opts.windowMs;
    for (const [key, hits] of this.hits) {
      if (hits.length === 0 || (hits[hits.length - 1] ?? 0) <= cutoff) {
        this.hits.delete(key);
      }
    }
  }
}
