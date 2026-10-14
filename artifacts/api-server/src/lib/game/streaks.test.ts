import { describe, it, expect } from "vitest";
import { computeStreakUpdate } from "./streaks";

describe("computeStreakUpdate", () => {
  it("starts a streak at 1 for a first-ever daily win", () => {
    const result = computeStreakUpdate(
      { current_streak: 0, longest_streak: 0, last_daily_completed: null },
      "2026-07-08",
    );
    expect(result).toEqual({
      current_streak: 1,
      longest_streak: 1,
      last_daily_completed: "2026-07-08",
      extended: true,
    });
  });

  it("extends the streak when yesterday's daily was won", () => {
    const result = computeStreakUpdate(
      { current_streak: 3, longest_streak: 5, last_daily_completed: "2026-07-07" },
      "2026-07-08",
    );
    expect(result.current_streak).toBe(4);
    expect(result.longest_streak).toBe(5);
    expect(result.extended).toBe(true);
  });

  it("updates longest streak when the current one passes it", () => {
    const result = computeStreakUpdate(
      { current_streak: 5, longest_streak: 5, last_daily_completed: "2026-07-07" },
      "2026-07-08",
    );
    expect(result.current_streak).toBe(6);
    expect(result.longest_streak).toBe(6);
  });

  it("resets to 1 after a missed day", () => {
    const result = computeStreakUpdate(
      { current_streak: 9, longest_streak: 9, last_daily_completed: "2026-07-05" },
      "2026-07-08",
    );
    expect(result.current_streak).toBe(1);
    expect(result.longest_streak).toBe(9);
  });

  it("is idempotent for a same-day repeat", () => {
    const result = computeStreakUpdate(
      { current_streak: 4, longest_streak: 6, last_daily_completed: "2026-07-08" },
      "2026-07-08",
    );
    expect(result.current_streak).toBe(4);
    expect(result.longest_streak).toBe(6);
    expect(result.extended).toBe(false);
  });

  it("handles month boundaries (Jul 31 -> Aug 1)", () => {
    const result = computeStreakUpdate(
      { current_streak: 2, longest_streak: 2, last_daily_completed: "2026-07-31" },
      "2026-08-01",
    );
    expect(result.current_streak).toBe(3);
  });
});
