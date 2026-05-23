import type { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, RoomStateSnapshot } from "./types";
import { getRoom, listParticipants } from "../room/store";

export function broadcastRoomState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
): void {
  const s = getRoom(roomId);
  if (!s) return;
  const snap: RoomStateSnapshot = {
    roomId,
    videoId: s.videoId,
    playing: s.playing,
    positionSec: s.positionSec,
    updatedAt: s.updatedAt,
    queue: s.queue,
    participants: listParticipants(roomId),
  };
  io.to(roomId).emit("room:state", snap);
}
