"use client";

import { useState } from "react";
import { getSocket } from "@/lib/socket/client";
import { parseYouTubeId } from "@/lib/youtube";
import { DuoButton } from "@/components/theme/duo-button";
import type { QueueItem } from "@/lib/socket/types";

export function QueueDrawer({ queue, open, onClose }: { queue: QueueItem[]; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    const videoId = parseYouTubeId(url);
    if (!videoId) return;
    getSocket().emit("queue:add", { videoId });
    setUrl("");
  }

  function remove(id: string) {
    getSocket().emit("queue:remove", { queueItemId: id });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="bg-white w-full max-w-md h-full p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">🎵 Up next ({queue.length})</h2>
          <button onClick={onClose} className="text-2xl text-[#777]">×</button>
        </div>
        <form onSubmit={add} className="flex gap-2 mb-4">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="YouTube URL"
            className="flex-1 rounded-xl px-3 py-2 bg-[#f7f7f7] focus:outline-none border-2 border-transparent focus:border-[#58cc02] text-sm"
          />
          <DuoButton type="submit" variant="primary">Add</DuoButton>
        </form>
        <ul className="space-y-2">
          {queue.map((q) => (
            <li key={q.id} className="flex gap-3 items-center p-2 bg-[#f7f7f7] rounded-xl">
              {q.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={q.thumbnail} alt="" className="w-20 h-12 object-cover rounded" />
              )}
              <div className="flex-1 text-sm truncate">{q.title ?? q.videoId}</div>
              <button onClick={() => remove(q.id)} className="text-[#777] text-sm hover:text-red-500">remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
