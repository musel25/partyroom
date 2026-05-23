import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./src/lib/socket/types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: dev ? "*" : false },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("[io] connection", socket.id);
    socket.on("disconnect", (reason) => {
      console.log("[io] disconnect", socket.id, reason);
    });
  });

  httpServer.listen(port, () => {
    console.log(`partyroom ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
