import { describe, it, expect } from "vitest";
import {
  applyPlay,
  applyPause,
  applySeek,
  applyLoadVideo,
  applyQueueAdd,
  applyQueueRemove,
  applyQueueAdvance,
  expectedPosition,
  type RoomState,
} from "./state";

function base(overrides: Partial<RoomState> = {}): RoomState {
  return {
    roomId: "r1",
    videoId: "v1",
    playing: false,
    positionSec: 0,
    updatedAt: 1_000_000,
    queue: [],
    ...overrides,
  };
}

describe("playback reducers", () => {
  it("play sets playing=true and records position+timestamp", () => {
    const r = applyPlay(base(), { positionSec: 12.4 }, 1_000_500);
    expect(r.playing).toBe(true);
    expect(r.positionSec).toBe(12.4);
    expect(r.updatedAt).toBe(1_000_500);
  });

  it("pause sets playing=false", () => {
    const r = applyPause(base({ playing: true }), { positionSec: 30 }, 1_001_000);
    expect(r.playing).toBe(false);
    expect(r.positionSec).toBe(30);
  });

  it("seek keeps playing state but jumps position", () => {
    const r = applySeek(base({ playing: true, positionSec: 10 }), { positionSec: 99 }, 1_002_000);
    expect(r.playing).toBe(true);
    expect(r.positionSec).toBe(99);
  });

  it("loadVideo resets to 0, paused", () => {
    const r = applyLoadVideo(base({ playing: true, positionSec: 90 }), { videoId: "v2" }, 1_003_000);
    expect(r.videoId).toBe("v2");
    expect(r.playing).toBe(false);
    expect(r.positionSec).toBe(0);
  });
});

describe("queue reducers", () => {
  it("add appends to end", () => {
    const r = applyQueueAdd(base(), { id: "q1", videoId: "v2" });
    expect(r.queue.map((q) => q.videoId)).toEqual(["v2"]);
  });

  it("remove by id", () => {
    const r = applyQueueRemove(base({ queue: [{ id: "q1", videoId: "v2" }] }), { queueItemId: "q1" });
    expect(r.queue).toHaveLength(0);
  });

  it("advance is idempotent: ignores if fromVideoId doesn't match", () => {
    const s = base({ videoId: "v1", queue: [{ id: "q1", videoId: "v2" }] });
    const r1 = applyQueueAdvance(s, { fromVideoId: "v1" }, 1_010_000);
    expect(r1.videoId).toBe("v2");
    expect(r1.queue).toHaveLength(0);
    expect(r1.playing).toBe(true);

    const r2 = applyQueueAdvance(r1, { fromVideoId: "v1" }, 1_011_000);
    expect(r2).toBe(r1); // unchanged
  });
});

describe("expectedPosition", () => {
  it("returns stored position when paused", () => {
    expect(expectedPosition(base({ playing: false, positionSec: 42, updatedAt: 1000 }), 5000)).toBe(42);
  });
  it("extrapolates by elapsed seconds when playing", () => {
    expect(expectedPosition(base({ playing: true, positionSec: 10, updatedAt: 1000 }), 4000)).toBeCloseTo(13);
  });
});
