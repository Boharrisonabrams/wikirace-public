import { describe, expect, it } from "vitest";

import { formatTime, puzzleNumber } from "./game-utils";

describe("web game utilities", () => {
  it("formats whole elapsed seconds as minutes and padded seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(67)).toBe("1:07");
    expect(formatTime(600)).toBe("10:00");
  });

  it("numbers daily puzzles from the UTC launch epoch", () => {
    expect(puzzleNumber("2026-07-09")).toBe(1);
    expect(puzzleNumber("2026-07-10")).toBe(2);
    expect(puzzleNumber("2026-10-15")).toBe(99);
  });

  it("never numbers a puzzle below 1", () => {
    expect(puzzleNumber("2026-07-01")).toBe(1);
  });
});
