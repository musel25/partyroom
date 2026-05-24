import type { Socket } from "socket.io";
import type { PartyServer } from "./types";
import { SlidingWindow } from "../rate-limit";

const ALLOWED = new Set(["❤️", "😂", "🎉", "🔥", "👍", "👎", "😮", "😢"]);
export const reactionLimiter = new SlidingWindow({ windowMs: 5000, max: 10 });

export function installReactionHandlers(io: PartyServer, socket: Socket) {
  socket.on("reaction:send", ({ emoji }) => {
    if (!ALLOWED.has(emoji)) return;
    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;
    if (!reactionLimiter.allow(identity.userKey)) return;
    io.to(roomId).emit("reaction", { emoji, fromName: identity.displayName });
  });
}
