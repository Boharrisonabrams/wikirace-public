import { describe, expect, it } from "vitest";

import {
  currentLocalDate,
  isCurrentDailyDate,
  isCurrentDailySessionDate,
} from "./daily-date";

describe("currentLocalDate", () => {
  it("formats the device-local civil date in the requested time zone", () => {
    expect(
      currentLocalDate(
        "America/Los_Angeles",
        new Date("2026-07-24T06:30:00.000Z"),
      ),
    ).toBe("2026-07-23");
  });
});

describe("isCurrentDailyDate", () => {
  it("accepts the current local date", () => {
    expect(
      isCurrentDailyDate("2026-07-24", {
        now: new Date("2026-07-24T18:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).toBe(true);
  });

  it("rejects a stale daily date", () => {
    expect(
      isCurrentDailyDate("2026-07-23", {
        now: new Date("2026-07-24T18:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).toBe(false);
  });

  it("handles midnight boundaries by time zone instead of UTC day", () => {
    expect(
      isCurrentDailyDate("2026-07-23", {
        now: new Date("2026-07-24T06:30:00.000Z"),
        timeZone: "America/Los_Angeles",
      }),
    ).toBe(true);
  });
});

describe("isCurrentDailySessionDate", () => {
  it("accepts a daily session from the current local date", () => {
    expect(
      isCurrentDailySessionDate(
        {
          challengeType: "daily",
          localDate: "2026-07-24",
        },
        {
          now: new Date("2026-07-24T18:00:00.000Z"),
          timeZone: "UTC",
        },
      ),
    ).toBe(true);
  });

  it("rejects a stale daily session", () => {
    expect(
      isCurrentDailySessionDate(
        {
          challengeType: "daily",
          localDate: "2026-07-23",
        },
        {
          now: new Date("2026-07-24T18:00:00.000Z"),
          timeZone: "UTC",
        },
      ),
    ).toBe(false);
  });
});
