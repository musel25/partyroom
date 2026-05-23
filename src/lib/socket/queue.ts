import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyQueueAdd, applyQueueAdvance, applyQueueRemove } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { db } from "../db";
import { parseYouTubeId, fetchOEmbed } from "../youtube";
import { broadcastRoomState } from "./broadcast";

export function installQueueHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  socket.on("queue:add", async ({ videoId, title, thumbnail }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
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
      data: { roomId, videoId, title: resolvedTitle, thumbnail: resolvedThumb, position },
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
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyQueueRemove(s, { queueItemId });
    setRoom(next);
    await db.queueItem.delete({ where: { id: queueItemId } }).catch(() => {});
    broadcastRoomState(io, roomId);
  });

  socket.on("queue:advance", async ({ fromVideoId }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyQueueAdvance(s, { fromVideoId }, Date.now());
    if (next === s) return; // idempotent no-op
    setRoom(next);

    // Remove the played item from DB if it was the head
    const head = s.queue[0];
    if (head && next.videoId === head.videoId) {
      await db.queueItem.delete({ where: { id: head.id } }).catch(() => {});
    }
    await persistRoomState(next);
    broadcastRoomState(io, roomId);
  });
}
