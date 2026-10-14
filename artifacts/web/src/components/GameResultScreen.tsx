import { useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Share2, RotateCcw, Home, Swords } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import {
  createFriendRaceAgainChallenge,
  createFriendRaceAgainController,
} from "@/lib/friend-race-again";
import {
  formatTime,
  formatShareIntent,
  getChallengeShareUrl,
  shareOrCopy,
} from "@/lib/game-utils";
import { isGuestUser } from "@/lib/player-session";
import type { ShareIntent } from "@workspace/share-intent";
import type { GameResult, GameSession, SearchTier } from "@/lib/store/game-store";

interface GameResultScreenProps {
  session: GameSession;
  result: GameResult;
  onPlayAgain: () => void;
}

/**
 * Full-screen result: the verdict, the numbers, and the route you carved —
 * rendered as a numbered reference list, encyclopedia-style.
 */
export default function GameResultScreen({
  session,
  result,
  onPlayAgain,
}: GameResultScreenProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [shareLabels, setShareLabels] = useState({
    challenge: "Challenge a friend",
    result: "Share my result",
  });
  const [raceAgainLabel, setRaceAgainLabel] = useState("Race again");
  const [sharingIntent, setSharingIntent] = useState<ShareIntent | null>(null);
  const [challengeUrl, setChallengeUrl] = useState<string | null>(null);
  const [racingAgain, setRacingAgain] = useState(false);
  const [searchTier, setSearchTier] = useState<SearchTier>("find");
  const [claimDismissed, setClaimDismissed] = useState(false);

  const isDaily = session.challengeType === "daily";
  const effectiveIsGuest = result.isGuest ?? isGuestUser(user);
  const effectiveClaimed =
    result.claimed ?? (user ? !effectiveIsGuest : undefined);
  const shouldOfferGuestClaim =
    effectiveClaimed === false && effectiveIsGuest === true && !claimDismissed;
  const claimReturnPath = `${window.location.pathname}${window.location.search}`;

  function handleClaimAccount() {
    navigate(
      `/signup?mode=claim&next=${encodeURIComponent(claimReturnPath || "/")}`,
    );
  }

  async function handleShare(intent: ShareIntent) {
    if (sharingIntent) return;
    setSharingIntent(intent);
    try {
      let url = challengeUrl;
      if (!url) {
        const data = await api<{
          challenge: { code?: unknown; url?: unknown };
        }>("/challenge", {
          method: "POST",
          body: { fromSessionId: session.id, searchTier },
        });
        url = getChallengeShareUrl(data.challenge, window.location.origin);
        if (!url)
          throw new Error("Challenge API did not return a safe short link");
        setChallengeUrl(url);
      }
      const base = {
        challengeUrl: url,
        endTitle: session.endArticle,
        startTitle: session.startArticle,
      };
      const content =
        intent === "challenge"
          ? formatShareIntent({ ...base, intent })
          : result.won
            ? formatShareIntent({
                ...base,
                clicks: result.clicks,
                elapsedSeconds: result.timeSeconds,
                intent,
                outcome: "won",
              })
            : formatShareIntent({
                ...base,
                intent,
                outcome: "stopped",
                stoppedAt: result.path.at(-1) ?? session.startArticle,
              });
      const outcome = await shareOrCopy(content);
      if (outcome === "copied") {
        setShareLabels((labels) => ({
          ...labels,
          [intent]: "Copied to clipboard ✓",
        }));
        setTimeout(
          () =>
            setShareLabels((labels) => ({
              ...labels,
              [intent]:
                intent === "challenge"
                  ? "Challenge a friend"
                  : "Share my result",
            })),
          2500,
        );
      }
    } catch {
      setShareLabels((labels) => ({
        ...labels,
        [intent]: "Could not share — try again",
      }));
      setTimeout(
        () =>
          setShareLabels((labels) => ({
            ...labels,
            [intent]:
              intent === "challenge" ? "Challenge a friend" : "Share my result",
          })),
        2500,
      );
    } finally {
      setSharingIntent(null);
    }
  }

  async function handleRaceAgain() {
    if (session.challengeType !== "friend" || racingAgain) return;
    setRacingAgain(true);
    try {
      await createFriendRaceAgainController({
        create: createFriendRaceAgainChallenge,
        navigate: (code) => navigate(`/challenge/${encodeURIComponent(code)}`),
      }).submit({
        startArticle: session.startArticle,
        endArticle: session.endArticle,
        searchTier,
      });
    } catch {
      setRaceAgainLabel("Could not create race — try again");
      setTimeout(() => setRaceAgainLabel("Race again"), 2500);
    } finally {
      setRacingAgain(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-10">
      <div className="border border-[var(--wiki-rule)] bg-white">
        <div className="masthead-rule mx-4 mt-4" />
        <div className="px-5 py-6 sm:px-8">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {isDaily
              ? "Daily challenge"
              : session.challengeType === "friend"
                ? "Head-to-head"
                : "Practice run"}
            {" · "}
            {session.startArticle} → {session.endArticle}
          </p>

          {result.won ? (
            <h1 className="font-serif text-3xl leading-tight">
              You reached{" "}
              <span className="text-[var(--wiki-blue-dark)]">
                {session.endArticle}
              </span>
              .
            </h1>
          ) : (
            <h1 className="font-serif text-3xl leading-tight text-muted-foreground">
              The trail went cold.
            </h1>
          )}

          <div className="mt-5 grid grid-cols-3 gap-px border border-[var(--wiki-hairline)] bg-[var(--wiki-hairline)] text-center">
            <div className="bg-white px-2 py-3">
              <div className="tabular font-serif text-2xl font-semibold">
                {result.clicks}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {result.clicks === 1 ? "click" : "clicks"}
              </div>
            </div>
            <div className="bg-white px-2 py-3">
              <div className="tabular font-serif text-2xl font-semibold">
                {formatTime(result.timeSeconds)}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                time
              </div>
            </div>
            <div className="bg-white px-2 py-3">
              {isDaily && result.streak ? (
                <>
                  <div className="tabular font-serif text-2xl font-semibold">
                    {result.streak.current}🔥
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    day streak
                  </div>
                </>
              ) : (
                <>
                  <div className="tabular font-serif text-2xl font-semibold">
                    {Math.max(0, result.path.length - 1)}
                  </div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    hops
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h2 className="mb-2 border-b border-[var(--wiki-hairline)] pb-1 font-serif text-lg font-semibold">
              Your route
            </h2>
            <ol className="space-y-1 text-sm">
              {result.path.map((step, i) => (
                <li key={`${step}-${i}`} className="flex gap-2">
                  <span className="tabular w-6 shrink-0 text-right text-muted-foreground">
                    {i + 1}.
                  </span>
                  <span
                    className={
                      i === result.path.length - 1 && result.won
                        ? "font-semibold text-[var(--wiki-green)]"
                        : "text-[var(--wiki-blue)]"
                    }
                  >
                    {step}
                  </span>
                </li>
              ))}
              {!result.won && (
                <li className="flex gap-2 text-muted-foreground">
                  <span className="w-6 shrink-0 text-right">✗</span>
                  <span>never reached {result.endArticle}</span>
                </li>
              )}
            </ol>
          </div>

          <div className="mt-7 space-y-2">
            <div className="rounded border border-[var(--wiki-hairline)] bg-[var(--wiki-surface)] px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Search on new challenge links
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([
                  ["find", "Find only"],
                  ["palette", "Full palette"],
                ] as const).map(([value, label]) => {
                  const active = searchTier === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      className={
                        active
                          ? "min-h-11 rounded border border-[var(--wiki-blue)] bg-white px-3 py-2 text-sm font-semibold text-[var(--wiki-blue)]"
                          : "min-h-11 rounded border border-[var(--wiki-hairline)] bg-white px-3 py-2 text-sm font-medium"
                      }
                      type="button"
                      onClick={() => setSearchTier(value)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Find only hides the links list. Full palette keeps both links
                and text find.
              </p>
            </div>
            {shouldOfferGuestClaim ? (
              <div className="rounded-[var(--radius)] border border-[var(--wiki-gold)]/40 bg-[var(--wiki-chrome)] px-4 py-4 text-left">
                <h2 className="font-serif text-lg font-semibold">
                  Save this guest profile
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep this player identity, add credentials after the race, and
                  become eligible for public leaderboard placement once the
                  profile is claimed.
                </p>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={handleClaimAccount}
                    className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground"
                  >
                    Create credentials
                  </button>
                  <button
                    onClick={() => setClaimDismissed(true)}
                    className="flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
                  >
                    Not now
                  </button>
                </div>
              </div>
            ) : null}
            <button
              onClick={() => void handleShare("challenge")}
              disabled={sharingIntent !== null}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Swords className="h-4 w-4" />
              {shareLabels.challenge}
            </button>
            <button
              onClick={() => void handleShare("result")}
              disabled={sharingIntent !== null || racingAgain}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {shareLabels.result}
            </button>
            {session.challengeType === "friend" && (
              <button
                onClick={() => void handleRaceAgain()}
                disabled={sharingIntent !== null || racingAgain}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium disabled:opacity-60"
              >
                <RotateCcw className="h-4 w-4" />
                {raceAgainLabel}
              </button>
            )}
            {isDaily && (
              <button
                onClick={() => navigate("/leaderboard")}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
              >
                <Trophy className="h-4 w-4 text-[var(--wiki-gold)]" />
                Today's leaderboard
              </button>
            )}
            {session.challengeType === "friend" &&
              session.friendChallengeId && (
                <button
                  onClick={() =>
                    navigate(`/challenge/${session.friendChallengeId}`)
                  }
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
                >
                  <Trophy className="h-4 w-4 text-[var(--wiki-gold)]" />
                  Challenge results
                </button>
              )}
            {session.challengeType === "practice" && (
              <button
                onClick={onPlayAgain}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-3 font-medium"
              >
                <RotateCcw className="h-4 w-4" />
                New practice run
              </button>
            )}
            <button
              onClick={() => navigate("/")}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] px-4 py-3 font-medium text-muted-foreground"
            >
              <Home className="h-4 w-4" />
              Home
            </button>
            {typeof navigator.share !== "function" && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                Sharing copies your result — paste it to a friend. The link puts
                them in the same race. Challenge a friend sends only the route
                endpoints.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
