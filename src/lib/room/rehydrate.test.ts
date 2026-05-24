import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "../../../tests/helpers/prisma-mock";

beforeEach(() => {
  vi.resetModules();
});

async function setup(roomRecord: object | null) {
  const db = mockPrisma();
  (db.room.findUnique as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(roomRecord);
  const rehydrate = await import("./rehydrate");
  return rehydrate;
}

const baseRoom = {
  id: "r_stale",
  code: "ABC-123",
  videoId: "dQw4w9WgXcQ",
  positionSec: 42,
  closedAt: null,
  queue: [],
};

describe("loadRoomIntoMemory — stale playing clamp", () => {
  it("clamps playing to false when the room was left playing more than 5 minutes ago", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const { loadRoomIntoMemory } = await setup({
      ...baseRoom,
      playing: true,
      stateUpdated: tenMinutesAgo,
    });

    const state = await loadRoomIntoMemory("ABC-123");
    expect(state).not.toBeNull();
    expect(state!.playing).toBe(false);
    // updatedAt should be refreshed to ~now so the next drift check
    // doesn't extrapolate from the original stamp.
    expect(state!.updatedAt).toBeGreaterThan(tenMinutesAgo.getTime() + 60_000);
  });

  it("preserves playing=true if the room was active within the threshold", async () => {
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const { loadRoomIntoMemory } = await setup({
      ...baseRoom,
      id: "r_fresh",
      playing: true,
      stateUpdated: oneMinuteAgo,
    });

    const state = await loadRoomIntoMemory("ABC-123");
    expect(state!.playing).toBe(true);
    expect(state!.updatedAt).toBe(oneMinuteAgo.getTime());
  });
});
