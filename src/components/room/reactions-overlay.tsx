"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";

type FloatingEmoji = { id: number; emoji: string; left: number };
let nextId = 1;

const EMOJIS = ["❤️", "😂", "🎉", "🔥", "👍", "👎", "😮", "😢"];

export function ReactionsOverlay() {
  const [floating, setFloating] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    const s = getSocket();
    const onR = ({ emoji }: { emoji: string; fromName: string }) => {
      const f = { id: nextId++, emoji, left: 20 + Math.random() * 60 };
      setFloating((prev) => [...prev, f]);
      setTimeout(() => setFloating((prev) => prev.filter((x) => x.id !== f.id)), 3000);
    };
    s.on("reaction", onR);
    return () => {
      s.off("reaction", onR);
    };
  }, []);

  return (
    <>
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floating.map((f) => (
          <span
            key={f.id}
            className="absolute bottom-4 text-3xl animate-float"
            style={{ left: `${f.left}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 flex gap-1 bg-white/80 rounded-full px-2 py-1">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => getSocket().emit("reaction:send", { emoji: e })}
            className="text-lg hover:scale-125 transition-transform"
          >
            {e}
          </button>
        ))}
      </div>
    </>
  );
}
