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
}
