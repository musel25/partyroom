import type { Socket } from "socket.io";
import type { PartyServer, ChatMessage } from "./types";
import { db } from "../db";
import { SlidingWindow } from "../rate-limit";

export const chatLimiter = new SlidingWindow({ windowMs: 5000, max: 5 });

export function installChatHandlers(io: PartyServer, socket: Socket) {
  socket.on("chat:send", async ({ body }) => {
    const roomId = socket.data.roomId;
    const identity = socket.data.identity;
    if (!roomId || !identity) return;
    const trimmed = body.trim().slice(0, 500);
    if (!trimmed) return;

    // Stable userKey survives reconnects, so a tab-bot can't bypass
    // the limit by churning sockets.
    if (!chatLimiter.allow(identity.userKey)) {
      socket.emit("error", { code: "RATE_LIMIT", message: "Slow down a bit." });
      return;
    }

    const row = await db.message.create({
      data: {
        roomId,
        userId: identity.userId ?? null,
        guestName: identity.userId ? null : identity.guestName ?? identity.displayName,
        body: trimmed,
      },
    });

    const msg: ChatMessage = {
      id: row.id,
      body: trimmed,
      authorName: identity.displayName,
      authorUserId: identity.userId,
      createdAt: row.createdAt.getTime(),
    };
    io.to(roomId).emit("chat:message", msg);
  });
}

export async function loadChatHistory(roomId: string, limit = 100): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    body: m.body,
    authorName: m.user?.name ?? m.guestName ?? "Guest",
    authorUserId: m.userId ?? undefined,
    createdAt: m.createdAt.getTime(),
  }));
}
