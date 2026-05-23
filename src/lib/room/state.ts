import type { QueueItem } from "../socket/types";

export type RoomState = {
  roomId: string;
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  updatedAt: number;
  queue: QueueItem[];
};

export function applyPlay(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, playing: true, positionSec: p.positionSec, updatedAt: now };
}

export function applyPause(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, playing: false, positionSec: p.positionSec, updatedAt: now };
}

export function applySeek(s: RoomState, p: { positionSec: number }, now: number): RoomState {
  return { ...s, positionSec: p.positionSec, updatedAt: now };
}

export function applyLoadVideo(s: RoomState, p: { videoId: string }, now: number): RoomState {
  return { ...s, videoId: p.videoId, playing: false, positionSec: 0, updatedAt: now };
}

export function applyQueueAdd(s: RoomState, item: QueueItem): RoomState {
  return { ...s, queue: [...s.queue, item] };
}

export function applyQueueRemove(s: RoomState, p: { queueItemId: string }): RoomState {
  return { ...s, queue: s.queue.filter((q) => q.id !== p.queueItemId) };
}

export function applyQueueAdvance(s: RoomState, p: { fromVideoId: string }, now: number): RoomState {
  if (s.videoId !== p.fromVideoId) return s; // already advanced
  const [next, ...rest] = s.queue;
  if (!next) return { ...s, playing: false, positionSec: 0, updatedAt: now };
  return { ...s, videoId: next.videoId, playing: true, positionSec: 0, queue: rest, updatedAt: now };
}

export function expectedPosition(s: RoomState, nowMs: number): number {
  if (!s.playing) return s.positionSec;
  return s.positionSec + (nowMs - s.updatedAt) / 1000;
}
