import type { RoomState } from "./state";
import type { Participant } from "../socket/types";

const rooms = new Map<string, RoomState>();
const participants = new Map<string, Map<string, Participant>>(); // roomId → socketId → participant

export function getRoom(roomId: string): RoomState | undefined {
  return rooms.get(roomId);
}

export function setRoom(state: RoomState): void {
  rooms.set(state.roomId, state);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  participants.delete(roomId);
}

export function listParticipants(roomId: string): Participant[] {
  const m = participants.get(roomId);
  return m ? Array.from(m.values()) : [];
}

export function addParticipant(roomId: string, p: Participant): void {
  if (!participants.has(roomId)) participants.set(roomId, new Map());
  participants.get(roomId)!.set(p.socketId, p);
}

export function removeParticipant(roomId: string, socketId: string): Participant | undefined {
  const m = participants.get(roomId);
  if (!m) return undefined;
  const p = m.get(socketId);
  m.delete(socketId);
  return p;
}
