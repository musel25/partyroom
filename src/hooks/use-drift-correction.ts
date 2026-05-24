"use client";

import { useEffect } from "react";
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
  // Called right before we touch the player so the caller can suppress
  // the resulting onStateChange echo that would otherwise bounce back
  // to the server.
  onBeforeApply?: () => void;
};

export function useDriftCorrection(
  player: YTPlayer | null,
  state: RoomStateSnapshot | null,
  options: Options = {},
) {
  // Event-driven only — no periodic poller. Periodic drift checks
  // rubber-banded the room when one client buffered.
  useEffect(() => {
    if (!player || !state) return;
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
    // Only issue the play/pause command when the player actually needs
    // to transition — avoids re-issuing no-op commands that some
    // YouTube embeds still bounce back as state changes.
    if (needsPlay) player.playVideo();
    if (needsPause) player.pauseVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, state?.videoId, state?.playing, state?.updatedAt, state?.positionSec]);
}
