"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";

export function HeroCreateRoom({ userName }: { userName: string }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl: url }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "failed");
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl p-6 text-white border-b-[4px] border-duo-green-2"
         style={{ background: "linear-gradient(135deg, #58cc02 0%, #89e219 100%)" }}>
      <h2 className="text-xl font-bold mb-1">👋 Hey {userName}</h2>
      <p className="text-sm text-white/90 mb-4">Paste a YouTube link to start watching together.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..."
          className="w-full rounded-xl px-4 py-3 text-duo-text placeholder-[#aaa] focus:outline-none"
        />
        <DuoButton type="submit" variant="ghost" disabled={busy} className="w-full !bg-white !text-duo-green-dk !border-duo-green-2">
          {busy ? "Creating…" : "Create room"}
        </DuoButton>
        {error && <p className="text-xs text-red-100">⚠ {error}</p>}
      </form>
    </div>
  );
}
