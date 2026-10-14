import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(resolve("src/app", relativePath), "utf8");
}

function libSource(relativePath: string): string {
  return readFileSync(resolve("src/lib", relativePath), "utf8");
}

describe("mobile route public copy", () => {
  it("uses WikiRace identity on Home", () => {
    const home = source("(tabs)/index.tsx");

    expect(home).toContain('"Could not load WikiRace"');
    expect(home).toContain("Make your own WikiRace");
  });

  it("refreshes Home and Leaderboard when the app returns to the foreground", () => {
    const home = source("(tabs)/index.tsx");
    const leaderboard = source("(tabs)/leaderboard.tsx");

    expect(home).toContain(
      'AppState.addEventListener("change", onAppStateChange)',
    );
    expect(home).toContain('nextState === "active"');
    expect(leaderboard).toContain(
      'AppState.addEventListener("change", onAppStateChange)',
    );
    expect(leaderboard).toContain('nextState === "active"');
  });

  it("uses WikiRace identity while completing an auth callback", () => {
    expect(source("auth/callback.tsx")).toContain(
      "Connecting your WikiRace account…",
    );
  });

  it("uses WikiRace identity on Login", () => {
    expect(source("login.tsx")).toContain("WIKIRACE ACCOUNT");
  });

  it("uses WikiRace identity for both Signup modes", () => {
    const signup = source("signup.tsx");

    expect(signup).toContain("WIKIRACE ACCOUNT");
    expect(signup).toContain('"Save your WikiRace score"');
    expect(signup).toContain('"Join WikiRace"');
    expect(signup).toContain('"Sign in instead"');
    expect(signup).toContain(
      "Games played on this phone stay with its guest profile",
    );
  });

  it("uses identity-pack copy for guest results and the home chip", () => {
    const resultPresentation = libSource("result-presentation.ts");
    const homeModel = libSource("home-model.ts");
    const home = source("(tabs)/index.tsx");

    expect(resultPresentation).toContain("You'd be #");
    expect(homeModel).toContain('"Guest — save your score"');
    expect(homeModel).toContain("· Saved");
    expect(home).toContain('testID="home-identity-chip"');
    expect(home).toContain('router.push("/profile")');
  });

  it("uses WikiRace identity in Result reminder confirmation", () => {
    const result = source("result.tsx");
    const reminderUi = libSource("reminder-ui.ts");

    expect(reminderUi).toContain(
      "WikiRace will remind you at 9:00 AM in your current timezone.",
    );
    expect(reminderUi).toContain(
      "Notifications are off in Settings. You can still play every day.",
    );
    expect(result).toContain('"Open Settings"');
  });

  it("separates result invitations from spoiler-safe result sharing", () => {
    const result = source("result.tsx");

    expect(result).toContain('label="Challenge a friend"');
    expect(result).toContain('label="Race again"');
    expect(result).toContain('label="Share my result"');
    expect(result).toContain("createCustomChallenge");
    expect(result).toContain('testID="result-race-again-btn"');
    expect(result).toContain('share("challenge")');
    expect(result).toContain('share("result")');
  });

  it("keeps the private picker keyboard and accessibility behavior explicit", () => {
    const picker = source("challenge/create.tsx");

    expect(picker).toContain('keyboardShouldPersistTaps="handled"');
    expect(picker).toContain("onSelect={() => targetInput.current?.focus()}");
    expect(picker).toContain('accessibilityRole="button"');
    expect(picker).toContain("selectedPrivateChallengeDraft(");
    expect(picker).toContain(
      "Selected · ${state.selected.title} — ${state.selected.description}",
    );
  });

  it("keeps the search keyboard up on submit and match navigation", () => {
    const game = source("game.tsx");

    const navigate = game.match(/function navigateFind\([\s\S]*?\n  \}/)?.[0];
    const submit = game.match(/function submitFind\(\)[\s\S]*?\n  \}/)?.[0];
    expect(navigate).toContain("postArticleCommand");
    expect(navigate).not.toContain("Keyboard.dismiss");
    expect(navigate).not.toContain("blur()");
    expect(submit).not.toContain("Keyboard.dismiss");
    expect(submit).not.toContain("blur()");
    // Closing the sheet is the only search path that drops the keyboard.
    expect(game).toMatch(
      /function closeSearch\(\)[\s\S]*?Keyboard\.dismiss\(\);/,
    );
    expect(game).toContain("Exact page:");
  });

  it("shows target descriptions on the home and challenge preview surfaces", () => {
    const home = source("(tabs)/index.tsx");
    const challengePreview = source("challenge/[code].tsx");

    expect(home).toContain(
      '${challenge.endTitle} — ${challenge.endDescription}',
    );
    expect(challengePreview).toContain(
      '{challenge.endTitle} — {challenge.endDescription}',
    );
  });

  it("exposes profile, friends, support, privacy, and account deletion", () => {
    const profile = source("(tabs)/profile.tsx");
    const reminderUi = libSource("reminder-ui.ts");

    expect(profile).toContain("Edit");
    expect(profile).toContain("Save");
    expect(profile).toContain("Cancel");
    expect(profile).toContain("Friend code");
    expect(profile).toContain("Add a friend");
    expect(profile).toContain("Privacy policy");
    expect(profile).toContain("Support");
    expect(profile).toContain("Daily reminder");
    expect(profile).toContain(
      "Keep tomorrow&apos;s daily from sneaking past you.",
    );
    expect(reminderUi).toContain("Notifications are off in Settings");
    expect(profile).toContain('"Open Settings"');
    expect(profile).toContain("Delete account");
    expect(profile).toContain("profileDeletionDescription()");
  });
});
