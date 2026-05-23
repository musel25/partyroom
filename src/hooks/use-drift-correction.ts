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

const DRIFT_THRESHOLD_SEC = 2;

export function useDriftCorrection(player: YTPlayer | null, state: RoomStateSnapshot | null) {
  // Apply immediate state change
  useEffect(() => {
    if (!player || !state) return;
    const expected = state.playing
      ? state.positionSec + (Date.now() - state.updatedAt) / 1000
      : state.positionSec;
    const actual = player.getCurrentTime();
    if (Math.abs(actual - expected) > DRIFT_THRESHOLD_SEC) {
      player.seekTo(expected, true);
    }
    if (state.playing) player.playVideo();
    else player.pauseVideo();
  }, [player, state?.videoId, state?.playing, state?.updatedAt, state?.positionSec]);

  // Periodic drift check every 5s
  useEffect(() => {
    if (!player || !state) return;
    const t = setInterval(() => {
      if (!state.playing) return;
      const expected = state.positionSec + (Date.now() - state.updatedAt) / 1000;
      const actual = player.getCurrentTime();
      if (Math.abs(actual - expected) > DRIFT_THRESHOLD_SEC) {
        player.seekTo(expected, true);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [player, state]);
}
