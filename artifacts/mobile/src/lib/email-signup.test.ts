import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("./auth-callback", () => ({ beginAuthCallback: vi.fn() }));
vi.mock("./auth-transaction", () => ({ cancelAuthTransaction: vi.fn() }));

import { signUpWithBoundCallback } from "./email-signup";

const emailTransaction = {
  version: 1 as const,
  expectedGuestUserId: null,
  expiresAt: 601_000,
  flowId: "email-flow",
  issuedAt: 1_000,
  mode: "signin" as const,
  next: "/leaderboard",
  redirectBase: "wikipath://auth/callback",
  redirectUri:
    "wikipath://auth/callback?flow_id=email-flow&mode=signin&next=%2Fleaderboard",
};

function clientWithSignUp(signUp: ReturnType<typeof vi.fn>): SupabaseClient {
  return { auth: { signUp } } as unknown as SupabaseClient;
}

describe("permanent email signup callback", () => {
  it("persists a bound signin callback before requesting email confirmation", async () => {
    const calls: string[] = [];
    const beginAuthCallback = vi.fn(async () => {
      calls.push("begin");
      return emailTransaction;
    });
    const signUp = vi.fn(async () => {
      calls.push("signup");
      return { data: { session: null, user: null }, error: null };
    });
    const cancelAuthTransaction = vi.fn();

    await expect(
      signUpWithBoundCallback(
        clientWithSignUp(signUp),
        {
          email: "player@example.com",
          next: "/leaderboard",
          password: "correct horse battery staple",
        },
        { beginAuthCallback, cancelAuthTransaction },
      ),
    ).resolves.toMatchObject({ data: { session: null }, error: null });
    expect(calls).toEqual(["begin", "signup"]);
    expect(beginAuthCallback).toHaveBeenCalledWith({
      expectedGuestUserId: null,
      lifetime: "email-confirmation",
      mode: "signin",
      next: "/leaderboard",
    });
    expect(signUp).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "correct horse battery staple",
      options: {
        emailRedirectTo:
          "wikipath://auth/callback?flow_id=email-flow&mode=signin&next=%2Fleaderboard",
      },
    });
    expect(cancelAuthTransaction).not.toHaveBeenCalled();
  });

  it("clears the callback transaction when signup returns an immediate session", async () => {
    const session = { user: { id: "permanent-uuid" } } as Session;
    const cancelAuthTransaction = vi.fn().mockResolvedValue(undefined);

    await signUpWithBoundCallback(
      clientWithSignUp(
        vi.fn().mockResolvedValue({
          data: { session, user: session.user },
          error: null,
        }),
      ),
      { email: "player@example.com", next: "/", password: "password" },
      {
        beginAuthCallback: vi.fn().mockResolvedValue({
          ...emailTransaction,
          next: "/",
          redirectUri:
            "wikipath://auth/callback?flow_id=email-flow&mode=signin&next=%2F",
        }),
        cancelAuthTransaction,
      },
    );

    expect(cancelAuthTransaction).toHaveBeenCalledWith("email-flow");
  });
});
