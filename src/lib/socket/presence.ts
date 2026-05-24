import type { Socket } from "socket.io";
import type { Participant } from "./types";
import { addParticipant, deleteRoom, getRoom, listParticipants, removeParticipant } from "../room/store";
import { persistRoomState } from "../room/rehydrate";
import type { PartyServer } from "./types";

export function trackPresence(
  io: PartyServer,
  socket: Socket,
  roomId: string,
  p: Participant,
) {
  addParticipant(roomId, p);
  socket.data.roomId = roomId;
  socket.data.participant = p;
  socket.join(roomId);
  io.to(roomId).emit("participant:join", p);
}

export function untrackPresence(io: PartyServer, socket: Socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const p = removeParticipant(roomId, socket.id);
  if (p) io.to(roomId).emit("participant:leave", { socketId: socket.id });
  socket.leave(roomId);
  socket.data.roomId = undefined;
  socket.data.participant = undefined;

  // Evict the room from memory when nobody's left. The DB still has
  // the latest persisted state so the next visitor rehydrates from
  // disk. Without this, a long-lived server accumulates dead rooms
  // and broadcasts heartbeats to empty channels forever.
  if (listParticipants(roomId).length === 0) {
    const state = getRoom(roomId);
    if (state) {
      // Best-effort final persist before evicting.
      void persistRoomState(state);
      deleteRoom(roomId);
    }
  }
}
