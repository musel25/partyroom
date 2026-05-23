"use client";

import { useEffect, useState } from "react";
import { DuoButton } from "@/components/theme/duo-button";

type Friend = {
  id: string;
  status: string;
  other: { id: string; name: string | null; image: string | null };
  iSent: boolean;
};
type SearchHit = { id: string; name: string | null; email: string; image: string | null };

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  async function reload() {
    const r = await fetch("/api/friends").then((r) => r.json());
    setFriends(r);
  }
  useEffect(() => { void reload(); }, []);

  useEffect(() => {
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setHits(r);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function add(otherUserId: string) {
    await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId }),
    });
    setQ("");
    setHits([]);
    void reload();
  }

  async function accept(id: string) {
    await fetch(`/api/friends/${id}`, { method: "PATCH" });
    void reload();
  }
  async function remove(id: string) {
    await fetch(`/api/friends/${id}`, { method: "DELETE" });
    void reload();
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-[#3c3c3c]">Friends</h1>
        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xs font-bold uppercase text-[#999] mb-3">Find people</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email or name"
            className="w-full rounded-xl px-3 py-2 bg-[#f7f7f7] focus:outline-none border-2 border-transparent focus:border-[#58cc02] text-sm"
          />
          <ul className="mt-3 space-y-2">
            {hits.map((u) => (
              <li key={u.id} className="flex justify-between items-center text-sm">
                <span>{u.name ?? u.email}</span>
                <DuoButton onClick={() => add(u.id)}>+ Add</DuoButton>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xs font-bold uppercase text-[#999] mb-3">Your friends</div>
          <ul className="space-y-2">
            {friends.length === 0 && (
              <li className="text-sm text-[#777]">No friends yet.</li>
            )}
            {friends.map((f) => (
              <li key={f.id} className="flex justify-between items-center text-sm">
                <span className="text-[#3c3c3c]">
                  {f.other.name ?? "anon"}{" "}
                  {f.status === "PENDING" && (f.iSent ? <em className="text-[#999]">(sent)</em> : <em className="text-[#999]">(wants to add)</em>)}
                </span>
                <div className="flex gap-2">
                  {f.status === "PENDING" && !f.iSent && <DuoButton onClick={() => accept(f.id)}>Accept</DuoButton>}
                  <DuoButton variant="ghost" onClick={() => remove(f.id)}>Remove</DuoButton>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
