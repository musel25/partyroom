import type { PartyServer, RoomStateSnapshot } from "./types";
import type { RoomState } from "../room/state";
import { getRoom, getVideoMeta, listParticipants, setVideoMeta } from "../room/store";
import { fetchOEmbed } from "../youtube";

export function broadcastRoomState(io: PartyServer, roomId: string): void {
  const s = getRoom(roomId);
  if (!s) return;
  io.to(roomId).emit("room:state", buildSnapshot(s));

  // Lazily warm the metadata cache for the currently-playing video.
  // Fire-and-forget; the next snapshot will include it.
  if (s.videoId && !getVideoMeta(s.videoId)) {
    void warmMeta(s.videoId, io, roomId);
  }
}

export function buildSnapshot(s: RoomState): RoomStateSnapshot {
  const meta = s.videoId ? getVideoMeta(s.videoId) ?? null : null;
  return {
    roomId: s.roomId,
    videoId: s.videoId,
    playing: s.playing,
    positionSec: s.positionSec,
    updatedAt: s.updatedAt,
    queue: s.queue,
    participants: listParticipants(s.roomId),
    nowPlaying: s.videoId
      ? { videoId: s.videoId, title: meta?.title, thumbnail: meta?.thumbnail, author: meta?.author }
      : null,
  };
}

async function warmMeta(videoId: string, io: PartyServer, roomId: string) {
  const meta = await fetchOEmbed(videoId);
  if (!meta.title && !meta.thumbnail && !meta.author) return;
  setVideoMeta(videoId, {
    videoId,
    title: meta.title,
    thumbnail: meta.thumbnail,
    author: meta.author,
  });
  // Re-broadcast so clients pick up the metadata without a state change.
  const s = getRoom(roomId);
  if (s) io.to(roomId).emit("room:state", buildSnapshot(s));
}
