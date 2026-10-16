import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveAppUrl } from "./profile-settings";

describe("profile settings links", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the placeholder host when EXPO_PUBLIC_APP_URL is unset or blank", () => {
    expect(resolveAppUrl(undefined)).toBe("https://wikirace.example.com");
    expect(resolveAppUrl(" ")).toBe("https://wikirace.example.com");
  });

  it("uses the configured origin without a trailing slash", () => {
    expect(resolveAppUrl("https://play.example.net/")).toBe(
      "https://play.example.net",
    );
  });

  it("builds the privacy and support links from EXPO_PUBLIC_APP_URL", async () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "https://play.example.net");
    vi.resetModules();

    const settings = await import("./profile-settings");

    expect(settings.PRIVACY_POLICY_URL).toBe(
      "https://play.example.net/privacy",
    );
    expect(settings.SUPPORT_URL).toBe("https://play.example.net/support");
  });

  it("keeps the placeholder links when EXPO_PUBLIC_APP_URL is unset", async () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", undefined);
    vi.resetModules();

    const settings = await import("./profile-settings");

    expect(settings.PRIVACY_POLICY_URL).toBe(
      "https://wikirace.example.com/privacy",
    );
    expect(settings.SUPPORT_URL).toBe("https://wikirace.example.com/support");
  });
});
