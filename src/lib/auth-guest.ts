import { SignJWT, jwtVerify } from "jose";

// `next/headers` is intentionally lazy-imported inside the cookie helpers.
// Importing it at module top-level bootstraps Next's AsyncLocalStorage and
// crashes the custom Node server (which loads this module at boot via the
// socket auth path).

export const GUEST_COOKIE = "partyroom_guest";

export type GuestSession = {
  guestId: string;
  guestName: string;
};

function key() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET required for guest sessions");
  return new TextEncoder().encode(secret);
}

export async function signGuest(payload: GuestSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function readGuest(token: string): Promise<GuestSession | null> {
  try {
    const { payload } = await jwtVerify(token, key());
    if (typeof payload.guestId === "string" && typeof payload.guestName === "string") {
      return { guestId: payload.guestId, guestName: payload.guestName };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setGuestCookie(payload: GuestSession) {
  const token = await signGuest(payload);
  const { cookies } = await import("next/headers");
  const c = await cookies();
  c.set(GUEST_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function getGuestFromCookies(): Promise<GuestSession | null> {
  const { cookies } = await import("next/headers");
  const c = await cookies();
  const token = c.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  return readGuest(token);
}
