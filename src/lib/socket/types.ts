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
