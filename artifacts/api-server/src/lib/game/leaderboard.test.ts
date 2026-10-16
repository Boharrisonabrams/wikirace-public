import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  authHeader: vi.fn(),
  deleteUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  user: null as null | { id: string; is_anonymous?: boolean },
}));

vi.mock("../supabase", () => ({
  createSupabaseClient: (authHeader?: string) => {
    supabaseMocks.authHeader(authHeader);
    return { rpc: supabaseMocks.rpc };
  },
  createServiceClient: () => ({
    auth: { admin: { deleteUser: supabaseMocks.deleteUser } },
    from: supabaseMocks.from,
  }),
  getRequestUser: async () => supabaseMocks.user,
}));

import { createApp } from "../../app";
import { parseBoard } from "./leaderboard";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const CHALLENGE_ID = "00000000-0000-0000-0000-000000000002";

afterEach(() => {
  supabaseMocks.authHeader.mockReset();
  supabaseMocks.deleteUser.mockReset();
  supabaseMocks.from.mockReset();
  supabaseMocks.rpc.mockReset();
  supabaseMocks.user = { id: USER_ID, is_anonymous: false };
});

async function requestApi(path: string, init?: RequestInit): Promise<Response> {
  const server = createApp().listen(0);
  try {
    const address = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${address.port}/api${path}`, init);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("parseBoard", () => {
  it("defaults a missing board to shortest for existing clients", () => {
    expect(parseBoard(undefined)).toBe("shortest");
  });

  it("accepts either explicit Daily board", () => {
    expect(parseBoard("shortest")).toBe("shortest");
    expect(parseBoard("fastest")).toBe("fastest");
  });

  it("rejects every unsupported value", () => {
    for (const value of ["combined", "", null, ["shortest"]]) {
      expect(() => parseBoard(value)).toThrow("Invalid board");
    }
  });
});

describe("GET /api/leaderboard/daily", () => {
  it("defaults to Shortest and returns both v2 rank fields", async () => {
    supabaseMocks.user = null;
    const row = {
      rank: 1,
      shortest_rank: 1,
      fastest_rank: 2,
      user_id: USER_ID,
      username: "player_one",
      display_name: "Player One",
      avatar_url: null,
      clicks: 3,
      time_seconds: 90,
      active_time_ms: 90_000,
      completed_at: "2026-07-10T12:00:00.000Z",
    };
    supabaseMocks.rpc.mockResolvedValue({ data: [row], error: null });

    const response = await requestApi(`/leaderboard/daily?challengeId=${CHALLENGE_ID}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      board: "shortest",
      leaderboard: [row],
    });
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_daily_leaderboard_v2", {
      p_challenge_id: CHALLENGE_ID,
      p_board: "shortest",
      p_limit: 50,
      p_offset: 0,
      p_friends_only: false,
    });
  });

  it("omits finisher paths until the caller has completed the same daily", async () => {
    const row = {
      rank: 1,
      shortest_rank: 1,
      fastest_rank: 1,
      user_id: "00000000-0000-0000-0000-000000000020",
      username: "player_one",
      display_name: "Player One",
      avatar_url: null,
      clicks: 3,
      time_seconds: 90,
      active_time_ms: 90_000,
      completed_at: "2026-07-25T12:00:00.000Z",
    };
    const eligibilityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    eligibilityQuery.select.mockReturnValue(eligibilityQuery);
    eligibilityQuery.eq.mockReturnValue(eligibilityQuery);
    eligibilityQuery.limit.mockReturnValue(eligibilityQuery);
    eligibilityQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    supabaseMocks.rpc.mockResolvedValue({ data: [row], error: null });
    supabaseMocks.from.mockReturnValue(eligibilityQuery);

    const response = await requestApi(`/leaderboard/daily?challengeId=${CHALLENGE_ID}`, {
      headers: { authorization: "Bearer permanent-user-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      board: "shortest",
      leaderboard: [row],
    });
  });

  it("reveals daily finisher paths after the caller wins that same daily", async () => {
    const row = {
      rank: 1,
      shortest_rank: 1,
      fastest_rank: 1,
      user_id: "00000000-0000-0000-0000-000000000020",
      username: "player_one",
      display_name: "Player One",
      avatar_url: null,
      clicks: 3,
      time_seconds: 90,
      active_time_ms: 90_000,
      completed_at: "2026-07-25T12:00:00.000Z",
    };
    const eligibilityQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    eligibilityQuery.select.mockReturnValue(eligibilityQuery);
    eligibilityQuery.eq.mockReturnValue(eligibilityQuery);
    eligibilityQuery.limit.mockReturnValue(eligibilityQuery);
    eligibilityQuery.maybeSingle.mockResolvedValue({
      data: { id: "session-1" },
      error: null,
    });

    const pathQuery = Promise.resolve({
      data: [
        {
          user_id: "00000000-0000-0000-0000-000000000020",
          clicks: 3,
          time_seconds: 90,
          completed_at: "2026-07-25T12:00:00.000Z",
          start_article: "Earth",
          game_moves: [
            { move_number: 1, to_article: "Orbit" },
            { move_number: 2, to_article: "Lunar orbit" },
            { move_number: 3, to_article: "Moon" },
          ],
        },
      ],
      error: null,
    }) as Promise<unknown> & {
      eq: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      select: ReturnType<typeof vi.fn>;
    };
    pathQuery.select = vi.fn();
    pathQuery.in = vi.fn();
    pathQuery.eq = vi.fn();
    pathQuery.select.mockReturnValue(pathQuery);
    pathQuery.in.mockReturnValue(pathQuery);
    pathQuery.eq.mockReturnValue(pathQuery);

    const queries = [eligibilityQuery, pathQuery];
    supabaseMocks.rpc.mockResolvedValue({ data: [row], error: null });
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const response = await requestApi(`/leaderboard/daily?challengeId=${CHALLENGE_ID}`, {
      headers: { authorization: "Bearer permanent-user-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      board: "shortest",
      leaderboard: [
        {
          ...row,
          path: ["Earth", "Orbit", "Lunar orbit", "Moon"],
        },
      ],
    });
    expect(pathQuery.in).toHaveBeenCalledWith("user_id", ["00000000-0000-0000-0000-000000000020"]);
  });

  it("selects Fastest while preserving caller auth for friends filtering", async () => {
    supabaseMocks.user = null;
    supabaseMocks.rpc.mockResolvedValue({ data: [], error: null });

    const response = await requestApi(
      `/leaderboard/daily?challengeId=${CHALLENGE_ID}&board=fastest&friendsOnly=true&limit=500&offset=7`,
      { headers: { authorization: "Bearer permanent-user-token" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      board: "fastest",
      leaderboard: [],
    });
    expect(supabaseMocks.authHeader).toHaveBeenCalledWith("Bearer permanent-user-token");
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("get_daily_leaderboard_v2", {
      p_challenge_id: CHALLENGE_ID,
      p_board: "fastest",
      p_limit: 100,
      p_offset: 7,
      p_friends_only: true,
    });
  });

  it("rejects an invalid board before calling the database", async () => {
    const response = await requestApi(
      `/leaderboard/daily?challengeId=${CHALLENGE_ID}&board=combined`
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid board" });
    expect(supabaseMocks.rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/claim", () => {
  it("rejects a JWT whose authenticated identity is still anonymous", async () => {
    supabaseMocks.user = { id: USER_ID, is_anonymous: true };

    const response = await requestApi("/profile/claim", {
      method: "POST",
      headers: {
        authorization: "Bearer anonymous-user-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: "00000000-0000-0000-0000-000000000099" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Identity is still anonymous",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("claims only the authenticated permanent identity", async () => {
    const attackerChosenId = "00000000-0000-0000-0000-000000000099";
    supabaseMocks.user = { id: USER_ID, is_anonymous: false };
    const claimQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    claimQuery.update.mockReturnValue(claimQuery);
    claimQuery.eq.mockReturnValue(claimQuery);
    claimQuery.select.mockReturnValue(claimQuery);
    claimQuery.maybeSingle.mockResolvedValue({
      data: { id: USER_ID },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(claimQuery);

    const response = await requestApi("/profile/claim", {
      method: "POST",
      headers: {
        authorization: "Bearer permanent-user-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: attackerChosenId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ claimed: true });
    expect(supabaseMocks.from).toHaveBeenCalledWith("profiles");
    expect(claimQuery.update).toHaveBeenCalledWith({
      claimed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(claimQuery.eq).toHaveBeenCalledWith("id", USER_ID);
    expect(claimQuery.eq).not.toHaveBeenCalledWith("id", attackerChosenId);
  });
});

describe("GET /api/profile/me", () => {
  it("returns claimed status and official Daily statistics without replay inflation", async () => {
    supabaseMocks.user = { id: USER_ID, is_anonymous: false };
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.maybeSingle.mockResolvedValue({
      data: {
        id: USER_ID,
        username: "player_one",
        display_name: "Player One",
        friend_code: "ABC123",
        avatar_url: null,
        claimed_at: "2026-07-10T12:00:00.000Z",
      },
      error: null,
    });

    const statsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsQuery.select.mockReturnValue(statsQuery);
    statsQuery.eq.mockReturnValue(statsQuery);
    statsQuery.maybeSingle.mockResolvedValue({
      data: {
        games_played: 99,
        games_won: 99,
        total_clicks: 99,
        total_time_seconds: 99,
        current_streak: 4,
        longest_streak: 9,
        last_daily_completed: "2026-07-10",
      },
      error: null,
    });

    const officialSessions = [
      { won: true, clicks: 3, time_seconds: 90, active_time_ms: 90_000 },
      { won: true, clicks: 5, time_seconds: 30, active_time_ms: "30000" },
      { won: false, clicks: 1, time_seconds: 10, active_time_ms: 10_000 },
    ];
    const sessionsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    sessionsQuery.select.mockReturnValue(sessionsQuery);
    sessionsQuery.eq
      .mockReturnValueOnce(sessionsQuery)
      .mockReturnValueOnce(sessionsQuery)
      .mockReturnValueOnce(sessionsQuery)
      .mockResolvedValueOnce({ data: officialSessions, error: null });

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileQuery;
      if (table === "user_stats") return statsQuery;
      if (table === "game_sessions") return sessionsQuery;
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await requestApi("/profile/me", {
      headers: { authorization: "Bearer permanent-user-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: {
        userId: USER_ID,
        username: "player_one",
        displayName: "Player One",
        friendCode: "ABC123",
        avatarUrl: null,
        claimed: true,
        isGuest: false,
      },
      stats: {
        gamesPlayed: 3,
        gamesWon: 2,
        totalClicks: 9,
        totalTimeSeconds: 130,
        currentStreak: 4,
        longestStreak: 9,
        lastDailyCompleted: "2026-07-10",
        averageClicks: 4,
        averageActiveTimeMs: 60_000,
        bestClicks: 3,
        fastestTimeMs: 30_000,
      },
    });
    expect(sessionsQuery.eq.mock.calls).toEqual([
      ["user_id", USER_ID],
      ["challenge_type", "daily"],
      ["is_official", true],
      ["completed", true],
    ]);
  });

  it("returns a server error when the profile query fails", async () => {
    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "profile database unavailable" },
    });
    const statsQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsQuery.select.mockReturnValue(statsQuery);
    statsQuery.eq.mockReturnValue(statsQuery);
    statsQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const sessionsQuery = { select: vi.fn(), eq: vi.fn() };
    sessionsQuery.select.mockReturnValue(sessionsQuery);
    sessionsQuery.eq
      .mockReturnValueOnce(sessionsQuery)
      .mockReturnValueOnce(sessionsQuery)
      .mockReturnValueOnce(sessionsQuery)
      .mockResolvedValueOnce({ data: [], error: null });
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === "profiles") return profileQuery;
      if (table === "user_stats") return statsQuery;
      return sessionsQuery;
    });

    const response = await requestApi("/profile/me", {
      headers: { authorization: "Bearer permanent-user-token" },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to fetch profile",
    });
  });
});

describe("PATCH /api/profile/me", () => {
  it("rejects unauthenticated callers", async () => {
    supabaseMocks.user = null;

    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player_one" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("rejects too-short usernames", async () => {
    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "ab" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Username needs at least 3 characters.",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("rejects usernames with invalid characters", async () => {
    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player-one" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Username can use letters, numbers, and underscores only.",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("rejects usernames longer than 24 characters", async () => {
    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "abcdefghijklmnopqrstuvwxy" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Username must be 24 characters or fewer.",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("returns a conflict when the username is already taken", async () => {
    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    supabaseMocks.from.mockReturnValue(updateQuery);

    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "player_one" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "That username is taken",
    });
    expect(updateQuery.update).toHaveBeenCalledWith({ username: "player_one" });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", USER_ID);
  });

  it("normalizes and returns the updated profile", async () => {
    supabaseMocks.user = { id: USER_ID, is_anonymous: true };
    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.maybeSingle.mockResolvedValue({
      data: {
        id: USER_ID,
        username: "player_one",
        display_name: "Player One",
        friend_code: "ABC123",
        avatar_url: null,
        claimed_at: null,
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(updateQuery);

    const response = await requestApi("/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "  Player_One " }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: {
        userId: USER_ID,
        username: "player_one",
        displayName: "Player One",
        friendCode: "ABC123",
        avatarUrl: null,
        claimed: false,
        isGuest: true,
      },
    });
    expect(updateQuery.update).toHaveBeenCalledWith({ username: "player_one" });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", USER_ID);
  });
});

describe("DELETE /api/profile/me", () => {
  it("rejects unauthenticated deletion requests", async () => {
    supabaseMocks.user = null;

    const response = await requestApi("/profile/me", {
      method: "DELETE",
      headers: {
        authorization: "Bearer invalid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(supabaseMocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects a missing confirmation before deleting anything", async () => {
    const response = await requestApi("/profile/me", {
      method: "DELETE",
      headers: {
        authorization: "Bearer permanent-user-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "not-delete" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Account deletion confirmation is required",
    });
    expect(supabaseMocks.deleteUser).not.toHaveBeenCalled();
  });

  it("hard-deletes only the authenticated caller", async () => {
    supabaseMocks.deleteUser.mockResolvedValue({ data: {}, error: null });

    const response = await requestApi("/profile/me", {
      method: "DELETE",
      headers: {
        authorization: "Bearer permanent-user-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        confirmation: "DELETE",
        userId: "00000000-0000-0000-0000-000000000099",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });
    expect(supabaseMocks.deleteUser).toHaveBeenCalledWith(USER_ID, false);
    expect(supabaseMocks.deleteUser).not.toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000099",
      expect.anything()
    );
  });

  it("reports a server failure without claiming the account was deleted", async () => {
    supabaseMocks.deleteUser.mockResolvedValue({
      data: { user: null },
      error: { message: "auth service unavailable" },
    });

    const response = await requestApi("/profile/me", {
      method: "DELETE",
      headers: {
        authorization: "Bearer permanent-user-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to delete account",
    });
  });
});
