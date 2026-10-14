import { describe, expect, it } from "vitest";

import {
  buildAuthCallbackUrl,
  nextTargetFromSearch,
  normalizeReturnPath,
} from "@/lib/auth-redirect";

describe("auth redirect helpers", () => {
  it("preserves a safe internal return path", () => {
    expect(normalizeReturnPath("/leaderboard?tab=friends")).toBe(
      "/leaderboard?tab=friends",
    );
  });

  it("rejects unsafe return targets", () => {
    expect(normalizeReturnPath("https://evil.example")).toBe("/");
    expect(normalizeReturnPath("//evil.example")).toBe("/");
    expect(normalizeReturnPath(undefined)).toBe("/");
  });

  it("reads next from the current search string", () => {
    expect(nextTargetFromSearch("?next=%2Fchallenge%2Fabc123")).toBe(
      "/challenge/abc123",
    );
    expect(nextTargetFromSearch("?next=https://evil.example")).toBe("/");
  });

  it("builds an auth callback URL that preserves next when present", () => {
    expect(
      buildAuthCallbackUrl(
        "https://wikirace.example.com",
        "/leaderboard?tab=friends",
      ),
    ).toBe(
      "https://wikirace.example.com/auth/callback?next=%2Fleaderboard%3Ftab%3Dfriends",
    );
  });

  it("omits next when the destination is the default home route", () => {
    expect(
      buildAuthCallbackUrl("https://wikirace.example.com"),
    ).toBe("https://wikirace.example.com/auth/callback");
  });
});
