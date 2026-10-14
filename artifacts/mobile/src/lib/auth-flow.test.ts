import { describe, expect, it, vi } from "vitest";

import {
  assertAppleState,
  buildInternalReturnPath,
  enrichAppleProfileBestEffort,
  formatAppleFullName,
  isAppleCancellation,
  normalizeReturnPath,
  parseAuthCallbackUrl,
  runGoogleOAuthFlow,
} from "./auth-flow";

describe("auth flow helpers", () => {
  it("accepts only internal return paths", () => {
    expect(normalizeReturnPath("/game?type=practice")).toBe(
      "/game?type=practice",
    );
    expect(normalizeReturnPath(undefined)).toBe("/");
    expect(normalizeReturnPath("https://evil.example")).toBe("/");
    expect(normalizeReturnPath("//evil.example")).toBe("/");
    expect(normalizeReturnPath("/\\evil")).toBe("/");
  });

  it("builds an encoded internal path without empty parameters", () => {
    expect(
      buildInternalReturnPath("/game", {
        type: "friend",
        challengeId: undefined,
        friendChallengeId: "challenge / one",
      }),
    ).toBe("/game?type=friend&friendChallengeId=challenge%20%2F%20one");
  });

  it("parses Supabase tokens from the callback fragment", () => {
    expect(
      parseAuthCallbackUrl(
        "wikipath://auth/callback?next=%2Fgame%3Ftype%3Dpractice#access_token=access-token&refresh_token=refresh-token&token_type=bearer",
      ),
    ).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      next: "/game?type=practice",
      error: null,
      errorCode: null,
    });
  });

  it("preserves a provider callback error for the UI", () => {
    expect(
      parseAuthCallbackUrl(
        "wikipath://auth/callback?next=%2F#error=access_denied&error_description=Google+denied+access",
      ),
    ).toMatchObject({
      next: "/",
      error: "Google denied access",
      errorCode: "access_denied",
    });
  });

  it("completes a successful Google browser callback once", async () => {
    const createOAuthUrl = vi.fn().mockResolvedValue("https://provider.test");
    const openAuthSession = vi.fn().mockResolvedValue({
      type: "success",
      url: "wikipath://auth/callback#access_token=a&refresh_token=b",
    });
    const completeCallback = vi.fn().mockResolvedValue({
      next: "/leaderboard",
      userId: "user-1",
    });

    await expect(
      runGoogleOAuthFlow({
        createOAuthUrl,
        openAuthSession,
        completeCallback,
      }),
    ).resolves.toEqual({ status: "success", next: "/leaderboard" });
    expect(createOAuthUrl).toHaveBeenCalledOnce();
    expect(openAuthSession).toHaveBeenCalledWith("https://provider.test");
    expect(completeCallback).toHaveBeenCalledOnce();
  });

  it.each(["cancel", "dismiss"])(
    "treats Google browser %s as cancellation",
    async (type) => {
      const completeCallback = vi.fn();
      await expect(
        runGoogleOAuthFlow({
          createOAuthUrl: async () => "https://provider.test",
          openAuthSession: async () => ({ type }),
          completeCallback,
        }),
      ).resolves.toEqual({ status: "cancelled" });
      expect(completeCallback).not.toHaveBeenCalled();
    },
  );

  it("rejects a browser result that never returned to WikiRace", async () => {
    await expect(
      runGoogleOAuthFlow({
        createOAuthUrl: async () => "https://provider.test",
        openAuthSession: async () => ({ type: "opened" }),
        completeCallback: vi.fn(),
      }),
    ).rejects.toThrow("Google sign-in did not return to WikiRace.");
  });

  it("formats the first Apple name without null gaps", () => {
    expect(
      formatAppleFullName({
        givenName: "Ada",
        middleName: null,
        familyName: "Lovelace",
      }),
    ).toBe("Ada Lovelace");
    expect(formatAppleFullName(null)).toBeNull();
  });

  it("keeps Apple sign-in successful when optional profile enrichment fails", async () => {
    const updateUserMetadata = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new Error("metadata unavailable"));
    const updateProfile = vi.fn<() => Promise<void>>(() => {
      throw new Error("profile unavailable");
    });

    await expect(
      enrichAppleProfileBestEffort({ updateUserMetadata, updateProfile }),
    ).resolves.toHaveLength(2);
    expect(updateUserMetadata).toHaveBeenCalledOnce();
    expect(updateProfile).toHaveBeenCalledOnce();
  });

  it("classifies Apple cancellation and validates returned state", () => {
    expect(isAppleCancellation({ code: "ERR_REQUEST_CANCELED" })).toBe(true);
    expect(
      isAppleCancellation(
        {
          code: "ERR_REQUEST_UNKNOWN",
          message: "The authorization attempt failed for an unknown reason",
        },
        true,
      ),
    ).toBe(true);
    expect(isAppleCancellation({ code: "ERR_REQUEST_UNKNOWN" })).toBe(false);
    expect(isAppleCancellation(new Error("network failure"))).toBe(false);
    expect(() => assertAppleState("state-1", "state-1")).not.toThrow();
    expect(() => assertAppleState("state-1", "state-2")).toThrow(
      "Apple sign-in state did not match.",
    );
  });
});
