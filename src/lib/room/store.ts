import type { RoomState } from "./state";
import type { Participant, NowPlaying } from "../socket/types";

const rooms = new Map<string, RoomState>();
const participants = new Map<string, Map<string, Participant>>(); // roomId → socketId → participant

// Cached video metadata keyed by YouTube videoId. Populated lazily by
// oEmbed lookups in the rooms layer; survives across rooms since the
// same video can be played in many places.
const videoMetaCache = new Map<string, NowPlaying>();
const MAX_META_CACHE = 500;

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function setRoom(state: RoomState): void {
  rooms.set(state.roomId, state);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  participants.delete(roomId);
}

export function listAllRooms(): RoomState[] {
  return Array.from(rooms.values());
}

export function listParticipants(roomId: string): Participant[] {
  const m = participants.get(roomId);
  return m ? Array.from(m.values()) : [];
}

export function addParticipant(roomId: string, p: Participant): void {
  if (!participants.has(roomId)) participants.set(roomId, new Map());
  participants.get(roomId)!.set(p.socketId, p);
}

export function removeParticipant(roomId: string, socketId: string): Participant | undefined {
  const m = participants.get(roomId);
  if (!m) return undefined;
  const p = m.get(socketId);
  m.delete(socketId);
  return p;
}

/**
 * Look up which (in-memory) room a given userId is currently in.
 * Used by /api/friends to surface "Alice is watching now".
 */
export function findRoomForUser(userId: string): { roomId: string; videoId: string | null } | null {
  for (const [roomId, map] of participants) {
    for (const p of map.values()) {
      if (p.userId === userId) {
        const s = rooms.get(roomId);
        return { roomId, videoId: s?.videoId ?? null };
      }
    }
  }
  return null;
}

export function getVideoMeta(videoId: string): NowPlaying | undefined {
  return videoMetaCache.get(videoId);
}

export function setVideoMeta(videoId: string, meta: NowPlaying): void {
  if (videoMetaCache.size >= MAX_META_CACHE) {
    // crude FIFO eviction
    const first = videoMetaCache.keys().next().value;
    if (first) videoMetaCache.delete(first);
  }
  videoMetaCache.set(videoId, meta);
}
