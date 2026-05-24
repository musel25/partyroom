"use client";

import { useEffect, useRef, useState } from "react";

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
    __ytApiCallbacks?: Array<() => void>;
  }
}

// Shared ready-callback registry so multiple players (current + future)
// don't clobber each other's `onYouTubeIframeAPIReady`. Any caller that
// pushes here fires when YT loads; if YT is already loaded, the push
// site can call its callback synchronously.
function registerYTReady(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) {
    cb();
    return;
  }
  window.__ytApiCallbacks ??= [];
  window.__ytApiCallbacks.push(cb);
  // First registration wires the global hook.
  if (window.__ytApiCallbacks.length === 1) {
    window.onYouTubeIframeAPIReady = () => {
      const cbs = window.__ytApiCallbacks ?? [];
      window.__ytApiCallbacks = [];
      for (const fn of cbs) try { fn(); } catch {}
    };
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(s);
    }
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
  const buildAttemptRef = useRef(0);
  const propsRef = useRef({ onReady, onStateChange });
  propsRef.current = { onReady, onStateChange };
  const [error, setError] = useState<string | null>(null);

  // Build the YT player once a videoId is available. Self-heals if the
  // player fails to become ready within a few seconds (which sometimes
  // happens on a cold first load).
  useEffect(() => {
    if (!videoId || playerRef.current) return;
    let cancelled = false;
    let readyTimeout: ReturnType<typeof setTimeout> | undefined;

    function attemptBuild() {
      if (cancelled || !ref.current || !videoId) return;
      buildAttemptRef.current += 1;
      const attempt = buildAttemptRef.current;
      currentVideoIdRef.current = videoId;

      try {
        playerRef.current = new window.YT!.Player(ref.current, {
          videoId,
          playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              if (cancelled) return;
              readyRef.current = true;
              if (readyTimeout) clearTimeout(readyTimeout);
              setError(null);
              const p = playerRef.current;
              if (p) propsRef.current.onReady?.(p);
            },
            onStateChange: (e: { data: number }) => {
              const p = playerRef.current;
              if (!p) return;
              propsRef.current.onStateChange?.(e.data, p.getCurrentTime());
            },
            onError: (e: { data: number }) => {
              // 2: invalid id · 5: HTML5 · 100: not found · 101/150: embed denied
              const code = e?.data;
              if (code === 101 || code === 150) {
                setError("This video can't be embedded. Try a different one.");
              } else if (code === 100) {
                setError("Video not found.");
              } else if (code === 2) {
                setError("Invalid YouTube link.");
              } else {
                setError(`Playback error (${code}).`);
              }
            },
          },
        });
      } catch {
        if (attempt < 3) setTimeout(attemptBuild, 800);
        else setError("Couldn't initialise the YouTube player.");
        return;
      }

      // Self-heal: if onReady never fires within 8s on the very first
      // build, destroy and rebuild once. Covers the rare cold-load
      // case where the iframe script loads but the player init hangs.
      readyTimeout = setTimeout(() => {
        if (cancelled || readyRef.current) return;
        if (buildAttemptRef.current >= 3) return;
        try { playerRef.current?.destroy(); } catch {}
        playerRef.current = null;
        currentVideoIdRef.current = null;
        attemptBuild();
      }, 8000);
    }

    registerYTReady(attemptBuild);

    return () => {
      cancelled = true;
      if (readyTimeout) clearTimeout(readyTimeout);
    };
  }, [videoId]);

  // Swap videos once the player is ready.
  useEffect(() => {
    if (!readyRef.current || !videoId || !playerRef.current) return;
    if (currentVideoIdRef.current === videoId) return;
    currentVideoIdRef.current = videoId;
    setError(null);
    playerRef.current.loadVideoById(videoId);
  }, [videoId]);

  // Destroy on unmount.
  useEffect(() => {
    return () => {
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
      readyRef.current = false;
      currentVideoIdRef.current = null;
    };
  }, []);

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black relative">
      <div ref={ref} className="w-full h-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white text-sm font-bold p-4 text-center">
          {error}
        </div>
      )}
    </div>
  );
}
