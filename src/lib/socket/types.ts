export type QueueItem = {
  id: string;
  videoId: string;
  title?: string;
  thumbnail?: string;
  addedById?: string;
  addedByName?: string;
};

export type Participant = {
  socketId: string;
  userId?: string;
  guestName?: string;
  displayName: string;
};

export type RoomStateSnapshot = {
  roomId: string;
  videoId: string | null;
  playing: boolean;
  positionSec: number;
  updatedAt: number;
  queue: QueueItem[];
  participants: Participant[];
};

export type ChatMessage = {
  id: string;
  body: string;
  authorName: string;
  authorUserId?: string;
  createdAt: number;
};

// Identity attached to a socket once authenticated. `userKey` is a
// stable handle (either the userId or the persistent guestId from the
// signed cookie) — used as the rate-limit key so reconnecting doesn't
// reset a user's chat/reaction budget.
export type SocketUserIdentity = {
  userId?: string;
  guestName?: string;
  guestId?: string;
  displayName: string;
  userKey: string;
};

// Server-side data attached to each socket. Threaded into the Socket.IO
// typing so handlers don't need `as` casts to read it.
export type SocketData = {
  roomId?: string;
  identity?: SocketUserIdentity;
  participant?: Participant;
};

// Client → Server
export interface ClientToServerEvents {
  "room:join": (payload: { roomCode: string }, ack: (state: RoomStateSnapshot | { error: string }) => void) => void;
  "room:leave": () => void;
  "playback:play": (payload: { positionSec: number }) => void;
  "playback:pause": (payload: { positionSec: number }) => void;
  "playback:seek": (payload: { positionSec: number }) => void;
  "playback:loadVideo": (payload: { videoId: string }) => void;
  "queue:add": (payload: { videoId: string; title?: string; thumbnail?: string }) => void;
  "queue:remove": (payload: { queueItemId: string }) => void;
  "queue:advance": (payload: { fromVideoId: string }) => void;
  "queue:skip": (payload: { fromVideoId: string }) => void;
  "chat:send": (payload: { body: string }) => void;
  "reaction:send": (payload: { emoji: string }) => void;
}

// Server → Client
export interface ServerToClientEvents {
  "room:state": (state: RoomStateSnapshot) => void;
  "chat:message": (msg: ChatMessage) => void;
  "chat:history": (msgs: ChatMessage[]) => void;
  reaction: (payload: { emoji: string; fromName: string }) => void;
  "participant:join": (p: Participant) => void;
  "participant:leave": (p: { socketId: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

// We don't use server-to-server Socket.IO events; placeholder for typing.
export type InterServerEvents = Record<string, never>;

// Re-exported here so handler files can type their `io` arg without
// pulling in server.ts (which would create import cycles).
import type { Server } from "socket.io";
export type PartyServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
