"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

export function getSocket() {
  if (!socket) {
    socket = io({ path: "/socket.io", transports: ["websocket", "polling"] });
  }
  return socket;
}
