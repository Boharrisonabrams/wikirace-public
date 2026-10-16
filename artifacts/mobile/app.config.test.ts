import { afterEach, describe, expect, it, vi } from "vitest";

import type { ExpoConfig } from "expo/config";

import appConfig, {
  DEFAULT_APP_URL,
  DEFAULT_EAS_PROJECT_ID,
  withDeployValues,
} from "./app.config";
import app from "./app.json";

// app.json stays the static base. app.config.ts layers the deploy-specific
// values on top from the environment, with the public placeholders as
// defaults. The override values below are placeholders too.
const baseConfig = app.expo as unknown as ExpoConfig;

describe("mobile deploy values", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the public placeholders when the variables are unset", () => {
    const config = withDeployValues(baseConfig, {});

    expect(DEFAULT_APP_URL).toBe("https://wikirace.example.com");
    expect(DEFAULT_EAS_PROJECT_ID).toBe("00000000-0000-0000-0000-000000000000");
    expect(config.ios?.associatedDomains).toEqual([
      "applinks:wikirace.example.com",
      "webcredentials:wikirace.example.com",
    ]);
    expect(config.extra?.eas?.projectId).toBe(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(config.updates?.url).toBe(
      "https://u.expo.dev/00000000-0000-0000-0000-000000000000",
    );
  });

  it("treats blank variables as unset", () => {
    const config = withDeployValues(baseConfig, {
      EXPO_PUBLIC_APP_URL: "  ",
      EAS_PROJECT_ID: "",
    });

    expect(config.ios?.associatedDomains).toEqual([
      "applinks:wikirace.example.com",
      "webcredentials:wikirace.example.com",
    ]);
    expect(config.extra?.eas?.projectId).toBe(DEFAULT_EAS_PROJECT_ID);
  });

  it("reads the app host and EAS project ID from the environment", () => {
    const config = withDeployValues(baseConfig, {
      EXPO_PUBLIC_APP_URL: "https://play.example.net/",
      EAS_PROJECT_ID: "00000000-0000-0000-0000-000000000001",
    });

    expect(config.ios?.associatedDomains).toEqual([
      "applinks:play.example.net",
      "webcredentials:play.example.net",
    ]);
    expect(config.extra?.eas?.projectId).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
    expect(config.updates?.url).toBe(
      "https://u.expo.dev/00000000-0000-0000-0000-000000000001",
    );
  });

  it("keeps every static field from app.json", () => {
    const config = withDeployValues(baseConfig, {
      EXPO_PUBLIC_APP_URL: "https://play.example.net",
      EAS_PROJECT_ID: "00000000-0000-0000-0000-000000000001",
    });

    expect(config.name).toBe("WikiRace");
    expect(config.slug).toBe("wikipath");
    expect(config.scheme).toEqual(["wikirace", "wikipath"]);
    expect(config.owner).toBe(app.expo.owner);
    expect(config.runtimeVersion).toEqual({ policy: "sdkVersion" });
    expect(config.plugins).toEqual(app.expo.plugins);
    expect(config.ios?.bundleIdentifier).toBe("com.boabrams.wikirace");
    expect(config.ios?.usesAppleSignIn).toBe(true);
    expect(config.ios?.infoPlist).toEqual({
      ITSAppUsesNonExemptEncryption: false,
    });
    expect(config.android?.package).toBe("com.boabrams.wikipath");
    expect(config.extra?.router).toEqual({});
  });

  it("rejects an app URL that is not an absolute http(s) URL", () => {
    expect(() =>
      withDeployValues(baseConfig, {
        EXPO_PUBLIC_APP_URL: "wikirace.example.com",
      }),
    ).toThrow(/EXPO_PUBLIC_APP_URL/);
    expect(() =>
      withDeployValues(baseConfig, {
        EXPO_PUBLIC_APP_URL: "ftp://wikirace.example.com",
      }),
    ).toThrow(/EXPO_PUBLIC_APP_URL/);
  });

  it("applies process.env when Expo evaluates the config", () => {
    vi.stubEnv("EXPO_PUBLIC_APP_URL", "https://play.example.net");
    vi.stubEnv("EAS_PROJECT_ID", "00000000-0000-0000-0000-000000000001");

    const config = appConfig({
      projectRoot: ".",
      staticConfigPath: null,
      packageJsonPath: null,
      config: baseConfig,
    });

    expect(config.ios?.associatedDomains).toEqual([
      "applinks:play.example.net",
      "webcredentials:play.example.net",
    ]);
    expect(config.extra?.eas?.projectId).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
  });
});
