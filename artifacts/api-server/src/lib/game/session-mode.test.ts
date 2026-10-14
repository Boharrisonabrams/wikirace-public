import { describe, expect, it } from "vitest";
import { sessionToJson } from "./session-json";
import {
  allowsArticleBack,
  declaredSearchTier,
  deriveDeclaredSearchTier,
  parseRequestedSearchTier,
  parseStartMode,
} from "./session-mode";

describe("article Back rules", () => {
  it("rejects Back only for an official Daily race", () => {
    expect(
      allowsArticleBack({ challengeType: "daily", isOfficial: true }),
    ).toBe(false);
    expect(
      allowsArticleBack({ challengeType: "daily", isOfficial: false }),
    ).toBe(true);
    expect(
      allowsArticleBack({ challengeType: "practice", isOfficial: true }),
    ).toBe(true);
    expect(
      allowsArticleBack({ challengeType: "friend", isOfficial: true }),
    ).toBe(true);
  });
});

describe("parseStartMode", () => {
  it("marks the first Daily start official", () => {
    expect(parseStartMode({ challengeType: "daily", replay: false })).toEqual({
      isOfficial: true,
    });
  });

  it("marks a Daily replay unranked", () => {
    expect(parseStartMode({ challengeType: "daily", replay: true })).toEqual({
      isOfficial: false,
    });
  });

  it("rejects replay outside Daily", () => {
    expect(() =>
      parseStartMode({ challengeType: "practice", replay: true }),
    ).toThrow("Replay is daily-only");
  });
});

describe("declaredSearchTier", () => {
  it("search tier hold: all sessions declare palette until find perf fix", () => {
    expect(
      declaredSearchTier({
        challengeType: "daily",
        isOfficial: true,
      }),
    ).toBe("palette");
    expect(
      declaredSearchTier({
        challengeType: "practice",
        isOfficial: true,
      }),
    ).toBe("palette");
    expect(
      declaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: null,
      }),
    ).toBe("palette");
    expect(
      declaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: "palette",
      }),
    ).toBe("palette");
    expect(
      declaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: "find",
      }),
    ).toBe("palette");
    expect(
      declaredSearchTier({
        challengeType: "daily",
        isOfficial: false,
      }),
    ).toBe("palette");
  });

  it("underlying search tier derivation still matches the approved per-mode values when hold is off", () => {
    expect(
      deriveDeclaredSearchTier({
        challengeType: "daily",
        isOfficial: true,
      }),
    ).toBe("find");
    expect(
      deriveDeclaredSearchTier({
        challengeType: "practice",
        isOfficial: true,
      }),
    ).toBe("palette");
    expect(
      deriveDeclaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: null,
      }),
    ).toBeUndefined();
    expect(
      deriveDeclaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: "palette",
      }),
    ).toBe("palette");
    expect(
      deriveDeclaredSearchTier({
        challengeType: "friend",
        isOfficial: true,
        friendSearchTier: "find",
      }),
    ).toBe("find");
    expect(
      deriveDeclaredSearchTier({
        challengeType: "daily",
        isOfficial: false,
      }),
    ).toBe("palette");
  });

  it("defaults a requested friend challenge tier to find-only", () => {
    expect(parseRequestedSearchTier(undefined)).toBe("find");
    expect(parseRequestedSearchTier("palette")).toBe("palette");
    expect(() => parseRequestedSearchTier("invalid")).toThrow(
      "Invalid searchTier",
    );
  });
});

describe("sessionToJson Daily attempt metadata", () => {
  it("serializes official attempt and timing fields", () => {
    const session = sessionToJson({
      id: "session-id",
      challenge_type: "daily",
      challenge_id: "challenge-id",
      start_article: "Start_article",
      end_article: "End_article",
      path: ["Start_article"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: "2026-07-10T12:00:00.000Z",
      completed_at: null,
      attempt_number: 2,
      is_official: false,
      local_date: "2026-07-10",
      timezone_at_start: "America/Los_Angeles",
      active_time_ms: "1500",
      active_started_at: "2026-07-10T12:00:01.000Z",
      start_description: "A beginning",
      end_description: "A destination",
    });

    expect(session).toMatchObject({
      attemptNumber: 2,
      isOfficial: false,
      searchTier: "palette",
      localDate: "2026-07-10",
      timeZone: "America/Los_Angeles",
      activeTimeMs: 1500,
      timingActive: true,
      startDescription: "A beginning",
      endDescription: "A destination",
    });
  });

  it("keeps legacy rows backward compatible", () => {
    const session = sessionToJson({
      id: "session-id",
      challenge_type: "practice",
      challenge_id: null,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: "2026-07-10T12:00:00.000Z",
      completed_at: null,
    });

    expect(session).toMatchObject({
      attemptNumber: 1,
      isOfficial: true,
      searchTier: "palette",
      localDate: null,
      timeZone: null,
      activeTimeMs: 0,
      timingActive: false,
    });
  });

  it("includes a friend challenge tier when the challenge row declares one", () => {
    const session = sessionToJson({
      id: "session-id",
      challenge_type: "friend",
      challenge_id: null,
      friend_challenge_id: "friend-id",
      search_tier: "find",
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: "2026-07-10T12:00:00.000Z",
      completed_at: null,
    });

    expect(session.searchTier).toBe("palette");
  });
});
