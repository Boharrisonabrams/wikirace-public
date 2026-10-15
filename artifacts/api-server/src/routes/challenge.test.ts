import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchArticleDescription: vi.fn(async () => null),
  fetchArticleRedirectAliases: vi.fn(async () => []),
  from: vi.fn(),
  resolveArticle: vi.fn(async (title: string) => title),
  rpc: vi.fn(),
  user: {
    id: "00000000-0000-0000-0000-000000000001",
  } as { id: string } | null,
}));

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  createSupabaseClient: () => ({ rpc: mocks.rpc }),
  getRequestUser: async () => mocks.user,
}));

vi.mock("../lib/wikipedia", () => ({
  fetchArticleDescription: mocks.fetchArticleDescription,
  fetchArticleRedirectAliases: mocks.fetchArticleRedirectAliases,
  resolveArticle: mocks.resolveArticle,
}));

import { createApp } from "../app";

/** Shape of the GET /api/challenge/:id response fields these tests read. */
type ChallengeResultsBody = { results: Array<Record<string, unknown>> };

afterEach(() => {
  mocks.from.mockReset();
  mocks.fetchArticleDescription.mockClear();
  mocks.fetchArticleRedirectAliases.mockClear();
  mocks.resolveArticle.mockClear();
  mocks.rpc.mockReset();
  mocks.user = {
    id: "00000000-0000-0000-0000-000000000001",
  };
});

describe("challenge API compatibility", () => {
  it("keeps the legacy challenge id while adding an opaque code", async () => {
    const challenge = {
      id: "00000000-0000-0000-0000-000000000099",
      short_code: "abc123def4",
      challenge_type: "friend",
      daily_challenge_id: null,
      start_article: "Start",
      end_article: "End",
      start_article_title: "Start",
      end_article_title: "End",
      start_description: "A beginning",
      end_description: "A destination",
      created_at: "2026-07-10T00:00:00.000Z",
    };
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValue({ data: challenge, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "friend_challenges") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return insertQuery;
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/challenge`, {
        method: "POST",
        headers: {
          authorization: "Bearer local-test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startArticle: "Start",
          endArticle: "End",
        }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        challenge: {
          id: challenge.id,
          code: challenge.short_code,
          startDescription: "A beginning",
          endDescription: "A destination",
          url: `https://wikirace.example.com/challenge/${challenge.short_code}`,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects aliases that resolve to the same canonical article", async () => {
    mocks.resolveArticle.mockResolvedValueOnce("United States");
    mocks.resolveArticle.mockResolvedValueOnce("United States");
    mocks.from.mockImplementation(() => {
      throw new Error("Challenge insert must not run for an identical pair");
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/challenge`, {
        method: "POST",
        headers: {
          authorization: "Bearer local-test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startArticle: "USA",
          endArticle: "United States",
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Start and end must be different articles",
      });
      expect(mocks.from).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("creates a challenge when alias lookup contributes no aliases", async () => {
    const challenge = {
      id: "00000000-0000-0000-0000-000000000100",
      short_code: "abc123def4",
      challenge_type: "friend",
      daily_challenge_id: null,
      start_article: "Start",
      end_article: "Target",
      start_article_title: "Start",
      end_article_title: "Target",
      end_article_aliases: [],
      created_at: "2026-07-10T00:00:00.000Z",
    };
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValue({ data: challenge, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table !== "friend_challenges") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return insertQuery;
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/challenge`, {
        method: "POST",
        headers: {
          authorization: "Bearer local-test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startArticle: "Start",
          endArticle: "Target",
        }),
      });

      expect(response.status).toBe(200);
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          end_article_aliases: [],
        })
      );
      await expect(response.json()).resolves.toMatchObject({
        challenge: {
          id: challenge.id,
          code: challenge.short_code,
        },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("keeps challenge-result payloads route-free until the caller has finished", async () => {
    const challenge = {
      id: "00000000-0000-0000-0000-000000000099",
      short_code: "abc123def4",
      challenge_type: "friend",
      daily_challenge_id: null,
      creator_id: "00000000-0000-0000-0000-000000000010",
      start_article_title: "Earth",
      end_article_title: "Moon",
      created_at: "2026-07-25T00:00:00.000Z",
    };
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.maybeSingle.mockResolvedValue({ data: challenge, error: null });

    const openQuery = {
      insert: vi.fn(),
    };
    openQuery.insert.mockResolvedValue({ error: null });

    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.maybeSingle.mockResolvedValue({
      data: { username: "bo", display_name: "Bo" },
      error: null,
    });

    const mySessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    mySessionQuery.select.mockReturnValue(mySessionQuery);
    mySessionQuery.eq.mockReturnValue(mySessionQuery);
    mySessionQuery.order.mockReturnValue(mySessionQuery);
    mySessionQuery.limit.mockReturnValue(mySessionQuery);
    mySessionQuery.maybeSingle.mockResolvedValue({
      data: { completed: false, won: false, gave_up: false },
      error: null,
    });

    const queries = [challengeQuery, openQuery, profileQuery, mySessionQuery];
    mocks.from.mockImplementation(() => queries.shift());
    mocks.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          user_id: "00000000-0000-0000-0000-000000000020",
          username: "winner",
          display_name: "Winner",
          clicks: 3,
          time_seconds: 45,
          won: true,
          gave_up: false,
          path: ["Earth", "Orbit", "Moon"],
          completed_at: "2026-07-25T00:00:45.000Z",
        },
      ],
      error: null,
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/challenge/${challenge.short_code}`,
        {
          headers: { authorization: "Bearer local-test-token" },
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ChallengeResultsBody;
      expect(body.results[0]).not.toHaveProperty("path");
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("reveals every finisher path after the caller completes the challenge, even by giving up", async () => {
    const challenge = {
      id: "00000000-0000-0000-0000-000000000199",
      short_code: "finish42",
      challenge_type: "friend",
      daily_challenge_id: null,
      creator_id: "00000000-0000-0000-0000-000000000010",
      start_article_title: "Earth",
      end_article_title: "Moon",
      created_at: "2026-07-25T00:00:00.000Z",
    };
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.maybeSingle.mockResolvedValue({ data: challenge, error: null });

    const openQuery = {
      insert: vi.fn(),
    };
    openQuery.insert.mockResolvedValue({ error: null });

    const profileQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    profileQuery.select.mockReturnValue(profileQuery);
    profileQuery.eq.mockReturnValue(profileQuery);
    profileQuery.maybeSingle.mockResolvedValue({
      data: { username: "bo", display_name: "Bo" },
      error: null,
    });

    const mySessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    mySessionQuery.select.mockReturnValue(mySessionQuery);
    mySessionQuery.eq.mockReturnValue(mySessionQuery);
    mySessionQuery.order.mockReturnValue(mySessionQuery);
    mySessionQuery.limit.mockReturnValue(mySessionQuery);
    mySessionQuery.maybeSingle.mockResolvedValue({
      data: { completed: true, won: false, gave_up: true, clicks: 4, time_seconds: 65 },
      error: null,
    });

    const pathQuery = Promise.resolve({
      data: [
        {
          user_id: "00000000-0000-0000-0000-000000000001",
          clicks: 4,
          time_seconds: 65,
          completed_at: "2026-07-25T00:01:05.000Z",
          start_article: "Earth",
          game_moves: [
            { move_number: 1, to_article: "Ocean" },
            { move_number: 2, to_article: "Tide" },
          ],
        },
        {
          user_id: "00000000-0000-0000-0000-000000000020",
          clicks: 3,
          time_seconds: 45,
          completed_at: "2026-07-25T00:00:45.000Z",
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

    const queries = [challengeQuery, openQuery, profileQuery, mySessionQuery, pathQuery];
    mocks.from.mockImplementation(() => queries.shift());
    mocks.rpc.mockResolvedValue({
      data: [
        {
          rank: 1,
          user_id: "00000000-0000-0000-0000-000000000020",
          username: "winner",
          display_name: "Winner",
          clicks: 3,
          time_seconds: 45,
          won: true,
          gave_up: false,
          path: ["should", "not", "leak"],
          completed_at: "2026-07-25T00:00:45.000Z",
        },
        {
          rank: 2,
          user_id: "00000000-0000-0000-0000-000000000001",
          username: "bo",
          display_name: "Bo",
          clicks: 4,
          time_seconds: 65,
          won: false,
          gave_up: true,
          path: ["should", "not", "leak"],
          completed_at: "2026-07-25T00:01:05.000Z",
        },
      ],
      error: null,
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/challenge/${challenge.short_code}`,
        {
          headers: { authorization: "Bearer local-test-token" },
        }
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as ChallengeResultsBody;
      expect(body.results).toEqual([
        expect.objectContaining({
          username: "winner",
          path: ["Earth", "Orbit", "Lunar orbit", "Moon"],
        }),
        expect.objectContaining({
          username: "bo",
          gave_up: true,
          is_current_user: true,
          path: ["Earth", "Ocean", "Tide"],
        }),
      ]);
      expect(pathQuery.in).toHaveBeenCalledWith("user_id", [
        "00000000-0000-0000-0000-000000000020",
        "00000000-0000-0000-0000-000000000001",
      ]);
      expect(mocks.from.mock.calls.filter(([table]) => table === "game_sessions")).toHaveLength(2);
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
