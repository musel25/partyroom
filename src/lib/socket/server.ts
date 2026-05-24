import type { PartyServer } from "./types";
export type { PartyServer } from "./types";
import { identifySocket } from "./auth";
import { loadRoomIntoMemory } from "../room/rehydrate";
import { getRoom } from "../room/store";
import { trackPresence, untrackPresence } from "./presence";
import { installPlaybackHandlers } from "./playback";
import { installChatHandlers, loadChatHistory, chatLimiter } from "./chat";
import { installQueueHandlers } from "./queue";
import { installReactionHandlers, reactionLimiter } from "./reactions";
import { broadcastRoomState, buildSnapshot } from "./broadcast";
import { db } from "../db";

// Rooms idle (no activity) for longer than this get marked closed by
// the periodic janitor. Closed rooms still exist in the DB but no
// longer appear in the user's recent list and can't be joined.
const ROOM_IDLE_CLOSE_HOURS = 24;

export function installSocketServer(io: PartyServer) {
  io.on("connection", async (socket) => {
    const identity = await identifySocket(socket);
    if (!identity) {
      socket.emit("error", {
        code: "AUTH_REQUIRED",
        message: "Sign in or claim a guest name first.",
      });
      socket.disconnect(true);
      return;
    }
    socket.data.identity = identity;

    socket.on("room:join", async ({ roomCode }, ack) => {
      const state = await loadRoomIntoMemory(roomCode);
      if (!state) {
        ack({ error: "Room not found" });
        return;
      }
      // Leave any previous room the same socket was in (rejoin flow).
      const prev = socket.data.roomId;
      if (prev && prev !== state.roomId) untrackPresence(io, socket);

      trackPresence(io, socket, state.roomId, {
        socketId: socket.id,
        userId: identity.userId,
        guestName: identity.guestName,
        displayName: identity.displayName,
      });

      // Record participation. Upsert by (roomId, userId) so refreshing
      // doesn't generate one row per visit. Guests still create rows
      // (composite key isn't possible without a userId).
      if (identity.userId) {
        const userId = identity.userId;
        const existing = await db.roomParticipant
          .findFirst({ where: { roomId: state.roomId, userId } })
          .catch(() => null);
        if (existing) {
          await db.roomParticipant
            .update({ where: { id: existing.id }, data: { joinedAt: new Date(), leftAt: null } })
            .catch(() => {});
        } else {
          await db.roomParticipant
            .create({ data: { roomId: state.roomId, userId } })
            .catch(() => {});
        }
      }

      const s = getRoom(state.roomId);
      if (!s) {
        ack({ error: "Room evicted mid-join — retry" });
        return;
      }
      ack(buildSnapshot(s));
      // Also broadcast so existing participants see the new join.
      broadcastRoomState(io, state.roomId);
      const history = await loadChatHistory(state.roomId);
      socket.emit("chat:history", history);
    });

    installPlaybackHandlers(io, socket);
    installChatHandlers(io, socket);
    installQueueHandlers(io, socket);
    installReactionHandlers(io, socket);

    socket.on("disconnect", () => {
      // Mark the participant row as left.
      const id = socket.data.identity;
      const roomId = socket.data.roomId;
      if (id?.userId && roomId) {
        const userId = id.userId;
        db.roomParticipant
          .updateMany({
            where: { roomId, userId, leftAt: null },
            data: { leftAt: new Date() },
          })
          .catch(() => {});
      }
      untrackPresence(io, socket);
    });
  });

  // Periodic broadcasts — only emit when there's something to say.
  // Rooms with no participants are evicted in presence.ts so we don't
  // touch them. Rooms in pause state need no time-sync.
  setInterval(() => {
    for (const roomId of io.sockets.adapter.rooms.keys()) {
      const s = getRoom(roomId);
      if (!s) continue;
      if (!s.playing) continue;
      broadcastRoomState(io, roomId);
    }
  }, 30_000);

  // Periodic rate-limit sweep to drop stale keys.
  setInterval(() => {
    chatLimiter.sweep();
    reactionLimiter.sweep();
  }, 60_000);

  // Periodic janitor: close rooms that have been idle for a while.
  // "Idle" = no in-memory state (everyone left) AND DB stateUpdated
  // older than the threshold.
  setInterval(() => void closeIdleRooms(), 60 * 60 * 1000); // hourly
  // Run once at boot too, to catch anything stale from a previous run.
  setTimeout(() => void closeIdleRooms(), 60_000);
}

async function closeIdleRooms() {
  const cutoff = new Date(Date.now() - ROOM_IDLE_CLOSE_HOURS * 60 * 60 * 1000);
  try {
    const result = await db.room.updateMany({
      where: { closedAt: null, stateUpdated: { lt: cutoff } },
      data: { closedAt: new Date() },
    });
    if (result.count > 0) {
      console.log(`[janitor] closed ${result.count} idle room(s)`);
    }
  } catch (e) {
    console.error("[janitor] closeIdleRooms failed", e);
  }
}
