import { vi } from "vitest";
import type { SocketData, SocketUserIdentity, PartyServer } from "@/lib/socket/types";

/**
 * Lightweight stand-in for socket.io's Socket + Server. We only need
 * enough surface area for the handlers under test:
 *  - socket.on(event, handler) registers a handler
 *  - emit(event, payload) invokes a registered handler
 *  - socket.data carries roomId / identity
 *  - server.to(room).emit(event, payload) records broadcast events
 */

type Handler = (...args: unknown[]) => unknown;

export function makeFakeSocket(opts: { roomId?: string; identity?: SocketUserIdentity } = {}) {
  const handlers = new Map<string, Handler>();
  const data: SocketData = {
    roomId: opts.roomId,
    identity: opts.identity ?? {
      userId: "u_test",
      displayName: "Test User",
      userKey: "u:u_test",
    },
  };

  const socket = {
    id: "socket_test_" + Math.random().toString(36).slice(2, 8),
    data,
    on(event: string, h: Handler) {
      handlers.set(event, h);
      return socket;
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    handshake: { headers: {} },
  };

  async function fire(event: string, payload?: unknown, ack?: (resp: unknown) => void) {
    const h = handlers.get(event);
    if (!h) throw new Error(`No handler for ${event}`);
    return await h(payload, ack);
  }

  return { socket, fire, handlers };
}

export function makeFakeServer() {
  const broadcasts: Array<{ room: string; event: string; payload: unknown }> = [];

  const io = {
    to(room: string) {
      return {
        emit(event: string, payload: unknown) {
          broadcasts.push({ room, event, payload });
        },
      };
    },
  } as unknown as PartyServer;

  return { io, broadcasts };
}
