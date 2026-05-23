import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseYouTubeId, fetchOEmbed } from "@/lib/youtube";
import { generateRoomCode } from "@/lib/room-codes";

const Body = z.object({
  youtubeUrl: z.string().min(1).max(2048),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "auth required" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const videoId = parseYouTubeId(parsed.data.youtubeUrl);
  if (!videoId) {
    return NextResponse.json({ error: "Not a valid YouTube URL" }, { status: 400 });
  }

  // Retry on rare code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    try {
      const room = await db.room.create({
        data: {
          code,
          creatorId: session.user.id,
          videoId,
          playing: false,
          positionSec: 0,
        },
      });

      // Best-effort oEmbed for the initial video (non-blocking)
      void fetchOEmbed(videoId).then(async ({ title, thumbnail }) => {
        if (title || thumbnail) {
          await db.queueItem.create({
            data: { roomId: room.id, videoId, title, thumbnail, position: 0 },
          }).catch(() => {});
        }
      });

      return NextResponse.json({ code: room.code });
    } catch (e: unknown) {
      // Prisma unique violation: retry with a fresh code
      if ((e as { code?: string }).code === "P2002") continue;
      throw e;
    }
  }

  return NextResponse.json({ error: "could not allocate room code" }, { status: 500 });
}
