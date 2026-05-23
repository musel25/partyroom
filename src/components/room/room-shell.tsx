"use client";

import { YouTubePlayer } from "./youtube-player";

export function RoomShell({ roomCode, initialVideoId }: { roomCode: string; initialVideoId: string | null }) {
  return (
    <div className="min-h-screen bg-[#fffaf0] p-4">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-4 bg-white rounded-xl px-5 py-3 border-b-[3px] border-[#e5e5e5]">
          <div className="text-xl font-bold text-[#58cc02]">▶ partyroom</div>
          <div className="text-sm font-bold text-[#777]">Room <span className="text-[#3c3c3c]">{roomCode}</span></div>
        </header>

        <div className="grid lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-3">
            <YouTubePlayer videoId={initialVideoId} />
            <div className="bg-white rounded-xl p-3 border-b-[3px] border-[#e5e5e5] text-sm text-[#777]">
              Sync controls go here in Phase 4.
            </div>
          </div>
          <aside className="bg-white rounded-2xl p-4 border-b-[3px] border-[#e5e5e5] min-h-[200px]">
            <div className="text-xs font-bold uppercase text-[#999] mb-2">Chat</div>
            <p className="text-sm text-[#777]">Wires up in Phase 5.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
