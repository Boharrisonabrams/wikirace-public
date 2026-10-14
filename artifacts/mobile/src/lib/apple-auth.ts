import type { AuthMode, SocialAuthResult } from "@/lib/auth-flow";

export async function signInWithApple(
  _next: unknown = "/",
  _mode: AuthMode = "signin",
): Promise<SocialAuthResult> {
  throw new Error("Apple Authentication is unavailable on this device.");
}
