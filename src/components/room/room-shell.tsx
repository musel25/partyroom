"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

// How long after we programmatically touch the player to ignore the
// resulting onStateChange events. Long enough to cover YouTube's
// BUFFERING → PLAYING transition that a seek triggers.
const ECHO_SUPPRESS_MS = 1500;

// If a local play/pause event would tell the server something it
// already knows (within this many seconds), drop it. Prevents
// buffer-resume from rebroadcasting a stale position.
const NO_OP_POSITION_TOLERANCE_SEC = 1.5;

export function RoomShell({ roomCode }: { roomCode: string }) {
  const { state, error } = useRoomState(roomCode);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const suppressEmitUntilRef = useRef(0);

  useDriftCorrection(player, state, {
    onBeforeApply: () => {
      suppressEmitUntilRef.current = Date.now() + ECHO_SUPPRESS_MS;
    },
  });

  function handleStateChange(ytState: number, currentTime: number) {
    if (Date.now() < suppressEmitUntilRef.current) return;
    const s = getSocket();

    if (ytState === YT_PLAYING) {
      // If server already thinks we're playing at ~this position, this is
      // just a buffer-resume — don't tell the server (and don't rewind everyone).
      if (state?.playing) {
        const expected = state.positionSec + (Date.now() - state.updatedAt) / 1000;
        if (Math.abs(currentTime - expected) < NO_OP_POSITION_TOLERANCE_SEC) return;
      }
      s.emit("playback:play", { positionSec: currentTime });
    } else if (ytState === YT_PAUSED) {
      // If server already thinks we're paused, no need to echo.
      if (state && !state.playing) return;
      s.emit("playback:pause", { positionSec: currentTime });
    } else if (ytState === YT_ENDED && state?.videoId) {
      s.emit("queue:advance", { fromVideoId: state.videoId });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Browsers without clipboard access — user can copy from URL bar.
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
        <header className="flex flex-wrap justify-between items-center gap-3 mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-duo-border">
          <Link href="/" className="text-xl font-bold text-duo-green">▶ partyroom</Link>
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold text-duo-muted">
              Room <span className="text-duo-text">{roomCode}</span>
            </div>
            <button
              onClick={copyLink}
              className={`text-sm font-bold px-3 py-1.5 rounded-lg border-2 border-b-[3px] transition-all
                ${copied
                  ? "bg-duo-green text-white border-duo-green-dk"
                  : "bg-white text-duo-blue border-duo-blue/40 hover:border-duo-blue"}`}
              title="Copy the room link to share"
            >
              {copied ? "✓ Copied!" : "🔗 Copy link"}
            </button>
          </div>
        </header>

        <ShareBanner roomCode={roomCode} />

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

// First-visit banner that nudges the host to share the room URL with friends.
// Auto-dismisses 8s after a successful copy, or via the close button.
function ShareBanner({ roomCode }: { roomCode: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setUrl(window.location.href);
  }, []);

  if (dismissed) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url || `https://partyroom.musel.dev/room/${roomCode}`);
      setCopied(true);
      setTimeout(() => setDismissed(true), 8000);
    } catch {}
  }

  return (
    <div className="mb-4 rounded-xl bg-white border-b-[3px] border-duo-border p-3 flex flex-wrap items-center gap-3">
      <span className="text-sm font-bold text-duo-text whitespace-nowrap">📣 Invite friends:</span>
      <input
        readOnly
        value={url || `https://partyroom.musel.dev/room/${roomCode}`}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-[200px] rounded-lg px-3 py-1.5 bg-duo-soft text-sm text-duo-text focus:outline-none"
      />
      <button
        onClick={copy}
        className={`text-sm font-bold px-3 py-1.5 rounded-lg border-2 border-b-[3px] transition-all
          ${copied
            ? "bg-duo-green text-white border-duo-green-dk"
            : "bg-duo-blue text-white border-duo-blue-dk hover:brightness-105"}`}
      >
        {copied ? "✓ Copied!" : "Copy link"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-sm font-bold text-duo-faint hover:text-duo-text px-2"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
