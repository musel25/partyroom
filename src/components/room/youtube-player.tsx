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
  // Keep latest props accessible from the YT callbacks without rebuilding the player.
  const propsRef = useRef({ videoId, onReady, onStateChange });
  propsRef.current = { videoId, onReady, onStateChange };

  useEffect(() => {
    function build() {
      if (!ref.current || !window.YT) return;
      playerRef.current = new window.YT.Player(ref.current, {
        // Start empty — we load the video in the onReady callback below.
        // Passing videoId here races with `loadVideoById` from the second effect.
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            readyRef.current = true;
            const p = playerRef.current;
            if (!p) return;
            const vid = propsRef.current.videoId;
            if (vid && currentVideoIdRef.current !== vid) {
              currentVideoIdRef.current = vid;
              p.loadVideoById(vid);
            }
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

    return () => playerRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to videoId changes — but only once the player is ready.
  useEffect(() => {
    if (!readyRef.current || !videoId || !playerRef.current) return;
    if (currentVideoIdRef.current === videoId) return;
    currentVideoIdRef.current = videoId;
    playerRef.current.loadVideoById(videoId);
  }, [videoId]);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
      <div ref={ref} className="w-full h-full" />
    </div>
  );
}
