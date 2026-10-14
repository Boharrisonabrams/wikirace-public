// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChallengePage from "@/pages/challenge";

const mockNavigate = vi.fn();
const mockApi = vi.fn();
const mockUseAuth = vi.fn();
const mockEnsurePlayerSession = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/challenge/abc123", mockNavigate],
  useParams: () => ({ id: "abc123" }),
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/player-session", () => ({
  ensurePlayerSession: () => mockEnsurePlayerSession(),
}));

describe("ChallengePage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockNavigate.mockReset();
    mockApi.mockReset();
    mockUseAuth.mockReset();
    mockEnsurePlayerSession.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("shows the iOS open-in-app button and removes the Expo Go copy", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });

    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockApi.mockResolvedValue({
      challenge: {
        code: "abc123",
        kind: "friend",
        dailyChallengeId: null,
        dailyDate: null,
        startTitle: "Earth",
        endTitle: "Moon",
        endDescription: "the only natural satellite of Earth",
        url: "https://wikirace.example.com/challenge/abc123",
      },
      creator: { username: "bo", display_name: "Bo" },
      results: [],
      mySession: null,
    });

    await act(async () => {
      root.render(<ChallengePage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Open in the WikiRace app");
    expect(container.innerHTML).toContain('href="wikirace://challenge/abc123"');
    expect(container.textContent).toContain(
      "Moon — the only natural satellite of Earth",
    );
    expect(container.textContent).toContain(
      "Don't have the app? Keep playing right here in the browser.",
    );
    expect(container.textContent).not.toContain("Expo Go");
  });

  it("starts guest play immediately instead of redirecting to signup", async () => {
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0",
    });

    mockEnsurePlayerSession.mockResolvedValue({
      user: { id: "guest-1", is_anonymous: true },
    });
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    mockApi
      .mockResolvedValueOnce({
        challenge: {
          code: "abc123",
          kind: "daily",
          dailyChallengeId: "daily-1",
          dailyDate: "2026-07-24",
          startTitle: "Earth",
          endTitle: "Moon",
          url: "https://wikirace.example.com/challenge/abc123",
        },
        creator: { username: "bo", display_name: "Bo" },
        results: [],
        mySession: null,
      })
      .mockResolvedValueOnce({ recorded: true });

    await act(async () => {
      root.render(<ChallengePage />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const playButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Accept the challenge"),
    );
    expect(playButton).toBeTruthy();

    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockEnsurePlayerSession).toHaveBeenCalledOnce();
    expect(mockApi).toHaveBeenNthCalledWith(2, "/challenge/abc123/start", {
      method: "POST",
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/game?type=daily&challengeId=daily-1&friendChallengeId=abc123&dailyDate=2026-07-24",
    );
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.stringContaining("/signup"),
    );
  });
});
