"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DuoButton } from "@/components/theme/duo-button";

// Accept either a bare code (XXX-XXX) or a full room URL like
// https://partyroom.musel.dev/room/XXX-XXX. We normalise to the code.
const CODE_RE = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/i;

function extractCode(input: string): string | null {
  const trimmed = input.trim();
  if (CODE_RE.test(trimmed)) return trimmed.toUpperCase();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/room\/([A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3})/i);
    if (match) return match[1]!.toUpperCase();
  } catch {
    // not a URL
  }
  return null;
}

export function JoinByCode() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const code = extractCode(value);
    if (!code) {
      setError("Enter a room code like ABC-123 or a /room/... URL.");
      return;
    }
    setError(null);
    router.push(`/room/${code}`);
  }

  return (
    <section className="bg-white rounded-2xl p-5 border-b-[3px] border-duo-border">
      <div className="text-xs font-bold uppercase text-duo-faint mb-3">Join with code</div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ABC-123 or paste room URL"
          className="flex-1 rounded-xl px-3 py-2 bg-duo-soft focus:outline-none border-2 border-transparent focus:border-duo-blue text-sm"
        />
        <DuoButton type="submit" variant="secondary">Join</DuoButton>
      </form>
      {error && <p className="text-xs text-red-500 mt-2">⚠ {error}</p>}
    </section>
  );
}
