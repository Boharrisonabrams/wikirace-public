// @vitest-environment jsdom
import * as React from "react";
import { Linking, Share } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameResult } from "@/lib/types";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  api: {
    completeGame: vi.fn(),
    createChallengeLink: vi.fn(),
    createCustomChallenge: vi.fn(),
  },
  auth: {
    isGuest: false,
    loading: false,
    user: { id: "player-1" } as { id: string } | null,
  },
  profileClaim: { finalizeProfileClaim: vi.fn() },
  reminders: {
    disableDailyReminder: vi.fn(),
    enableDailyReminder: vi.fn(),
    getDailyReminderState: vi.fn(),
  },
}));

vi.mock("react-native", () => import("./support/react-native-dom"));
vi.mock("@expo/vector-icons/Feather", () => import("./support/icon"));
vi.mock("expo-router", () => import("./support/expo-router"));
vi.mock("@/hooks/use-auth-session", () => ({
  useAuthSession: () => mocks.auth,
}));
vi.mock("@/lib/api", () => mocks.api);
vi.mock("@/lib/profile-claim", () => mocks.profileClaim);
vi.mock("@/lib/reminders", () => mocks.reminders);

import ResultScreen from "@/app/result";
import { router, setSearchParams } from "./support/expo-router";
import {
  getByLabel,
  getByTestId,
  press,
  queryByTestId,
  render,
  textOf,
  unmountAll,
} from "./support/render";

const CHALLENGE_URL = "https://wikirace.example.com/challenge/abc123";

function makeResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    activeTimeMs: 65_000,
    challengeId: "daily-1",
    claimed: true,
    clicks: 2,
    dailyDate: "2026-10-15",
    eligibleCount: 40,
    endArticle: "Moon",
    fastestRank: 1,
    isGuest: false,
    isOfficial: true,
    path: ["Bronze", "Alloy", "Moon"],
    shortestRank: 1,
    streak: { current: 4, extended: true, longest: 6 },
    timeSeconds: 65,
    won: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.isGuest = false;
  mocks.auth.loading = false;
  mocks.auth.user = { id: "player-1" };
  setSearchParams({
    challengeId: "daily-1",
    dailyDate: "2026-10-15",
    gaveUp: "false",
    sessionId: "session-1",
    type: "daily",
  });
  mocks.api.completeGame.mockResolvedValue(makeResult());
  mocks.api.createChallengeLink.mockResolvedValue({
    challenge: { url: CHALLENGE_URL },
  });
  mocks.reminders.getDailyReminderState.mockResolvedValue({
    enabled: false,
    permission: "granted",
  });
  mocks.reminders.enableDailyReminder.mockResolvedValue({
    enabled: true,
    permission: "granted",
  });
});

afterEach(async () => {
  await unmountAll();
});

describe("ResultScreen", () => {
  it("shows the saving state while the result loads", async () => {
    mocks.api.completeGame.mockReturnValue(new Promise(() => undefined));

    const { container } = await render(<ResultScreen />);

    expect(textOf(container)).toContain("Saving result…");
  });

  it("shows an error with a way home when the session is missing", async () => {
    setSearchParams({ type: "practice" });

    const { container } = await render(<ResultScreen />);

    expect(mocks.api.completeGame).not.toHaveBeenCalled();
    expect(textOf(container)).toContain("Missing game session.");
    await press(getByTestId(container, "result-error-home"));
    expect(router.dismissTo).toHaveBeenCalledWith("/");
  });

  it("sends a signed-out player to login with a return path", async () => {
    mocks.auth.user = null;

    await render(<ResultScreen />);

    expect(mocks.api.completeGame).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith({
      params: {
        next: "/result?sessionId=session-1&type=daily&dailyDate=2026-10-15&challengeId=daily-1&replay=false&gaveUp=false",
      },
      pathname: "/login",
    });
  });

  it("renders an official Daily win with stats, ranks, streak, and route", async () => {
    const { container } = await render(<ResultScreen />);
    const text = textOf(container);

    expect(mocks.api.completeGame).toHaveBeenCalledWith("session-1", false);
    expect(text).toContain("Daily challenge · Official result · Bronze → Moon");
    expect(text).toContain("You reached Moon.");
    expect(getByLabel(container, "clicks: 2")).toBeTruthy();
    expect(getByLabel(container, "active time: 1:05")).toBeTruthy();
    expect(getByLabel(container, "day streak: 4")).toBeTruthy();
    expect(text).toContain("Daily streak extended. Longest streak: 6.");
    expect(text).toContain("Today's standings");
    expect(text).toContain("Daily champion sweep");
    expect(text).toContain("Shortest Path");
    expect(text).toContain("Fastest Solve");
    expect(getByLabel(container, "Step 1 of 3: Bronze")).toBeTruthy();
    expect(getByLabel(container, "Step 3 of 3: Moon")).toBeTruthy();
    expect(getByTestId(container, "challenge-friend-btn")).toBeTruthy();
    expect(getByTestId(container, "share-result-btn")).toBeTruthy();
    expect(getByTestId(container, "result-replay-btn")).toBeTruthy();
    expect(textOf(getByTestId(container, "result-reminder-btn"))).toBe(
      "Remind me tomorrow",
    );
    expect(queryByTestId(container, "result-race-again-btn")).toBeNull();
    expect(queryByTestId(container, "result-account-btn")).toBeNull();
  });

  it("renders a practice give-up with the missed target", async () => {
    setSearchParams({
      gaveUp: "true",
      sessionId: "session-1",
      type: "practice",
    });
    mocks.api.completeGame.mockResolvedValue(
      makeResult({
        challengeId: null,
        clicks: 1,
        path: ["Bronze", "Alloy"],
        streak: null,
        won: false,
      }),
    );

    const { container } = await render(<ResultScreen />);
    const text = textOf(container);

    expect(mocks.api.completeGame).toHaveBeenCalledWith("session-1", true);
    expect(text).toContain("Practice run · Bronze → Moon");
    expect(text).toContain("The trail went cold.");
    expect(text).toContain("Gave up before reaching Moon.");
    expect(getByLabel(container, "hops: 1")).toBeTruthy();
    expect(text).toContain("never reached Moon");
    expect(queryByTestId(container, "result-reminder-btn")).toBeNull();
    expect(queryByTestId(container, "result-replay-btn")).toBeNull();
  });

  it("shares the result through a new challenge link for the chosen search tier", async () => {
    const { container } = await render(<ResultScreen />);

    const palette = getByTestId(container, "result-search-tier-palette");
    expect(palette.getAttribute("aria-checked")).toBe("false");
    await press(palette);
    expect(palette.getAttribute("aria-checked")).toBe("true");
    await press(getByTestId(container, "share-result-btn"));

    expect(mocks.api.createChallengeLink).toHaveBeenCalledWith(
      "session-1",
      "palette",
    );
    expect(Share.share).toHaveBeenCalledTimes(1);
    const [payload] = vi.mocked(Share.share).mock.calls[0] ?? [];
    expect(payload).toMatchObject({ url: CHALLENGE_URL });
    expect(JSON.stringify(payload)).toContain("Bronze");
  });

  it("shows an error when the challenge link is unsafe", async () => {
    mocks.api.createChallengeLink.mockResolvedValue({
      challenge: { url: "http://wikirace.example.com/elsewhere" },
    });
    const { container } = await render(<ResultScreen />);

    await press(getByTestId(container, "challenge-friend-btn"));

    expect(Share.share).not.toHaveBeenCalled();
    expect(textOf(container)).toContain(
      "Could not create the challenge link. Try again.",
    );
  });

  it("replays the Daily unranked", async () => {
    const { container } = await render(<ResultScreen />);

    await press(getByTestId(container, "result-replay-btn"));

    expect(router.replace).toHaveBeenCalledWith({
      params: {
        challengeId: "daily-1",
        claimed: "true",
        dailyDate: "2026-10-15",
        isGuest: "false",
        replay: "true",
        type: "daily",
      },
      pathname: "/game",
    });
  });

  it("turns the daily reminder on", async () => {
    const { container } = await render(<ResultScreen />);

    await press(getByTestId(container, "result-reminder-btn"));

    expect(mocks.reminders.enableDailyReminder).toHaveBeenCalledTimes(1);
    expect(textOf(getByTestId(container, "result-reminder-btn"))).toBe(
      "Daily reminder on · Turn off",
    );
    expect(textOf(container)).toContain(
      "WikiRace will remind you at 9:00 AM in your current timezone.",
    );
  });

  it("offers Settings when reminders are denied", async () => {
    mocks.reminders.getDailyReminderState.mockResolvedValue({
      enabled: false,
      permission: "denied",
    });
    const { container } = await render(<ResultScreen />);

    await press(getByTestId(container, "result-reminder-settings-btn"));

    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });

  it("sends a guest Daily finisher to claim the score", async () => {
    mocks.auth.isGuest = true;
    mocks.api.completeGame.mockResolvedValue(
      makeResult({ claimed: false, isGuest: true, wouldBeShortestRank: 3 }),
    );
    const { container } = await render(<ResultScreen />);

    expect(textOf(container)).toContain("You'd be #3 today");
    await press(getByTestId(container, "result-account-btn"));

    expect(router.push).toHaveBeenCalledWith({
      params: {
        mode: "claim",
        next: "/result?sessionId=session-1&type=daily&dailyDate=2026-10-15&challengeId=daily-1&replay=false&gaveUp=false",
      },
      pathname: "/signup",
    });
  });

  it("creates a new friend challenge from Race again", async () => {
    setSearchParams({
      gaveUp: "false",
      sessionId: "session-1",
      type: "friend",
    });
    mocks.api.createCustomChallenge.mockResolvedValue({
      challenge: { code: "abc123", url: CHALLENGE_URL },
    });
    const { container } = await render(<ResultScreen />);

    await press(getByTestId(container, "result-race-again-btn"));

    expect(mocks.api.createCustomChallenge).toHaveBeenCalledWith({
      endArticle: "Moon",
      searchTier: "find",
      startArticle: "Bronze",
    });
    expect(router.push).toHaveBeenCalledWith({
      params: { code: "abc123" },
      pathname: "/challenge/[code]",
    });
  });
});
