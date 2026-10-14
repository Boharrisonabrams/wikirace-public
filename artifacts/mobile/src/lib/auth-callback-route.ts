import { api } from "./api";
import { completeAuthCallback } from "./auth-callback";
import {
  normalizeReturnPath,
  type AuthCallbackResult,
  type AuthMode,
} from "./auth-flow";
import { peekAuthTransaction } from "./auth-transaction";

interface AuthCallbackRouteDependencies {
  claimProfile: () => Promise<void>;
  completeCallback: (url: string) => Promise<AuthCallbackResult>;
}

export interface AuthCallbackRecovery {
  destination:
    | { pathname: "/login"; params: { next: string } }
    | {
        pathname: "/signup";
        params: { mode: "claim"; next: string };
      };
  label: string;
  mode: AuthMode;
  next: string;
}

class AuthCallbackRouteError extends Error {
  readonly code: string | null;
  readonly mode: AuthMode;
  readonly next: string;

  constructor(error: unknown, result: AuthCallbackResult) {
    super(error instanceof Error ? error.message : "Authentication failed.");
    this.name = "AuthCallbackRouteError";
    this.code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;
    this.mode = result.mode;
    this.next = result.next;
  }
}

const defaultDependencies: AuthCallbackRouteDependencies = {
  async claimProfile() {
    await api<{ claimed: true }>("/profile/claim", { method: "POST" });
  },
  completeCallback: completeAuthCallback,
};

export async function finishAuthCallbackRoute(
  url: string,
  dependencies: AuthCallbackRouteDependencies = defaultDependencies,
): Promise<{ next: string }> {
  const result = await dependencies.completeCallback(url);

  if (result.mode === "claim") {
    if (
      !result.expectedGuestUserId ||
      result.userId !== result.expectedGuestUserId
    ) {
      throw new AuthCallbackRouteError(
        new Error(
          "Account claiming stopped because the player identity changed.",
        ),
        result,
      );
    }
    try {
      await dependencies.claimProfile();
    } catch (error) {
      throw new AuthCallbackRouteError(error, result);
    }
  }

  return { next: result.next };
}

function contextFromError(
  error: unknown,
): { mode: AuthMode; next: string } | null {
  if (typeof error !== "object" || error === null) return null;
  const mode = "mode" in error ? error.mode : null;
  const next = "next" in error ? error.next : null;
  if (mode !== "claim" && mode !== "signin") return null;
  return { mode, next: normalizeReturnPath(next) };
}

export async function resolveAuthCallbackRecovery(
  error: unknown,
): Promise<AuthCallbackRecovery> {
  const pending = await peekAuthTransaction();
  const context = contextFromError(error) ??
    pending ?? {
      mode: "signin" as const,
      next: "/",
    };
  const next = normalizeReturnPath(context.next);

  if (context.mode === "claim") {
    return {
      destination: {
        pathname: "/signup",
        params: { mode: "claim", next },
      },
      label: "Back to account setup",
      mode: "claim",
      next,
    };
  }

  return {
    destination: { pathname: "/login", params: { next } },
    label: "Back to sign in",
    mode: "signin",
    next,
  };
}
