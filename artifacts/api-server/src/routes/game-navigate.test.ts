import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchArticleLinks: vi.fn(async () => ["Target"]),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  getRequestUser: async () => ({
    id: "00000000-0000-0000-0000-000000000001",
  }),
}));

vi.mock("../lib/wikipedia", () => ({
  fetchArticleLinks: mocks.fetchArticleLinks,
  WikipediaUpstreamError: class WikipediaUpstreamError extends Error {},
}));

import { createApp } from "../app";

afterEach(() => {
  mocks.fetchArticleLinks.mockClear();
  mocks.from.mockReset();
  mocks.rpc.mockReset();
});

function mockSessionQuery(overrides: Record<string, unknown> = {}) {
  const sessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  const dailyChallengeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const friendChallengeQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sessionQuery.select.mockReturnValue(sessionQuery);
  sessionQuery.eq.mockReturnValue(sessionQuery);
  sessionQuery.single.mockResolvedValue({
    data: {
      id: "00000000-0000-0000-0000-000000000010",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "daily",
      is_official: true,
      challenge_id: "00000000-0000-0000-0000-000000000020",
      friend_challenge_id: null,
      end_article: "Target",
      end_article_aliases: null,
      start_description: null,
      end_description: null,
      path: ["Start"],
      clicks: 0,
      completed: false,
      ...overrides,
    },
    error: null,
  });
  dailyChallengeQuery.select.mockReturnValue(dailyChallengeQuery);
  dailyChallengeQuery.eq.mockReturnValue(dailyChallengeQuery);
  dailyChallengeQuery.maybeSingle.mockResolvedValue({
    data: {
      end_article_aliases:
        (overrides.end_article_aliases as string[] | null | undefined) ?? null,
      start_description:
        (overrides.start_description as string | null | undefined) ?? null,
      end_description:
        (overrides.end_description as string | null | undefined) ?? null,
    },
    error: null,
  });
  friendChallengeQuery.select.mockReturnValue(friendChallengeQuery);
  friendChallengeQuery.eq.mockReturnValue(friendChallengeQuery);
  friendChallengeQuery.maybeSingle.mockResolvedValue({
    data: {
      end_article_aliases:
        (overrides.end_article_aliases as string[] | null | undefined) ?? null,
      start_description:
        (overrides.start_description as string | null | undefined) ?? null,
      end_description:
        (overrides.end_description as string | null | undefined) ?? null,
    },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === "game_sessions") return sessionQuery;
    if (table === "daily_challenges") return dailyChallengeQuery;
    if (table === "friend_challenges") return friendChallengeQuery;
    throw new Error(`Non-atomic write attempted through ${table}`);
  });
  return sessionQuery;
}

async function postNavigate(body: Record<string, unknown>) {
  const server = createApp().listen(0);
  try {
    const address = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${address.port}/api/game/navigate`, {
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

describe("POST /api/game/navigate", () => {
  it("returns completed when the atomic move loses a race with Give up", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000010";
    mockSessionQuery({ id: sessionId });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "transition_game_timing") return { error: null };
      if (name === "record_game_move") {
        return {
          data: null,
          error: { code: "P0002", message: "Game already completed" },
        };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Target",
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Game already completed",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_game_move",
      expect.objectContaining({
        p_session_id: sessionId,
        p_move_number: 1,
        p_won: true,
      }),
    );
    expect(mocks.from).toHaveBeenCalledTimes(2);
  });

  it("returns 503 when wikipedia link verification fails and records nothing", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000011";
    mockSessionQuery({ id: sessionId });
    const verificationError = new Error("Wikipedia parse failed");
    verificationError.name = "WikipediaUpstreamError";
    mocks.fetchArticleLinks.mockRejectedValueOnce(verificationError);
    mocks.rpc.mockResolvedValue({ error: null });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Target",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Couldn't verify that move",
      reason: "Wikipedia didn't answer — try that link again.",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "transition_game_timing",
      expect.any(Object),
    );
  });

  it("keeps real invalid moves as 400 responses", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000012";
    mockSessionQuery({ id: sessionId });
    mocks.fetchArticleLinks.mockResolvedValueOnce(["Another page"]);
    mocks.rpc.mockResolvedValue({ error: null });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Target",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid move",
      reason: "destination is not linked from the source article",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "transition_game_timing",
      expect.any(Object),
    );
  });

  it("preserves empty successful parses as invalid moves", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000013";
    mockSessionQuery({ id: sessionId });
    mocks.fetchArticleLinks.mockResolvedValueOnce([]);
    mocks.rpc.mockResolvedValue({ error: null });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Target",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid move",
      reason: "destination is not linked from the source article",
    });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "transition_game_timing",
      expect.any(Object),
    );
  });

  it("counts a redirect alias arrival as a win", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000014";
    mockSessionQuery({
      id: sessionId,
      end_article: "Tiger",
      end_article_aliases: ["Tigers"],
    });
    mocks.fetchArticleLinks.mockResolvedValueOnce(["Tigers"]);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "transition_game_timing") return { error: null };
      if (name === "record_game_move") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Tigers",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      valid: true,
      won: true,
      currentArticle: "Tigers",
      path: ["Start", "Tigers"],
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_game_move",
      expect.objectContaining({
        p_session_id: sessionId,
        p_to_article: "Tigers",
        p_won: true,
      }),
    );
  });

  it("keeps alias-less sessions on exact-match-only wins", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000015";
    mockSessionQuery({
      id: sessionId,
      end_article: "Tiger",
      end_article_aliases: null,
    });
    mocks.fetchArticleLinks.mockResolvedValueOnce(["Tigers"]);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "transition_game_timing") return { error: null };
      if (name === "record_game_move") {
        return { data: null, error: null };
      }
      throw new Error(`Unexpected RPC: ${name}`);
    });

    const response = await postNavigate({
      sessionId,
      destinationTitle: "Tigers",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      valid: true,
      won: false,
      currentArticle: "Tigers",
      path: ["Start", "Tigers"],
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_game_move",
      expect.objectContaining({
        p_session_id: sessionId,
        p_to_article: "Tigers",
        p_won: false,
      }),
    );
  });
});
