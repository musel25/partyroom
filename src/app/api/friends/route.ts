import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });

  const me = session.user.id;
  const rows = await db.friendship.findMany({
    where: { OR: [{ aId: me }, { bId: me }] },
    include: { a: true, b: true },
  });
  return NextResponse.json(rows.map((f) => ({
    id: f.id,
    status: f.status,
    other: f.aId === me
      ? { id: f.b.id, name: f.b.name, image: f.b.image }
      : { id: f.a.id, name: f.a.name, image: f.a.image },
    iSent: f.aId === me,
  })));
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
