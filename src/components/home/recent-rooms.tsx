"use client";

import { useEffect, useState } from "react";

type Recent = {
  code: string;
  videoId: string | null;
  joinedAt: number;
  creatorName: string | null;
  closed: boolean;
};

export function RecentRooms() {
  const [rooms, setRooms] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/rooms/recent").then((r) => r.json());
      if (Array.isArray(r)) setRooms(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(code: string) {
    // Optimistic — drop from the list immediately, undo on failure.
    const prev = rooms;
    setRooms((rs) => rs.filter((r) => r.code !== code));
    try {
      const res = await fetch(`/api/rooms/recent/${code}`, { method: "DELETE" });
      if (!res.ok) throw new Error("failed");
    } catch {
      setRooms(prev);
    }
  }

  if (loading) return <p className="text-sm text-duo-muted">Loading…</p>;
  if (rooms.length === 0) {
    return <p className="text-sm text-duo-muted">No rooms yet — create one above!</p>;
  }
  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li
          key={r.code}
          className="flex justify-between items-center p-3 bg-duo-soft rounded-xl group"
        >
          <div className="min-w-0">
            <div className="font-bold text-sm text-duo-text">{r.code}</div>
            <div className="text-xs text-duo-faint truncate">by {r.creatorName ?? "you"}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!r.closed && (
              <a href={`/room/${r.code}`} className="text-sm font-bold text-duo-blue hover:text-duo-blue-dk">
                Open
              </a>
            )}
            <button
              onClick={() => remove(r.code)}
              className="text-duo-muted hover:text-red-500 hover:bg-duo-card text-xl font-bold w-7 h-7 leading-none rounded-md flex items-center justify-center transition-colors"
              aria-label="Remove from recent"
              title="Remove from your recent rooms"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
