import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { findRoomForUser } from "@/lib/room/store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const me = session.user.id;
  const rows = await db.friendship.findMany({
    where: { OR: [{ aId: me }, { bId: me }] },
    include: { a: true, b: true },
  });

  // Cross-reference with the in-memory presence store to flag friends
  // who are currently in a room. We need the room's CODE (not the id)
  // to build a join link.
  return NextResponse.json(
    await Promise.all(
      rows.map(async (f) => {
        const otherUser = f.aId === me ? f.b : f.a;
        let currentRoom: { code: string; videoId: string | null } | null = null;
        if (f.status === "ACCEPTED") {
          const inRoom = findRoomForUser(otherUser.id);
          if (inRoom) {
            const room = await db.room
              .findUnique({ where: { id: inRoom.roomId }, select: { code: true } })
              .catch(() => null);
            if (room) currentRoom = { code: room.code, videoId: inRoom.videoId };
          }
        }
        return {
          id: f.id,
          status: f.status,
          other: { id: otherUser.id, name: otherUser.name, image: otherUser.image },
          iSent: f.aId === me,
          currentRoom,
        };
      }),
    ),
  );
}

const AddBody = z.object({ otherUserId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const parsed = AddBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const me = session.user.id;
  if (parsed.data.otherUserId === me) return NextResponse.json({ error: "self" }, { status: 400 });

  const [a, b] = [me, parsed.data.otherUserId].sort();
  const f = await db.friendship.upsert({
    where: { aId_bId: { aId: a!, bId: b! } },
    create: { aId: a!, bId: b!, status: "PENDING" },
    update: {},
  });
  return NextResponse.json({ id: f.id, status: f.status });
}
