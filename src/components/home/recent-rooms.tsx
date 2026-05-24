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
  useEffect(() => {
    void fetch("/api/rooms/recent").then((r) => r.json()).then(setRooms);
  }, []);

  if (rooms.length === 0) {
    return <p className="text-sm text-duo-muted">No rooms yet — create one above!</p>;
  }
  return (
    <ul className="space-y-2">
      {rooms.map((r) => (
        <li
          key={r.code}
          className="flex justify-between items-center p-3 bg-duo-soft rounded-xl"
        >
          <div>
            <div className="font-bold text-sm text-duo-text">{r.code}</div>
            <div className="text-xs text-duo-faint">by {r.creatorName ?? "you"}</div>
          </div>
          {!r.closed && (
            <a href={`/room/${r.code}`} className="text-sm font-bold text-duo-blue hover:text-duo-blue-dk">
              Open
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
