"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { ChatMessage } from "@/lib/socket/types";

type ChatEntry =
  | { kind: "msg"; id: string; authorName: string; body: string }
  | { kind: "reaction"; id: string; authorName: string; emoji: string };

let reactionEntryId = 1;

export function ChatPanel() {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSocket();
    const onMsg = (m: ChatMessage) =>
      setEntries((prev) => [
        ...prev,
        { kind: "msg", id: m.id, authorName: m.authorName, body: m.body },
      ]);
    const onHistory = (h: ChatMessage[]) =>
      setEntries(
        h.map((m) => ({ kind: "msg", id: m.id, authorName: m.authorName, body: m.body })),
      );
    const onReaction = ({ emoji, fromName }: { emoji: string; fromName: string }) =>
      setEntries((prev) => [
        ...prev,
        { kind: "reaction", id: `r-${reactionEntryId++}`, authorName: fromName, emoji },
      ]);

    s.on("chat:message", onMsg);
    s.on("chat:history", onHistory);
    s.on("reaction", onReaction);
    return () => {
      s.off("chat:message", onMsg);
      s.off("chat:history", onHistory);
      s.off("reaction", onReaction);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    getSocket().emit("chat:send", { body });
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 mb-3">
        {entries.map((e) =>
          e.kind === "msg" ? (
            <div key={e.id} className="text-sm">
              <span className="font-bold text-duo-green">{e.authorName}</span>{" "}
              <span className="text-duo-text">{e.body}</span>
            </div>
          ) : (
            <div key={e.id} className="text-xs text-duo-faint italic">
              {e.authorName} reacted {e.emoji}
            </div>
          ),
        )}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Say something..."
          className="flex-1 rounded-xl px-3 py-2 bg-duo-soft focus:outline-none focus:bg-duo-card border-2 border-transparent focus:border-duo-green text-sm"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-xl px-3 py-2 bg-duo-green text-white font-bold text-sm border-b-[3px] border-duo-green-dk disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
}
