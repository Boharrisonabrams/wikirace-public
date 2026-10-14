import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Trophy,
  Dumbbell,
  UserCircle2,
  Play,
  RotateCcw,
  Flame,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { formatTime, puzzleNumber } from "@/lib/game-utils";
import { ensurePlayerSession } from "@/lib/player-session";
import type { GameSession } from "@/lib/store/game-store";

interface DailyChallenge {
  id: string;
  date: string;
  startTitle: string;
  endTitle: string;
  endDescription?: string | null;
}

const VERSION_STAMP = `v${__APP_VERSION__} · built ${__BUILD_DATE__}`;

function Masthead() {
  return (
    <div className="text-center">
      <div className="masthead-rule" />
      <h1 className="mt-3 font-serif text-5xl font-semibold tracking-tight">
        WikiRace
      </h1>
      <p className="mt-1 text-sm italic text-muted-foreground">
        The encyclopedia, as a sport.
      </p>
      <div className="masthead-rule mt-3" />
    </div>
  );
}

export default function HomePage() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestPlayLoading, setGuestPlayLoading] = useState(false);
  const [guestPlayError, setGuestPlayError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    api<{ challenge: DailyChallenge; session: GameSession | null }>("/daily")
      .then((data) => {
        if (cancelled) return;
        setChallenge(data.challenge);
        setSession(data.session);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));

    if (user) {
      api<{ stats: { currentStreak: number } }>("/profile/me")
        .then((data) => !cancelled && setStreak(data.stats.currentStreak))
        .catch(() => {});
    }

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  async function handleLogout() {
    await getSupabase().auth.signOut();
    navigate("/login");
  }

  async function handleDailyPlay(challengeId: string) {
    if (guestPlayLoading) return;
    setGuestPlayError(null);
    setGuestPlayLoading(true);

    try {
      if (!user) {
        await ensurePlayerSession();
      }
      navigate(`/game?type=daily&challengeId=${challengeId}`);
    } catch (err) {
      setGuestPlayError(
        err instanceof Error
          ? err.message
          : "Guest play is unavailable. Try again, or sign in with email.",
      );
    } finally {
      setGuestPlayLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--wiki-hairline)] border-t-[var(--wiki-blue)]" />
      </div>
    );
  }

  // ── signed out ──
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--wiki-chrome)] px-4 py-10">
        <div className="mx-auto max-w-md">
          <Masthead />
          <div className="mt-8 border border-[var(--wiki-rule)] bg-white p-6">
            <h2 className="font-serif text-xl font-semibold">How it works</h2>
            <ol className="mt-3 space-y-3 text-sm leading-relaxed">
              <li className="flex gap-3">
                <span className="tabular w-5 shrink-0 text-right font-serif font-semibold">
                  1.
                </span>
                <span>
                  Everyone gets the same two Wikipedia articles — a start and a
                  target.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="tabular w-5 shrink-0 text-right font-serif font-semibold">
                  2.
                </span>
                <span>
                  Race to the target using only the{" "}
                  <span className="text-[var(--wiki-blue)] underline">
                    blue links
                  </span>{" "}
                  inside each article.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="tabular w-5 shrink-0 text-right font-serif font-semibold">
                  3.
                </span>
                <span>
                  Fewest clicks wins. Ties go to the clock. Brag accordingly.
                </span>
              </li>
            </ol>
            {challenge && (
              <p className="mt-4 border-t border-[var(--wiki-hairline)] pt-3 text-sm text-muted-foreground">
                Today's race:{" "}
                <span className="font-medium text-foreground">
                  {challenge.startTitle}
                </span>
                {" → "}
                <span className="font-medium text-foreground">
                  {challenge.endTitle}
                </span>
              </p>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {challenge ? (
              <button
                onClick={() => void handleDailyPlay(challenge.id)}
                disabled={guestPlayLoading}
                className="min-h-12 w-full rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
              >
                {guestPlayLoading
                  ? "Starting guest race…"
                  : "Play today's race"}
              </button>
            ) : null}
            <button
              onClick={() => navigate("/signup")}
              className="min-h-12 w-full rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
            >
              Create account
            </button>
            <button
              onClick={() => navigate("/login")}
              className="min-h-12 w-full rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
            >
              Sign in
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Start instantly as a guest. Save the profile after the race if you
            want.
          </p>
          {guestPlayError ? (
            <p className="mt-2 text-center text-xs text-[var(--wiki-red)]">
              {guestPlayError}
            </p>
          ) : null}
          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            {VERSION_STAMP}
          </p>
        </div>
      </div>
    );
  }

  // ── signed in ──
  const playedToday = session?.completed;
  const inProgress = session && !session.completed;

  return (
    <div className="min-h-screen bg-[var(--wiki-chrome)] px-4 py-8">
      <div className="mx-auto max-w-md">
        <Masthead />

        <div className="mt-6 border border-[var(--wiki-rule)] bg-white">
          <div className="border-b border-[var(--wiki-hairline)] px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Daily challenge
                {challenge && <> · No. {puzzleNumber(challenge.date)}</>}
              </span>
              {streak !== null && streak > 0 && (
                <span className="flex items-center gap-1 text-sm font-semibold text-[var(--wiki-gold)]">
                  <Flame className="h-4 w-4" />
                  {streak}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 py-6">
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-8 rounded bg-[var(--wiki-soft)]" />
                <div className="h-12 rounded bg-[var(--wiki-soft)]" />
              </div>
            ) : challenge ? (
              <>
                <p className="font-serif text-2xl leading-snug">
                  <span className="font-semibold">{challenge.startTitle}</span>
                  <span className="mx-2 text-muted-foreground">→</span>
                  <span className="font-semibold text-[var(--wiki-blue-dark)]">
                    {challenge.endTitle}
                  </span>
                </p>
                {challenge.endDescription ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {challenge.endTitle} — {challenge.endDescription}
                  </p>
                ) : null}

                {playedToday && session ? (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      {session.won ? (
                        <>
                          Done — {session.clicks}{" "}
                          {session.clicks === 1 ? "click" : "clicks"} in{" "}
                          {formatTime(session.timeSeconds ?? 0)}. Come back
                          tomorrow.
                        </>
                      ) : (
                        <>You gave this one up. Tomorrow is a fresh race.</>
                      )}
                    </p>
                    <button
                      onClick={() => void handleDailyPlay(challenge.id)}
                      disabled={guestPlayLoading}
                      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
                    >
                      <Trophy className="h-4 w-4 text-[var(--wiki-gold)]" />
                      See your result
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void handleDailyPlay(challenge.id)}
                    disabled={guestPlayLoading}
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {guestPlayLoading ? (
                      <>Starting race…</>
                    ) : inProgress ? (
                      <>
                        <RotateCcw className="h-4 w-4" /> Resume today's race
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" /> Start today's race
                      </>
                    )}
                  </button>
                )}
                {guestPlayError ? (
                  <p className="mt-2 text-sm text-[var(--wiki-red)]">
                    {guestPlayError}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Couldn't load today's challenge. Check your connection and
                reload.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            onClick={() => navigate("/game?type=practice")}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 border border-[var(--wiki-rule)] bg-white px-2 py-3"
          >
            <Dumbbell className="h-5 w-5 text-[var(--wiki-blue)]" />
            <span className="text-xs font-medium">Practice</span>
          </button>
          <button
            onClick={() => navigate("/leaderboard")}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 border border-[var(--wiki-rule)] bg-white px-2 py-3"
          >
            <Trophy className="h-5 w-5 text-[var(--wiki-gold)]" />
            <span className="text-xs font-medium">Leaderboard</span>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="flex min-h-20 flex-col items-center justify-center gap-1.5 border border-[var(--wiki-rule)] bg-white px-2 py-3"
          >
            <UserCircle2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="mx-auto mt-8 block text-xs text-muted-foreground underline underline-offset-2"
        >
          Sign out
        </button>
        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          {VERSION_STAMP}
        </p>
      </div>
    </div>
  );
}
