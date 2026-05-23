"use client";

import { useEffect, useRef } from "react";

type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allowSeekAhead: boolean) => void;
  loadVideoById: (id: string) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: object) => YTPlayer;
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type Props = {
  videoId: string | null;
  onReady?: (p: YTPlayer) => void;
  onStateChange?: (state: number, currentTime: number) => void;
};

export function YouTubePlayer({ videoId, onReady, onStateChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    function build() {
      if (!ref.current || !window.YT) return;
      playerRef.current = new window.YT.Player(ref.current, {
        videoId: videoId ?? undefined,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => playerRef.current && onReady?.(playerRef.current),
          onStateChange: (e: { data: number }) =>
            playerRef.current && onStateChange?.(e.data, playerRef.current.getCurrentTime()),
        },
      });
    }

    if (window.YT?.Player) {
      build();
    } else {
      window.onYouTubeIframeAPIReady = build;
      if (!document.getElementById("yt-iframe-api")) {
        const s = document.createElement("script");
        s.id = "yt-iframe-api";
        s.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(s);
      }
    }

    return () => playerRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoId && playerRef.current) playerRef.current.loadVideoById(videoId);
  }, [videoId]);

  return <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black"><div ref={ref} className="w-full h-full" /></div>;
}
