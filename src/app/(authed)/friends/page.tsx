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
  const [error, setError] = useState<string | null>(null);

  async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T | null> {
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Request failed (${res.status})`);
        return null;
      }
      setError(null);
      return (await res.json()) as T;
    } catch {
      setError("Network error.");
      return null;
    }
  }

  async function reload() {
    const r = await fetchJSON<Friend[]>("/api/friends");
    if (r) setFriends(r);
  }
  useEffect(() => { void reload(); }, []);

  useEffect(() => {
    if (q.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const r = await fetchJSON<SearchHit[]>(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (r) setHits(r);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function add(otherUserId: string) {
    await fetchJSON("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId }),
    });
    setQ("");
    setHits([]);
    void reload();
  }

  async function accept(id: string) {
    await fetchJSON(`/api/friends/${id}`, { method: "PATCH" });
    void reload();
  }
  async function remove(id: string) {
    await fetchJSON(`/api/friends/${id}`, { method: "DELETE" });
    void reload();
  }

  return (
    <main className="min-h-screen bg-duo-cream p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <h1 className="text-2xl font-bold text-duo-text">Friends</h1>
        {error && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-2">
            ⚠ {error}
          </p>
        )}
        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-duo-border">
          <div className="text-xs font-bold uppercase text-duo-faint mb-3">Find people</div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Email or name"
            className="w-full rounded-xl px-3 py-2 bg-duo-soft focus:outline-none border-2 border-transparent focus:border-duo-green text-sm"
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

        <section className="bg-white rounded-2xl p-5 border-b-[3px] border-duo-border">
          <div className="text-xs font-bold uppercase text-duo-faint mb-3">Your friends</div>
          <ul className="space-y-2">
            {friends.length === 0 && (
              <li className="text-sm text-duo-muted">No friends yet.</li>
            )}
            {friends.map((f) => (
              <li key={f.id} className="flex justify-between items-center text-sm">
                <span className="text-duo-text">
                  {f.other.name ?? "anon"}{" "}
                  {f.status === "PENDING" && (f.iSent ? <em className="text-duo-faint">(sent)</em> : <em className="text-duo-faint">(wants to add)</em>)}
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
