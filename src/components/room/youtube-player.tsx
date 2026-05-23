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
  const readyRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  // Latest callbacks are accessible to YT event handlers without rebuilding the player.
  const propsRef = useRef({ onReady, onStateChange });
  propsRef.current = { onReady, onStateChange };

  // Build the YT player the first time a videoId is provided.
  // Constructing with no videoId leaves the player in a state where
  // later loadVideoById calls don't take effect.
  useEffect(() => {
    if (!videoId || playerRef.current) return;
    let cancelled = false;

    function build() {
      if (cancelled || !ref.current || !window.YT || !videoId) return;
      currentVideoIdRef.current = videoId;
      playerRef.current = new window.YT.Player(ref.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const p = playerRef.current;
            if (!p) return;
            propsRef.current.onReady?.(p);
          },
          onStateChange: (e: { data: number }) => {
            const p = playerRef.current;
            if (!p) return;
            propsRef.current.onStateChange?.(e.data, p.getCurrentTime());
          },
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

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Once the player is built and ready, swap to a new videoId via loadVideoById.
  useEffect(() => {
    if (!readyRef.current || !videoId || !playerRef.current) return;
    if (currentVideoIdRef.current === videoId) return;
    currentVideoIdRef.current = videoId;
    playerRef.current.loadVideoById(videoId);
  }, [videoId]);

  // Destroy on unmount.
  useEffect(() => {
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
      currentVideoIdRef.current = null;
    };
  }, []);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
