"use client";

import { useRef, useState } from "react";
import { YouTubePlayer } from "./youtube-player";
import { ChatPanel } from "./chat-panel";
import { QueueDrawer } from "./queue-drawer";
import { ReactionsOverlay } from "./reactions-overlay";
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
  const [chatOpen, setChatOpen] = useState(true);
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
      <main className="min-h-screen flex items-center justify-center bg-duo-cream">
        <p className="text-duo-muted">{error}</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-duo-cream p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-duo-border">
          <div className="text-xl font-bold text-duo-green">▶ partyroom</div>
          <div className="text-sm font-bold text-duo-muted">
            Room <span className="text-duo-text">{roomCode}</span>
          </div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <div className="relative">
              <YouTubePlayer
                videoId={state?.videoId ?? null}
                onReady={setPlayer}
                onStateChange={handleStateChange}
              />
              <ReactionsOverlay />
            </div>
            <div className="bg-white rounded-xl p-3 border-b-[3px] border-duo-border flex justify-between items-center">
              <span className="text-sm text-duo-muted">Anyone can play, pause, seek, or add to the queue.</span>
              <button
                onClick={() => setQueueOpen(true)}
                className="text-sm font-bold text-duo-blue hover:text-duo-blue-dk"
              >
                Queue ({state?.queue.length ?? 0})
              </button>
            </div>
          </div>
          <aside className={`bg-white rounded-2xl p-4 border-b-[3px] border-duo-border flex flex-col gap-3 transition-all
                             ${chatOpen ? "h-[600px]" : "h-12 overflow-hidden"}`}>
            <button
              onClick={() => setChatOpen((v) => !v)}
              className="text-xs font-bold uppercase text-duo-faint flex justify-between items-center w-full"
            >
              <span>Chat</span>
              <span>{chatOpen ? "−" : "+"}</span>
            </button>
            {chatOpen && (
              <>
                <div>
                  <div className="text-xs font-bold uppercase text-duo-faint mb-2">
                    Participants ({state?.participants.length ?? 0})
                  </div>
                  <ul className="space-y-1 text-sm">
                    {state?.participants.map((p) => (
                      <li key={p.socketId} className="text-duo-text">
                        {p.displayName}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t border-duo-border pt-3 flex-1 flex flex-col min-h-0">
                  <div className="flex-1 min-h-0">
                    <ChatPanel />
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
      <QueueDrawer queue={state?.queue ?? []} open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
}
