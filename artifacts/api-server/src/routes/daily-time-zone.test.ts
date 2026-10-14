import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => ({ from: supabaseMocks.from }),
  getRequestUser: async () => null,
}));

import { createApp } from "../app";

afterEach(() => {
  supabaseMocks.from.mockReset();
});

async function getDaily(path = "/api/daily") {
  const server = createApp().listen(0);
  try {
    const address = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("GET /api/daily time zone compatibility", () => {
  it("defaults an omitted time zone to UTC for legacy clients", async () => {
    const localDate = new Date().toISOString().slice(0, 10);
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "00000000-0000-0000-0000-000000000002",
        challenge_date: localDate,
        start_article: "Start",
        end_article: "End",
        start_article_title: "Start",
        end_article_title: "End",
        start_description: "A beginning",
        end_description: "A destination",
        difficulty: "medium",
        difficulty_source: "provisional",
        generator_version: 1,
        generator_seed: "seed",
        start_topic: "science",
        end_topic: "history",
        start_recognition: "familiar",
        end_recognition: "discovery",
      },
      error: null,
    });
    supabaseMocks.from.mockReturnValue(challengeQuery);

    const response = await getDaily();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      localDate,
      challenge: {
        date: localDate,
        startDescription: "A beginning",
        endDescription: "A destination",
      },
    });
    expect(challengeQuery.eq).toHaveBeenCalledWith("challenge_date", localDate);
  });

  it("still rejects an invalid supplied time zone", async () => {
    const response = await getDaily(
      "/api/daily?timeZone=Definitely%2FNot_A_Time_Zone",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid time zone",
    });
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it.each(["+23:59", "-23:59"])(
    "rejects numeric offset %s before database access",
    async (timeZone) => {
      const response = await getDaily(
        `/api/daily?timeZone=${encodeURIComponent(timeZone)}`,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid time zone",
      });
      expect(supabaseMocks.from).not.toHaveBeenCalled();
    },
  );
});
