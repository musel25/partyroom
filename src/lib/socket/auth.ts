import type { Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { decode } from "next-auth/jwt";
import { db } from "../db";
import { readGuest } from "../auth-guest";
import type { SocketUserIdentity } from "./types";

const AUTHJS_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
] as const;

export async function identifySocket(socket: Socket): Promise<SocketUserIdentity | null> {
  const raw = socket.handshake.headers.cookie;
  if (!raw) return null;
  const cookies = parseCookie(raw);

  // 1) Try Auth.js JWT session
  for (const name of AUTHJS_COOKIE_NAMES) {
    const token = cookies[name];
    if (!token) continue;
    try {
      const payload = await decode({
        token,
        secret: process.env.NEXTAUTH_SECRET!,
        salt: name,
      });
      if (payload?.sub) {
        const user = await db.user.findUnique({ where: { id: payload.sub } });
        return {
          userId: payload.sub,
          displayName: user?.name ?? user?.email ?? "Player",
          userKey: `u:${payload.sub}`,
        };
      }
    } catch {
      // Bad / expired token — try next cookie name or fall through to guest.
    }
  }

  // 2) Try guest cookie
  const guestToken = cookies["partyroom_guest"];
  if (guestToken) {
    const guest = await readGuest(guestToken);
    if (guest) {
      return {
        guestName: guest.guestName,
        guestId: guest.guestId,
        displayName: guest.guestName,
        userKey: `g:${guest.guestId}`,
      };
    }
  }

  return null;
}
