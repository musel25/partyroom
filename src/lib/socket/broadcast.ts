import type { PartyServer, RoomStateSnapshot } from "./types";
import { getRoom, listParticipants } from "../room/store";

export function broadcastRoomState(io: PartyServer, roomId: string): void {
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
