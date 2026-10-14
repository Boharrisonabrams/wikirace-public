import { describe, expect, it } from "vitest";

import { resolveSocialAuthVisibility } from "@/lib/social-auth-availability";

describe("web social auth availability", () => {
  it("hides unconfigured providers by default", () => {
    expect(resolveSocialAuthVisibility("web", {})).toEqual({
      apple: false,
      google: false,
      any: false,
    });
  });

  it("shows Google only when its flag is enabled", () => {
    expect(
      resolveSocialAuthVisibility("web", {
        google: "true",
      }),
    ).toEqual({
      apple: false,
      google: true,
      any: true,
    });
  });

  it("keeps Apple unavailable on web even if a future flag appears", () => {
    expect(
      resolveSocialAuthVisibility("web", {
        apple: "true",
        google: "false",
      }),
    ).toEqual({
      apple: false,
      google: false,
      any: false,
    });
  });
});
