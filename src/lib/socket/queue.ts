import type { Socket } from "socket.io";
import type { PartyServer } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyQueueAdd, applyQueueAdvance, applyQueueRemove } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { db } from "../db";
import { parseYouTubeId, fetchOEmbed } from "../youtube";
import { broadcastRoomState } from "./broadcast";

export function installQueueHandlers(io: PartyServer, socket: Socket) {
  socket.on("queue:add", async ({ videoId, title, thumbnail }) => {
    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;
    if (!parseYouTubeId(videoId)) return;

    let resolvedTitle = title;
    let resolvedThumb = thumbnail;
    if (!resolvedTitle || !resolvedThumb) {
      const meta = await fetchOEmbed(videoId);
      resolvedTitle = resolvedTitle ?? meta.title;
      resolvedThumb = resolvedThumb ?? meta.thumbnail;
    }

    const s = getRoom(roomId);
    if (!s) return;
    const position = s.queue.length;
    const row = await db.queueItem.create({
      data: {
        roomId,
        videoId,
        title: resolvedTitle,
        thumbnail: resolvedThumb,
        position,
        addedById: identity.userId ?? null,
      },
    });

    const next = applyQueueAdd(s, {
      id: row.id,
      videoId,
      title: resolvedTitle,
      thumbnail: resolvedThumb,
    });
    setRoom(next);
    broadcastRoomState(io, roomId);
  });

  socket.on("queue:remove", async ({ queueItemId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyQueueRemove(s, { queueItemId });
    setRoom(next);
    await db.queueItem.delete({ where: { id: queueItemId } }).catch(() => {});
    broadcastRoomState(io, roomId);
  });

  // Triggered automatically when a video ends. Idempotent: if the
  // current videoId no longer matches what the caller saw, no-op.
  socket.on("queue:advance", async ({ fromVideoId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    await doAdvance(io, roomId, fromVideoId);
  });

  // Triggered explicitly by a "Skip" button. Same logic as advance.
  socket.on("queue:skip", async ({ fromVideoId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    await doAdvance(io, roomId, fromVideoId);
  });
}

async function doAdvance(io: PartyServer, roomId: string, fromVideoId: string) {
  const s = getRoom(roomId);
  if (!s) return;
  const next = applyQueueAdvance(s, { fromVideoId }, Date.now());
  if (next === s) return; // already advanced — idempotent no-op
  setRoom(next);

  // Persist the new room state and clean up the played queue row.
  // The advanced "next" video came from the head of the queue, so
  // remove that DB row.
  const head = s.queue[0];
  if (head && next.videoId === head.videoId) {
    await db.queueItem.delete({ where: { id: head.id } }).catch(() => {});
  }
  await persistRoomState(next);
  broadcastRoomState(io, roomId);
}
