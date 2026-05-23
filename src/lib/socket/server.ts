import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types";
import { identifySocket } from "./auth";
import { loadRoomIntoMemory } from "../room/rehydrate";
import { getRoom, listParticipants } from "../room/store";
import { trackPresence, untrackPresence } from "./presence";
import { installPlaybackHandlers } from "./playback";
import { broadcastRoomState } from "./broadcast";

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
      const s = getRoom(state.roomId);
      if (s) {
        ack({
          roomId: s.roomId,
          videoId: s.videoId,
          playing: s.playing,
          positionSec: s.positionSec,
          updatedAt: s.updatedAt,
          queue: s.queue,
          participants: listParticipants(state.roomId),
        });
      }
    });

    installPlaybackHandlers(io, socket);

    socket.on("disconnect", () => untrackPresence(io, socket));
  });

  setInterval(() => {
    // io.sockets.adapter.rooms includes both per-socket rooms (id === socket.id)
    // and our app-level rooms (we join with roomId from store). Filter to ours.
    for (const roomId of io.sockets.adapter.rooms.keys()) {
      if (getRoom(roomId)) broadcastRoomState(io, roomId);
    }
  }, 30_000);
}
