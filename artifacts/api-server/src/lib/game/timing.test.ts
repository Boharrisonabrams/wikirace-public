import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../supabase", () => ({
  createServiceClient: () => ({
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  }),
  getRequestUser: async () => ({
    id: "00000000-0000-0000-0000-000000000001",
    is_anonymous: false,
  }),
}));

import { createApp } from "../../app";
import { applyTimingTransition } from "./timing";

const UUID_PATTERN_FOR_TEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.useRealTimers();
  supabaseMocks.from.mockReset();
  supabaseMocks.rpc.mockReset();
});

async function postApi(path: string, body: Record<string, unknown>) {
  const server = createApp().listen(0);
  try {
    const address = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method: "POST",
      headers: {
        authorization: "Bearer local-test-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function postTiming(body: Record<string, unknown>) {
  return postApi("/game/timing", body);
}

function arrangeOfficialDailyCompletion({
  challengeDate,
  localDate,
  previousDailyDate,
  timeZone,
}: {
  challengeDate: string;
  localDate: string | null;
  previousDailyDate: string;
  timeZone: string | null;
}) {
  const sessionId = "00000000-0000-0000-0000-000000000002";
  const challengeId = "00000000-0000-0000-0000-000000000004";
  const session = {
    id: sessionId,
    user_id: "00000000-0000-0000-0000-000000000001",
    challenge_type: "daily",
    challenge_id: challengeId,
    is_official: true,
    local_date: localDate,
    timezone_at_start: timeZone,
    end_article: "End",
    path: ["Start", "End"],
    clicks: 2,
    completed: false,
    won: false,
    gave_up: false,
    time_seconds: null,
    active_time_ms: 3_000,
    active_started_at: null,
    created_at: `${challengeDate}T12:00:00.000Z`,
  };
  const initialSessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  initialSessionQuery.select.mockReturnValue(initialSessionQuery);
  initialSessionQuery.eq.mockReturnValue(initialSessionQuery);
  initialSessionQuery.single.mockResolvedValue({ data: session, error: null });

  const completedSession = {
    ...session,
    completed: true,
    won: true,
    time_seconds: 3,
    turn_path: ["Start", "Detour", "Start", "End"],
  };

  const statsQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  statsQuery.select.mockReturnValue(statsQuery);
  statsQuery.eq.mockReturnValue(statsQuery);
  statsQuery.maybeSingle.mockResolvedValue({
    data: {
      games_played: 8,
      games_won: 6,
      total_clicks: 30,
      total_time_seconds: 100,
      current_streak: 3,
      longest_streak: 5,
      last_daily_completed: previousDailyDate,
    },
    error: null,
  });

  const challengeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  challengeQuery.select.mockReturnValue(challengeQuery);
  challengeQuery.eq.mockReturnValue(challengeQuery);
  challengeQuery.single.mockResolvedValue({
    data: {
      challenge_date: challengeDate,
      difficulty: "hard",
      difficulty_source: "provisional",
    },
    error: null,
  });

  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  profileQuery.select.mockReturnValue(profileQuery);
  profileQuery.eq.mockReturnValue(profileQuery);
  profileQuery.maybeSingle.mockResolvedValue({
    data: { claimed_at: "2026-07-10T11:00:00.000Z" },
    error: null,
  });

  const statsUpsert = { upsert: vi.fn() };
  statsUpsert.upsert.mockResolvedValue({ error: null });
  const statsQueries = [statsQuery, statsUpsert];
  supabaseMocks.from.mockImplementation((table: string) => {
    if (table === "game_sessions") return initialSessionQuery;
    if (table === "user_stats") return statsQueries.shift();
    if (table === "daily_challenges") return challengeQuery;
    if (table === "profiles") return profileQuery;
    throw new Error(`Unexpected table ${table}`);
  });
  supabaseMocks.rpc.mockImplementation(async (name: string) => {
    if (name === "complete_game_session_v2") {
      return {
        data: [
          {
            did_complete: true,
            session: completedSession,
            streak: { current: 4, longest: 5, extended: true },
          },
        ],
        error: null,
      };
    }
    if (name === "get_daily_player_ranks") {
      return {
        data: [
          {
            eligible_count: 20,
            user_id: "00000000-0000-0000-0000-000000000001",
            shortest_rank: 2,
            fastest_rank: 5,
          },
        ],
        error: null,
      };
    }
    throw new Error(`Unexpected RPC ${name}`);
  });

  return { challengeId, challengeQuery, sessionId, statsUpsert };
}

describe("applyTimingTransition", () => {
  it("starts an inactive timer without accumulating time", () => {
    expect(
      applyTimingTransition({ activeTimeMs: 0, activeStartedAt: null }, "resume", 1_000)
    ).toEqual({ activeTimeMs: 0, activeStartedAt: 1_000 });
  });

  it("checkpoints active time on heartbeat", () => {
    expect(
      applyTimingTransition({ activeTimeMs: 0, activeStartedAt: 1_000 }, "heartbeat", 16_000)
    ).toEqual({ activeTimeMs: 15_000, activeStartedAt: 16_000 });
  });

  it("closes the active interval on pause", () => {
    expect(
      applyTimingTransition({ activeTimeMs: 15_000, activeStartedAt: 16_000 }, "pause", 20_000)
    ).toEqual({ activeTimeMs: 19_000, activeStartedAt: null });
  });

  it("treats duplicate resume and pause actions as no-ops", () => {
    const active = { activeTimeMs: 500, activeStartedAt: 1_000 };
    const paused = { activeTimeMs: 500, activeStartedAt: null };

    expect(applyTimingTransition(active, "resume", 2_000)).toEqual(active);
    expect(applyTimingTransition(paused, "pause", 2_000)).toEqual(paused);
  });

  it("never subtracts time when the clock moves backwards", () => {
    const active = { activeTimeMs: 500, activeStartedAt: 1_000 };

    expect(applyTimingTransition(active, "heartbeat", 500)).toEqual({
      activeTimeMs: 500,
      activeStartedAt: 500,
    });
    expect(applyTimingTransition(active, "pause", 500)).toEqual({
      activeTimeMs: 500,
      activeStartedAt: null,
    });
  });

  it("caps a delayed heartbeat to exclude unattended time", () => {
    expect(
      applyTimingTransition({ activeTimeMs: 0, activeStartedAt: 1_000 }, "heartbeat", 61_000)
    ).toEqual({ activeTimeMs: 15_000, activeStartedAt: 61_000 });
  });
});

describe("POST /api/game/timing", () => {
  it("returns the state stored by the atomic timing transition", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const eventId = "00000000-0000-0000-0000-000000000003";
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        user_id: "00000000-0000-0000-0000-000000000001",
        completed: false,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          active_time_ms: "1500",
          active_started_at: "2026-07-10T12:00:01.000Z",
          timing_version: 1,
        },
      ],
      error: null,
    });

    const response = await postTiming({
      sessionId,
      action: "resume",
      eventId,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      activeTimeMs: 1500,
      timingActive: true,
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("transition_game_timing", {
      p_session_id: sessionId,
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_action: "resume",
      p_event_id: eventId,
    });
  });

  it("forwards a repeated event ID and returns the same stored state", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const eventId = "00000000-0000-0000-0000-000000000003";
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        user_id: "00000000-0000-0000-0000-000000000001",
        completed: false,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          active_time_ms: 2_500,
          active_started_at: null,
          timing_version: 1,
        },
      ],
      error: null,
    });

    const body = { sessionId, action: "pause", eventId };
    const first = await postTiming(body);
    const second = await postTiming(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    await expect(first.json()).resolves.toEqual({
      activeTimeMs: 2_500,
      timingActive: false,
    });
    await expect(second.json()).resolves.toEqual({
      activeTimeMs: 2_500,
      timingActive: false,
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledTimes(2);
    expect(supabaseMocks.rpc.mock.calls[0]?.[1]).toEqual(supabaseMocks.rpc.mock.calls[1]?.[1]);
  });

  it("rejects an unsupported timing action before database access", async () => {
    const response = await postTiming({
      sessionId: "00000000-0000-0000-0000-000000000002",
      action: "reset",
      eventId: "00000000-0000-0000-0000-000000000003",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid timing action",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID event ID before database access", async () => {
    const response = await postTiming({
      sessionId: "00000000-0000-0000-0000-000000000002",
      action: "pause",
      eventId: "not-a-uuid",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid eventId",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a session owned by another user", async () => {
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        user_id: "00000000-0000-0000-0000-000000000099",
        completed: false,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);

    const response = await postTiming({
      sessionId: "00000000-0000-0000-0000-000000000002",
      action: "pause",
      eventId: "00000000-0000-0000-0000-000000000003",
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden" });
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a completed session", async () => {
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        user_id: "00000000-0000-0000-0000-000000000001",
        completed: true,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);

    const response = await postTiming({
      sessionId: "00000000-0000-0000-0000-000000000002",
      action: "resume",
      eventId: "00000000-0000-0000-0000-000000000003",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Game already completed",
    });
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });

  it("maps a completion race from the timing RPC to conflict", async () => {
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        user_id: "00000000-0000-0000-0000-000000000001",
        completed: false,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0002",
        message: "Owned incomplete game session not found",
      },
    });

    const response = await postTiming({
      sessionId: "00000000-0000-0000-0000-000000000002",
      action: "heartbeat",
      eventId: "00000000-0000-0000-0000-000000000003",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Game already completed",
    });
  });
});

describe("POST /api/game/navigate timing", () => {
  it("pauses timing before rejecting Back in an official Daily", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.single.mockResolvedValue({
      data: {
        id: sessionId,
        user_id: "00000000-0000-0000-0000-000000000001",
        challenge_type: "daily",
        is_official: true,
        end_article: "End",
        path: ["Start"],
        clicks: 0,
        completed: false,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(sessionQuery);
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          active_time_ms: 1_000,
          active_started_at: null,
          timing_version: 1,
        },
      ],
      error: null,
    });

    const response = await postApi("/game/navigate", {
      sessionId,
      back: true,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid move",
      reason: "Back is unavailable in an official Daily race",
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "transition_game_timing",
      expect.objectContaining({
        p_session_id: sessionId,
        p_user_id: "00000000-0000-0000-0000-000000000001",
        p_action: "pause",
        p_event_id: expect.stringMatching(UUID_PATTERN_FOR_TEST),
      })
    );
  });
});

describe("POST /api/game/complete timing", () => {
  it("closes the active segment and rounds active milliseconds", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const session = {
      id: sessionId,
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "practice",
      challenge_id: null,
      is_official: true,
      end_article: "End",
      path: ["Start", "End"],
      clicks: 1,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      active_time_ms: 1_000,
      active_started_at: "2026-07-10T12:00:00.000Z",
      created_at: "2000-01-01T00:00:00.000Z",
    };
    const initialSessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    initialSessionQuery.select.mockReturnValue(initialSessionQuery);
    initialSessionQuery.eq.mockReturnValue(initialSessionQuery);
    initialSessionQuery.single.mockResolvedValue({
      data: session,
      error: null,
    });

    const completedSession = {
      ...session,
      completed: true,
      won: true,
      time_seconds: 2,
      active_time_ms: 1_550,
      active_started_at: null,
    };
    const statsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsQuery.select.mockReturnValue(statsQuery);
    statsQuery.eq.mockReturnValue(statsQuery);
    statsQuery.maybeSingle.mockResolvedValue({
      data: {
        games_played: 0,
        games_won: 0,
        total_clicks: 0,
        total_time_seconds: 0,
        current_streak: 0,
        longest_streak: 0,
        last_daily_completed: null,
      },
      error: null,
    });

    const statsUpsert = { upsert: vi.fn() };
    statsUpsert.upsert.mockResolvedValue({ error: null });

    const statsQueries = [statsQuery, statsUpsert];
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "game_sessions") return initialSessionQuery;
      if (table === "user_stats") return statsQueries.shift();
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ did_complete: true, session: completedSession }],
      error: null,
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      won: true,
      clicks: 1,
      timeSeconds: 2,
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "complete_game_session_v2",
      expect.objectContaining({
        p_session_id: sessionId,
        p_gave_up: false,
      })
    );
    expect(statsUpsert.upsert).not.toHaveBeenCalled();
  });

  it("retries a stored completion through the atomic effects RPC", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const session = {
      id: sessionId,
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "practice",
      challenge_id: null,
      is_official: true,
      end_article: "End",
      path: ["Start", "End"],
      clicks: 1,
      completed: true,
      won: true,
      gave_up: false,
      time_seconds: 2,
      active_time_ms: 1_550,
      active_started_at: null,
      created_at: "2026-07-10T11:59:00.000Z",
    };
    const initialSessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    initialSessionQuery.select.mockReturnValue(initialSessionQuery);
    initialSessionQuery.eq.mockReturnValue(initialSessionQuery);
    initialSessionQuery.single.mockResolvedValue({
      data: session,
      error: null,
    });

    const storedSession = {
      ...session,
      completed: true,
      won: true,
      time_seconds: 2,
      active_time_ms: 1_550,
      active_started_at: null,
    };
    const statsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsQuery.select.mockReturnValue(statsQuery);
    statsQuery.eq.mockReturnValue(statsQuery);
    statsQuery.maybeSingle.mockResolvedValue({
      data: { current_streak: 3, longest_streak: 5 },
      error: null,
    });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "game_sessions") return initialSessionQuery;
      if (table === "user_stats") return statsQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ did_complete: false, session: storedSession }],
      error: null,
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      won: true,
      clicks: 1,
      timeSeconds: 2,
      streak: { current: 3, longest: 5, extended: false },
    });
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      "game_sessions",
      "user_stats",
    ]);
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("complete_game_session_v2", {
      p_session_id: sessionId,
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_gave_up: false,
    });
  });

  it("uses the stored time zone and local date across the UTC boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T10:30:00.000Z"));
    const { challengeId, challengeQuery, sessionId, statsUpsert } = arrangeOfficialDailyCompletion({
      challengeDate: "2026-07-11",
      localDate: "2026-07-11",
      previousDailyDate: "2026-07-10",
      timeZone: "Pacific/Kiritimati",
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      path: ["Start", "Detour", "Start", "End"],
      streak: { current: 4, longest: 5, extended: true },
    });
    expect(challengeQuery.eq).toHaveBeenCalledWith("id", challengeId);
    expect(statsUpsert.upsert).not.toHaveBeenCalled();
  });

  it("uses the atomic completion effect result without a second stats write", async () => {
    const { sessionId, statsUpsert } = arrangeOfficialDailyCompletion({
      challengeDate: "2026-07-10",
      localDate: "2026-07-10",
      previousDailyDate: "2026-07-09",
      timeZone: "America/Los_Angeles",
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      streak: { current: 4, longest: 5, extended: true },
    });
    expect(statsUpsert.upsert).not.toHaveBeenCalled();
  });

  it("returns server-authoritative Daily difficulty, eligibility, and dual ranks", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T10:30:00.000Z"));
    const { challengeId, sessionId } = arrangeOfficialDailyCompletion({
      challengeDate: "2026-07-10",
      localDate: "2026-07-10",
      previousDailyDate: "2026-07-09",
      timeZone: "America/Los_Angeles",
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      activeTimeMs: 3_000,
      attemptNumber: 1,
      challengeId,
      claimed: true,
      dailyDate: "2026-07-10",
      difficulty: "hard",
      difficultySource: "provisional",
      eligibleCount: 20,
      fastestRank: 5,
      isGuest: false,
      isOfficial: true,
      shortestRank: 2,
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      "get_daily_player_ranks",
      expect.objectContaining({
        p_challenge_id: challengeId,
        p_user_id: "00000000-0000-0000-0000-000000000001",
      })
    );
    expect(
      supabaseMocks.rpc.mock.calls.filter(([name]) => name === "get_daily_player_ranks")
    ).toHaveLength(1);
  });

  it("falls back to UTC when a legacy session has no stored date or zone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T10:30:00.000Z"));
    const { sessionId, statsUpsert } = arrangeOfficialDailyCompletion({
      challengeDate: "2026-07-10",
      localDate: null,
      previousDailyDate: "2026-07-09",
      timeZone: null,
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      streak: { current: 4, longest: 5, extended: true },
    });
    expect(statsUpsert.upsert).not.toHaveBeenCalled();
  });

  it("keeps an unranked replay out of official stats and streaks", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000002";
    const session = {
      id: sessionId,
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "daily",
      challenge_id: "00000000-0000-0000-0000-000000000004",
      is_official: false,
      end_article: "End",
      path: ["Start", "End"],
      clicks: 2,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      active_time_ms: 3_000,
      active_started_at: null,
      created_at: "2026-07-10T12:00:00.000Z",
    };
    const initialSessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    initialSessionQuery.select.mockReturnValue(initialSessionQuery);
    initialSessionQuery.eq.mockReturnValue(initialSessionQuery);
    initialSessionQuery.single.mockResolvedValue({
      data: session,
      error: null,
    });

    const completedSession = {
      ...session,
      completed: true,
      won: true,
      time_seconds: 3,
    };

    const statsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsQuery.select.mockReturnValue(statsQuery);
    statsQuery.eq.mockReturnValue(statsQuery);
    statsQuery.maybeSingle.mockResolvedValue({
      data: {
        games_played: 8,
        games_won: 6,
        total_clicks: 30,
        total_time_seconds: 100,
        current_streak: 4,
        longest_streak: 5,
        last_daily_completed: "2026-07-09",
      },
      error: null,
    });

    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.single.mockResolvedValue({
      data: {
        challenge_date: "2026-07-10",
        difficulty: "medium",
        difficulty_source: "provisional",
      },
      error: null,
    });
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.maybeSingle.mockResolvedValue({
      data: { claimed_at: "2026-07-10T11:00:00.000Z" },
      error: null,
    });

    let statsReads = 0;
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "game_sessions") return initialSessionQuery;
      if (table === "user_stats" && statsReads++ === 0) return statsQuery;
      if (table === "daily_challenges") return challengeQuery;
      if (table === "profiles") return profileQuery;
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          did_complete: true,
          session: completedSession,
          streak: { current: 4, longest: 5, extended: false },
        },
      ],
      error: null,
    });

    const response = await postApi("/game/complete", { sessionId });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      won: true,
      clicks: 2,
      claimed: true,
      difficulty: "medium",
      fastestRank: null,
      isOfficial: false,
      shortestRank: null,
      timeSeconds: 3,
      streak: { current: 4, longest: 5, extended: false },
    });
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      "game_sessions",
      "daily_challenges",
      "profiles",
    ]);
  });
});
