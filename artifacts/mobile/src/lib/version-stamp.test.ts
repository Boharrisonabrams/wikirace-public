import { describe, expect, it } from "vitest";

import { formatMobileVersionStamp } from "./version-stamp";

describe("formatMobileVersionStamp", () => {
  it("returns the embedded app version without an update suffix", () => {
    expect(
      formatMobileVersionStamp({
        version: "1.0.0",
        isEmbeddedLaunch: true,
        createdAt: new Date("2026-07-23T18:30:00.000Z"),
      }),
    ).toBe("v1.0.0");
  });

  it("returns the OTA update date when the launch is not embedded", () => {
    expect(
      formatMobileVersionStamp({
        version: "1.0.0",
        isEmbeddedLaunch: false,
        createdAt: new Date("2026-07-23T18:30:00.000Z"),
      }),
    ).toBe("v1.0.0 · update Jul 23");
  });

  it("falls back to the embedded-style label when update metadata is missing", () => {
    expect(
      formatMobileVersionStamp({
        version: "1.0.0",
        isEmbeddedLaunch: false,
        createdAt: null,
      }),
    ).toBe("v1.0.0");
  });
});
