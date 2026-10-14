import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  createServiceClient: () => ({ from: supabaseMocks.from }),
  getRequestUser: async () => ({ id: "00000000-0000-0000-0000-000000000001" }),
}));

import { createApp } from "../app";

afterEach(() => {
  supabaseMocks.from.mockReset();
});

describe("POST /api/game/start Daily challenge date", () => {
  it("defaults an omitted time zone to UTC for legacy clients", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000002";
    const localDate = new Date().toISOString().slice(0, 10);
    const existingOfficial = {
      id: "00000000-0000-0000-0000-000000000003",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "daily",
      challenge_id: challengeId,
      friend_challenge_id: null,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: `${localDate}T12:00:00.000Z`,
      completed_at: null,
      attempt_number: 1,
      is_official: true,
      local_date: localDate,
      timezone_at_start: "UTC",
      active_time_ms: 0,
      active_started_at: null,
    };

    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.single.mockResolvedValue({
      data: {
        id: challengeId,
        challenge_date: localDate,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });

    const officialQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    officialQuery.select.mockReturnValue(officialQuery);
    officialQuery.eq.mockReturnValue(officialQuery);
    officialQuery.maybeSingle.mockResolvedValue({
      data: existingOfficial,
      error: null,
    });

    const queries = [challengeQuery, officialQuery];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ challengeType: "daily", challengeId }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: { id: existingOfficial.id, timeZone: "UTC" },
        resumed: true,
      });
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("persists the UTC fallback on a new legacy-client session", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000002";
    const localDate = new Date().toISOString().slice(0, 10);
    const insertedSession = {
      id: "00000000-0000-0000-0000-000000000003",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "daily",
      challenge_id: challengeId,
      friend_challenge_id: null,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: `${localDate}T12:00:00.000Z`,
      completed_at: null,
      attempt_number: 1,
      is_official: true,
      local_date: localDate,
      timezone_at_start: "UTC",
      active_time_ms: 0,
      active_started_at: null,
    };
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.single.mockResolvedValue({
      data: {
        id: challengeId,
        challenge_date: localDate,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const officialQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    officialQuery.select.mockReturnValue(officialQuery);
    officialQuery.eq.mockReturnValue(officialQuery);
    officialQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValue({
      data: insertedSession,
      error: null,
    });
    const queries = [challengeQuery, officialQuery, insertQuery];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ challengeType: "daily", challengeId }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: {
          id: insertedSession.id,
          localDate,
          timeZone: "UTC",
        },
      });
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          local_date: localDate,
          timezone_at_start: "UTC",
        }),
      );
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("attributes a shared Daily attempt to the accepted invite", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000002";
    const sharedChallengeId = "00000000-0000-0000-0000-000000000099";
    const localDate = new Date().toISOString().slice(0, 10);
    const dailyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    dailyQuery.select.mockReturnValue(dailyQuery);
    dailyQuery.eq.mockReturnValue(dailyQuery);
    dailyQuery.single.mockResolvedValue({
      data: {
        id: challengeId,
        challenge_date: localDate,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const sharedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    sharedQuery.select.mockReturnValue(sharedQuery);
    sharedQuery.eq.mockReturnValue(sharedQuery);
    sharedQuery.maybeSingle.mockResolvedValue({
      data: {
        id: sharedChallengeId,
        challenge_type: "daily",
        daily_challenge_id: challengeId,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const officialQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    officialQuery.select.mockReturnValue(officialQuery);
    officialQuery.eq.mockReturnValue(officialQuery);
    officialQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValue({
      data: {
        id: "00000000-0000-0000-0000-000000000003",
        user_id: "00000000-0000-0000-0000-000000000001",
        challenge_type: "daily",
        challenge_id: challengeId,
        friend_challenge_id: sharedChallengeId,
        start_article: "Start",
        end_article: "End",
        path: ["Start"],
        clicks: 0,
        completed: false,
        won: false,
        gave_up: false,
        time_seconds: null,
        created_at: `${localDate}T12:00:00.000Z`,
        completed_at: null,
        attempt_number: 1,
        is_official: true,
        local_date: localDate,
        timezone_at_start: "UTC",
        active_time_ms: 0,
        active_started_at: null,
      },
      error: null,
    });
    const queries = [dailyQuery, sharedQuery, officialQuery, insertQuery];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "daily",
            challengeId,
            friendChallengeId: "daily12345",
            timeZone: "UTC",
          }),
        },
      );

      expect(response.status).toBe(200);
      expect(insertQuery.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge_id: challengeId,
          friend_challenge_id: sharedChallengeId,
        }),
      );
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects an invite that does not belong to the requested Daily", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000002";
    const localDate = new Date().toISOString().slice(0, 10);
    const dailyQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    dailyQuery.select.mockReturnValue(dailyQuery);
    dailyQuery.eq.mockReturnValue(dailyQuery);
    dailyQuery.single.mockResolvedValue({
      data: {
        id: challengeId,
        challenge_date: localDate,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const sharedQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    sharedQuery.select.mockReturnValue(sharedQuery);
    sharedQuery.eq.mockReturnValue(sharedQuery);
    sharedQuery.maybeSingle.mockResolvedValue({
      data: {
        id: "00000000-0000-0000-0000-000000000099",
        challenge_type: "daily",
        daily_challenge_id: "00000000-0000-0000-0000-000000000088",
        start_article_title: "Wrong start",
        end_article_title: "Wrong end",
      },
      error: null,
    });
    const queries = [dailyQuery, sharedQuery];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "daily",
            challengeId,
            friendChallengeId: "wrongdaily",
            timeZone: "UTC",
          }),
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Shared challenge does not match this Daily",
      });
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("still rejects an invalid supplied time zone", async () => {
    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "daily",
            challengeId: "00000000-0000-0000-0000-000000000002",
            timeZone: "Definitely/Not_A_Time_Zone",
          }),
        },
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid time zone",
      });
      expect(supabaseMocks.from).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it.each(["+23:59", "-23:59"])(
    "rejects numeric offset %s before database access",
    async (timeZone) => {
      const server = createApp().listen(0);
      try {
        const address = server.address() as AddressInfo;
        const response = await fetch(
          `http://127.0.0.1:${address.port}/api/game/start`,
          {
            method: "POST",
            headers: {
              authorization: "Bearer local-test-token",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              challengeType: "daily",
              challengeId: "00000000-0000-0000-0000-000000000002",
              timeZone,
            }),
          },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
          error: "Invalid time zone",
        });
        expect(supabaseMocks.from).not.toHaveBeenCalled();
      } finally {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    },
  );

  it("rejects a stale challenge before reading or creating a session", async () => {
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.single.mockResolvedValue({
      data: {
        id: "00000000-0000-0000-0000-000000000002",
        challenge_date: "1900-01-01",
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    supabaseMocks.from.mockImplementation((table: string) => {
      if (table !== "daily_challenges") {
        throw new Error(`Unexpected session access through ${table}`);
      }
      return challengeQuery;
    });

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "daily",
            challengeId: "00000000-0000-0000-0000-000000000002",
            timeZone: "UTC",
          }),
        },
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        error: "Daily challenge is not current",
      });
      expect(supabaseMocks.from).toHaveBeenCalledTimes(1);
      expect(supabaseMocks.from).toHaveBeenCalledWith("daily_challenges");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("re-reads the existing official after an insert conflict", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000002";
    const localDate = new Date().toISOString().slice(0, 10);
    const existingOfficial = {
      id: "00000000-0000-0000-0000-000000000003",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "daily",
      challenge_id: challengeId,
      friend_challenge_id: null,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      created_at: `${localDate}T12:00:00.000Z`,
      completed_at: null,
      attempt_number: 1,
      is_official: true,
      local_date: localDate,
      timezone_at_start: "UTC",
      active_time_ms: 0,
      active_started_at: null,
    };

    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.single.mockResolvedValue({
      data: {
        id: challengeId,
        challenge_date: localDate,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });

    const initialOfficialQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    initialOfficialQuery.select.mockReturnValue(initialOfficialQuery);
    initialOfficialQuery.eq.mockReturnValue(initialOfficialQuery);
    initialOfficialQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const conflictingInsert = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    conflictingInsert.insert.mockReturnValue(conflictingInsert);
    conflictingInsert.select.mockReturnValue(conflictingInsert);
    conflictingInsert.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate official" },
    });

    const officialReread = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    officialReread.select.mockReturnValue(officialReread);
    officialReread.eq.mockReturnValue(officialReread);
    officialReread.maybeSingle.mockResolvedValue({
      data: existingOfficial,
      error: null,
    });

    const queries = [
      challengeQuery,
      initialOfficialQuery,
      conflictingInsert,
      officialReread,
    ];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "daily",
            challengeId,
            timeZone: "UTC",
          }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: {
          id: existingOfficial.id,
          attemptNumber: 1,
          isOfficial: true,
        },
        resumed: true,
        alreadyCompleted: false,
      });
      expect(queries).toHaveLength(0);
      expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
        "daily_challenges",
        "game_sessions",
        "game_sessions",
        "game_sessions",
      ]);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("resumes a friend challenge by its resolved UUID when started from a short code", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000099";
    const existingSession = {
      id: "00000000-0000-0000-0000-000000000098",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "friend",
      challenge_id: null,
      friend_challenge_id: challengeId,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      completed_at: null,
    };
    const challengeQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi.fn(),
    };
    challengeQuery.select.mockReturnValue(challengeQuery);
    challengeQuery.eq.mockReturnValue(challengeQuery);
    challengeQuery.maybeSingle.mockResolvedValue({
      data: {
        id: challengeId,
        short_code: "abc123def4",
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const sessionQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn(),
    };
    sessionQuery.select.mockReturnValue(sessionQuery);
    sessionQuery.eq.mockReturnValue(sessionQuery);
    sessionQuery.order.mockReturnValue(sessionQuery);
    sessionQuery.limit.mockReturnValue(sessionQuery);
    sessionQuery.maybeSingle.mockResolvedValue({
      data: existingSession,
      error: null,
    });
    const queries = [challengeQuery, sessionQuery];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "friend",
            friendChallengeId: "abc123def4",
          }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: { id: existingSession.id },
        resumed: true,
      });
      expect(sessionQuery.eq).toHaveBeenCalledWith(
        "friend_challenge_id",
        challengeId,
      );
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("re-reads a shared attempt after a concurrent insert conflict", async () => {
    const challengeId = "00000000-0000-0000-0000-000000000099";
    const existingSession = {
      id: "00000000-0000-0000-0000-000000000097",
      user_id: "00000000-0000-0000-0000-000000000001",
      challenge_type: "friend",
      challenge_id: null,
      friend_challenge_id: challengeId,
      start_article: "Start",
      end_article: "End",
      path: ["Start"],
      clicks: 0,
      completed: false,
      won: false,
      gave_up: false,
      time_seconds: null,
      completed_at: null,
    };
    function selectQuery(result: unknown) {
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        limit: vi.fn(),
        maybeSingle: vi.fn(),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.order.mockReturnValue(query);
      query.limit.mockReturnValue(query);
      query.maybeSingle.mockResolvedValue(result);
      return query;
    }
    const challengeQuery = selectQuery({
      data: {
        id: challengeId,
        start_article_title: "Start",
        end_article_title: "End",
      },
      error: null,
    });
    const initialLookup = selectQuery({ data: null, error: null });
    const conflictingInsert = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    conflictingInsert.insert.mockReturnValue(conflictingInsert);
    conflictingInsert.select.mockReturnValue(conflictingInsert);
    conflictingInsert.single.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate shared attempt" },
    });
    const reread = selectQuery({ data: existingSession, error: null });
    const queries = [challengeQuery, initialLookup, conflictingInsert, reread];
    supabaseMocks.from.mockImplementation(() => queries.shift());

    const server = createApp().listen(0);
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/game/start`,
        {
          method: "POST",
          headers: {
            authorization: "Bearer local-test-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            challengeType: "friend",
            friendChallengeId: "abc123def4",
          }),
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        session: { id: existingSession.id },
        resumed: true,
        alreadyCompleted: false,
      });
      expect(reread.eq).toHaveBeenCalledWith(
        "friend_challenge_id",
        challengeId,
      );
      expect(queries).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
