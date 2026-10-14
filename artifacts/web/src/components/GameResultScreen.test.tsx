// @vitest-environment jsdom

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFriendRaceAgainChallenge: vi.fn(),
  navigate: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/game", mocks.navigate],
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("@/lib/friend-race-again", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/friend-race-again")
  >("@/lib/friend-race-again");
  return {
    ...actual,
    createFriendRaceAgainChallenge: mocks.createFriendRaceAgainChallenge,
  };
});

import GameResultScreen from "./GameResultScreen";

describe("GameResultScreen friend replay action", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, "", "/game?type=daily&challengeId=daily-1");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.createFriendRaceAgainChallenge.mockReset();
    mocks.navigate.mockReset();
    mocks.useAuth.mockReset();
    mocks.useAuth.mockReturnValue({ user: null, loading: false });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("creates a new friend challenge and opens its preview", async () => {
    mocks.createFriendRaceAgainChallenge.mockResolvedValue({
      challenge: { code: "fresh123" },
    });

    await act(async () => {
      root.render(
        <GameResultScreen
          onPlayAgain={() => {}}
          result={{
            won: true,
            gaveUp: false,
            clicks: 2,
            timeSeconds: 42,
            path: ["Christopher Columbus", "United Nations"],
            endArticle: "United Nations",
            streak: null,
          }}
          session={{
            id: "session-1",
            challengeType: "friend",
            challengeId: null,
            friendChallengeId: "friend-1",
            startArticle: "Christopher Columbus",
            endArticle: "United Nations",
            path: ["Christopher Columbus", "United Nations"],
            clicks: 2,
            completed: true,
            won: true,
            gaveUp: false,
            timeSeconds: 42,
            startedAt: "2026-07-24T00:00:00.000Z",
            completedAt: "2026-07-24T00:00:42.000Z",
            isOfficial: false,
          }}
        />,
      );
    });

    const raceAgainButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Race again"));

    expect(raceAgainButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      raceAgainButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(mocks.createFriendRaceAgainChallenge).toHaveBeenCalledWith({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });
    expect(mocks.navigate).toHaveBeenCalledWith("/challenge/fresh123");
  });

  it("surfaces a retry label when creation fails", async () => {
    mocks.createFriendRaceAgainChallenge.mockRejectedValue(new Error("boom"));

    await act(async () => {
      root.render(
        <GameResultScreen
          onPlayAgain={() => {}}
          result={{
            won: true,
            gaveUp: false,
            clicks: 2,
            timeSeconds: 42,
            path: ["Christopher Columbus", "United Nations"],
            endArticle: "United Nations",
            streak: null,
          }}
          session={{
            id: "session-1",
            challengeType: "friend",
            challengeId: null,
            friendChallengeId: "friend-1",
            startArticle: "Christopher Columbus",
            endArticle: "United Nations",
            path: ["Christopher Columbus", "United Nations"],
            clicks: 2,
            completed: true,
            won: true,
            gaveUp: false,
            timeSeconds: 42,
            startedAt: "2026-07-24T00:00:00.000Z",
            completedAt: "2026-07-24T00:00:42.000Z",
            isOfficial: false,
          }}
        />,
      );
    });

    const raceAgainButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Race again"));

    await act(async () => {
      raceAgainButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Could not create race");
  });

  it("offers guest players a post-finish account-save CTA", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "guest-1", is_anonymous: true },
      loading: false,
    });

    await act(async () => {
      root.render(
        <GameResultScreen
          onPlayAgain={() => {}}
          result={{
            won: true,
            gaveUp: false,
            clicks: 4,
            timeSeconds: 84,
            path: ["Earth", "Moon"],
            endArticle: "Moon",
            streak: null,
          }}
          session={{
            id: "session-guest",
            challengeType: "friend",
            challengeId: null,
            friendChallengeId: "guestplay1",
            startArticle: "Earth",
            endArticle: "Moon",
            path: ["Earth", "Moon"],
            clicks: 4,
            completed: true,
            won: true,
            gaveUp: false,
            timeSeconds: 84,
            startedAt: "2026-07-24T00:00:00.000Z",
            completedAt: "2026-07-24T00:01:24.000Z",
            isOfficial: false,
          }}
        />,
      );
    });

    expect(container.textContent).toContain("Save this guest profile");

    const createCredentialsButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Create credentials"));
    expect(createCredentialsButton).toBeTruthy();

    await act(async () => {
      createCredentialsButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/signup?mode=claim&next=%2Fgame%3Ftype%3Ddaily%26challengeId%3Ddaily-1",
    );
  });
});
