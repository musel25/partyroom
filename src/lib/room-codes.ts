import { randomInt } from "node:crypto";

// Avoid look-alike characters: 0/O, 1/I/L, U/V
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function group(): string {
  let s = "";
  for (let i = 0; i < 3; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export function generateRoomCode(): string {
  return `${group()}-${group()}`;
}
