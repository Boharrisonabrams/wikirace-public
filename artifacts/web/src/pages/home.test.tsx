// @vitest-environment jsdom

import { act } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  ensurePlayerSession: vi.fn(),
  navigate: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", mocks.navigate],
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mocks.useAuth(),
}));

vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => mocks.api(...args),
}));

vi.mock("@/lib/player-session", () => ({
  ensurePlayerSession: () => mocks.ensurePlayerSession(),
}));

import HomePage from "./home";

describe("HomePage guest Daily play", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    mocks.api.mockReset();
    mocks.ensurePlayerSession.mockReset();
    mocks.navigate.mockReset();
    mocks.useAuth.mockReset();
    mocks.useAuth.mockReturnValue({ user: null, loading: false });
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/daily") {
        return {
          challenge: {
            id: "daily-1",
            date: "2026-07-24",
            startTitle: "Earth",
            endTitle: "Moon",
            endDescription: "the only natural satellite of Earth",
          },
          session: null,
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });
    mocks.ensurePlayerSession.mockResolvedValue({
      user: { id: "guest-1", is_anonymous: true },
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("starts the daily as a guest from the signed-out home screen", async () => {
    await act(async () => {
      root.render(<HomePage />);
    });
    await act(async () => {});

    const playButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Play today's race"),
    );
    expect(playButton).toBeTruthy();

    await act(async () => {
      playButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(mocks.ensurePlayerSession).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith(
      "/game?type=daily&challengeId=daily-1",
    );
  });
});
