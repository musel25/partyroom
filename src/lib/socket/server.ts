import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomStateSnapshot,
} from "./types";
import { identifySocket } from "./auth";
import { loadRoomIntoMemory } from "../room/rehydrate";
import { getRoom, listParticipants } from "../room/store";
import { trackPresence, untrackPresence } from "./presence";

function toSnapshot(roomId: string): RoomStateSnapshot | null {
  const s = getRoom(roomId);
  if (!s) return null;
  return {
    roomId: s.roomId,
    videoId: s.videoId,
    playing: s.playing,
    positionSec: s.positionSec,
    updatedAt: s.updatedAt,
    queue: s.queue,
    participants: listParticipants(roomId),
  };
}

export function installSocketServer(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
) {
  io.on("connection", async (socket) => {
    const user = await identifySocket(socket);
    if (!user) {
      socket.emit("error", {
        code: "AUTH_REQUIRED",
        message: "Sign in or claim a guest name first.",
      });
      socket.disconnect(true);
      return;
    }

    socket.on("room:join", async ({ roomCode }, ack) => {
      const state = await loadRoomIntoMemory(roomCode);
      if (!state) {
        ack({ error: "Room not found" });
        return;
      }
      trackPresence(io, socket, state.roomId, {
        socketId: socket.id,
        userId: user.userId,
        guestName: user.guestName,
        displayName: user.displayName,
      });
      const snap = toSnapshot(state.roomId);
      if (snap) ack(snap);
    });

    socket.on("disconnect", () => untrackPresence(io, socket));
  });
}
