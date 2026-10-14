import { describe, expect, it } from "vitest";
import { isCurrentDailySessionDate, localDateForTimeZone } from "./daily-date";

describe("localDateForTimeZone", () => {
  const instant = new Date("2026-07-10T06:30:00.000Z");

  it("derives local calendar dates", () => {
    expect(localDateForTimeZone(instant, "UTC")).toBe("2026-07-10");
    expect(localDateForTimeZone(instant, "America/Los_Angeles")).toBe(
      "2026-07-09",
    );
    expect(localDateForTimeZone(instant, "Pacific/Kiritimati")).toBe(
      "2026-07-10",
    );
  });

  it.each(["+23:59", "-23:59"])(
    "rejects numeric offset %s even when Intl accepts it",
    (timeZone) => {
      expect(() => localDateForTimeZone(instant, timeZone)).toThrow(
        "Invalid time zone",
      );
    },
  );

  it("rejects an invalid IANA zone", () => {
    expect(() => localDateForTimeZone(instant, "Mars/Olympus")).toThrow(
      "Invalid time zone",
    );
  });
});

describe("isCurrentDailySessionDate", () => {
  it("keeps a Los Angeles Daily current across the adjacent UTC date", () => {
    expect(
      isCurrentDailySessionDate({
        challengeDate: "2026-07-10",
        localDate: "2026-07-10",
        timeZone: "America/Los_Angeles",
        now: new Date("2026-07-11T06:30:00.000Z"),
      }),
    ).toBe(true);
  });

  it("falls back to UTC for a legacy session without a stored zone", () => {
    const now = new Date("2026-07-11T06:30:00.000Z");
    expect(
      isCurrentDailySessionDate({
        challengeDate: "2026-07-11",
        localDate: null,
        timeZone: null,
        now,
      }),
    ).toBe(true);
    expect(
      isCurrentDailySessionDate({
        challengeDate: "2026-07-10",
        localDate: null,
        timeZone: null,
        now,
      }),
    ).toBe(false);
  });

  it("keeps the bound local date stable across a DST transition", () => {
    for (const instant of [
      "2026-03-08T09:30:00.000Z",
      "2026-03-08T10:30:00.000Z",
    ]) {
      expect(
        isCurrentDailySessionDate({
          challengeDate: "2026-03-08",
          localDate: "2026-03-08",
          timeZone: "America/Los_Angeles",
          now: new Date(instant),
        }),
      ).toBe(true);
    }
  });
});
