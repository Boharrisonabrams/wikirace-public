import type { Session, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  beginAuthCallback: vi.fn(),
  cancelAuthTransaction: vi.fn(),
  completeAuthCallback: vi.fn(),
  getSession: vi.fn(),
  linkIdentity: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  runGoogleOAuthFlow: vi.fn(),
  setSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("expo-web-browser", () => ({
  openAuthSessionAsync: mocks.openAuthSessionAsync,
}));

vi.mock("@/lib/api", () => ({ api: mocks.api }));

vi.mock("@/lib/auth-callback", () => ({
  beginAuthCallback: mocks.beginAuthCallback,
  completeAuthCallback: mocks.completeAuthCallback,
}));

vi.mock("@/lib/auth-transaction", () => ({
  cancelAuthTransaction: mocks.cancelAuthTransaction,
}));

vi.mock("@/lib/auth-flow", () => ({
  normalizeReturnPath: (value: unknown) =>
    typeof value === "string" && value.startsWith("/") ? value : "/",
  runGoogleOAuthFlow: mocks.runGoogleOAuthFlow,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    auth: {
      getSession: mocks.getSession,
      linkIdentity: mocks.linkIdentity,
      setSession: mocks.setSession,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

import { signInWithGoogle } from "./social-auth";

function authUser(isAnonymous: boolean): User {
  return {
    id: "guest-uuid",
    is_anonymous: isAnonymous,
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-07-10T00:00:00.000Z",
  };
}

function authSession(isAnonymous: boolean): Session {
  const user = authUser(isAnonymous);
  return {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
}

describe("Google auth mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.beginAuthCallback.mockResolvedValue({
      flowId: "flow-id",
      redirectUri:
        "wikipath://auth/callback?flow_id=flow-id&mode=signin&next=%2F",
    });
    mocks.cancelAuthTransaction.mockResolvedValue(undefined);
  });

  it("uses linkIdentity in claim mode and finalizes the same player", async () => {
    const guest = authSession(true);
    const permanent = authSession(false);
    mocks.getSession
      .mockResolvedValueOnce({ data: { session: guest }, error: null })
      .mockResolvedValueOnce({ data: { session: guest }, error: null })
      .mockResolvedValueOnce({ data: { session: permanent }, error: null });
    mocks.beginAuthCallback.mockResolvedValue({
      flowId: "claim-flow",
      redirectUri:
        "wikipath://auth/callback?flow_id=claim-flow&mode=claim&next=%2Fresult",
    });
    mocks.linkIdentity.mockResolvedValue({
      data: { provider: "google", url: "https://google.test/link" },
      error: null,
    });
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "wikipath://auth/callback#access_token=a&refresh_token=b",
    });
    mocks.completeAuthCallback.mockResolvedValue({
      expectedGuestUserId: "guest-uuid",
      mode: "claim",
      next: "/result",
      userId: "guest-uuid",
    });
    mocks.api.mockResolvedValue({ claimed: true });

    await expect(signInWithGoogle("/result", "claim")).resolves.toEqual({
      status: "success",
      next: "/result",
    });

    expect(mocks.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "wikipath://auth/callback?flow_id=claim-flow&mode=claim&next=%2Fresult",
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.beginAuthCallback).toHaveBeenCalledWith({
      expectedGuestUserId: "guest-uuid",
      mode: "claim",
      next: "/result",
    });
    expect(mocks.cancelAuthTransaction).toHaveBeenCalledWith("claim-flow");
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(mocks.api).toHaveBeenCalledWith("/profile/claim", {
      method: "POST",
    });
  });

  it("keeps permanent sign-in as the default mode", async () => {
    mocks.beginAuthCallback.mockResolvedValue({
      flowId: "signin-flow",
      redirectUri:
        "wikipath://auth/callback?flow_id=signin-flow&mode=signin&next=%2Fleaderboard",
    });
    mocks.signInWithOAuth.mockResolvedValue({
      data: { provider: "google", url: "https://google.test/signin" },
      error: null,
    });
    mocks.openAuthSessionAsync.mockResolvedValue({
      type: "success",
      url: "wikipath://auth/callback#access_token=a&refresh_token=b",
    });
    mocks.completeAuthCallback.mockResolvedValue({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/leaderboard",
      userId: "permanent-uuid",
    });
    mocks.runGoogleOAuthFlow.mockImplementation(async (dependencies) => {
      const providerUrl = await dependencies.createOAuthUrl();
      const browserResult = await dependencies.openAuthSession(providerUrl);
      const callback = await dependencies.completeCallback(browserResult.url);
      return { status: "success", next: callback.next };
    });

    await expect(signInWithGoogle("/leaderboard")).resolves.toEqual({
      status: "success",
      next: "/leaderboard",
    });

    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "wikipath://auth/callback?flow_id=signin-flow&mode=signin&next=%2Fleaderboard",
        skipBrowserRedirect: true,
      },
    });
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
    expect(mocks.api).not.toHaveBeenCalled();
    expect(mocks.beginAuthCallback).toHaveBeenCalledWith({
      expectedGuestUserId: null,
      mode: "signin",
      next: "/leaderboard",
    });
    expect(mocks.cancelAuthTransaction).toHaveBeenCalledWith("signin-flow");
  });

  it("clears the issued transaction when the browser is cancelled", async () => {
    mocks.beginAuthCallback.mockResolvedValue({
      flowId: "cancelled-flow",
      redirectUri:
        "wikipath://auth/callback?flow_id=cancelled-flow&mode=signin&next=%2F",
    });
    mocks.runGoogleOAuthFlow.mockResolvedValue({ status: "cancelled" });

    await expect(signInWithGoogle()).resolves.toEqual({ status: "cancelled" });
    expect(mocks.cancelAuthTransaction).toHaveBeenCalledWith("cancelled-flow");
  });

  it("retries only profile finalization for a permanent unclaimed player", async () => {
    const permanent = authSession(false);
    mocks.getSession.mockResolvedValue({
      data: { session: permanent },
      error: null,
    });
    mocks.api.mockResolvedValue({ claimed: true });

    await expect(signInWithGoogle("/", "claim")).resolves.toEqual({
      status: "success",
      next: "/",
    });
    expect(mocks.api).toHaveBeenCalledWith("/profile/claim", {
      method: "POST",
    });
    expect(mocks.beginAuthCallback).not.toHaveBeenCalled();
    expect(mocks.linkIdentity).not.toHaveBeenCalled();
    expect(mocks.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
