import { describe, expect, it, vi } from "vitest";

import {
  PLAYER_SESSION_UNAVAILABLE_MESSAGE,
  ensurePlayerSession,
  isGuestUser,
} from "./player-session";

describe("ensurePlayerSession", () => {
  it("reuses an existing session without creating an anonymous user", async () => {
    const session = {
      access_token: "access",
      refresh_token: "refresh",
      user: { id: "user-1", is_anonymous: false },
    };
    const signInAnonymously = vi.fn();
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session }, error: null }),
        signInAnonymously,
      },
    } as any;

    await expect(ensurePlayerSession(client)).resolves.toBe(session);
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("creates exactly one anonymous session for concurrent callers", async () => {
    const session = {
      access_token: "access",
      refresh_token: "refresh",
      user: { id: "guest-1", is_anonymous: true },
    };
    let resolveAnonymous: ((value: unknown) => void) | null = null;
    const signInAnonymously = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveAnonymous = resolve;
      }),
    );
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously,
      },
    } as any;

    const first = ensurePlayerSession(client);
    const second = ensurePlayerSession(client);

    await Promise.resolve();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    resolveAnonymous?.({ data: { session }, error: null });

    await expect(first).resolves.toBe(session);
    await expect(second).resolves.toBe(session);
  });

  it("surfaces stable copy when anonymous auth is unavailable", async () => {
    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValue({ data: { session: null }, error: null }),
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: "Anonymous sign-ins are disabled" },
        }),
      },
    } as any;

    await expect(ensurePlayerSession(client)).rejects.toThrow(
      PLAYER_SESSION_UNAVAILABLE_MESSAGE,
    );
  });
});

describe("isGuestUser", () => {
  it("recognizes anonymous Supabase users", () => {
    expect(isGuestUser({ id: "guest-1", is_anonymous: true } as any)).toBe(
      true,
    );
    expect(isGuestUser({ id: "user-1", is_anonymous: false } as any)).toBe(
      false,
    );
    expect(isGuestUser(null)).toBe(false);
  });
});
