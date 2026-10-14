import { describe, expect, it } from "vitest";

import {
  buildLeaderboardRowPresentation,
  buildResultPresentation,
  leaderboardBoardCopy,
} from "./result-presentation";
import * as resultPresentation from "./result-presentation";
import type { GameResult, LeaderboardEntry } from "./types";

function result(overrides: Partial<GameResult> = {}): GameResult {
  return {
    clicks: 2,
    endArticle: "Violin",
    path: ["Mathematics", "Geometry", "Violin"],
    streak: null,
    timeSeconds: 67,
    won: true,
    ...overrides,
  };
}

describe("buildResultPresentation", () => {
  it("exposes a staged-response fallback resolver", () => {
    expect(typeof resultPresentation.resolveResultFallback).toBe("function");
  });

  it("keeps a legacy Daily replay unranked and claimable from route context", () => {
    const legacyReplay = result({
      fastestRank: 1,
      shortestRank: 1,
      streak: { current: 8, extended: true, longest: 8 },
    });
    const resolved = resultPresentation.resolveResultFallback(legacyReplay, {
      challengeId: "daily-1",
      claimed: false,
      dailyDate: "2026-07-10",
      isGuest: true,
      replay: true,
    });
    const presentation = buildResultPresentation(resolved, "daily");

    expect(resolved).toMatchObject({
      challengeId: "daily-1",
      claimed: false,
      dailyDate: "2026-07-10",
      isGuest: true,
      isOfficial: false,
    });
    expect(resolved.activeTimeMs).toBeUndefined();
    expect(resolved.attemptNumber).toBeUndefined();
    expect(presentation.kicker).toBe("Daily challenge · Unranked replay");
    expect(presentation.rankCards).toEqual([]);
    expect(presentation.showStreak).toBe(false);
    expect(presentation.accountAction).toEqual({
      kind: "claim",
      label: "Save your score and join the rankings",
    });
  });

  it("treats a guest-to-permanent auth return as a completed claim", () => {
    const resolved = resultPresentation.resolveResultFallback(result(), {
      claimed: false,
      currentIsGuest: false,
      isGuest: true,
      replay: false,
    });

    expect(resolved).toMatchObject({ claimed: true, isGuest: false });
    expect(buildResultPresentation(resolved, "daily").accountAction).toBeNull();
  });

  it("keeps API result fields authoritative over fallback context", () => {
    const resolved = resultPresentation.resolveResultFallback(
      result({
        challengeId: "server-daily",
        claimed: true,
        dailyDate: "2026-07-11",
        isGuest: false,
        isOfficial: true,
      }),
      {
        challengeId: "route-daily",
        claimed: false,
        currentIsGuest: false,
        dailyDate: "2026-07-10",
        isGuest: true,
        replay: true,
      },
    );

    expect(resolved).toMatchObject({
      challengeId: "server-daily",
      claimed: true,
      dailyDate: "2026-07-11",
      isGuest: false,
      isOfficial: true,
    });
  });

  it("preserves explicit API nulls instead of replacing them from a route", () => {
    const resolved = resultPresentation.resolveResultFallback(
      result({ challengeId: null, dailyDate: null }),
      { challengeId: "route-daily", dailyDate: "2026-07-10" },
    );

    expect(resolved.challengeId).toBeNull();
    expect(resolved.dailyDate).toBeNull();
  });

  it("keeps a permanent-but-unclaimed fallback eligible to finish setup", () => {
    const resolved = resultPresentation.resolveResultFallback(result(), {
      claimed: false,
      currentIsGuest: false,
      isGuest: false,
      replay: false,
    });

    expect(buildResultPresentation(resolved, "daily").accountAction).toEqual({
      kind: "finalize-profile",
      label: "Finish account setup",
    });
  });

  it("uses a daily streak for a completed daily result", () => {
    const presentation = buildResultPresentation(
      result({
        claimed: true,
        difficulty: "medium",
        eligibleCount: 20,
        fastestRank: 4,
        isGuest: false,
        isOfficial: true,
        shortestRank: 2,
        streak: { current: 4, extended: true, longest: 7 },
      }),
      "daily",
    );

    expect(presentation.kicker).toBe("Daily challenge · Official result");
    expect(presentation.headline).toBe("You reached Violin.");
    expect(presentation.detail).toBe("Mathematics → Violin");
    expect(presentation).not.toHaveProperty("difficultyLabel");
    expect(presentation.stats).toEqual([
      { label: "clicks", value: "2" },
      { label: "active time", value: "1:07" },
      { label: "day streak", value: "4" },
    ]);
    expect(presentation.rankCards).toEqual([
      {
        board: "shortest",
        champion: false,
        detail: "Top 10% · Fewest clicks, then active time",
        label: "Shortest Path",
        value: "No. 2",
      },
      {
        board: "fastest",
        champion: false,
        detail: "Top 20% · Active time, then clicks",
        label: "Fastest Solve",
        value: "No. 4",
      },
    ]);
    expect(presentation.championSweep).toBe(false);
    expect(presentation.showStreak).toBe(true);
    expect(presentation.showDailyReminder).toBe(true);
    expect(presentation.targetMissed).toBeNull();
  });

  it("celebrates an official claimed-player champion sweep", () => {
    const presentation = buildResultPresentation(
      result({
        claimed: true,
        fastestRank: 1,
        isOfficial: true,
        shortestRank: 1,
      }),
      "daily",
    );

    expect(presentation.championSweep).toBe(true);
    expect(presentation.rankCards.map((card) => card.champion)).toEqual([
      true,
      true,
    ]);
  });

  it("offers same-identity account actions to unclaimed Daily players", () => {
    expect(
      buildResultPresentation(
        result({ claimed: false, isGuest: true, isOfficial: true }),
        "daily",
      ).accountAction,
    ).toEqual({
      kind: "claim",
      label: "Save your score and join the rankings",
    });

    expect(
      buildResultPresentation(
        result({ claimed: false, isGuest: false, isOfficial: true }),
        "daily",
      ).accountAction,
    ).toEqual({
      kind: "finalize-profile",
      label: "Finish account setup",
    });
  });

  it("teases a guest's would-be place without granting a public rank card", () => {
    const presentation = buildResultPresentation(
      result({
        claimed: false,
        isGuest: true,
        isOfficial: true,
        wouldBeShortestRank: 7,
      }),
      "daily",
    );

    expect(presentation.rankCards).toEqual([]);
    expect(presentation.rankTease).toEqual({
      copy: "You'd be #7 today",
      ctaLabel: "Save your score and join the rankings",
    });
    expect(presentation.accountAction).toEqual({
      kind: "claim",
      label: "Save your score and join the rankings",
    });
  });

  it("labels replays and suppresses official streaks and ranks", () => {
    const presentation = buildResultPresentation(
      result({
        claimed: true,
        fastestRank: 1,
        isOfficial: false,
        shortestRank: 1,
        streak: { current: 8, extended: true, longest: 8 },
      }),
      "daily",
    );

    expect(presentation.kicker).toBe("Daily challenge · Unranked replay");
    expect(presentation.rankCards).toEqual([]);
    expect(presentation.championSweep).toBe(false);
    expect(presentation.showStreak).toBe(false);
    expect(presentation.showDailyReminder).toBe(false);
    expect(presentation.stats[2]).toEqual({ label: "hops", value: "2" });
  });

  it("offers reminders after any completed official Daily result", () => {
    expect(
      buildResultPresentation(result({ isOfficial: true, won: true }), "daily")
        .showDailyReminder,
    ).toBe(true);
    expect(
      buildResultPresentation(
        result({ isOfficial: true, won: false, path: ["Mathematics"] }),
        "daily",
      ).showDailyReminder,
    ).toBe(true);
    expect(
      buildResultPresentation(result({ isOfficial: false, won: true }), "daily")
        .showDailyReminder,
    ).toBe(false);
    expect(
      buildResultPresentation(
        result({ isOfficial: true, won: true }),
        "practice",
      ).showDailyReminder,
    ).toBe(false);
    expect(
      buildResultPresentation(
        result({ isOfficial: true, won: true }),
        "friend",
      ).showDailyReminder,
    ).toBe(false);
  });

  it("does not judge route difficulty when metadata is absent", () => {
    const presentation = buildResultPresentation(result(), "daily");

    expect(presentation).not.toHaveProperty("difficultyLabel");
  });

  it("uses singular click copy and hops outside daily streak results", () => {
    const presentation = buildResultPresentation(
      result({ clicks: 1, path: ["Mathematics", "Violin"] }),
      "practice",
    );

    expect(presentation.kicker).toBe("Practice run");
    expect(presentation.stats[0]).toEqual({ label: "click", value: "1" });
    expect(presentation.stats[2]).toEqual({ label: "hops", value: "1" });
  });

  it("preserves the explicit gave-up outcome", () => {
    const presentation = buildResultPresentation(
      result({ gaveUp: true, path: ["Mathematics"], won: false }),
      "daily",
    );

    expect(presentation.headline).toBe("The trail went cold.");
    expect(presentation.detail).toBe("Gave up before reaching Violin.");
    expect(presentation.targetMissed).toBe("Violin");
    expect(presentation.stats[2]).toEqual({ label: "hops", value: "0" });
  });

  it("clamps an empty route to zero hops", () => {
    const presentation = buildResultPresentation(
      result({ path: [], won: false }),
      "friend",
    );

    expect(presentation.kicker).toBe("Head-to-head");
    expect(presentation.startArticle).toBe("Start");
    expect(presentation.stats[2]).toEqual({ label: "hops", value: "0" });
  });

  it("normalizes invalid elapsed time", () => {
    const presentation = buildResultPresentation(
      result({ timeSeconds: Number.NaN }),
      "practice",
    );

    expect(presentation.stats[1]).toEqual({
      label: "active time",
      value: "0:00",
    });
  });
});

const entry: LeaderboardEntry = {
  rank: 2,
  shortest_rank: 2,
  fastest_rank: 5,
  user_id: "player-1",
  username: "trailblazer",
  display_name: "Trail Blazer",
  avatar_url: null,
  clicks: 3,
  time_seconds: 67,
  active_time_ms: 67_400,
  completed_at: "2026-07-10T12:00:00.000Z",
};

describe("Daily board presentation", () => {
  it("keeps Shortest and Fastest selection and tie-break copy independent", () => {
    expect(leaderboardBoardCopy("shortest")).toEqual({
      title: "Shortest Path",
      explanation:
        "Fewest clicks ranks first. Ties go to lower active time, then earlier finish.",
    });
    expect(leaderboardBoardCopy("fastest")).toEqual({
      title: "Fastest Solve",
      explanation:
        "Lowest active time ranks first. Ties go to fewer clicks, then earlier finish.",
    });
  });

  it("emphasizes the selected metric and exposes a complete current-user cue", () => {
    expect(buildLeaderboardRowPresentation(entry, "shortest", true)).toEqual({
      rank: 2,
      primary: "3 clicks",
      secondary: "Active 1:07",
      accessibilityLabel:
        "Rank 2. Trail Blazer, you. 3 clicks. Active time 1:07.",
    });
    expect(buildLeaderboardRowPresentation(entry, "fastest", false)).toEqual({
      rank: 5,
      primary: "Active 1:07",
      secondary: "3 clicks",
      accessibilityLabel: "Rank 5. Trail Blazer. Active time 1:07. 3 clicks.",
    });
  });

  it("keeps the staged legacy leaderboard response readable", () => {
    const legacyEntry = {
      ...entry,
      active_time_ms: undefined,
      fastest_rank: undefined,
      shortest_rank: undefined,
    } as unknown as LeaderboardEntry;

    expect(
      buildLeaderboardRowPresentation(legacyEntry, "shortest", false),
    ).toMatchObject({
      rank: 2,
      primary: "3 clicks",
      secondary: "Active 1:07",
    });
  });
});
