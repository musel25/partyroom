import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getGuestFromCookies } from "@/lib/auth-guest";
import { GuestPrompt } from "./guest-prompt";
import { RoomShell } from "@/components/room/room-shell";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const room = await db.room.findUnique({ where: { code } });
  if (!room || room.closedAt) notFound();

  const session = await auth();
  const guest = await getGuestFromCookies();

  if (!session?.user && !guest) {
    return <GuestPrompt code={code} />;
  }

  return <RoomShell roomCode={code} initialVideoId={room.videoId} />;
}
