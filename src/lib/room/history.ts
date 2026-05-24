import { db } from "../db";
import { getVideoMeta } from "./store";

type MetaHint = { title?: string; thumbnail?: string };

/**
 * Append a row to the room's play history. Fire-and-forget — we
 * don't block broadcasts on the write. Dedupes lightly: if the
 * most recent entry has the same videoId we don't insert again.
 *
 * Prefers caller-supplied metadata (e.g. the queue item we just
 * popped) over the in-memory video cache.
 */
export async function recordPlayHistory(
  roomId: string,
  videoId: string,
  hint?: MetaHint,
): Promise<void> {
  try {
    const last = await db.playHistory.findFirst({
      where: { roomId },
      orderBy: { playedAt: "desc" },
      select: { videoId: true },
    });
    if (last?.videoId === videoId) return;

    const cached = getVideoMeta(videoId);
    await db.playHistory.create({
      data: {
        roomId,
        videoId,
        title: hint?.title ?? cached?.title ?? null,
        thumbnail: hint?.thumbnail ?? cached?.thumbnail ?? null,
      },
    });
  } catch (err) {
    console.error("recordPlayHistory failed", err);
  }
}
