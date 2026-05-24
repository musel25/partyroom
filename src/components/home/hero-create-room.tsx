"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";
import { parseYouTubeId } from "@/lib/youtube";
import type { YouTubeSearchResult } from "@/lib/youtube";

export function HeroCreateRoom({ userName }: { userName: string }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const router = useRouter();

  // Debounced YouTube search — only when the input isn't already a
  // recognisable URL/ID. Server returns 503 if YOUTUBE_API_KEY isn't
  // set; we flip into paste-link-only mode in that case.
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed || parseYouTubeId(trimmed) || !searchEnabled || trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
        if (res.status === 503) {
          setSearchEnabled(false);
          setResults([]);
          return;
        }
        const data = (await res.json()) as { results?: YouTubeSearchResult[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [value, searchEnabled]);

  async function createRoom(youtubeUrl: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "failed");
      router.push(`/room/${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const id = parseYouTubeId(trimmed);
    if (id) {
      void createRoom(`https://www.youtube.com/watch?v=${id}`);
      return;
    }
    const top = results[0];
    if (top) {
      void createRoom(`https://www.youtube.com/watch?v=${top.videoId}`);
      return;
    }
    setError(searchEnabled ? "No matches — try a different search or paste a link." : "Paste a YouTube link.");
  }

  const looksLikeLink = parseYouTubeId(value.trim()) !== null;
  const placeholder = searchEnabled
    ? "Search YouTube or paste a link"
    : "Paste a YouTube link";
  const ctaLabel = busy
    ? "Creating…"
    : looksLikeLink
    ? "Create room"
    : results.length > 0
    ? "Use top result"
    : "Search";

  return (
    <div
      className="rounded-2xl p-6 text-white border-b-[4px] border-duo-green-2"
      style={{ background: "linear-gradient(135deg, #58cc02 0%, #89e219 100%)" }}
    >
      <h2 className="text-2xl font-extrabold mb-1 drop-shadow-sm">👋 Hey {userName}</h2>
      <p className="text-sm font-bold text-white mb-4 drop-shadow-sm">
        {searchEnabled
          ? "Search YouTube or paste a link to start watching together."
          : "Paste a YouTube link to start watching together."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl px-4 py-3 bg-white text-duo-text placeholder-duo-muted focus:outline-none focus:ring-2 focus:ring-white text-base"
          aria-label="Search YouTube or paste a link"
        />
        <DuoButton
          type="submit"
          variant="ghost"
          disabled={busy || !value.trim()}
          className="w-full !bg-duo-card !text-duo-green-dk !border-duo-green-2"
        >
          {ctaLabel}
        </DuoButton>
        {error && <p className="text-xs text-red-100">⚠ {error}</p>}
      </form>

      {results.length > 0 && (
        <div className="mt-3 rounded-xl bg-duo-card/95 backdrop-blur-sm p-2 text-duo-text">
          <div className="text-xs font-bold uppercase text-duo-faint px-2 mb-1">
            Results {searching && <span className="font-normal italic ml-1">…</span>}
          </div>
          <ul className="space-y-1 max-h-[260px] overflow-y-auto">
            {results.map((r) => (
              <li
                key={r.videoId}
                className="flex gap-3 items-center p-2 hover:bg-duo-soft rounded-lg cursor-pointer"
                onClick={() => createRoom(`https://www.youtube.com/watch?v=${r.videoId}`)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.thumbnail}
                  alt=""
                  className="w-20 h-12 object-cover rounded shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" title={r.title}>{r.title}</div>
                  <div className="text-xs text-duo-faint truncate">{r.author}</div>
                </div>
                <span className="text-xs font-bold text-duo-green shrink-0">Create →</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
