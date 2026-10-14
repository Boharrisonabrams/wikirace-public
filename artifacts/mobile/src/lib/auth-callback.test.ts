import type { Session, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    getSession: vi.fn(),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    setSession: vi.fn(),
    storage,
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: mocks.getItem,
    removeItem: mocks.removeItem,
    setItem: mocks.setItem,
  },
}));

vi.mock("expo-auth-session", () => ({
  makeRedirectUri: vi.fn((options: { native: string }) => options.native),
}));

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "8bd6cb2b-442f-4aa8-81f0-fb93db44db43"),
}));

vi.mock("./supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: mocks.getSession,
      setSession: mocks.setSession,
    },
  }),
}));

import {
  beginAuthCallback,
  completeAuthCallback,
  getAuthRedirectUri,
} from "./auth-callback";

function authUser(id: string, isAnonymous: boolean): User {
  return {
    id,
    is_anonymous: isAnonymous,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-10T00:00:00.000Z",
  };
}

function authSession(id: string, isAnonymous: boolean): Session {
  return {
    access_token: `${id}-access`,
    refresh_token: `${id}-refresh`,
    expires_in: 3600,
    token_type: "bearer",
    user: authUser(id, isAnonymous),
  };
}

describe("auth callback completion", () => {
  beforeEach(() => {
    mocks.storage.clear();
    mocks.getItem.mockClear();
    mocks.getSession.mockReset();
    mocks.removeItem.mockClear();
    mocks.setItem.mockClear();
    mocks.setSession.mockReset();
  });

  it("issues a preferred WikiRace callback before installing a sign-in session", async () => {
    const permanent = authSession("user-1", false);
    mocks.setSession.mockResolvedValue({
      data: { session: permanent, user: permanent.user },
      error: null,
    });
    const transaction = await beginAuthCallback({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/leaderboard",
    });

    expect(transaction.redirectBase).toBe("wikirace://auth/callback");
    await expect(
      completeAuthCallback(
        `${transaction.redirectUri}#access_token=access&refresh_token=refresh`,
      ),
    ).resolves.toEqual({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/leaderboard",
      userId: "user-1",
    });
    expect(mocks.setSession).toHaveBeenCalledOnce();
  });

  it("accepts the exact legacy WikiPath callback for a new WikiRace transaction", async () => {
    const permanent = authSession("user-1", false);
    mocks.setSession.mockResolvedValue({
      data: { session: permanent, user: permanent.user },
      error: null,
    });
    const transaction = await beginAuthCallback({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/leaderboard",
    });
    const legacyCallback = transaction.redirectUri.replace(
      "wikirace://auth/callback",
      "wikipath://auth/callback",
    );

    await expect(
      completeAuthCallback(
        `${legacyCallback}#access_token=access&refresh_token=refresh`,
      ),
    ).resolves.toMatchObject({ next: "/leaderboard", userId: "user-1" });
  });

  it.each([
    {
      label: "missing flow ID",
      url: "wikirace://auth/callback#access_token=a&refresh_token=b",
    },
    {
      label: "wrong flow ID",
      url: "wikirace://auth/callback?flow_id=wrong#access_token=a&refresh_token=b",
    },
    {
      label: "unexpected callback URI",
      url: "other://auth/callback?flow_id=8bd6cb2b-442f-4aa8-81f0-fb93db44db43#access_token=a&refresh_token=b",
    },
  ])("never installs tokens for a callback with $label", async ({ url }) => {
    await beginAuthCallback({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/",
    });

    await expect(completeAuthCallback(url)).rejects.toBeInstanceOf(Error);
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("deduplicates a simultaneous callback but rejects its later replay", async () => {
    const permanent = authSession("user-1", false);
    let resolveSession: (value: {
      data: { session: Session; user: User };
      error: null;
    }) => void = () => {};
    mocks.setSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const transaction = await beginAuthCallback({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/",
    });
    const callback = `${transaction.redirectUri}#access_token=a&refresh_token=b`;

    const first = completeAuthCallback(callback);
    const simultaneous = completeAuthCallback(callback);
    expect(simultaneous).toBe(first);
    resolveSession({
      data: { session: permanent, user: permanent.user },
      error: null,
    });
    await first;
    await expect(completeAuthCallback(callback)).rejects.toMatchObject({
      code: "missing_transaction",
    });
    expect(mocks.setSession).toHaveBeenCalledOnce();
  });

  it("keeps provider error context for claim recovery and consumes the flow", async () => {
    const guest = authSession("guest-uuid", true);
    mocks.getSession.mockResolvedValue({
      data: { session: guest },
      error: null,
    });
    const transaction = await beginAuthCallback({
      expectedGuestUserId: "guest-uuid",
      mode: "claim",
      next: "/result",
    });

    await expect(
      completeAuthCallback(
        `${transaction.redirectUri}&error_code=identity_already_exists&error_description=Identity+already+linked`,
      ),
    ).rejects.toMatchObject({
      code: "identity_already_exists",
      message: "Identity already linked",
      mode: "claim",
      next: "/result",
    });
    await expect(
      completeAuthCallback(
        `${transaction.redirectUri}#access_token=a&refresh_token=b`,
      ),
    ).rejects.toMatchObject({ code: "missing_transaction" });
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("restores the prior guest if a claim callback installs a different UUID", async () => {
    const guest = authSession("guest-uuid", true);
    const wrongAccount = authSession("other-uuid", false);
    mocks.getSession.mockResolvedValue({
      data: { session: guest },
      error: null,
    });
    mocks.setSession
      .mockResolvedValueOnce({
        data: { session: wrongAccount, user: wrongAccount.user },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { session: guest, user: guest.user },
        error: null,
      });
    const transaction = await beginAuthCallback({
      expectedGuestUserId: "guest-uuid",
      mode: "claim",
      next: "/",
    });

    await expect(
      completeAuthCallback(
        `${transaction.redirectUri}#access_token=wrong-access&refresh_token=wrong-refresh`,
      ),
    ).rejects.toMatchObject({
      code: "claim_user_mismatch",
      mode: "claim",
      next: "/",
    });
    expect(mocks.setSession).toHaveBeenNthCalledWith(2, {
      access_token: guest.access_token,
      refresh_token: guest.refresh_token,
    });
  });

  it("keeps the legacy email redirect internal without issuing an OAuth flow", () => {
    expect(getAuthRedirectUri("https://evil.example")).toBe(
      "wikirace://auth/callback?next=%2F",
    );
    expect(mocks.setItem).not.toHaveBeenCalled();
  });
});
