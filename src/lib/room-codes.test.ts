import { describe, it, expect } from "vitest";
import { generateRoomCode } from "./room-codes";

describe("generateRoomCode", () => {
  it("returns a string matching XXX-XXX with safe alphabet", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{3}$/);
  });

  it("generates distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()));
    expect(codes.size).toBe(200);
  });
});
