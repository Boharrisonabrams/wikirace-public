import { useState } from "react";
import { useLocation } from "wouter";
import SocialAuthButtons from "@/components/SocialAuthButtons";
import { nextTargetFromSearch } from "@/lib/auth-redirect";
import { getSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Wrong email or password."
            : error.message,
        );
        return;
      }
      if (data.user) navigate(nextTargetFromSearch(window.location.search));
    } catch {
      setError("Could not reach the sign-in service. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="masthead-rule" />
          <h1 className="mt-3 font-serif text-4xl font-semibold">WikiRace</h1>
          <p className="mt-1 text-sm italic text-muted-foreground">
            Welcome back, racer.
          </p>
          <div className="masthead-rule mt-3" />
        </div>

        <form
          onSubmit={handleLogin}
          className="mt-6 space-y-4 border border-[var(--wiki-rule)] bg-white p-6"
        >
          {error && (
            <div className="rounded border border-[var(--wiki-red)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--wiki-red)]">
              {error}
            </div>
          )}

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
              autoComplete="email"
              className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </div>

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
              autoComplete="current-password"
              className="min-h-12 w-full rounded border border-[var(--wiki-rule)] px-3 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 w-full rounded bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <SocialAuthButtons
          disabled={loading}
          next={nextTargetFromSearch(window.location.search)}
          onError={setError}
        />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <button
            onClick={() => navigate(`/signup${window.location.search}`)}
            className="font-semibold text-[var(--wiki-blue)] underline underline-offset-2"
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}
