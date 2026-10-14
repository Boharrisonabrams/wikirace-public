import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  ensurePlayerSession,
  isGuestUser,
  PLAYER_SESSION_UNAVAILABLE_MESSAGE,
} from "./player-session";

const guestSession = {
  access_token: "guest-access-token",
  refresh_token: "guest-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "guest-uuid",
    is_anonymous: true,
  },
} as unknown as Session;

function clientWithAuth(auth: Record<string, unknown>): SupabaseClient {
  return { auth } as unknown as SupabaseClient;
}

describe("ensurePlayerSession", () => {
  it("reuses the persisted session without creating a new guest", async () => {
    const signInAnonymously = vi.fn();
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: guestSession },
        error: null,
      }),
      signInAnonymously,
    });

    await expect(ensurePlayerSession(client)).resolves.toBe(guestSession);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates exactly one persisted anonymous session when storage is empty", async () => {
    const signInAnonymously = vi.fn().mockResolvedValue({
      data: { session: guestSession, user: guestSession.user },
      error: null,
    });
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInAnonymously,
    });

    await expect(ensurePlayerSession(client)).resolves.toBe(guestSession);
    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("shares one anonymous bootstrap across concurrent consumers", async () => {
    let finishSignIn: (value: {
      data: { session: Session; user: Session["user"] };
      error: null;
    }) => void = () => {};
    const signInAnonymously = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finishSignIn = resolve;
      }),
    );
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInAnonymously,
    });

    const first = ensurePlayerSession(client);
    const second = ensurePlayerSession(client);
    await vi.waitFor(() => expect(signInAnonymously).toHaveBeenCalledOnce());
    finishSignIn({
      data: { session: guestSession, user: guestSession.user },
      error: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      guestSession,
      guestSession,
    ]);
  });

  it("returns stable recovery copy when hosted anonymous auth is disabled", async () => {
    expect(PLAYER_SESSION_UNAVAILABLE_MESSAGE).toBe(
      "Guest play is unavailable. Try again, or sign in with email.",
    );
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: {
          code: "anonymous_provider_disabled",
          message: "Anonymous sign-ins are disabled",
        },
      }),
    });

    await expect(ensurePlayerSession(client)).rejects.toThrow(
      "Guest play is unavailable. Try again, or sign in with email.",
    );
  });

  it("allows a failed bootstrap to be retried without changing clients", async () => {
    const signInAnonymously = vi
      .fn()
      .mockResolvedValueOnce({
        data: { session: null, user: null },
        error: new Error("network unavailable"),
      })
      .mockResolvedValueOnce({
        data: { session: guestSession, user: guestSession.user },
        error: null,
      });
    const client = clientWithAuth({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      signInAnonymously,
    });

    await expect(ensurePlayerSession(client)).rejects.toThrow(
      PLAYER_SESSION_UNAVAILABLE_MESSAGE,
    );
    await expect(ensurePlayerSession(client)).resolves.toBe(guestSession);
    expect(signInAnonymously).toHaveBeenCalledTimes(2);
  });
});

describe("isGuestUser", () => {
  it("distinguishes anonymous players from permanent users", () => {
    expect(isGuestUser(guestSession.user)).toBe(true);
    expect(isGuestUser({ ...guestSession.user, is_anonymous: false })).toBe(
      false,
    );
    expect(isGuestUser(null)).toBe(false);
  });
});
