import * as WebBrowser from "expo-web-browser";

import { api } from "@/lib/api";
import { beginAuthCallback, completeAuthCallback } from "@/lib/auth-callback";
import {
  normalizeReturnPath,
  runGoogleOAuthFlow,
  type AuthMode,
  type SocialAuthResult,
} from "@/lib/auth-flow";
import { cancelAuthTransaction } from "@/lib/auth-transaction";
import { claimWithOAuth, type OAuthClaimProvider } from "./claim-account";
import { getSupabase } from "@/lib/supabase";

async function claimProfile(): Promise<void> {
  await api<{ claimed: true }>("/profile/claim", { method: "POST" });
}

export async function claimWithSocialProvider(
  provider: OAuthClaimProvider,
  next: unknown = "/",
): Promise<SocialAuthResult> {
  const returnPath = normalizeReturnPath(next);
  const client = getSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Your player session is missing.");

  if (data.session.user.is_anonymous !== true) {
    await claimProfile();
    return { status: "success", next: returnPath };
  }

  const transaction = await beginAuthCallback({
    expectedGuestUserId: data.session.user.id,
    mode: "claim",
    next: returnPath,
  });
  try {
    const result = await claimWithOAuth(client, {
      provider,
      redirectTo: transaction.redirectUri,
      openAuthSession: (url) =>
        WebBrowser.openAuthSessionAsync(url, transaction.redirectUri),
      completeCallback: completeAuthCallback,
      claimProfile,
    });

    return result.status === "cancelled"
      ? result
      : { status: "success", next: returnPath };
  } finally {
    await cancelAuthTransaction(transaction.flowId);
  }
}

export async function signInWithGoogle(
  next: unknown = "/",
  mode: AuthMode = "signin",
): Promise<SocialAuthResult> {
  if (mode === "claim") {
    return claimWithSocialProvider("google", next);
  }

  const returnPath = normalizeReturnPath(next);
  const transaction = await beginAuthCallback({
    expectedGuestUserId: null,
    mode: "signin",
    next: returnPath,
  });

  try {
    return await runGoogleOAuthFlow({
      async createOAuthUrl() {
        const { data, error } = await getSupabase().auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: transaction.redirectUri,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        if (!data.url) {
          throw new Error("Supabase did not return a Google sign-in URL.");
        }
        return data.url;
      },
      async openAuthSession(url) {
        return WebBrowser.openAuthSessionAsync(url, transaction.redirectUri);
      },
      completeCallback: completeAuthCallback,
    });
  } finally {
    await cancelAuthTransaction(transaction.flowId);
  }
}
