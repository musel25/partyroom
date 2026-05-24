import type { Socket } from "socket.io";
import type { PartyServer } from "./types";
import { getRoom, setRoom } from "../room/store";
import { applyPlay, applyPause, applySeek, applyLoadVideo } from "../room/state";
import { persistRoomState } from "../room/rehydrate";
import { broadcastRoomState } from "./broadcast";
import { parseYouTubeId } from "../youtube";
import { recordPlayHistory } from "../room/history";

const NO_OP_TOLERANCE_SEC = 1;

export function installPlaybackHandlers(io: PartyServer, socket: Socket) {
  socket.on("playback:play", ({ positionSec }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    // Idempotency: if the server already thinks we're playing and the
    // incoming position is close to the extrapolated expected position,
    // drop the event. Stops feedback loops when two clients echo the
    // same play event after a buffer-resume.
    if (s.playing) {
      const expected = s.positionSec + (Date.now() - s.updatedAt) / 1000;
      if (Math.abs(positionSec - expected) < NO_OP_TOLERANCE_SEC) return;
    }
    const next = applyPlay(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:pause", ({ positionSec }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    if (!s.playing && Math.abs(positionSec - s.positionSec) < NO_OP_TOLERANCE_SEC) return;
    const next = applyPause(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:seek", ({ positionSec }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const s = getRoom(roomId);
    if (!s) return;
    const next = applySeek(s, { positionSec }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
  });

  socket.on("playback:loadVideo", ({ videoId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!parseYouTubeId(videoId)) return; // reject anything that isn't a valid YT id
    const s = getRoom(roomId);
    if (!s) return;
    const next = applyLoadVideo(s, { videoId }, Date.now());
    setRoom(next);
    broadcastRoomState(io, roomId);
    void persistRoomState(next);
    void recordPlayHistory(roomId, videoId);
  });
}
