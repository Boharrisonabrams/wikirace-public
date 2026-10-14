import { makeRedirectUri } from "expo-auth-session";

import {
  normalizeReturnPath,
  parseAuthCallbackUrl,
  type AuthMode,
  type AuthCallbackResult,
} from "./auth-flow";
import {
  consumeAuthTransaction,
  issueAuthTransaction,
  type AuthTransaction,
  type AuthTransactionLifetime,
} from "./auth-transaction";
import { getSupabase } from "./supabase";

const activeCallbacks = new Map<string, Promise<AuthCallbackResult>>();

export const AUTH_CALLBACK_SCHEMES = ["wikirace", "wikipath"] as const;
export const AUTH_CALLBACK_BASE_URIS = AUTH_CALLBACK_SCHEMES.map(
  (scheme) => `${scheme}://auth/callback`,
);
export const PREFERRED_AUTH_SCHEME = AUTH_CALLBACK_SCHEMES[0];

export class AuthCallbackError extends Error {
  readonly code: string | null;
  readonly mode: AuthMode | null;
  readonly next: string;

  constructor(
    message: string,
    code: string | null,
    context?: Pick<AuthTransaction, "mode" | "next"> | null,
  ) {
    super(message);
    this.name = "AuthCallbackError";
    this.code = code;
    this.mode = context?.mode ?? null;
    this.next = context?.next ?? "/";
  }
}

function getAuthRedirectBaseUri(): string {
  return makeRedirectUri({
    native: AUTH_CALLBACK_BASE_URIS[0],
    scheme: PREFERRED_AUTH_SCHEME,
    path: "auth/callback",
  });
}

export function getAuthRedirectUri(next: unknown = "/"): string {
  const returnPath = normalizeReturnPath(next);
  const redirect = new URL(getAuthRedirectBaseUri());
  redirect.searchParams.set("next", returnPath);
  return redirect.toString();
}

export function beginAuthCallback(options: {
  expectedGuestUserId: string | null;
  lifetime?: AuthTransactionLifetime;
  mode: AuthMode;
  next: unknown;
}): Promise<AuthTransaction> {
  return issueAuthTransaction({
    ...options,
    redirectBase: getAuthRedirectBaseUri(),
  });
}

function contextualError(
  error: unknown,
  transaction: AuthTransaction,
): AuthCallbackError {
  if (error instanceof AuthCallbackError) return error;
  const message =
    error instanceof Error ? error.message : "Authentication failed.";
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;
  return new AuthCallbackError(message, code, transaction);
}

async function createSessionFromCallback(
  url: string,
): Promise<AuthCallbackResult> {
  const transaction = await consumeAuthTransaction(url, undefined, {
    compatibleRedirectBases: AUTH_CALLBACK_BASE_URIS,
  });
  const parameters = parseAuthCallbackUrl(url);
  if (parameters.error) {
    throw new AuthCallbackError(
      parameters.error,
      parameters.errorCode,
      transaction,
    );
  }
  if (!parameters.accessToken || !parameters.refreshToken) {
    throw new AuthCallbackError(
      "Authentication callback did not include a Supabase session.",
      "missing_session",
      transaction,
    );
  }

  const auth = getSupabase().auth;
  let guestSession = null;
  if (transaction.mode === "claim") {
    try {
      const { data, error } = await auth.getSession();
      if (error) throw error;
      guestSession = data.session;
    } catch (error) {
      throw contextualError(error, transaction);
    }

    if (
      !guestSession ||
      guestSession.user.id !== transaction.expectedGuestUserId ||
      guestSession.user.is_anonymous !== true
    ) {
      throw new AuthCallbackError(
        "Account claiming stopped because the guest player is no longer active.",
        "claim_guest_mismatch",
        transaction,
      );
    }
  }

  let data;
  try {
    const result = await auth.setSession({
      access_token: parameters.accessToken,
      refresh_token: parameters.refreshToken,
    });
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    throw contextualError(error, transaction);
  }
  if (!data.session) {
    throw new AuthCallbackError(
      "Supabase did not create an authenticated session.",
      "missing_session",
      transaction,
    );
  }

  if (
    transaction.mode === "claim" &&
    data.session.user.id !== transaction.expectedGuestUserId
  ) {
    if (guestSession) {
      const { error: restoreError } = await auth.setSession({
        access_token: guestSession.access_token,
        refresh_token: guestSession.refresh_token,
      });
      if (restoreError) {
        throw new AuthCallbackError(
          "Account claiming changed the player identity and the guest session could not be restored.",
          "claim_restore_failed",
          transaction,
        );
      }
    }
    throw new AuthCallbackError(
      "Account claiming stopped because the player identity changed.",
      "claim_user_mismatch",
      transaction,
    );
  }

  return {
    expectedGuestUserId: transaction.expectedGuestUserId,
    mode: transaction.mode,
    next: transaction.next,
    userId: data.session.user.id,
  };
}

export function completeAuthCallback(url: string): Promise<AuthCallbackResult> {
  const activePromise = activeCallbacks.get(url);
  if (activePromise) return activePromise;

  const promise = createSessionFromCallback(url).finally(() => {
    if (activeCallbacks.get(url) === promise) {
      activeCallbacks.delete(url);
    }
  });
  activeCallbacks.set(url, promise);
  return promise;
}
