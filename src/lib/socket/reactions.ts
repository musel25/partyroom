import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { SlidingWindow } from "../rate-limit";

const ALLOWED = new Set(["❤️", "😂", "🎉", "🔥", "👍", "👎", "😮", "😢"]);
const limiter = new SlidingWindow({ windowMs: 5000, max: 10 });

export function installReactionHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  socket.on("reaction:send", ({ emoji }) => {
    if (!ALLOWED.has(emoji)) return;
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const p = socket.data.participant as { displayName: string } | undefined;
    if (!limiter.allow(socket.id)) return;
    io.to(roomId).emit("reaction", { emoji, fromName: p?.displayName ?? "?" });
  });
}
