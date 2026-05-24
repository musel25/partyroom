"use client";

import { useState } from "react";
import { getSocket } from "@/lib/socket/client";
import { parseYouTubeId } from "@/lib/youtube";
import { DuoButton } from "@/components/theme/duo-button";
import type { QueueItem } from "@/lib/socket/types";

type Props = {
  queue: QueueItem[];
  currentVideoId: string | null;
};

export function QueuePanel({ queue, currentVideoId }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const videoId = parseYouTubeId(value);
    if (!videoId) {
      setError("Paste a YouTube link (e.g. https://youtu.be/...)");
      return;
    }
    setError(null);
    getSocket().emit("queue:add", { videoId });
    setValue("");
  }

  function remove(id: string) {
    getSocket().emit("queue:remove", { queueItemId: id });
  }

  function skip() {
    if (!currentVideoId) return;
    getSocket().emit("queue:skip", { fromVideoId: currentVideoId });
  }

  return (
    <section className="bg-white rounded-2xl border-b-[3px] border-duo-border overflow-hidden">
      <form onSubmit={add} className="flex flex-wrap gap-2 items-stretch p-3 border-b border-duo-border bg-duo-soft">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Paste a YouTube link to add to the queue"
          className="flex-1 min-w-[240px] rounded-xl px-3 py-2 bg-white border-2 border-transparent focus:border-duo-blue focus:outline-none text-sm"
        />
        <DuoButton type="submit" variant="primary" className="!py-2">+ Add</DuoButton>
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

      <div className="p-4">
        <div className="text-xs font-bold uppercase text-duo-faint mb-2">
          Up next ({queue.length})
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-duo-muted">
            Nothing queued. Paste a link above to add one.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[200px] overflow-y-auto">
            {queue.map((q, i) => (
              <li
                key={q.id}
                className="flex gap-3 items-center p-2 bg-duo-soft rounded-xl"
              >
                <span className="text-xs font-bold text-duo-faint w-5 text-center">
                  {i + 1}
                </span>
                {q.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={q.thumbnail}
                    alt=""
                    className="w-20 h-12 object-cover rounded shrink-0"
                  />
                ) : (
                  <div className="w-20 h-12 bg-duo-border rounded shrink-0" />
                )}
                <div className="flex-1 text-sm text-duo-text truncate" title={q.title ?? q.videoId}>
                  {q.title ?? q.videoId}
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
