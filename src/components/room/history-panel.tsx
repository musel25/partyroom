"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { RoomStateSnapshot } from "@/lib/socket/types";

type HistoryItem = {
  id: string;
  videoId: string;
  title: string | null;
  thumbnail: string | null;
  playedAt: number;
};

type Props = {
  roomCode: string;
  state: RoomStateSnapshot | null;
};

export function HistoryPanel({ roomCode, state }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/rooms/${roomCode}/history`);
      if (!res.ok) return;
      const data = (await res.json()) as { items: HistoryItem[] };
      setItems(data.items);
    } catch {}
  }

  // Reload whenever the current videoId changes (a new entry just landed).
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.videoId, roomCode]);

  function playAgain(videoId: string) {
    getSocket().emit("playback:loadVideo", { videoId });
  }

  // Filter out the currently-playing video from the history list.
  const filtered = items.filter((i) => i.videoId !== state?.videoId);

  return (
    <section className="bg-duo-card rounded-2xl border-b-[3px] border-duo-border overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center px-4 py-3 hover:bg-duo-soft"
      >
        <span className="text-xs font-bold uppercase text-duo-faint">
          Previously played ({filtered.length})
        </span>
        <span className="text-duo-faint font-bold">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="p-4 pt-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-duo-muted">
              Nothing else has played in this room yet.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[280px] overflow-y-auto">
              {filtered.map((h) => (
                <li
                  key={h.id}
                  className="flex gap-3 items-center p-2 bg-duo-soft rounded-xl hover:bg-duo-border cursor-pointer"
                  onClick={() => playAgain(h.videoId)}
                  title="Play this video again"
                >
                  {h.thumbnail ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={h.thumbnail}
                      alt=""
                      className="w-20 h-12 object-cover rounded shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-12 bg-duo-border rounded shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-duo-text truncate" title={h.title ?? h.videoId}>
                      {h.title ?? h.videoId}
                    </div>
                    <div className="text-xs text-duo-faint">{relative(h.playedAt)}</div>
                  </div>
                  <span className="text-xs font-bold text-duo-blue shrink-0">↻ Play</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function relative(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
