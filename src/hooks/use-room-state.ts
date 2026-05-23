"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { RoomStateSnapshot } from "@/lib/socket/types";

export function useRoomState(roomCode: string) {
  const [state, setState] = useState<RoomStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = getSocket();
    s.emit("room:join", { roomCode }, (resp) => {
      if ("error" in resp) setError(resp.error);
      else setState(resp);
    });
    const onState = (snap: RoomStateSnapshot) => setState(snap);
    s.on("room:state", onState);
    return () => {
      s.off("room:state", onState);
    };
  }, [roomCode]);

  return { state, error };
}
