"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({
      path: "/socket.io",
      // Try polling first, then upgrade. nginx 1.24 with HTTP/2 can
      // sometimes choke on the WebSocket upgrade; polling-first lets
      // us connect reliably and then upgrade in the background.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 20_000,
    });
  }
  return socket;
}

/**
 * Close the singleton — call when leaving the room so we stop holding
 * a WebSocket open on routes that don't need it (mobile battery).
 */
export function closeSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
