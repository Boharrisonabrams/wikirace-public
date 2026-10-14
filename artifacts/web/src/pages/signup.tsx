import { useState } from "react";
import { useLocation } from "wouter";
import SocialAuthButtons from "@/components/SocialAuthButtons";
import { api } from "@/lib/api";
import {
  buildAuthCallbackUrl,
  nextTargetFromSearch,
} from "@/lib/auth-redirect";
import { completeEmailClaim, requestEmailClaim } from "@/lib/claim-account";
import { getSupabase } from "@/lib/supabase/client";

export default function SignupPage() {
  const search = new URLSearchParams(window.location.search);
  const claimMode = search.get("mode") === "claim";
  const next = nextTargetFromSearch(window.location.search);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [claimUserId, setClaimUserId] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [, navigate] = useLocation();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (claimMode) {
      setLoading(true);
      try {
        const client = getSupabase();
        if (!claimUserId) {
          const result = await requestEmailClaim(client, {
            email: email.trim(),
          });
          const needsVerification = result.status === "verification-required";
          setClaimUserId(result.userId);
          setVerificationRequired(needsVerification);
          setMessage(
            needsVerification
              ? "Enter the 6-digit code from your email, then choose a password."
              : "Your email is ready. Choose a password to save this account.",
          );
          return;
        }

        await completeEmailClaim(client, {
          email: email.trim(),
          expectedUserId: claimUserId,
          password,
          verificationCode: verificationCode.trim(),
          claimProfile: async () => {
            await api<{ claimed: true }>("/profile/claim", {
              method: "POST",
            });
          },
        });
        navigate(next);
      } catch (claimError) {
        setError(
          claimError instanceof Error
            ? claimError.message
            : "Could not save this guest profile.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    const cleanUsername = username.toLowerCase().trim();
    if (cleanUsername.length < 3) {
      setError("Username needs at least 3 characters.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setError("Username can use letters, numbers, and underscores only.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await getSupabase().auth.signUp({
        email,
        password,
        options: {
          data: { username: cleanUsername },
          emailRedirectTo: buildAuthCallbackUrl(
            window.location.origin,
            nextTargetFromSearch(window.location.search),
          ),
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.session) {
        navigate(next);
      } else if (data.user) {
        // Email confirmation is enabled on this Supabase project.
        setConfirmationSent(true);
      }
    } catch {
      setError("Could not reach the sign-up service. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4">
        <div className="w-full max-w-md border border-[var(--wiki-rule)] bg-white p-6 text-center">
          <h1 className="mb-2 font-serif text-2xl font-semibold">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Tap it
            on this device and you'll land back here signed in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="masthead-rule" />
          <h1 className="mt-3 font-serif text-4xl font-semibold">WikiRace</h1>
          <p className="mt-1 text-sm italic text-muted-foreground">
            {claimMode
              ? "Save this guest profile after the race."
              : "Pick a name your rivals will learn to fear."}
          </p>
          <div className="masthead-rule mt-3" />
        </div>

        <form
          onSubmit={handleSignup}
          className="mt-6 space-y-4 border border-[var(--wiki-rule)] bg-white p-6"
        >
          {error && (
            <div className="rounded border border-[var(--wiki-red)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--wiki-red)]">
              {error}
            </div>
          )}

          {!claimMode ? (
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-sm font-medium"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
                autoCapitalize="off"
                className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="wikiracer"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Shown on leaderboards.
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || claimUserId !== null}
              autoComplete="email"
              className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>

          {claimMode && claimUserId !== null && verificationRequired ? (
            <div>
              <label
                htmlFor="verification-code"
                className="mb-1.5 block text-sm font-medium"
              >
                Verification code
              </label>
              <input
                id="verification-code"
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                maxLength={6}
                className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="123456"
              />
            </div>
          ) : null}

          {!claimMode || claimUserId !== null ? (
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="At least 6 characters"
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading
              ? claimMode
                ? "Saving account…"
                : "Creating account…"
              : claimMode
                ? claimUserId === null
                  ? "Send verification code"
                  : "Save account"
                : "Create account"}
          </button>

          {message ? (
            <div className="rounded border border-[var(--wiki-blue)]/20 bg-blue-50 px-3 py-2 text-sm text-[var(--wiki-blue-dark)]">
              {message}
            </div>
          ) : null}
        </form>

        {!claimMode ? (
          <SocialAuthButtons
            disabled={loading}
            next={next}
            onError={setError}
          />
        ) : null}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {claimMode ? (
            <button
              onClick={() => navigate(next)}
              className="font-semibold text-[var(--wiki-blue)] underline underline-offset-2"
            >
              Maybe later
            </button>
          ) : (
            <>
              Already racing?{" "}
              <button
                onClick={() => navigate(`/login${window.location.search}`)}
                className="font-semibold text-[var(--wiki-blue)] underline underline-offset-2"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
