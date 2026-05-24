"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket/client";
import type { RoomStateSnapshot } from "@/lib/socket/types";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/**
 * Subscribe to a room over the socket. Re-emits `room:join` on every
 * (re)connect so a transient network drop doesn't leave the user as a
 * server-side ghost.
 */
export function useRoomState(roomCode: string) {
  const [state, setState] = useState<RoomStateSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    const s = getSocket();

    function join() {
      s.emit("room:join", { roomCode }, (resp) => {
        if ("error" in resp) {
          setError(resp.error);
        } else {
          setError(null);
          setState(resp);
        }
      });
    }
    function onConnect() {
      setStatus("connected");
      join();
    }
    function onDisconnect() {
      setStatus("reconnecting");
    }
    function onConnectError() {
      setStatus("reconnecting");
    }
    function onState(snap: RoomStateSnapshot) {
      setState(snap);
    }

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    s.on("connect_error", onConnectError);
    s.on("room:state", onState);

    if (s.connected) {
      setStatus("connected");
      join();
    } else {
      setStatus("connecting");
      s.connect();
    }

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.off("connect_error", onConnectError);
      s.off("room:state", onState);
    };
  }, [roomCode]);

  return { state, error, status };
}
