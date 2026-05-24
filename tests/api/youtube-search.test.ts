import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockPrisma } from "../helpers/prisma-mock";

beforeEach(() => {
  vi.resetModules();
  mockPrisma();
});

async function withMockedAuth(session: { user?: { id: string; name?: string } } | null) {
  vi.doMock("@/lib/auth", () => ({ auth: async () => session }));
  vi.doMock("@/lib/auth-guest", () => ({ getGuestFromCookies: async () => null }));
}

describe("GET /api/youtube/search", () => {
  it("returns 401 when not authenticated", async () => {
    await withMockedAuth(null);
    delete process.env.YOUTUBE_API_KEY;
    const { GET } = await import("@/app/api/youtube/search/route");
    const res = await GET(new Request("http://localhost/api/youtube/search?q=cats"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when YOUTUBE_API_KEY is unset", async () => {
    await withMockedAuth({ user: { id: "u1" } });
    delete process.env.YOUTUBE_API_KEY;
    const { GET } = await import("@/app/api/youtube/search/route");
    const res = await GET(new Request("http://localhost/api/youtube/search?q=cats"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("search_disabled");
  });

  it("returns parsed results when the key is set", async () => {
    await withMockedAuth({ user: { id: "u2" } });
    process.env.YOUTUBE_API_KEY = "test-key";
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: "abcDefGhi12" },
            snippet: {
              title: "Test video",
              channelTitle: "Test channel",
              thumbnails: { medium: { url: "https://example.com/t.jpg" } },
            },
          },
        ],
      }),
    }) as unknown as typeof global.fetch;

    try {
      const { GET } = await import("@/app/api/youtube/search/route");
      const res = await GET(new Request("http://localhost/api/youtube/search?q=cats"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toHaveLength(1);
      expect(body.results[0].videoId).toBe("abcDefGhi12");
      expect(body.results[0].author).toBe("Test channel");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
