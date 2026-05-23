import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, Participant } from "./types";
import { addParticipant, removeParticipant } from "../room/store";

export function trackPresence(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
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

export function untrackPresence(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  const roomId = socket.data.roomId as string | undefined;
  if (!roomId) return;
  const p = removeParticipant(roomId, socket.id);
  if (p) io.to(roomId).emit("participant:leave", { socketId: socket.id });
  socket.leave(roomId);
}
