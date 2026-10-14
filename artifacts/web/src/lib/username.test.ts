import { describe, expect, it } from "vitest";

import {
  USERNAME_MAX_LENGTH,
  normalizeUsername,
  validateUsername,
} from "./username";

describe("web username validation", () => {
  it("normalizes mixed-case input before saving", () => {
    expect(normalizeUsername("  Player_One  ")).toBe("player_one");
  });

  it("matches the signup minimum length rule", () => {
    expect(validateUsername("ab")).toBe(
      "Username needs at least 3 characters.",
    );
  });

  it("rejects characters outside letters numbers and underscores", () => {
    expect(validateUsername("player-one")).toBe(
      "Username can use letters, numbers, and underscores only.",
    );
  });

  it("rejects usernames longer than the server limit", () => {
    expect(validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toBe(
      "Username must be 24 characters or fewer.",
    );
  });

  it("accepts a valid username", () => {
    expect(validateUsername("player_one")).toBeNull();
  });
});
