import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Hide a room from the user's recent list. Does NOT close the room
// for other people — just removes our RoomParticipant rows so the
// /api/rooms/recent query stops returning it for us.
export async function DELETE(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const room = await db.room.findUnique({ where: { code }, select: { id: true } });
  if (!room) return NextResponse.json({ ok: true });

  await db.roomParticipant.deleteMany({
    where: { roomId: room.id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
