import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "auth" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);
  const rows = await db.user.findMany({
    where: {
      AND: [
        { id: { not: session.user.id } },
        { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] },
      ],
    },
    take: 10,
    select: { id: true, name: true, email: true, image: true },
  });
  return NextResponse.json(rows);
}
