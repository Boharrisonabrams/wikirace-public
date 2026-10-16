// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DailyChallenge, GameSession, ProfileResponse } from "@/lib/types";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => {
  (globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = true;
  return {
    api: { getDailyChallenge: vi.fn(), getProfile: vi.fn() },
    auth: {
      bootstrapError: null as string | null,
      isClaimed: true,
      isGuest: false,
      loading: false,
      retryBootstrap: vi.fn(),
      user: { id: "player-1" } as { id: string } | null,
    },
    profileClaim: { finalizeProfileClaim: vi.fn() },
    reminders: { scheduleReminderTest: vi.fn() },
    signOut: vi.fn(),
  };
});

vi.mock("react-native", () => import("./support/react-native-dom"));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
vi.mock("@expo/vector-icons/Feather", () => import("./support/icon"));
vi.mock("expo-router", () => import("./support/expo-router"));
vi.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  impactAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.2.3" } },
}));
vi.mock("expo-updates", () => ({ createdAt: null, isEmbeddedLaunch: true }));
vi.mock("@/hooks/use-auth-session", () => ({
  useAuthSession: () => mocks.auth,
}));
vi.mock("@/lib/api", () => mocks.api);
vi.mock("@/lib/profile-claim", () => mocks.profileClaim);
vi.mock("@/lib/reminders", () => mocks.reminders);
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { signOut: mocks.signOut } }),
}));

import HomeScreen from "@/app/(tabs)/index";
import { currentLocalDate } from "@/lib/daily-date";
import { puzzleNumber } from "@/lib/game-utils";
import { router, setSearchParams } from "./support/expo-router";
import { emitAppState, scrollToSpy } from "./support/react-native-dom";
import {
  flush,
  getByLabel,
  getByTestId,
  press,
  queryByLabel,
  queryByTestId,
  render,
  textOf,
  unmountAll,
} from "./support/render";

const TODAY = currentLocalDate();

function makeChallenge(): DailyChallenge {
  return {
    date: TODAY,
    endArticle: "Moon",
    endDescription: "Natural satellite of Earth",
    endRecognition: null,
    endTitle: "Moon",
    endTopic: null,
    generatorSeed: null,
    generatorVersion: 1,
    id: "daily-1",
    startArticle: "Bronze",
    startRecognition: null,
    startTitle: "Bronze",
    startTopic: null,
  };
}

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    activeTimeMs: 65_000,
    attemptNumber: 1,
    challengeId: "daily-1",
    challengeType: "daily",
    clicks: 3,
    completed: true,
    completedAt: `${TODAY}T10:00:00.000Z`,
    endArticle: "Moon",
    friendChallengeId: null,
    gaveUp: false,
    id: "session-1",
    isOfficial: true,
    localDate: TODAY,
    path: ["Bronze", "Alloy", "Tin", "Moon"],
    startArticle: "Bronze",
    startedAt: `${TODAY}T09:58:00.000Z`,
    timeSeconds: 65,
    timeZone: null,
    timingActive: false,
    won: true,
    ...overrides,
  };
}

function makeProfile(claimed = true): ProfileResponse {
  return {
    profile: {
      avatarUrl: null,
      claimed,
      displayName: null,
      friendCode: "ABC123",
      isGuest: !claimed,
      userId: "player-1",
      username: "racer",
    },
    stats: {
      averageActiveTimeMs: 80_000,
      averageClicks: 4.25,
      bestClicks: 3,
      currentStreak: 2,
      fastestTimeMs: 61_000,
      gamesPlayed: 7,
      gamesWon: 5,
      lastDailyCompleted: TODAY,
      longestStreak: 4,
      totalClicks: 30,
      totalTimeSeconds: 600,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  emitAppState("active");
  setSearchParams({});
  Object.assign(mocks.auth, {
    bootstrapError: null,
    isClaimed: true,
    isGuest: false,
    loading: false,
    user: { id: "player-1" },
  });
  mocks.api.getDailyChallenge.mockResolvedValue({
    challenge: makeChallenge(),
    localDate: TODAY,
    replayAvailable: false,
    session: null,
  });
  mocks.api.getProfile.mockResolvedValue(makeProfile());
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(async () => {
  await unmountAll();
});

describe("HomeScreen", () => {
  it("shows the loading card until the Daily arrives", async () => {
    mocks.api.getDailyChallenge.mockReturnValue(new Promise(() => undefined));

    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain("Opening today's encyclopedia…");
  });

  it("renders the Daily infobox, private game, statistics, links, rules, and version", async () => {
    const { container } = await render(<HomeScreen />);
    const text = textOf(container);

    expect(text).toContain("WIKIRACE");
    expect(textOf(getByTestId(container, "home-identity-chip"))).toBe(
      "@racer · Saved",
    );
    expect(text).toContain("For today's shared race, see Today's challenge.");
    expect(text).toContain("Today's challenge");
    expect(text).toContain(`No. ${puzzleNumber(TODAY)}`);
    expect(text).toContain("Official attempt");
    expect(text).toContain("FromBronze");
    expect(text).toContain("ToMoon");
    expect(text).toContain("Natural satellite of Earth");
    expect(text).toContain("RouteSame start and target for everyone");
    expect(textOf(getByTestId(container, "play-daily-btn"))).toBe(
      "Begin today's path",
    );
    expect(text).toContain("Make your own WikiRace");
    expect(text).toContain("Games played7");
    expect(text).toContain("Current streak2 days");
    expect(text).toContain("Average clicks4.3");
    expect(text).toContain("Average active time1:20");
    expect(text).toContain("Best path3 clicks");
    expect(text).toContain("Fastest solve1:01");
    expect(
      getByLabel(container, "Practice mode, random article pair"),
    ).toBeTruthy();
    expect(
      getByLabel(container, "Daily leaderboard, today's fastest paths"),
    ).toBeTruthy();
    expect(text).toContain("Reach the target in as few clicks as possible.");
    expect(getByLabel(container, "Sign out")).toBeTruthy();
    expect(text).toContain("v1.2.3");
    expect(queryByTestId(container, "home-debug-reminder-btn")).toBeNull();
  });

  it("starts the Daily from the primary action", async () => {
    const { container } = await render(<HomeScreen />);

    await press(getByTestId(container, "play-daily-btn"));

    expect(router.push).toHaveBeenCalledWith({
      params: {
        challengeId: "daily-1",
        claimed: "true",
        dailyDate: TODAY,
        isGuest: "false",
        type: "daily",
      },
      pathname: "/game",
    });
  });

  it("shows a finished Daily with its result and replay actions", async () => {
    mocks.api.getDailyChallenge.mockResolvedValue({
      challenge: makeChallenge(),
      localDate: TODAY,
      replayAvailable: true,
      session: makeSession(),
    });
    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain("Official complete");
    expect(textOf(container)).toContain("3 clicks · 1:05");
    expect(textOf(getByTestId(container, "play-daily-btn"))).toBe("See result");
    await press(getByTestId(container, "replay-daily-btn"));

    expect(router.push).toHaveBeenCalledWith({
      params: {
        challengeId: "daily-1",
        claimed: "true",
        dailyDate: TODAY,
        isGuest: "false",
        replay: "true",
        type: "daily",
      },
      pathname: "/game",
    });
  });

  it("shows saved progress for an unfinished Daily", async () => {
    mocks.api.getDailyChallenge.mockResolvedValue({
      challenge: makeChallenge(),
      localDate: TODAY,
      replayAvailable: false,
      session: makeSession({ completed: false, path: ["Bronze", "Alloy"] }),
    });
    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain(
      "2 articles so far · Your progress is saved.",
    );
    expect(textOf(getByTestId(container, "play-daily-btn"))).toBe(
      "Resume today's path",
    );
  });

  it("shows a load error and retries", async () => {
    mocks.api.getDailyChallenge.mockRejectedValueOnce(
      new Error("Daily offline"),
    );
    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain("Daily offline");
    await press(getByLabel(container, "Try again"));

    expect(mocks.api.getDailyChallenge).toHaveBeenCalledTimes(2);
    expect(textOf(container)).toContain("Today's challenge");
  });

  it("offers a bootstrap retry and email sign in", async () => {
    mocks.auth.bootstrapError = "Guest play is unavailable.";
    mocks.auth.user = null;
    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain("Guest play is unavailable.");
    await press(getByLabel(container, "Try again"));
    expect(mocks.auth.retryBootstrap).toHaveBeenCalledTimes(1);
    await press(getByLabel(container, "Sign in with email"));
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("hides player-only sections when signed out", async () => {
    mocks.auth.user = null;
    mocks.auth.isClaimed = false;
    const { container } = await render(<HomeScreen />);

    expect(mocks.api.getProfile).not.toHaveBeenCalled();
    expect(textOf(container)).not.toContain("Make your own WikiRace");
    expect(
      queryByLabel(container, "Practice mode, random article pair"),
    ).toBeNull();
    expect(queryByLabel(container, "Sign out")).toBeNull();
    await press(getByLabel(container, "Sign in"));
    expect(router.push).toHaveBeenCalledWith("/login");
  });

  it("finishes account setup for a signed-in player with an unclaimed profile", async () => {
    mocks.auth.isClaimed = false;
    mocks.api.getProfile.mockResolvedValue(makeProfile(false));
    mocks.profileClaim.finalizeProfileClaim.mockResolvedValue(undefined);
    const { container } = await render(<HomeScreen />);

    expect(textOf(getByTestId(container, "home-identity-chip"))).toBe(
      "@racer · Finish setup",
    );
    await press(getByTestId(container, "claim-account-btn"));

    expect(mocks.profileClaim.finalizeProfileClaim).toHaveBeenCalledTimes(1);
    expect(queryByTestId(container, "claim-account-btn")).toBeNull();
  });

  it("reports a failed account setup", async () => {
    mocks.auth.isClaimed = false;
    mocks.api.getProfile.mockResolvedValue(makeProfile(false));
    mocks.profileClaim.finalizeProfileClaim.mockRejectedValue(
      new Error("Claim failed."),
    );
    const { container } = await render(<HomeScreen />);

    await press(getByTestId(container, "claim-account-btn"));

    expect(textOf(container)).toContain("Claim failed. Try again.");
  });

  it("sends a guest to save their progress", async () => {
    mocks.auth.isClaimed = false;
    mocks.auth.isGuest = true;
    mocks.api.getProfile.mockResolvedValue(makeProfile(false));
    const { container } = await render(<HomeScreen />);

    await press(getByTestId(container, "claim-account-btn"));

    expect(router.push).toHaveBeenCalledWith({
      params: { mode: "claim", next: "/" },
      pathname: "/signup",
    });
  });

  it("navigates from the identity chip, private game, and see-also links", async () => {
    const { container } = await render(<HomeScreen />);

    await press(getByTestId(container, "home-identity-chip"));
    await press(getByTestId(container, "create-private-game-btn"));
    await press(getByLabel(container, "Practice mode, random article pair"));
    await press(
      getByLabel(container, "Daily leaderboard, today's fastest paths"),
    );
    await press(getByLabel(container, "How to play (rules)"));

    expect(vi.mocked(router.push).mock.calls).toEqual([
      ["/profile"],
      ["/challenge/create"],
      ["/game?type=practice"],
      ["/leaderboard"],
    ]);
    expect(scrollToSpy).toHaveBeenCalledWith({ animated: true, y: 0 });
  });

  it("signs out", async () => {
    const { container } = await render(<HomeScreen />);

    await press(getByLabel(container, "Sign out"));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("reloads on pull to refresh and when the app returns to the foreground", async () => {
    const { container } = await render(<HomeScreen />);
    expect(mocks.api.getDailyChallenge).toHaveBeenCalledTimes(1);

    await press(getByTestId(container, "refresh-control"));
    expect(mocks.api.getDailyChallenge).toHaveBeenCalledTimes(2);

    await act(async () => {
      emitAppState("background");
      emitAppState("active");
    });
    await flush();
    expect(mocks.api.getDailyChallenge).toHaveBeenCalledTimes(3);
  });

  it("schedules a development test notification when asked", async () => {
    setSearchParams({ debugReminder: "1" });
    mocks.reminders.scheduleReminderTest.mockResolvedValue(undefined);
    const { container } = await render(<HomeScreen />);

    expect(textOf(container)).toContain("Development notification proof");
    await press(getByTestId(container, "home-debug-reminder-btn"));

    expect(mocks.reminders.scheduleReminderTest).toHaveBeenCalledWith(60);
    expect(textOf(getByTestId(container, "home-debug-reminder-status"))).toBe(
      "Test notification scheduled. Leave WikiRace open or background it and wait 60 seconds.",
    );
  });
});
