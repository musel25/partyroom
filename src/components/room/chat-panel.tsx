"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { ChatMessage } from "@/lib/socket/types";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = getSocket();
    const onMsg = (m: ChatMessage) => setMessages((prev) => [...prev, m]);
    const onHistory = (h: ChatMessage[]) => setMessages(h);
    s.on("chat:message", onMsg);
    s.on("chat:history", onHistory);
    return () => {
      s.off("chat:message", onMsg);
      s.off("chat:history", onHistory);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    getSocket().emit("chat:send", { body });
    setDraft("");
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 mb-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-bold text-duo-green">{m.authorName}</span>{" "}
            <span className="text-duo-text">{m.body}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Say something..."
          className="flex-1 rounded-xl px-3 py-2 bg-duo-soft focus:outline-none focus:bg-white border-2 border-transparent focus:border-duo-green text-sm"
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
