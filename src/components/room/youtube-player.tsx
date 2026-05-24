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
// don't clobber each other's `onYouTubeIframeAPIReady`.
function registerYTReady(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) {
    cb();
    return;
  }
  window.__ytApiCallbacks ??= [];
  window.__ytApiCallbacks.push(cb);
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
  // Latest props accessible from inside YT callbacks without re-running
  // the build effect every time a callback identity changes.
  const propsRef = useRef({ videoId, onReady, onStateChange });
  propsRef.current = { videoId, onReady, onStateChange };
  const [error, setError] = useState<string | null>(null);

  // Build the YT player the first time a videoId is provided.
  useEffect(() => {
    if (!videoId || playerRef.current) return;
    let cancelled = false;
    let readyTimeout: ReturnType<typeof setTimeout> | undefined;

    function attemptBuild() {
      if (cancelled || !ref.current || !window.YT?.Player) return;
      const vidToBuild = propsRef.current.videoId; // use latest, not the closure's
      if (!vidToBuild) return;
      buildAttemptRef.current += 1;
      const attempt = buildAttemptRef.current;
      currentVideoIdRef.current = vidToBuild;

      try {
        playerRef.current = new window.YT.Player(ref.current, {
          videoId: vidToBuild,
          playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
          events: {
            onReady: () => {
              if (cancelled) return;
              readyRef.current = true;
              if (readyTimeout) clearTimeout(readyTimeout);
              setError(null);
              const p = playerRef.current;
              if (!p) return;
              // The prop's videoId may have changed while we were
              // initialising — load whatever's current now.
              const vidNow = propsRef.current.videoId;
              if (vidNow && vidNow !== currentVideoIdRef.current) {
                currentVideoIdRef.current = vidNow;
                p.loadVideoById(vidNow);
              }
              propsRef.current.onReady?.(p);
            },
            onStateChange: (e: { data: number }) => {
              const p = playerRef.current;
              if (!p) return;
              propsRef.current.onStateChange?.(e.data, p.getCurrentTime());
            },
            onError: (e: { data: number }) => {
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

      // Self-heal: rebuild once if onReady never fires (rare cold-load case).
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
