// Fail-fast on missing/invalid env at boot rather than on the first request.
import "./src/env";

import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "./src/lib/socket/types";
import { installSocketServer } from "./src/lib/socket/server";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: dev ? "*" : false },
    transports: ["websocket", "polling"],
  });

  installSocketServer(io);

  httpServer.listen(port, () => {
    console.log(`partyroom ready on http://${hostname}:${port}`);
  });

  // Graceful shutdown — finishes in-flight requests, lets Socket.IO
  // notify clients to reconnect somewhere new.
  for (const sig of ["SIGTERM", "SIGINT"] as const) {
    process.on(sig, () => {
      console.log(`${sig} received, shutting down`);
      io.close();
      httpServer.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5_000).unref();
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
