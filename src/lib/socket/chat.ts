import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents, ChatMessage } from "./types";
import { db } from "../db";
import { SlidingWindow } from "../rate-limit";

const limiter = new SlidingWindow({ windowMs: 5000, max: 5 });

export function installChatHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  socket.on("chat:send", async ({ body }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const trimmed = body.trim().slice(0, 500);
    if (!trimmed) return;

    const user = socket.data.participant as {
      userId?: string;
      displayName: string;
      guestName?: string;
    };
    const key = user.userId ?? `g:${socket.id}`;
    if (!limiter.allow(key)) {
      socket.emit("error", { code: "RATE_LIMIT", message: "Slow down a bit." });
      return;
    }

    const row = await db.message.create({
      data: {
        roomId,
        userId: user.userId ?? null,
        guestName: user.userId ? null : user.guestName ?? user.displayName,
        body: trimmed,
      },
    });

    const msg: ChatMessage = {
      id: row.id,
      body: trimmed,
      authorName: user.displayName,
      authorUserId: user.userId,
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
