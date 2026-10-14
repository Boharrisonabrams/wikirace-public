import { afterEach, describe, expect, it, vi } from "vitest";

import { deviceTimeZone } from "./daily-context";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deviceTimeZone", () => {
  it("uses the device IANA time zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: "America/Los_Angeles" }),
        }) as Intl.DateTimeFormat,
    );

    expect(deviceTimeZone()).toBe("America/Los_Angeles");
  });

  it("falls back to UTC when the runtime cannot resolve a time zone", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl unavailable");
    });

    expect(deviceTimeZone()).toBe("UTC");
  });
});
