import { db } from "../db";
import { setRoom, getRoom } from "./store";
import type { RoomState } from "./state";

/**
 * Load a room into the in-memory store by its public code.
 * If already in memory (matched by id), return it.
 * Otherwise fetch from Postgres, hydrate, return.
 * Returns null if the room doesn't exist or is closed.
 */
export async function loadRoomIntoMemory(code: string): Promise<RoomState | null> {
  const room = await db.room.findUnique({
    where: { code },
    include: { queue: { orderBy: { position: "asc" } } },
  });
  if (!room || room.closedAt) return null;

  // Check if we already have a fresher copy in memory
  const existing = getRoom(room.id);
  if (existing) return existing;

  const state: RoomState = {
    roomId: room.id,
    videoId: room.videoId,
    playing: room.playing,
    positionSec: room.positionSec,
    updatedAt: room.stateUpdated.getTime(),
    queue: room.queue.map((q) => ({
      id: q.id,
      videoId: q.videoId,
      title: q.title ?? undefined,
      thumbnail: q.thumbnail ?? undefined,
      addedById: q.addedById ?? undefined,
    })),
  };
  setRoom(state);
  return state;
}

/**
 * Persist current in-memory state to the DB. Fire-and-forget pattern is fine —
 * we don't block the broadcast on the write.
 */
export async function persistRoomState(state: RoomState): Promise<void> {
  await db.room
    .update({
      where: { id: state.roomId },
      data: {
        videoId: state.videoId,
        playing: state.playing,
        positionSec: state.positionSec,
        stateUpdated: new Date(state.updatedAt),
      },
    })
    .catch((e) => console.error("persistRoomState failed", e));
}
