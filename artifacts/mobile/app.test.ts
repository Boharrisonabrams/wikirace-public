import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import app from "./app.json";
import eas from "./eas.json";
import packageJson from "./package.json";

describe("mobile public identity", () => {
  it("uses WikiRace publicly while preserving stable native and EAS identity", () => {
    expect(app.expo.name).toBe("WikiRace");
    expect(app.expo.slug).toBe("wikipath");
    expect(app.expo.scheme).toEqual(["wikirace", "wikipath"]);
    expect(app.expo.ios.bundleIdentifier).toBe("com.boabrams.wikirace");
    // Placeholder domain and EAS project ID in the public export; replace
    // them with your own host and `eas init` project before a native build.
    expect(app.expo.ios.associatedDomains).toEqual([
      "applinks:wikirace.example.com",
      "webcredentials:wikirace.example.com",
    ]);
    expect(app.expo.android.package).toBe("com.boabrams.wikipath");
    expect(app.expo.extra.eas.projectId).toBe(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(app.expo.updates.url).toBe(
      "https://u.expo.dev/00000000-0000-0000-0000-000000000000",
    );
    expect(app.expo.icon).toBe("./assets/images/icon.png");
    expect(app.expo.ios.icon).toBe("./assets/images/icon.png");
    expect(app.expo.android.adaptiveIcon).toEqual({
      backgroundColor: "#f5f2eb",
      backgroundImage: "./assets/images/android-icon-background.png",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    });
    expect(app.expo.web.favicon).toBe("./assets/images/favicon.png");
    expect(app.expo.plugins).toContainEqual([
      "expo-splash-screen",
      expect.objectContaining({ image: "./assets/images/splash-icon.png" }),
    ]);
    expect(app.expo.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(packageJson.name).toBe("@workspace/wikirace-mobile");
  });

  it("uses the approved WikiRace icon asset", () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const icon = readFileSync(resolve(testDirectory, app.expo.icon));

    expect(createHash("sha256").update(icon).digest("hex")).toBe(
      "77a3ffd53ade8b9ed96c58d9c111244d8261ad6839f2d8d7a32e8c73c9084aeb",
    );
  });

  it("tracks the approved monogram master separately from generated exports", () => {
    const testDirectory = dirname(fileURLToPath(import.meta.url));
    const master = readFileSync(
      resolve(testDirectory, "../brand/wikirace-monogram-master.png"),
    );

    expect(createHash("sha256").update(master).digest("hex")).toBe(
      "4b744d07cb4bb9bfe4b84d9e558f25cbaa04e9c07ad043a6b595e19c589bfc31",
    );
  });

  it("defines distinct internal-preview and App Store production profiles", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
    expect(eas.build.preview).toEqual(
      expect.objectContaining({
        channel: "preview",
        distribution: "internal",
        environment: "preview",
      }),
    );
    expect(eas.build.production).toEqual(
      expect.objectContaining({
        autoIncrement: true,
        channel: "production",
        environment: "production",
      }),
    );
    // Pinned build channels keep future binaries OTA-addressable via
    // `eas update --channel production` instead of reaching zero devices.
    // Pinned ascAppId keeps `eas submit` from auto-creating a TestFlight
    // group and auto-inviting the whole Apple team (iOS Release Rules).
    // The public export ships a placeholder; set your own App Store Connect
    // app ID before running `eas submit`.
    expect(eas.submit.production).toEqual({
      ios: { ascAppId: "0000000000" },
    });
  });
});
