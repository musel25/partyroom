"use client";

import { useRef, useState } from "react";
import { YouTubePlayer } from "./youtube-player";
import { ChatPanel } from "./chat-panel";
import { QueueDrawer } from "./queue-drawer";
import { useRoomState } from "@/hooks/use-room-state";
import { useDriftCorrection } from "@/hooks/use-drift-correction";
import { getSocket } from "@/lib/socket/client";

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (s: number, allow: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
};

export function RoomShell({ roomCode }: { roomCode: string }) {
  const { state, error } = useRoomState(roomCode);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const suppressEmit = useRef(false);

  useDriftCorrection(player, state);

  function handleStateChange(ytState: number, currentTime: number) {
    if (suppressEmit.current) return;
    const s = getSocket();
    if (ytState === 1) s.emit("playback:play", { positionSec: currentTime });
    if (ytState === 2) s.emit("playback:pause", { positionSec: currentTime });
    if (ytState === 0 /* ENDED */ && state?.videoId) {
      s.emit("queue:advance", { fromVideoId: state.videoId });
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fffaf0]">
        <p className="text-[#777]">{error}</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#fffaf0] p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <div className="text-sm font-bold text-[#777]">
            Room <span className="text-[#3c3c3c]">{roomCode}</span>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <YouTubePlayer
              videoId={state?.videoId ?? null}
              onReady={setPlayer}
              onStateChange={handleStateChange}
            />
            <div className="bg-white rounded-xl p-3 border-b-[3px] border-[#e5e5e5] flex justify-between items-center">
              <span className="text-sm text-[#777]">Anyone can play, pause, seek, or add to the queue.</span>
              <button
                onClick={() => setQueueOpen(true)}
                className="text-sm font-bold text-[#1cb0f6] hover:text-[#0a8fc7]"
              >
                Queue ({state?.queue.length ?? 0})
              </button>
            </div>
          </div>
          <aside className="bg-white rounded-2xl p-4 border-b-[3px] border-[#e5e5e5] h-[600px] flex flex-col gap-3">
            <div>
              <div className="text-xs font-bold uppercase text-[#999] mb-2">
                Participants ({state?.participants.length ?? 0})
              </div>
              <ul className="space-y-1 text-sm">
                {state?.participants.map((p) => (
                  <li key={p.socketId} className="text-[#3c3c3c]">
                    {p.displayName}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-[#e5e5e5] pt-3 flex-1 flex flex-col min-h-0">
              <div className="text-xs font-bold uppercase text-[#999] mb-2">Chat</div>
              <div className="flex-1 min-h-0">
                <ChatPanel />
              </div>
            </div>
          </aside>
        </div>
      </div>
      <QueueDrawer queue={state?.queue ?? []} open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
}
