import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "../helpers/prisma-mock";
import { makeFakeServer, makeFakeSocket } from "../helpers/fake-socket";

beforeEach(() => {
  vi.resetModules();
  mockPrisma();
});

async function importHandlers() {
  const queue = await import("@/lib/socket/queue");
  const store = await import("@/lib/room/store");
  return { queue, store };
}

const ROOM_ID = "room_test_1";
const VID_CURRENT = "vCurrent0001";
const VID_NEW = "vNewVid0001"; // intentionally 11 chars to pass parseYouTubeId

describe("queue:add — synchronous in-memory update", () => {
  it("makes the item visible to a subsequent queue:skip on the same socket", async () => {
    const { queue, store } = await importHandlers();
    // Seed an empty-queue room playing VID_CURRENT.
    store.setRoom({
      roomId: ROOM_ID,
      videoId: VID_CURRENT,
      playing: true,
      positionSec: 30,
      updatedAt: Date.now(),
      queue: [],
    });

    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    queue.installQueueHandlers(io, socket as never);

    // Fire add and skip back-to-back, only awaiting add itself —
    // simulates a fast user click sequence. Crucially we do NOT
    // await any DB writes that the add handler kicks off.
    await fire("queue:add", { videoId: VID_NEW });
    await fire("queue:skip", { fromVideoId: VID_CURRENT });

    const state = store.getRoom(ROOM_ID);
    expect(state).toBeDefined();
    // Skip should have advanced to VID_NEW (proving it was visible).
    expect(state!.videoId).toBe(VID_NEW);
    expect(state!.queue).toHaveLength(0);

    // And there should have been broadcasts: add + skip.
    expect(broadcasts.length).toBeGreaterThanOrEqual(2);
  });
});

describe("queue:skip — idempotent", () => {
  it("two concurrent skips from the same fromVideoId yield only one transition", async () => {
    const { queue, store } = await importHandlers();
    store.setRoom({
      roomId: ROOM_ID,
      videoId: VID_CURRENT,
      playing: true,
      positionSec: 30,
      updatedAt: Date.now(),
      queue: [
        { id: "q1", videoId: "vNextVid001" },
        { id: "q2", videoId: "vAfterNext1" },
      ],
    });

    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    queue.installQueueHandlers(io, socket as never);

    await Promise.all([
      fire("queue:skip", { fromVideoId: VID_CURRENT }),
      fire("queue:skip", { fromVideoId: VID_CURRENT }),
    ]);

    const state = store.getRoom(ROOM_ID);
    // Only one advance happened: we landed on q1 (vNextVid001), not q2.
    expect(state!.videoId).toBe("vNextVid001");
    expect(state!.queue).toHaveLength(1);
    expect(state!.queue[0]!.videoId).toBe("vAfterNext1");
    // Despite two skip events, only one room:state should have been broadcast.
    const stateBroadcasts = broadcasts.filter((b) => b.event === "room:state");
    expect(stateBroadcasts.length).toBe(1);
  });
});
