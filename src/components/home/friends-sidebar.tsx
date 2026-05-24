"use client";

import { useEffect, useState } from "react";

type Friend = {
  id: string;
  status: string;
  other: { id: string; name: string | null };
  currentRoom: { code: string; videoId: string | null } | null;
};

export function FriendsSidebar() {
  const [friends, setFriends] = useState<Friend[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/friends").then((r) => r.json());
        if (!cancelled && Array.isArray(r)) setFriends(r);
      } catch {}
    }
    void load();
    // Refresh every 30s so "watching now" stays current.
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const accepted = friends.filter((f) => f.status === "ACCEPTED");
  const watchingNow = accepted.filter((f) => f.currentRoom !== null);
  const offline = accepted.filter((f) => f.currentRoom === null);

  return (
    <aside className="bg-duo-card rounded-2xl p-5 border-b-[3px] border-duo-border">
      <div className="text-xs font-bold uppercase text-duo-faint mb-3">Friends</div>

      {accepted.length === 0 && (
        <p className="text-sm text-duo-muted">
          No friends yet.{" "}
          <a href="/friends" className="text-duo-blue font-bold">Add some</a>.
        </p>
      )}

      {watchingNow.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-bold text-duo-green mb-1.5">🔴 Watching now</div>
          <ul className="space-y-1.5">
            {watchingNow.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-duo-green inline-block" />
                <span className="text-duo-text flex-1 truncate">{f.other.name}</span>
                <a
                  href={`/room/${f.currentRoom!.code}`}
                  className="text-xs font-bold bg-duo-green text-white px-2 py-0.5 rounded-md hover:brightness-105"
                >
                  Join
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {offline.length > 0 && (
        <ul className="space-y-1.5">
          {offline.map((f) => (
            <li key={f.id} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-duo-border inline-block" />
              <span className="text-duo-muted">{f.other.name}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
