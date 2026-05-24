import { randomUUID } from "node:crypto";
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

    const s = getRoom(roomId);
    if (!s) return;
    const position = s.queue.length;

    // Apply to in-memory state IMMEDIATELY (with a generated id) so
    // that any follow-up event arriving on the same socket — most
    // commonly a rapid Skip — sees the item. Persist to DB
    // fire-and-forget. We accept the small risk of a DB write losing
    // (logged below) because the alternative was a real race that
    // dropped the new item if the user skipped fast enough.
    const id = randomUUID();
    const next = applyQueueAdd(s, {
      id,
      videoId,
      title,
      thumbnail,
      addedById: identity.userId,
      addedByName: identity.displayName,
    });
    setRoom(next);
    broadcastRoomState(io, roomId);

    void (async () => {
      try {
        let resolvedTitle = title;
        let resolvedThumb = thumbnail;
        if (!resolvedTitle || !resolvedThumb) {
          const meta = await fetchOEmbed(videoId);
          resolvedTitle = resolvedTitle ?? meta.title;
          resolvedThumb = resolvedThumb ?? meta.thumbnail;
        }
        await db.queueItem.create({
          data: {
            id,
            roomId,
            videoId,
            title: resolvedTitle,
            thumbnail: resolvedThumb,
            position,
            addedById: identity.userId ?? null,
          },
        });

        // If we resolved metadata after the initial broadcast, patch
        // the in-memory item and re-broadcast so clients see it.
        if (resolvedTitle || resolvedThumb) {
          const cur = getRoom(roomId);
          if (!cur) return;
          let changed = false;
          const updated = cur.queue.map((q) => {
            if (q.id !== id) return q;
            if (q.title === resolvedTitle && q.thumbnail === resolvedThumb) return q;
            changed = true;
            return { ...q, title: resolvedTitle, thumbnail: resolvedThumb };
          });
          if (changed) {
            setRoom({ ...cur, queue: updated });
            broadcastRoomState(io, roomId);
          }
        }
      } catch (err) {
        console.error("queue:add persist failed", err);
      }
    })();
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
