"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import { parseYouTubeId } from "@/lib/youtube";
import { DuoButton } from "@/components/theme/duo-button";
import type { QueueItem } from "@/lib/socket/types";
import type { YouTubeSearchResult } from "@/lib/youtube";

type Props = {
  queue: QueueItem[];
  currentVideoId: string | null;
};

export function QueuePanel({ queue, currentVideoId }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(true);

  // Treat the input as a YouTube link/ID if parseable; otherwise debounce
  // and search via the API. Single input, two behaviours — like YT Music.
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
        const data = (await res.json()) as { results?: YouTubeSearchResult[]; error?: string };
        if (data.error === "rate_limited") {
          setError("Searching too fast — slow down.");
          setResults([]);
          return;
        }
        setError(null);
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [value, searchEnabled]);

  function addById(videoId: string, title?: string, thumbnail?: string) {
    getSocket().emit("queue:add", { videoId, title, thumbnail });
    setValue("");
    setResults([]);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    const videoId = parseYouTubeId(trimmed);
    if (videoId) {
      addById(videoId);
      return;
    }
    // Not a link — if we have search results, pick the top hit.
    const top = results[0];
    if (top) {
      addById(top.videoId, top.title, top.thumbnail);
      return;
    }
    setError(searchEnabled ? "No matches — try a different search or paste a link." : "Paste a YouTube link.");
  }

  function remove(id: string) {
    getSocket().emit("queue:remove", { queueItemId: id });
  }

  function skip() {
    if (!currentVideoId) return;
    getSocket().emit("queue:skip", { fromVideoId: currentVideoId });
  }

  const looksLikeLink = parseYouTubeId(value.trim()) !== null;
  const placeholder = searchEnabled
    ? "Search YouTube or paste a link to queue a video"
    : "Paste a YouTube link to queue a video";

  return (
    <section className="bg-duo-card rounded-2xl border-b-[3px] border-duo-border overflow-hidden">
      <form onSubmit={submit} className="flex flex-wrap gap-2 items-stretch p-3 border-b border-duo-border bg-duo-soft">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-[240px] rounded-xl px-3 py-2 bg-duo-card border-2 border-transparent focus:border-duo-blue focus:outline-none text-sm"
          aria-label="Search or paste a YouTube link"
        />
        <DuoButton type="submit" variant="primary" className="!py-2" disabled={!value.trim()}>
          {looksLikeLink ? "+ Add" : results.length > 0 ? "+ Add top" : "Search"}
        </DuoButton>
        <DuoButton
          type="button"
          variant="ghost"
          onClick={skip}
          disabled={!currentVideoId || queue.length === 0}
          className="!py-2"
          title="Skip to the next video in the queue"
        >
          ⏭ Skip
        </DuoButton>
      </form>

      {error && <p className="text-xs text-red-500 px-4 py-2">⚠ {error}</p>}

      {results.length > 0 && (
        <div className="border-b border-duo-border bg-duo-card p-2">
          <div className="text-xs font-bold uppercase text-duo-faint mb-2 px-2">
            Search results {searching && <span className="font-normal italic ml-1">…</span>}
          </div>
          <ul className="space-y-1 max-h-[260px] overflow-y-auto">
            {results.map((r) => (
              <li
                key={r.videoId}
                className="flex gap-3 items-center p-2 hover:bg-duo-soft rounded-lg cursor-pointer"
                onClick={() => addById(r.videoId, r.title, r.thumbnail)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumbnail} alt="" className="w-24 h-14 object-cover rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-duo-text truncate" title={r.title}>{r.title}</div>
                  <div className="text-xs text-duo-faint truncate">{r.author}</div>
                </div>
                <DuoButton type="button" variant="primary" className="!py-1 !px-3 text-xs shrink-0">+ Add</DuoButton>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-4">
        <div className="text-xs font-bold uppercase text-duo-faint mb-2">
          Up next ({queue.length})
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-duo-muted">
            {searchEnabled ? "Nothing queued. Search above or paste a link." : "Nothing queued. Paste a link above."}
          </p>
        ) : (
          <ul className="space-y-2 max-h-[240px] overflow-y-auto">
            {queue.map((q, i) => (
              <li
                key={q.id}
                className="flex gap-3 items-center p-2 bg-duo-soft rounded-xl"
              >
                <span className="text-xs font-bold text-duo-faint w-5 text-center">{i + 1}</span>
                {q.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={q.thumbnail} alt="" className="w-20 h-12 object-cover rounded shrink-0" />
                ) : (
                  <div className="w-20 h-12 bg-duo-border rounded shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-duo-text truncate" title={q.title ?? q.videoId}>
                    {q.title ?? q.videoId}
                  </div>
                  {q.addedByName && (
                    <div className="text-xs text-duo-faint truncate">added by {q.addedByName}</div>
                  )}
                </div>
                <button
                  onClick={() => remove(q.id)}
                  className="text-duo-muted hover:text-red-500 text-sm font-bold px-2"
                  aria-label="Remove from queue"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
