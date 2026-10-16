import { describe, expect, it } from "vitest";

import { resolveSocialAuthVisibility } from "./social-auth-availability";

describe("social auth availability", () => {
  it("hides unconfigured providers by default", () => {
    expect(resolveSocialAuthVisibility("ios", {})).toEqual({
      apple: false,
      google: false,
      any: false,
    });
  });

  it("shows only explicitly enabled providers", () => {
    expect(
      resolveSocialAuthVisibility("ios", {
        apple: "false",
        google: "true",
      })
    ).toEqual({ apple: false, google: true, any: true });
  });

  it("offers Apple on iOS only when its flag is enabled", () => {
    expect(
      resolveSocialAuthVisibility("ios", {
        apple: "true",
        google: "false",
      })
    ).toEqual({ apple: true, google: false, any: true });
  });

  it("offers Google on web when its flag is enabled", () => {
    expect(
      resolveSocialAuthVisibility("web", {
        apple: "false",
        google: "true",
      })
    ).toEqual({ apple: false, google: true, any: true });
  });

  it("never offers native Apple sign-in outside iOS", () => {
    expect(
      resolveSocialAuthVisibility("web", {
        apple: "true",
        google: "false",
      })
    ).toEqual({ apple: false, google: false, any: false });
  });
});

describe("web client cases", () => {
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
        })
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
        })
      ).toEqual({
        apple: false,
        google: false,
        any: false,
      });
    });
  });
});
