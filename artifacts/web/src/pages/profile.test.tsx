// @vitest-environment jsdom

import { act } from "react";
import ReactDOMClient from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  navigate: vi.fn(),
  updateUsername: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", mocks.navigate],
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
  updateUsername: mocks.updateUsername,
}));

import ProfilePage from "./profile";

describe("ProfilePage username editing", () => {
  let container: HTMLDivElement;
  let root: ReactDOMClient.Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = ReactDOMClient.createRoot(container);
    mocks.navigate.mockReset();
    mocks.api.mockReset();
    mocks.updateUsername.mockReset();
    mocks.api.mockImplementation(async (path: string) => {
      if (path === "/profile/me") {
        return {
          profile: {
            userId: "user-1",
            username: "player_one",
            displayName: "Player One",
            friendCode: "ABC123",
          },
          stats: {
            gamesPlayed: 10,
            gamesWon: 7,
            totalClicks: 42,
            totalTimeSeconds: 123,
            currentStreak: 3,
            longestStreak: 4,
          },
        };
      }
      if (path === "/friends") {
        return {
          friends: [],
          pendingIncoming: [],
          pendingOutgoing: [],
        };
      }
      throw new Error(`Unexpected path ${path}`);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("saves a normalized username and updates the visible handle", async () => {
    mocks.updateUsername.mockResolvedValue({
      profile: {
        userId: "user-1",
        username: "player_two",
        displayName: "Player One",
        friendCode: "ABC123",
      },
    });

    await act(async () => {
      root.render(<ProfilePage />);
    });
    await act(async () => {});

    const editButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Edit",
    );
    expect(editButton).toBeTruthy();

    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const input = container.querySelector(
      "#profile-username",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setValue?.call(input, "  Player_Two ");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Save",
    );
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mocks.updateUsername).toHaveBeenCalledWith("player_two");
    expect(container.textContent).toContain("@player_two");
    expect(container.textContent).toContain("Username updated to @player_two");
  });
});
