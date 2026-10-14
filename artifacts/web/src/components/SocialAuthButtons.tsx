import { useMemo, useState } from "react";

import { resolveSocialAuthVisibility } from "@/lib/social-auth-availability";
import { signInWithGoogle } from "@/lib/social-auth";

interface SocialAuthButtonsProps {
  disabled?: boolean;
  next?: unknown;
  onError: (message: string | null) => void;
}

type SocialProvider = "google" | "apple";

interface ProviderConfig {
  id: SocialProvider;
  label: string;
  mark: string;
}

const PROVIDERS: ProviderConfig[] = [
  { id: "google", label: "Continue with Google", mark: "G" },
];

export default function SocialAuthButtons({
  disabled = false,
  next,
  onError,
}: SocialAuthButtonsProps) {
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const visibility = useMemo(
    () =>
      resolveSocialAuthVisibility("web", {
        google: import.meta.env.VITE_GOOGLE_AUTH_ENABLED,
      }),
    [],
  );

  if (!visibility.any) return null;

  async function authenticate(provider: SocialProvider) {
    if (disabled || busyProvider) return;
    setBusyProvider(provider);
    onError(null);

    try {
      if (provider === "google") {
        await signInWithGoogle(next);
        return;
      }
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Could not start sign-in.",
      );
    } finally {
      setBusyProvider(null);
    }
  }

  const availableProviders = PROVIDERS.filter((provider) => {
    if (provider.id === "google") return visibility.google;
    return visibility.apple;
  });

  if (availableProviders.length === 0) return null;

  return (
    <div className="mt-6 space-y-3 border border-[var(--wiki-rule)] bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--wiki-hairline)]" />
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Or continue with
        </p>
        <div className="h-px flex-1 bg-[var(--wiki-hairline)]" />
      </div>

      {availableProviders.map((provider) => {
        const busy = busyProvider === provider.id;
        return (
          <button
            key={provider.id}
            type="button"
            disabled={disabled || busyProvider !== null}
            onClick={() => void authenticate(provider.id)}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded border border-[var(--wiki-rule)] bg-white px-4 py-3 font-semibold text-foreground disabled:opacity-50"
          >
            <span
              aria-hidden="true"
              className="text-lg font-bold text-[#4285f4]"
            >
              {provider.mark}
            </span>
            <span>{busy ? "Redirecting…" : provider.label}</span>
          </button>
        );
      })}
    </div>
  );
}
