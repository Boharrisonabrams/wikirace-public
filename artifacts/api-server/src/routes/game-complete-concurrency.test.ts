import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  getRequestUser: async () => ({
    id: "00000000-0000-0000-0000-000000000001",
    is_anonymous: false,
  }),
}));

import { createApp } from "../app";

afterEach(() => {
  mocks.from.mockReset();
  mocks.rpc.mockReset();
});

describe("POST /api/game/complete navigation race", () => {
  it("uses the locked post-navigation session returned by completion", async () => {
    const sessionId = "00000000-0000-0000-0000-000000000010";
    const staleSession = {
      id: sessionId,
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "practice",
      challenge_id: null,
      friend_challenge_id: null,
      is_official: true,
      end_article: "Target",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      active_time_ms: 1_000,
      active_started_at: null,
    };
    const completedSession = {
      ...staleSession,
      path: ["Start", "Target"],
      clicks: 1,
      completed: true,
      won: true,
      time_seconds: 1,
    };
    const initialQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    initialQuery.select.mockReturnValue(initialQuery);
    initialQuery.eq.mockReturnValue(initialQuery);
    initialQuery.single.mockResolvedValue({
      data: staleSession,
      error: null,
    });
    const statsRead = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    statsRead.select.mockReturnValue(statsRead);
    statsRead.eq.mockReturnValue(statsRead);
    statsRead.maybeSingle.mockResolvedValue({ data: null, error: null });
    const statsWrite = { upsert: vi.fn() };
    statsWrite.upsert.mockResolvedValue({ error: null });
    const statsQueries = [statsRead, statsWrite];
    mocks.from.mockImplementation((table: string) => {
      if (table === "game_sessions") return initialQuery;
      if (table === "user_stats") return statsQueries.shift();
      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name !== "complete_game_session_v2") {
        throw new Error(`Unexpected RPC: ${name}`);
      }
      return {
        data: [{ did_complete: true, session: completedSession }],
        error: null,
      };
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/game/complete`, {
        method: "POST",
        headers: {
          authorization: "Bearer local-test-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ sessionId, gaveUp: false }),
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        won: true,
        clicks: 1,
        path: ["Start", "Target"],
      });
      expect(statsWrite.upsert).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
