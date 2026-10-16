import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { completeEmailClaim } from "./claim-account";

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

describe("completeEmailClaim", () => {
  it("verifies the guest email code, sets a password, and claims the profile", async () => {
    const claimProfile = vi.fn().mockResolvedValue(undefined);
    const client = clientWithAuth({
      getSession: vi
        .fn()
        .mockResolvedValueOnce({
          data: { session: session(user("guest-1", true)) },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { session: session(user("guest-1", false)) },
          error: null,
        }),
      verifyOtp: vi.fn().mockResolvedValue({
        data: { session: session(user("guest-1", false)) },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: { id: "guest-1", is_anonymous: false } },
        error: null,
      }),
    });

    await expect(
      completeEmailClaim(client, {
        claimProfile,
        email: "guest@example.com",
        expectedUserId: "guest-1",
        password: "hunter22",
        verificationCode: "123456",
      })
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

describe("completeEmailClaim guards", () => {
  const claimOptions = {
    email: "player@example.com",
    expectedUserId: "guest-uuid",
    password: "correct horse battery staple",
    verificationCode: "123456",
  };

  it("stops when the player session is missing or unreadable", async () => {
    const claimProfile = vi.fn();
    const sessionError = new Error("storage unavailable");

    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: null,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toThrow("Your player session is missing.");
    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession: vi.fn().mockResolvedValue({
            data: { session: null },
            error: sessionError,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toBe(sessionError);
    expect(claimProfile).not.toHaveBeenCalled();
  });

  it("stops before verifying when the session belongs to another player", async () => {
    const verifyOtp = vi.fn();
    const updateUser = vi.fn();
    const claimProfile = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: session(user("other-uuid", true)) },
        error: null,
      }),
      updateUser,
      verifyOtp,
    });

    await expect(completeEmailClaim(client, { ...claimOptions, claimProfile })).rejects.toThrow(
      "Account claiming stopped because the player identity changed."
    );
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
  });

  it("surfaces verification errors and a verification without a session", async () => {
    const guest = session(user("guest-uuid", true));
    const verifyError = new Error("Token has expired or is invalid");
    const claimProfile = vi.fn();
    const getSession = vi.fn().mockResolvedValue({
      data: { session: guest },
      error: null,
    });

    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession,
          verifyOtp: vi.fn().mockResolvedValue({
            data: { session: null, user: null },
            error: verifyError,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toBe(verifyError);
    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession,
          verifyOtp: vi.fn().mockResolvedValue({
            data: { session: null, user: null },
            error: null,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toThrow("Email verification did not create a session.");
    expect(claimProfile).not.toHaveBeenCalled();
  });

  it("rejects a verified session for a different player", async () => {
    const updateUser = vi.fn();
    const claimProfile = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: session(user("guest-uuid", true)) },
        error: null,
      }),
      updateUser,
      verifyOtp: vi.fn().mockResolvedValue({
        data: { session: session(user("other-uuid", false)), user: null },
        error: null,
      }),
    });

    await expect(completeEmailClaim(client, { ...claimOptions, claimProfile })).rejects.toThrow(
      "Account claiming stopped because the player identity changed."
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
  });

  it("refuses to set a password while the player is still anonymous", async () => {
    const guest = session(user("guest-uuid", true));
    const updateUser = vi.fn();
    const claimProfile = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guest },
        error: null,
      }),
      updateUser,
      verifyOtp: vi.fn().mockResolvedValue({
        data: { session: guest, user: guest.user },
        error: null,
      }),
    });

    await expect(completeEmailClaim(client, { ...claimOptions, claimProfile })).rejects.toThrow(
      "Verify your email before creating a password."
    );
    expect(updateUser).not.toHaveBeenCalled();
    expect(claimProfile).not.toHaveBeenCalled();
  });

  it("stops before claiming when the password update fails or changes the player", async () => {
    const permanent = session(user("guest-uuid", false));
    const passwordError = new Error("Password is too weak");
    const claimProfile = vi.fn();
    const getSession = vi.fn().mockResolvedValue({
      data: { session: permanent },
      error: null,
    });

    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession,
          updateUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: passwordError,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toBe(passwordError);
    await expect(
      completeEmailClaim(
        clientWithAuth({
          getSession,
          updateUser: vi.fn().mockResolvedValue({
            data: { user: user("other-uuid", false) },
            error: null,
          }),
        }),
        { ...claimOptions, claimProfile }
      )
    ).rejects.toThrow("Account claiming stopped because the player identity changed.");
    expect(claimProfile).not.toHaveBeenCalled();
  });
});
