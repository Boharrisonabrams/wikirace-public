import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ACCOUNT_CLAIM_CONFLICT_MESSAGE,
  claimWithOAuth,
  completeEmailClaim,
  requestEmailClaim,
} from "./claim-account";

function user(id: string, isAnonymous: boolean): User {
  return {
    id,
    is_anonymous: isAnonymous,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-10T00:00:00.000Z",
  };
}

function session(currentUser: User): Session {
  return {
    access_token: `${currentUser.id}-access`,
    refresh_token: `${currentUser.id}-refresh`,
    expires_in: 3600,
    token_type: "bearer",
    user: currentUser,
  };
}

function clientWithAuth(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("email guest claim", () => {
  it("verifies email before setting a password and claims the same UUID", async () => {
    const guest = session(user("guest-uuid", true));
    const permanent = session(user("guest-uuid", false));
    let currentSession = guest;
    const calls: string[] = [];
    const updateUser = vi.fn(
      async (attributes: { email?: string; password?: string }) => {
        if (attributes.email) {
          calls.push("email");
          return { data: { user: guest.user }, error: null };
        }
        calls.push("password");
        expect(currentSession.user.is_anonymous).toBe(false);
        return { data: { user: permanent.user }, error: null };
      },
    );
    const client = clientWithAuth({
      getSession: vi.fn(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      updateUser,
      verifyOtp: vi.fn(async () => {
        calls.push("verify");
        currentSession = permanent;
        return {
          data: { session: permanent, user: permanent.user },
          error: null,
        };
      }),
    });
    const claimProfile = vi.fn(async () => {
      calls.push("profile");
      expect(currentSession.user.id).toBe("guest-uuid");
      expect(currentSession.user.is_anonymous).toBe(false);
    });

    const requested = await requestEmailClaim(client, {
      email: "player@example.com",
    });
    await expect(
      completeEmailClaim(client, {
        email: "player@example.com",
        expectedUserId: requested.userId,
        password: "correct horse battery staple",
        verificationCode: "123456",
        claimProfile,
      }),
    ).resolves.toEqual({ status: "success", userId: "guest-uuid" });

    expect(calls).toEqual(["email", "verify", "password", "profile"]);
    expect(updateUser).toHaveBeenNthCalledWith(1, {
      email: "player@example.com",
    });
    expect(updateUser).toHaveBeenNthCalledWith(2, {
      password: "correct horse battery staple",
    });
  });

  it("keeps the guest session and returns explicit copy for an existing email", async () => {
    const guest = session(user("guest-uuid", true));
    const getSession = vi.fn().mockResolvedValue({
      data: { session: guest },
      error: null,
    });
    const client = clientWithAuth({
      getSession,
      updateUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: {
          code: "email_exists",
          message: "A user with this email address has already been registered",
        },
      }),
    });

    await expect(
      requestEmailClaim(client, { email: "existing@example.com" }),
    ).rejects.toMatchObject({
      code: "account_conflict",
      message: ACCOUNT_CLAIM_CONFLICT_MESSAGE,
    });
    await expect(client.auth.getSession()).resolves.toMatchObject({
      data: {
        session: {
          user: { id: "guest-uuid", is_anonymous: true },
        },
      },
    });
  });

  it("skips OTP only when Supabase has already made the same UUID permanent", async () => {
    const guest = session(user("guest-uuid", true));
    const permanent = session(user("guest-uuid", false));
    let currentSession = guest;
    const verifyOtp = vi.fn();
    const updateUser = vi.fn(
      async (attributes: { email?: string; password?: string }) => {
        if (attributes.email) {
          currentSession = permanent;
          return { data: { user: permanent.user }, error: null };
        }
        return { data: { user: permanent.user }, error: null };
      },
    );
    const client = clientWithAuth({
      getSession: vi.fn(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      updateUser,
      verifyOtp,
    });
    const claimProfile = vi.fn();

    await expect(
      requestEmailClaim(client, { email: "player@example.com" }),
    ).resolves.toEqual({ status: "ready-for-password", userId: "guest-uuid" });
    await expect(
      completeEmailClaim(client, {
        email: "player@example.com",
        expectedUserId: "guest-uuid",
        password: "correct horse battery staple",
        verificationCode: "",
        claimProfile,
      }),
    ).resolves.toEqual({ status: "success", userId: "guest-uuid" });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(claimProfile).toHaveBeenCalledOnce();
  });
});

describe("OAuth guest claim", () => {
  it("identifies WikiRace when account linking does not return", async () => {
    const guest = session(user("guest-uuid", true));
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guest },
        error: null,
      }),
      linkIdentity: vi.fn().mockResolvedValue({
        data: { provider: "google", url: "https://provider.test/link" },
        error: null,
      }),
      setSession: vi.fn(),
    });

    await expect(
      claimWithOAuth(client, {
        provider: "google",
        redirectTo: "wikirace://auth/callback",
        openAuthSession: vi.fn().mockResolvedValue({ type: "opened" }),
        completeCallback: vi.fn(),
        claimProfile: vi.fn(),
      }),
    ).rejects.toThrow("Account linking did not return to WikiRace.");
  });

  it("treats browser cancellation as non-destructive", async () => {
    const guest = session(user("guest-uuid", true));
    const claimProfile = vi.fn();
    const completeCallback = vi.fn();
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { provider: "google", url: "https://provider.test/link" },
      error: null,
    });
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guest },
        error: null,
      }),
      linkIdentity,
      setSession: vi.fn(),
    });

    await expect(
      claimWithOAuth(client, {
        provider: "google",
        redirectTo: "wikipath://auth/callback?next=%2Fresult",
        openAuthSession: vi.fn().mockResolvedValue({ type: "cancel" }),
        completeCallback,
        claimProfile,
      }),
    ).resolves.toEqual({ status: "cancelled" });

    expect(linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "wikipath://auth/callback?next=%2Fresult",
        skipBrowserRedirect: true,
      },
    });
    expect(completeCallback).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
    expect(client.auth.setSession).not.toHaveBeenCalled();
    await expect(client.auth.getSession()).resolves.toMatchObject({
      data: { session: { user: { id: "guest-uuid", is_anonymous: true } } },
    });
  });

  it.each(["google", "apple"] as const)(
    "links %s in claim mode and finalizes only the same UUID",
    async (provider) => {
      const guest = session(user("guest-uuid", true));
      const permanent = session(user("guest-uuid", false));
      let currentSession = guest;
      const signInWithOAuth = vi.fn();
      const signInWithIdToken = vi.fn();
      const linkIdentity = vi.fn().mockResolvedValue({
        data: { provider, url: `https://${provider}.test/link` },
        error: null,
      });
      const client = clientWithAuth({
        getSession: vi.fn(async () => ({
          data: { session: currentSession },
          error: null,
        })),
        linkIdentity,
        setSession: vi.fn(),
        signInWithIdToken,
        signInWithOAuth,
      });
      const claimProfile = vi.fn(async () => {
        expect(currentSession.user.id).toBe("guest-uuid");
        expect(currentSession.user.is_anonymous).toBe(false);
      });

      await expect(
        claimWithOAuth(client, {
          provider,
          redirectTo: "wikipath://auth/callback?next=%2Fresult",
          openAuthSession: vi.fn().mockResolvedValue({
            type: "success",
            url: "wikipath://auth/callback#access_token=a&refresh_token=b",
          }),
          completeCallback: vi.fn(async () => {
            currentSession = permanent;
            return { userId: permanent.user.id };
          }),
          claimProfile,
        }),
      ).resolves.toEqual({ status: "success", userId: "guest-uuid" });

      expect(linkIdentity).toHaveBeenCalledWith({
        provider,
        options: {
          redirectTo: "wikipath://auth/callback?next=%2Fresult",
          skipBrowserRedirect: true,
        },
      });
      expect(signInWithOAuth).not.toHaveBeenCalled();
      expect(signInWithIdToken).not.toHaveBeenCalled();
      expect(claimProfile).toHaveBeenCalledOnce();
    },
  );

  it("preserves the guest when the provider identity belongs to another account", async () => {
    const guest = session(user("guest-uuid", true));
    const claimProfile = vi.fn();
    const setSession = vi.fn();
    const conflict = Object.assign(
      new Error("Identity is already linked to another user"),
      { code: "identity_already_exists" },
    );
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guest },
        error: null,
      }),
      linkIdentity: vi.fn().mockResolvedValue({
        data: { provider: "google", url: "https://provider.test/link" },
        error: null,
      }),
      setSession,
    });

    await expect(
      claimWithOAuth(client, {
        provider: "google",
        redirectTo: "wikipath://auth/callback",
        openAuthSession: vi.fn().mockResolvedValue({
          type: "success",
          url: "wikipath://auth/callback?error_code=identity_already_exists",
        }),
        completeCallback: vi.fn().mockRejectedValue(conflict),
        claimProfile,
      }),
    ).rejects.toMatchObject({
      code: "account_conflict",
      message: ACCOUNT_CLAIM_CONFLICT_MESSAGE,
    });

    expect(setSession).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
    await expect(client.auth.getSession()).resolves.toMatchObject({
      data: { session: { user: { id: "guest-uuid", is_anonymous: true } } },
    });
  });

  it("keeps the guest session after a non-conflict provider callback error", async () => {
    const guest = session(user("guest-uuid", true));
    const setSession = vi.fn();
    const claimProfile = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guest },
        error: null,
      }),
      linkIdentity: vi.fn().mockResolvedValue({
        data: { provider: "google", url: "https://provider.test/link" },
        error: null,
      }),
      setSession,
    });

    await expect(
      claimWithOAuth(client, {
        provider: "google",
        redirectTo: "wikipath://auth/callback",
        openAuthSession: vi.fn().mockResolvedValue({
          type: "success",
          url: "wikipath://auth/callback?error=server_error",
        }),
        completeCallback: vi
          .fn()
          .mockRejectedValue(new Error("Provider unavailable")),
        claimProfile,
      }),
    ).rejects.toThrow("Provider unavailable");

    expect(setSession).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
    await expect(client.auth.getSession()).resolves.toMatchObject({
      data: { session: { user: { id: "guest-uuid", is_anonymous: true } } },
    });
  });

  it("restores the guest tokens if a callback ever changes the UUID", async () => {
    const guest = session(user("guest-uuid", true));
    const wrongAccount = session(user("other-uuid", false));
    let currentSession = guest;
    const setSession = vi.fn(async () => {
      currentSession = guest;
      return { data: { session: guest, user: guest.user }, error: null };
    });
    const claimProfile = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      linkIdentity: vi.fn().mockResolvedValue({
        data: { provider: "google", url: "https://provider.test/link" },
        error: null,
      }),
      setSession,
    });

    await expect(
      claimWithOAuth(client, {
        provider: "google",
        redirectTo: "wikipath://auth/callback",
        openAuthSession: vi.fn().mockResolvedValue({
          type: "success",
          url: "wikipath://auth/callback#access_token=a&refresh_token=b",
        }),
        completeCallback: vi.fn(async () => {
          currentSession = wrongAccount;
          return { userId: wrongAccount.user.id };
        }),
        claimProfile,
      }),
    ).rejects.toThrow("player identity changed");

    expect(setSession).toHaveBeenCalledWith({
      access_token: guest.access_token,
      refresh_token: guest.refresh_token,
    });
    expect(claimProfile).not.toHaveBeenCalled();
    expect(currentSession.user.id).toBe("guest-uuid");
    expect(currentSession.user.is_anonymous).toBe(true);
  });

  it("retries profile finalization without relinking a permanent same-UUID user", async () => {
    const guest = session(user("guest-uuid", true));
    const permanent = session(user("guest-uuid", false));
    let currentSession = guest;
    const linkIdentity = vi.fn().mockResolvedValue({
      data: { provider: "google", url: "https://provider.test/link" },
      error: null,
    });
    const client = clientWithAuth({
      getSession: vi.fn(async () => ({
        data: { session: currentSession },
        error: null,
      })),
      linkIdentity,
      setSession: vi.fn(),
    });
    const claimProfile = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("temporary API failure"))
      .mockResolvedValueOnce();
    const options = {
      provider: "google" as const,
      redirectTo: "wikipath://auth/callback",
      openAuthSession: vi.fn().mockResolvedValue({
        type: "success",
        url: "wikipath://auth/callback#access_token=a&refresh_token=b",
      }),
      completeCallback: vi.fn(async () => {
        currentSession = permanent;
        return { userId: permanent.user.id };
      }),
      claimProfile,
    };

    await expect(claimWithOAuth(client, options)).rejects.toThrow(
      "temporary API failure",
    );
    await expect(claimWithOAuth(client, options)).resolves.toEqual({
      status: "success",
      userId: "guest-uuid",
    });

    expect(linkIdentity).toHaveBeenCalledOnce();
    expect(options.openAuthSession).toHaveBeenCalledOnce();
    expect(options.completeCallback).toHaveBeenCalledOnce();
    expect(claimProfile).toHaveBeenCalledTimes(2);
  });
});
