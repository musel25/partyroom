import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGuestFromCookies } from "@/lib/auth-guest";
import { searchYouTube } from "@/lib/youtube";
import { SlidingWindow } from "@/lib/rate-limit";

// 10 searches / minute / user. Conservative — Google's free quota is
// 100 searches/day total. Keeps a single party from burning the quota.
const limiter = new SlidingWindow({ windowMs: 60_000, max: 10 });

export async function GET(req: Request) {
  const session = await auth();
  const guest = session?.user ? null : await getGuestFromCookies();
  if (!session?.user?.id && !guest) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "search_disabled", message: "YouTube search isn't configured on this server." },
      { status: 503 },
    );
  }

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });
  if (q.length > 200) return NextResponse.json({ error: "query too long" }, { status: 400 });

  const key = session?.user?.id ?? `g:${guest?.guestId}`;
  if (!limiter.allow(key)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many searches — slow down." },
      { status: 429 },
    );
  }

  try {
    const results = await searchYouTube(q, apiKey, 8);
    return NextResponse.json({ results });
  } catch (e) {
    console.error("youtube search error", e);
    return NextResponse.json({ error: "search_failed" }, { status: 502 });
  }
}
