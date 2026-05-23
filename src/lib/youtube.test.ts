import { describe, it, expect } from "vitest";
import { parseYouTubeId } from "./youtube";

describe("parseYouTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=10s", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("extracts id from %s", (input, expected) => {
    expect(parseYouTubeId(input)).toBe(expected);
  });

  it.each([
    "https://example.com",
    "https://youtube.com/watch?v=tooshort",
    "https://youtube.com/watch",
    "",
    "not a url",
  ])("rejects %s", (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});
