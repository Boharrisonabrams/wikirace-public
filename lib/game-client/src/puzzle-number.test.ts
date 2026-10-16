import { describe, expect, it } from "vitest";

import { puzzleNumber } from "./puzzle-number";

describe("puzzle number", () => {
  it("numbers daily puzzles from the UTC launch epoch", () => {
    expect(puzzleNumber("2026-07-09")).toBe(1);
    expect(puzzleNumber("2026-07-10")).toBe(2);
  });
});

describe("web client cases", () => {
  it("numbers daily puzzles from the UTC launch epoch", () => {
    expect(puzzleNumber("2026-07-09")).toBe(1);
    expect(puzzleNumber("2026-07-10")).toBe(2);
    expect(puzzleNumber("2026-10-15")).toBe(99);
  });

  it("never numbers a puzzle below 1", () => {
    expect(puzzleNumber("2026-07-01")).toBe(1);
  });
});
