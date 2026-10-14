import { describe, expect, it, vi } from "vitest";

import { signInWithGoogle } from "@/lib/social-auth";

describe("web Google sign-in", () => {
  it("passes the provider and preserves a safe next path in redirectTo", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: "google" },
      error: null,
    });

    await expect(
      signInWithGoogle("/challenge/abc123?from=daily", {
        client: { auth: { signInWithOAuth } } as never,
        origin: "https://wikirace.example.com",
      }),
    ).resolves.toEqual({ provider: "google" });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo:
          "https://wikirace.example.com/auth/callback?next=%2Fchallenge%2Fabc123%3Ffrom%3Ddaily",
      },
    });
  });

  it("falls back to the default callback when next is unsafe", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({
      data: { provider: "google" },
      error: null,
    });

    await signInWithGoogle("https://evil.example", {
      client: { auth: { signInWithOAuth } } as never,
      origin: "https://wikirace.example.com",
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://wikirace.example.com/auth/callback",
      },
    });
  });
});
