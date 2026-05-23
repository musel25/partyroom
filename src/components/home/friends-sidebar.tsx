"use client";

import { useEffect, useState } from "react";

type Friend = {
  id: string;
  status: string;
  other: { id: string; name: string | null };
};

export function FriendsSidebar() {
  const [friends, setFriends] = useState<Friend[]>([]);
  useEffect(() => {
    void fetch("/api/friends").then((r) => r.json()).then(setFriends);
  }, []);
  const accepted = friends.filter((f) => f.status === "ACCEPTED");

  return (
    <aside className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
      <div className="text-xs font-bold uppercase text-[#999] mb-3">Friends</div>
      {accepted.length === 0 && (
        <p className="text-sm text-[#777]">
          No friends yet.{" "}
          <a href="/friends" className="text-[#1cb0f6] font-bold">Add some</a>.
        </p>
      )}
      <ul className="space-y-2">
        {accepted.map((f) => (
          <li key={f.id} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-[#ccc]"></span>
            <span className="text-[#3c3c3c]">{f.other.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
