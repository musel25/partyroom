import { describe, it, expect, beforeAll } from "vitest";
import { signGuest, readGuest, GUEST_COOKIE } from "./auth-guest";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-test-secret-test-secret-test-12";
});

describe("guest session cookies", () => {
  it("round-trips a guest name", async () => {
    const token = await signGuest({ guestId: "g_abc", guestName: "Alice" });
    const result = await readGuest(token);
    expect(result).toEqual({ guestId: "g_abc", guestName: "Alice" });
  });

  it("rejects tampered tokens", async () => {
    const token = await signGuest({ guestId: "g_abc", guestName: "Alice" });
    const tampered = token.slice(0, -2) + "xx";
    await expect(readGuest(tampered)).resolves.toBeNull();
  });

  it("exposes the cookie name", () => {
    expect(GUEST_COOKIE).toBe("partyroom_guest");
  });
});
