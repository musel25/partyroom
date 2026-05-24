import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "../helpers/prisma-mock";

beforeEach(() => {
  vi.resetModules();
});

async function withMockedAuth(userId: string | null) {
  vi.doMock("@/lib/auth", () => ({
    auth: async () => (userId ? { user: { id: userId } } : null),
  }));
}

describe("POST /api/rooms", () => {
  it("returns 401 without a session", async () => {
    mockPrisma();
    await withMockedAuth(null);
    const { POST } = await import("@/app/api/rooms/route");
    const req = new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: "https://youtu.be/dQw4w9WgXcQ" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-YouTube URL", async () => {
    mockPrisma();
    await withMockedAuth("u1");
    const { POST } = await import("@/app/api/rooms/route");
    const req = new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: "https://example.com/" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing body", async () => {
    mockPrisma();
    await withMockedAuth("u1");
    const { POST } = await import("@/app/api/rooms/route");
    const req = new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a room and returns its code for valid input", async () => {
    const db = mockPrisma();
    db.room.create.mockResolvedValue({ id: "r1", code: "ABC-123" });
    await withMockedAuth("u1");
    const { POST } = await import("@/app/api/rooms/route");
    const req = new Request("http://localhost/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("code", "ABC-123");
    expect(db.room.create).toHaveBeenCalledOnce();
  });
});
