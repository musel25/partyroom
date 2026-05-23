import { describe, it, expect } from "vitest";
import { SlidingWindow } from "./rate-limit";

describe("SlidingWindow", () => {
  it("allows under the limit", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 3 });
    expect(rl.allow("k", 0)).toBe(true);
    expect(rl.allow("k", 100)).toBe(true);
    expect(rl.allow("k", 200)).toBe(true);
  });
  it("blocks over the limit", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 3 });
    rl.allow("k", 0); rl.allow("k", 0); rl.allow("k", 0);
    expect(rl.allow("k", 100)).toBe(false);
  });
  it("forgives after window passes", () => {
    const rl = new SlidingWindow({ windowMs: 1000, max: 2 });
    rl.allow("k", 0); rl.allow("k", 500);
    expect(rl.allow("k", 600)).toBe(false);
    expect(rl.allow("k", 1100)).toBe(true);
  });
});
