// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { Alert, Linking } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FriendsResponse, ProfileResponse } from "@/lib/types";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  api: {
    deleteAccount: vi.fn(),
    getFriends: vi.fn(),
    getProfile: vi.fn(),
    requestFriend: vi.fn(),
    respondToFriendRequest: vi.fn(),
    updateUsername: vi.fn(),
  },
  clipboard: { setStringAsync: vi.fn(async () => true) },
  reminders: {
    disableDailyReminder: vi.fn(),
    enableDailyReminder: vi.fn(),
    getDailyReminderState: vi.fn(),
  },
  signOut: vi.fn(),
}));

vi.mock("react-native", () => import("./support/react-native-dom"));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));
vi.mock("@expo/vector-icons/Feather", () => import("./support/icon"));
vi.mock("expo-clipboard", () => mocks.clipboard);
vi.mock("expo-router", () => import("./support/expo-router"));
vi.mock("@/lib/api", () => mocks.api);
vi.mock("@/lib/reminders", () => mocks.reminders);
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({ auth: { signOut: mocks.signOut } }),
}));

import ProfileScreen from "@/app/(tabs)/profile";
import { PRIVACY_POLICY_URL, SUPPORT_URL } from "@/lib/profile-settings";
import { router } from "./support/expo-router";
import {
  flush,
  getByLabel,
  getByTestId,
  isDisabled,
  press,
  queryByLabel,
  render,
  textOf,
  typeInto,
  unmountAll,
} from "./support/render";

function makeProfile(
  overrides: Partial<ProfileResponse["profile"]> = {},
): ProfileResponse {
  return {
    profile: {
      avatarUrl: null,
      claimed: true,
      displayName: "Racer One",
      friendCode: "ABC123",
      isGuest: false,
      userId: "player-1",
      username: "racer",
      ...overrides,
    },
    stats: {
      averageActiveTimeMs: null,
      averageClicks: null,
      bestClicks: 4,
      currentStreak: 3,
      fastestTimeMs: 95_000,
      gamesPlayed: 6,
      gamesWon: 3,
      lastDailyCompleted: null,
      longestStreak: 5,
      totalClicks: 30,
      totalTimeSeconds: 600,
    },
  };
}

const FRIENDS: FriendsResponse = {
  friends: [
    {
      displayName: "Pal",
      friendCode: "PAL111",
      userId: "f-1",
      username: "pal",
    },
  ],
  pendingIncoming: [
    {
      displayName: null,
      friendCode: "RIV222",
      friendshipId: "fs-1",
      userId: "f-2",
      username: "rival",
    },
  ],
  pendingOutgoing: [
    {
      displayName: null,
      friendCode: "OUT333",
      userId: "f-3",
      username: "slow",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.getProfile.mockResolvedValue(makeProfile());
  mocks.api.getFriends.mockResolvedValue(FRIENDS);
  mocks.reminders.getDailyReminderState.mockResolvedValue({
    enabled: false,
    permission: "granted",
  });
  mocks.reminders.enableDailyReminder.mockResolvedValue({
    enabled: true,
    permission: "granted",
  });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(async () => {
  await unmountAll();
});

describe("ProfileScreen", () => {
  it("shows the loading state until the profile arrives", async () => {
    mocks.api.getProfile.mockReturnValue(new Promise(() => undefined));

    const { container } = await render(<ProfileScreen />);

    expect(textOf(container)).toContain("Your profile");
    expect(textOf(container)).toContain("Reading your record…");
  });

  it("shows a load error", async () => {
    mocks.api.getProfile.mockRejectedValue(new Error("Profile offline"));

    const { container } = await render(<ProfileScreen />);

    expect(textOf(container)).toContain("Profile offline");
    expect(queryByLabel(container, "Sign out")).toBeNull();
  });

  it("renders identity, record, friends, reminder, help, and account sections", async () => {
    const { container } = await render(<ProfileScreen />);
    const text = textOf(container);

    expect(text).toContain("Racer One");
    expect(text).toContain("@racer");
    expect(text).toContain("Saved account");
    expect(getByLabel(container, "Copy friend code ABC123")).toBeTruthy();
    expect(text).toContain("6Played");
    expect(text).toContain("3Won");
    expect(text).toContain("50%Win rate");
    expect(text).toContain("4Best path");
    expect(text).toContain("1:35Fastest");
    expect(text).toContain("3Streak");
    expect(text).toContain("Add a friend");
    expect(text).toContain("REQUESTS");
    expect(text).toContain("@rival");
    expect(text).toContain("Pal@pal");
    expect(text).toContain("Waiting on @slow");
    expect(textOf(getByTestId(container, "profile-reminder-btn"))).toBe(
      "Remind me tomorrow",
    );
    expect(getByLabel(container, "Privacy policy")).toBeTruthy();
    expect(getByLabel(container, "Support")).toBeTruthy();
    expect(getByLabel(container, "Sign out")).toBeTruthy();
    expect(getByLabel(container, "Delete account")).toBeTruthy();
  });

  it("offers a guest the claim flow and hides friends and sign out", async () => {
    mocks.api.getProfile.mockResolvedValue(
      makeProfile({ claimed: false, isGuest: true }),
    );
    const { container } = await render(<ProfileScreen />);

    expect(textOf(container)).toContain("Guest profile");
    expect(textOf(container)).not.toContain("Add a friend");
    expect(queryByLabel(container, "Sign out")).toBeNull();
    await press(getByLabel(container, "Save this guest profile"));

    expect(router.push).toHaveBeenCalledWith({
      params: { mode: "claim", next: "/profile" },
      pathname: "/signup",
    });
  });

  it("validates and saves a new username", async () => {
    mocks.api.updateUsername.mockResolvedValue(
      makeProfile({ username: "new_name" }),
    );
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Edit username"));
    expect(textOf(container)).toContain("Change username");
    const input = getByLabel(container, "Username");
    expect((input as HTMLInputElement).value).toBe("racer");

    await typeInto(input, "ab");
    expect(textOf(container)).toContain(
      "Username needs at least 3 characters.",
    );
    expect(isDisabled(getByLabel(container, "Save username"))).toBe(true);

    await typeInto(input, "New_Name");
    await press(getByLabel(container, "Save username"));

    expect(mocks.api.updateUsername).toHaveBeenCalledWith("new_name");
    expect(textOf(container)).toContain("Username updated to @new_name.");
    expect(textOf(container)).not.toContain("Change username");
  });

  it("cancels a username edit", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Edit username"));
    await press(getByLabel(container, "Cancel username edit"));

    expect(textOf(container)).not.toContain("Change username");
    expect(mocks.api.updateUsername).not.toHaveBeenCalled();
  });

  it("sends a friend request with a normalized code and reloads", async () => {
    mocks.api.requestFriend.mockResolvedValue({
      friend: { username: "newpal" },
      status: "pending",
    });
    const { container } = await render(<ProfileScreen />);
    expect(isDisabled(getByLabel(container, "Send friend request"))).toBe(true);

    await typeInto(getByLabel(container, "Friend code"), "xyz-789");
    expect(
      (getByLabel(container, "Friend code") as HTMLInputElement).value,
    ).toBe("XYZ789");
    await press(getByLabel(container, "Send friend request"));

    expect(mocks.api.requestFriend).toHaveBeenCalledWith("XYZ789");
    expect(textOf(container)).toContain("Request sent to @newpal.");
    expect(mocks.api.getProfile).toHaveBeenCalledTimes(2);
  });

  it("accepts an incoming friend request", async () => {
    mocks.api.respondToFriendRequest.mockResolvedValue({});
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Accept friend request"));

    expect(mocks.api.respondToFriendRequest).toHaveBeenCalledWith("fs-1", true);
    expect(textOf(container)).toContain("You and @rival are now friends.");
  });

  it("copies the friend code", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Copy friend code ABC123"));

    expect(mocks.clipboard.setStringAsync).toHaveBeenCalledWith("ABC123");
  });

  it("opens the help links", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Privacy policy"));
    await press(getByLabel(container, "Support"));

    expect(Linking.openURL).toHaveBeenNthCalledWith(1, PRIVACY_POLICY_URL);
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, SUPPORT_URL);
  });

  it("turns the daily reminder on", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByTestId(container, "profile-reminder-btn"));

    expect(mocks.reminders.enableDailyReminder).toHaveBeenCalledTimes(1);
    expect(textOf(getByTestId(container, "profile-reminder-btn"))).toBe(
      "Daily reminder on · Turn off",
    );
  });

  it("signs out to Home", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Sign out"));

    expect(mocks.signOut).toHaveBeenCalledWith();
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("deletes the account after confirmation", async () => {
    mocks.api.deleteAccount.mockResolvedValue({});
    const { container } = await render(<ProfileScreen />);

    await press(getByLabel(container, "Delete account"));
    const [title, , buttons] = vi.mocked(Alert.alert).mock.calls[0] ?? [];
    expect(title).toBe("Delete account?");
    await act(async () => {
      buttons?.find((button) => button.text === "Delete account")?.onPress?.();
    });
    await flush();

    expect(mocks.api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("reloads on pull to refresh", async () => {
    const { container } = await render(<ProfileScreen />);

    await press(getByTestId(container, "refresh-control"));

    expect(mocks.api.getProfile).toHaveBeenCalledTimes(2);
    expect(mocks.api.getFriends).toHaveBeenCalledTimes(2);
  });
});
