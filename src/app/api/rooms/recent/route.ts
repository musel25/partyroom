import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const recent = await db.roomParticipant.findMany({
    where: { userId: session.user.id },
    orderBy: { joinedAt: "desc" },
    take: 3,
    include: { room: { include: { creator: { select: { name: true } } } } },
    distinct: ["roomId"],
  });

  return NextResponse.json(recent.map((p) => ({
    code: p.room.code,
    videoId: p.room.videoId,
    joinedAt: p.joinedAt.getTime(),
    creatorName: p.room.creator.name,
    closed: !!p.room.closedAt,
  })));
}
