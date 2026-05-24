import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGuestFromCookies } from "@/lib/auth-guest";
import { db } from "@/lib/db";

// Returns the room's play history (most recent first). Open to
// anyone who can join the room — either signed-in or with a guest
// cookie.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const guest = session?.user ? null : await getGuestFromCookies();
  if (!session?.user && !guest) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const room = await db.room.findUnique({ where: { code }, select: { id: true } });
  if (!room) return NextResponse.json({ items: [] });

  const rows = await db.playHistory.findMany({
    where: { roomId: room.id },
    orderBy: { playedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      videoId: r.videoId,
      title: r.title,
      thumbnail: r.thumbnail,
      playedAt: r.playedAt.getTime(),
    })),
  });
}
