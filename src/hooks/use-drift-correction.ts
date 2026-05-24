"use client";

import { useEffect, useRef } from "react";
import type { RoomStateSnapshot } from "@/lib/socket/types";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

const YT_PLAYING = 1;
const YT_PAUSED = 2;
// Generous threshold — anything tighter fights YouTube's own buffer
// smoothing and triggers feedback loops with one buffering client.
const DRIFT_THRESHOLD_SEC = 3;

type Options = {
  onBeforeApply?: () => void;
};

export function useDriftCorrection(
  player: YTPlayer | null,
  state: RoomStateSnapshot | null,
  options: Options = {},
) {
  const lastVideoIdRef = useRef<string | null>(null);

  // Event-driven only — no periodic poller. Periodic drift checks
  // rubber-banded the room when one client buffered.
  useEffect(() => {
    if (!player || !state) return;

    // When the video itself changed, YouTubePlayer is calling
    // loadVideoById which both loads AND auto-plays the new content.
    // Issuing seekTo in the same tick races with the load and YT
    // can end up in a weird "blank" state. We skip the seek and the
    // play call this run; loadVideoById will autoplay. We DO still
    // pause if the server says paused — handled with a brief delay
    // to let the load settle.
    const last = lastVideoIdRef.current;
    const videoChanged = last !== null && last !== state.videoId;
    lastVideoIdRef.current = state.videoId;

    if (videoChanged) {
      if (!state.playing) {
        const id = setTimeout(() => {
          if (player.getPlayerState() === YT_PLAYING) {
            options.onBeforeApply?.();
            player.pauseVideo();
          }
        }, 1200);
        return () => clearTimeout(id);
      }
      return;
    }

    const now = Date.now();
    const expected = state.playing
      ? state.positionSec + (now - state.updatedAt) / 1000
      : state.positionSec;
    const actual = player.getCurrentTime();
    const ytState = player.getPlayerState();
    const isPlaying = ytState === YT_PLAYING;
    const isPaused = ytState === YT_PAUSED;

    const needsSeek = Math.abs(actual - expected) > DRIFT_THRESHOLD_SEC;
    const needsPlay = state.playing && !isPlaying;
    const needsPause = !state.playing && !isPaused;

    if (!needsSeek && !needsPlay && !needsPause) return;

    options.onBeforeApply?.();
    if (needsSeek) player.seekTo(expected, true);
    if (needsPlay) player.playVideo();
    if (needsPause) player.pauseVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, state?.videoId, state?.playing, state?.updatedAt, state?.positionSec]);
}
