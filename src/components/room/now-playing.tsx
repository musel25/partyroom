"use client";

import type { NowPlaying as NowPlayingT } from "@/lib/socket/types";

export function NowPlaying({ data }: { data: NowPlayingT | null }) {
  if (!data) return null;

  const watchUrl = `https://www.youtube.com/watch?v=${data.videoId}`;

  return (
    <div className="bg-duo-card rounded-xl px-4 py-3 border-b-[3px] border-duo-border flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold uppercase text-duo-faint mb-0.5">Now playing</div>
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="block text-sm font-bold text-duo-text hover:text-duo-blue truncate"
          title={data.title ?? data.videoId}
        >
          {data.title ?? "Loading title…"}
        </a>
        {data.author && (
          <div className="text-xs text-duo-muted truncate">{data.author}</div>
        )}
      </div>
    </div>
  );
}
