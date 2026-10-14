import { describe, expect, it } from "vitest";
import {
  assertDailyChallengeDate,
  insertReplayWithRetry,
} from "./daily-start";

describe("assertDailyChallengeDate", () => {
  it("accepts the challenge for the server-derived local date", () => {
    expect(() =>
      assertDailyChallengeDate("2026-07-10", "2026-07-10"),
    ).not.toThrow();
  });

  it("rejects a challenge from another local date", () => {
    expect(() =>
      assertDailyChallengeDate("2026-07-09", "2026-07-10"),
    ).toThrow("Daily challenge is not current");
  });
});

describe("insertReplayWithRetry", () => {
  it("recomputes the attempt number after a unique conflict", async () => {
    const latestAttempts = [1, 2];
    const insertedAttempts: number[] = [];

    const result = await insertReplayWithRetry({
      loadLatestAttemptNumber: async () => ({
        data: { attempt_number: latestAttempts.shift() ?? 2 },
        error: null,
      }),
      insertAttempt: async (attemptNumber) => {
        insertedAttempts.push(attemptNumber);
        if (attemptNumber === 2) {
          return {
            data: null,
            error: { code: "23505", message: "duplicate attempt" },
          };
        }
        return {
          data: { id: "replay-3", attempt_number: attemptNumber },
          error: null,
        };
      },
    });

    expect(insertedAttempts).toEqual([2, 3]);
    expect(result).toEqual({
      data: { id: "replay-3", attempt_number: 3 },
      error: null,
    });
  });

  it("stops after the bounded number of unique-conflict retries", async () => {
    let loadCount = 0;
    let insertCount = 0;

    const result = await insertReplayWithRetry({
      maxAttempts: 3,
      loadLatestAttemptNumber: async () => {
        loadCount += 1;
        return { data: { attempt_number: 1 }, error: null };
      },
      insertAttempt: async () => {
        insertCount += 1;
        return {
          data: null,
          error: { code: "23505", message: "duplicate attempt" },
        };
      },
    });

    expect(loadCount).toBe(3);
    expect(insertCount).toBe(3);
    expect(result).toEqual({
      data: null,
      error: { code: "23505", message: "duplicate attempt" },
    });
  });

  it("does not retry a non-unique insert failure", async () => {
    let loadCount = 0;
    let insertCount = 0;

    const result = await insertReplayWithRetry({
      loadLatestAttemptNumber: async () => {
        loadCount += 1;
        return { data: { attempt_number: 1 }, error: null };
      },
      insertAttempt: async () => {
        insertCount += 1;
        return {
          data: null,
          error: { code: "42501", message: "permission denied" },
        };
      },
    });

    expect(loadCount).toBe(1);
    expect(insertCount).toBe(1);
    expect(result).toEqual({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
  });
});
