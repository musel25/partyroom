import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyPlay, applyPause, applySeek, applyLoadVideo } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { broadcastRoomState } from "./broadcast";

export function installPlaybackHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket,
) {
  socket.on("playback:play", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyPlay(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:pause", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyPause(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:seek", ({ positionSec }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applySeek(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:loadVideo", ({ videoId }) => {
    const roomId = socket.data.roomId as string | undefined;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyLoadVideo(s, { videoId }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });
}
