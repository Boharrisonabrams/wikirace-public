import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: vi.fn() }));
vi.mock("./auth-callback", () => ({ completeAuthCallback: vi.fn() }));
vi.mock("./auth-transaction", () => ({ peekAuthTransaction: vi.fn() }));

import {
  finishAuthCallbackRoute,
  resolveAuthCallbackRecovery,
} from "./auth-callback-route";

describe("cold auth callback routing", () => {
  it("finalizes a cold claim before returning to the preserved next route", async () => {
    const claimProfile = vi.fn().mockResolvedValue(undefined);

    await expect(
      finishAuthCallbackRoute("wikipath://auth/callback", {
        claimProfile,
        completeCallback: vi.fn().mockResolvedValue({
          expectedGuestUserId: "guest-uuid",
          mode: "claim",
          next: "/result?sessionId=one",
          userId: "guest-uuid",
        }),
      }),
    ).resolves.toEqual({ next: "/result?sessionId=one" });
    expect(claimProfile).toHaveBeenCalledOnce();
  });

  it("recovers a failed cold claim to signup claim mode with its safe next", async () => {
    let failure: unknown;
    try {
      await finishAuthCallbackRoute("wikipath://auth/callback", {
        claimProfile: vi
          .fn()
          .mockRejectedValue(new Error("profile unavailable")),
        completeCallback: vi.fn().mockResolvedValue({
          expectedGuestUserId: "guest-uuid",
          mode: "claim",
          next: "/leaderboard",
          userId: "guest-uuid",
        }),
      });
    } catch (error) {
      failure = error;
    }

    expect(failure).toMatchObject({
      message: "profile unavailable",
      mode: "claim",
      next: "/leaderboard",
    });
    await expect(resolveAuthCallbackRecovery(failure)).resolves.toEqual({
      destination: {
        pathname: "/signup",
        params: { mode: "claim", next: "/leaderboard" },
      },
      label: "Back to account setup",
      mode: "claim",
      next: "/leaderboard",
    });
  });

  it("keeps permanent sign-in behavior and does not claim a profile", async () => {
    const claimProfile = vi.fn();
    await expect(
      finishAuthCallbackRoute("wikipath://auth/callback", {
        claimProfile,
        completeCallback: vi.fn().mockResolvedValue({
          expectedGuestUserId: null,
          mode: "signin",
          next: "/leaderboard",
          userId: "permanent-uuid",
        }),
      }),
    ).resolves.toEqual({ next: "/leaderboard" });
    expect(claimProfile).not.toHaveBeenCalled();

    await expect(
      resolveAuthCallbackRecovery({
        mode: "signin",
        next: "/leaderboard",
      }),
    ).resolves.toEqual({
      destination: {
        pathname: "/login",
        params: { next: "/leaderboard" },
      },
      label: "Back to sign in",
      mode: "signin",
      next: "/leaderboard",
    });
  });
});
