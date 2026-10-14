import { describe, expect, it, vi } from "vitest";

import { completeEmailClaim, requestEmailClaim } from "./claim-account";

function session(userId: string, isAnonymous: boolean) {
  return {
    access_token: `access-${userId}`,
    refresh_token: `refresh-${userId}`,
    user: { id: userId, is_anonymous: isAnonymous },
  };
}

describe("requestEmailClaim", () => {
  it("starts claim mode from the active guest identity", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: session("guest-1", true) },
          error: null,
        }),
        updateUser: vi.fn().mockResolvedValue({
          data: { user: { id: "guest-1", is_anonymous: false } },
          error: null,
        }),
      },
    } as any;

    await expect(
      requestEmailClaim(client, { email: "guest@example.com" }),
    ).resolves.toEqual({
      status: "ready-for-password",
      userId: "guest-1",
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      email: "guest@example.com",
    });
  });
});

describe("completeEmailClaim", () => {
  it("verifies the guest email code, sets a password, and claims the profile", async () => {
    const claimProfile = vi.fn().mockResolvedValue(undefined);
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValueOnce({
            data: { session: session("guest-1", true) },
            error: null,
          })
          .mockResolvedValueOnce({
            data: { session: session("guest-1", false) },
            error: null,
          }),
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: session("guest-1", false) },
          error: null,
        }),
        updateUser: vi.fn().mockResolvedValue({
          data: { user: { id: "guest-1", is_anonymous: false } },
          error: null,
        }),
      },
    } as any;

    await expect(
      completeEmailClaim(client, {
        claimProfile,
        email: "guest@example.com",
        expectedUserId: "guest-1",
        password: "hunter22",
        verificationCode: "123456",
      }),
    ).resolves.toEqual({ status: "success", userId: "guest-1" });

    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      email: "guest@example.com",
      token: "123456",
      type: "email_change",
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      password: "hunter22",
    });
    expect(claimProfile).toHaveBeenCalledOnce();
  });
});
