import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/daily-context", () => ({
  deviceTimeZone: () => "America/Los_Angeles",
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { getSession: mocks.getSession } }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("EXPO_PUBLIC_API_URL", "https://api.example.test/api");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockReset();
  mocks.getSession.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({}), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );
});

describe("mobile API Daily context", () => {
  it("sends the device IANA zone when loading the Daily", async () => {
    const { getDailyChallenge } = await import("./api");

    await getDailyChallenge();

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/daily?timeZone=America%2FLos_Angeles",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("starts a Daily replay with the device zone", async () => {
    const { startGame } = await import("./api");

    await startGame({
      challengeType: "daily",
      challengeId: "daily-1",
      replay: true,
    });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/game/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          challengeType: "daily",
          challengeId: "daily-1",
          replay: true,
          timeZone: "America/Los_Angeles",
        }),
      }),
    );
  });

  it("sends an idempotent timing transition", async () => {
    const { transitionGameTiming } = await import("./api");
    const eventId = "11111111-1111-4111-8111-111111111111";

    await transitionGameTiming({
      sessionId: "session-1",
      action: "heartbeat",
      eventId,
    });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/game/timing",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          action: "heartbeat",
          eventId,
        }),
      }),
    );
  });

  it("selects the requested independent Daily board", async () => {
    const { getDailyLeaderboard } = await import("./api");

    await getDailyLeaderboard("daily-1", true, "fastest");

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/leaderboard/daily?challengeId=daily-1&board=fastest&friendsOnly=true",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("creates a private challenge from a custom article pair", async () => {
    const { createCustomChallenge } = await import("./api");

    await createCustomChallenge({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          startArticle: "Christopher Columbus",
          endArticle: "United Nations",
          searchTier: "find",
        }),
      }),
    );
  });

  it("loads at most six Wikipedia suggestions", async () => {
    const { getWikipediaSuggestions } = await import("./api");
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ suggestions: [] }), { status: 200 }),
    );

    await getWikipediaSuggestions("castle", 99);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/wikipedia/suggestions?q=castle&limit=6",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("loads the current profile and friend relationships", async () => {
    const { getFriends, getProfile, updateUsername } = await import("./api");

    await getProfile();
    await getFriends();
    await updateUsername("player_one");

    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/api/profile/me",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/friends",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/api/profile/me",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ username: "player_one" }),
      }),
    );
  });

  it("sends and responds to friend requests", async () => {
    const { requestFriend, respondToFriendRequest } = await import("./api");

    await requestFriend(" abc123 ");
    await respondToFriendRequest("friendship-1", true);

    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/api/friends/request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ friendCode: "ABC123" }),
      }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/api/friends/respond",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ friendshipId: "friendship-1", accept: true }),
      }),
    );
  });

  it("uses the authenticated self-delete endpoint with explicit confirmation", async () => {
    const { deleteAccount } = await import("./api");

    await deleteAccount();

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.example.test/api/profile/me",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE" }),
      }),
    );
  });
});
