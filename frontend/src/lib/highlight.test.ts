import { describe, expect, it } from "vitest";
import { splitMatch } from "./highlight";

describe("splitMatch", () => {
  it("returns the whole text unmarked when the query is empty", () => {
    expect(splitMatch("Bose Headphones", "  ")).toEqual([{ text: "Bose Headphones", match: false }]);
  });

  it("marks every case-insensitive occurrence and keeps the original casing", () => {
    expect(splitMatch("Bose SoundLink, bose SoundTouch", "bose")).toEqual([
      { text: "Bose", match: true },
      { text: " SoundLink, ", match: false },
      { text: "bose", match: true },
      { text: " SoundTouch", match: false },
    ]);
  });

  it("handles a query that does not occur", () => {
    expect(splitMatch("Sony WH-1000XM5", "bose")).toEqual([{ text: "Sony WH-1000XM5", match: false }]);
  });

  it("handles a match at the very end without an empty trailing segment", () => {
    expect(splitMatch("Blender 3L", "3l")).toEqual([
      { text: "Blender ", match: false },
      { text: "3L", match: true },
    ]);
  });
});
