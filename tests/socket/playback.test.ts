import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "../helpers/prisma-mock";
import { makeFakeServer, makeFakeSocket } from "../helpers/fake-socket";

beforeEach(() => {
  vi.resetModules();
  mockPrisma();
});

const ROOM_ID = "room_pb_1";
const VID = "vPlayback001";

async function setup() {
  const playback = await import("@/lib/socket/playback");
  const store = await import("@/lib/room/store");
  return { playback, store };
}

describe("playback:play — no-op tolerance", () => {
  it("drops a play event when the server already says playing AND position matches expected", async () => {
    const { playback, store } = await setup();
    const updatedAt = Date.now() - 5_000; // started 5s ago
    store.setRoom({
      roomId: ROOM_ID,
      videoId: VID,
      playing: true,
      positionSec: 10, // → expected now ≈ 15
      updatedAt,
      queue: [],
    });

    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    playback.installPlaybackHandlers(io, socket as never);

    // Client emits PLAY at position 15 (matches expected within 1s).
    await fire("playback:play", { positionSec: 15 });

    // Server should have ignored it — no broadcast.
    expect(broadcasts.filter((b) => b.event === "room:state")).toHaveLength(0);
    // State unchanged.
    expect(store.getRoom(ROOM_ID)!.updatedAt).toBe(updatedAt);
  });

  it("broadcasts when the position differs meaningfully", async () => {
    const { playback, store } = await setup();
    store.setRoom({
      roomId: ROOM_ID,
      videoId: VID,
      playing: true,
      positionSec: 10,
      updatedAt: Date.now() - 5_000,
      queue: [],
    });
    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    playback.installPlaybackHandlers(io, socket as never);

    // Way ahead of expected — a real seek+play, must broadcast.
    await fire("playback:play", { positionSec: 90 });

    expect(broadcasts.filter((b) => b.event === "room:state")).toHaveLength(1);
    expect(store.getRoom(ROOM_ID)!.positionSec).toBe(90);
  });
});

describe("playback:loadVideo — input validation", () => {
  it("rejects garbage video ids without mutating room state", async () => {
    const { playback, store } = await setup();
    const initial = {
      roomId: ROOM_ID,
      videoId: VID,
      playing: false,
      positionSec: 0,
      updatedAt: Date.now(),
      queue: [],
    };
    store.setRoom(initial);

    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    playback.installPlaybackHandlers(io, socket as never);

    await fire("playback:loadVideo", { videoId: "not-a-real-id" });
    await fire("playback:loadVideo", { videoId: "<script>alert(1)</script>" });

    expect(broadcasts).toHaveLength(0);
    expect(store.getRoom(ROOM_ID)!.videoId).toBe(VID);
  });

  it("accepts a valid 11-char YouTube id and updates state", async () => {
    const { playback, store } = await setup();
    store.setRoom({
      roomId: ROOM_ID,
      videoId: VID,
      playing: false,
      positionSec: 0,
      updatedAt: Date.now(),
      queue: [],
    });
    const { io, broadcasts } = makeFakeServer();
    const { socket, fire } = makeFakeSocket({ roomId: ROOM_ID });
    playback.installPlaybackHandlers(io, socket as never);

    await fire("playback:loadVideo", { videoId: "dQw4w9WgXcQ" });

    expect(store.getRoom(ROOM_ID)!.videoId).toBe("dQw4w9WgXcQ");
    expect(broadcasts.filter((b) => b.event === "room:state")).toHaveLength(1);
  });
});
