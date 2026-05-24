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
// Slightly generous threshold — anything tighter and we fight YouTube's
// own buffering smoothing and trigger feedback loops.
const DRIFT_THRESHOLD_SEC = 3;

type Options = {
  // Called right before we touch the player so the caller can suppress
  // the resulting onStateChange echo (which would otherwise bounce the
  // same event back to the server).
  onBeforeApply?: () => void;
};

export function useDriftCorrection(
  player: YTPlayer | null,
  state: RoomStateSnapshot | null,
  options: Options = {},
) {
  // Only reconcile on actual state changes — no periodic poller.
  // A periodic check rubber-bands the room when one client buffers,
  // because the buffer pause makes our local position trail the
  // server's expected position; the seek to catch up triggers more
  // buffering, etc.
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

    if (needsSeek || needsPlay || needsPause) {
      options.onBeforeApply?.();
    }
    if (needsSeek) player.seekTo(expected, true);
    if (state.playing) player.playVideo();
    else player.pauseVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, state?.videoId, state?.playing, state?.updatedAt, state?.positionSec]);
}
