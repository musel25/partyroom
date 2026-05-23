import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const f = await db.friendship.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Only the recipient can accept
  if (f.bId !== session.user.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await db.friendship.update({ where: { id }, data: { status: "ACCEPTED" } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const f = await db.friendship.findUnique({ where: { id } });
  if (!f) return NextResponse.json({ ok: true });
  if (f.aId !== session.user.id && f.bId !== session.user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await db.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
