import { describe, expect, it, vi } from "vitest";

import {
  deriveWouldBeShortestRank,
  deriveCompletionOutcome,
  loadCompletionResultContext,
  recordsOfficialDailyStats,
} from "./completion-result";

describe("completion outcome", () => {
  it("keeps Give up non-ranked even when the stored path reached the target", () => {
    expect(
      deriveCompletionOutcome({
        gaveUp: true,
        lastArticle: "Violin",
        targetArticle: "Violin",
      })
    ).toEqual({ gaveUp: true, won: false });
  });

  it("awards a win only when the stored path reaches the target", () => {
    expect(
      deriveCompletionOutcome({
        gaveUp: false,
        lastArticle: "Violin",
        targetArticle: "Violin",
      })
    ).toEqual({ gaveUp: false, won: true });
    expect(
      deriveCompletionOutcome({
        gaveUp: false,
        lastArticle: "Piano",
        targetArticle: "Violin",
      })
    ).toEqual({ gaveUp: false, won: false });
  });

  it("treats redirect aliases as additive wins", () => {
    expect(
      deriveCompletionOutcome({
        gaveUp: false,
        lastArticle: "Tigers",
        targetArticle: "Tiger",
        targetAliases: ["Tigers"],
      })
    ).toEqual({ gaveUp: false, won: true });
    expect(
      deriveCompletionOutcome({
        gaveUp: false,
        lastArticle: "Tigers",
        targetArticle: "Tiger",
      })
    ).toEqual({ gaveUp: false, won: false });
  });
});

describe("official statistics eligibility", () => {
  it("records only the official Daily attempt", () => {
    expect(recordsOfficialDailyStats({ challengeType: "daily", isOfficial: true })).toBe(true);
    expect(recordsOfficialDailyStats({ challengeType: "daily", isOfficial: false })).toBe(false);
    expect(
      recordsOfficialDailyStats({
        challengeType: "practice",
        isOfficial: true,
      })
    ).toBe(false);
    expect(recordsOfficialDailyStats({ challengeType: "friend", isOfficial: true })).toBe(false);
  });
});

describe("deriveWouldBeShortestRank", () => {
  it("places a guest between faster claimed finishers and slower ones", () => {
    expect(
      deriveWouldBeShortestRank({
        leaderboard: [
          {
            active_time_ms: 1_200,
            clicks: 2,
            completed_at: "2026-07-24T08:00:00.000Z",
          },
          {
            active_time_ms: 5_000,
            clicks: 4,
            completed_at: "2026-07-24T08:05:00.000Z",
          },
        ],
        session: {
          active_time_ms: 3_000,
          clicks: 3,
          completed_at: "2026-07-24T08:10:00.000Z",
        },
      })
    ).toBe(2);
  });

  it("drops a slower guest behind every claimed finisher ahead of it", () => {
    expect(
      deriveWouldBeShortestRank({
        leaderboard: [
          {
            active_time_ms: 1_200,
            clicks: 2,
            completed_at: "2026-07-24T08:00:00.000Z",
          },
          {
            active_time_ms: 3_000,
            clicks: 3,
            completed_at: "2026-07-24T08:05:00.000Z",
          },
        ],
        session: {
          active_time_ms: 8_000,
          clicks: 5,
          completed_at: "2026-07-24T08:10:00.000Z",
        },
      })
    ).toBe(3);
  });

  it("breaks a shortest-path tie by earlier completion time", () => {
    expect(
      deriveWouldBeShortestRank({
        leaderboard: [
          {
            active_time_ms: 1_200,
            clicks: 2,
            completed_at: "2026-07-24T08:00:00.000Z",
          },
          {
            active_time_ms: 3_000,
            clicks: 3,
            completed_at: "2026-07-24T08:05:00.000Z",
          },
        ],
        session: {
          active_time_ms: 3_000,
          clicks: 3,
          completed_at: "2026-07-24T08:10:00.000Z",
        },
      })
    ).toBe(3);
  });
});

describe("loadCompletionResultContext", () => {
  function selectQuery(method: "single" | "maybeSingle", response: unknown) {
    const query = {
      eq: vi.fn(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query[method].mockResolvedValue(response);
    return query;
  }

  it("keeps public ranks claimed-only while returning a guest-only tease", async () => {
    const dailyQuery = selectQuery("single", {
      data: {
        challenge_date: "2026-07-24",
        difficulty: "medium",
        difficulty_source: "curated",
      },
      error: null,
    });
    const profileQuery = selectQuery("maybeSingle", {
      data: { claimed_at: null },
      error: null,
    });
    const rpc = vi.fn().mockImplementation((name: string) => {
      if (name === "get_daily_leaderboard_v2") {
        return Promise.resolve({
          data: [
            {
              active_time_ms: 1_500,
              clicks: 2,
              completed_at: "2026-07-24T08:00:00.000Z",
            },
            {
              active_time_ms: 4_000,
              clicks: 4,
              completed_at: "2026-07-24T08:05:00.000Z",
            },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected RPC ${name}`);
    });
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "daily_challenges") return dailyQuery;
        if (table === "profiles") return profileQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    };

    await expect(
      loadCompletionResultContext({
        admin: admin as never,
        session: {
          active_time_ms: 3_000,
          challenge_id: "daily-1",
          challenge_type: "daily",
          clicks: 3,
          completed: true,
          completed_at: "2026-07-24T08:10:00.000Z",
          is_official: true,
          local_date: "2026-07-24",
          user_id: "guest-1",
          won: true,
        },
        user: { id: "guest-1", is_anonymous: true } as never,
      })
    ).resolves.toMatchObject({
      claimed: false,
      eligibleCount: null,
      fastestRank: null,
      isGuest: true,
      shortestRank: null,
      wouldBeShortestRank: 2,
    });

    expect(rpc).toHaveBeenCalledWith("get_daily_leaderboard_v2", {
      p_board: "shortest",
      p_challenge_id: "daily-1",
      p_friends_only: false,
      p_limit: 1000,
      p_offset: 0,
    });
    expect(rpc).not.toHaveBeenCalledWith("get_daily_player_ranks", expect.anything());
  });
});
