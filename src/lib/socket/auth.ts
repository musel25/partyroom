import type { Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { db } from "../db";
import { readGuest } from "../auth-guest";

export type SocketUser = {
  userId?: string;
  guestName?: string;
  displayName: string;
};

export async function identifySocket(socket: Socket): Promise<SocketUser | null> {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  const cookies = parseCookie(raw);

  // 1) Try Auth.js database session (cookie name varies by HTTPS / dev)
  const sessionToken =
    cookies["authjs.session-token"] ??
    cookies["__Secure-authjs.session-token"] ??
    cookies["next-auth.session-token"] ??
    cookies["__Secure-next-auth.session-token"];

  if (sessionToken) {
    const session = await db.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });
    if (session && session.expires > new Date()) {
      return {
        userId: session.userId,
        displayName: session.user.name ?? session.user.email ?? "Player",
      };
    }
  }

  // 2) Try guest cookie
  const guestToken = cookies["partyroom_guest"];
  if (guestToken) {
    const guest = await readGuest(guestToken);
    if (guest) {
      return { guestName: guest.guestName, displayName: guest.guestName };
    }
  }

  return null;
}
