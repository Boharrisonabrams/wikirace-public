import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Swords, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import ExpandableFinisherRow from "@/components/ExpandableFinisherRow";
import { useAuth } from "@/hooks/use-auth";
import {
  challengeActionLabel,
  challengeInvitationHeading,
  copyChallengeUrl,
  formatTime,
  getChallengeAppHref,
} from "@/lib/game-utils";
import { ensurePlayerSession } from "@/lib/player-session";

interface ChallengeData {
  challenge: {
    code: string;
    kind: "daily" | "practice" | "friend";
    dailyChallengeId: string | null;
    dailyDate: string | null;
    startTitle: string;
    endTitle: string;
    endDescription?: string | null;
    url: string;
  };
  creator: { username: string; display_name: string | null };
  results: Array<{
    rank: number;
    is_current_user: boolean;
    username: string;
    display_name: string | null;
    clicks: number;
    time_seconds: number;
    won: boolean;
    gave_up: boolean;
    path?: string[];
    completed_at: string;
  }>;
  mySession: { completed: boolean } | null;
}

/**
 * /challenge/:id — the public invite + results page a friend lands on.
 * Playable after sign-in; viewable by anyone with the link.
 */
export default function ChallengePage() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ChallengeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [showOpenInAppButton, setShowOpenInAppButton] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [expandedResultKey, setExpandedResultKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (authLoading) return;
    api<ChallengeData>(`/challenge/${params.id}`)
      .then(setData)
      .catch(() =>
        setError("This challenge does not exist (or the link is broken)."),
      );
  }, [params.id, authLoading]);

  useEffect(() => {
    setShowOpenInAppButton(/iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  async function play() {
    if (!data || starting) return;
    setPlayError(null);
    setStarting(true);
    try {
      if (!user) {
        await ensurePlayerSession();
      }
      await api(`/challenge/${params.id}/start`, { method: "POST" });
      const target =
        data.challenge.kind === "daily"
          ? `/game?type=daily&challengeId=${encodeURIComponent(data.challenge.dailyChallengeId ?? "")}&friendChallengeId=${encodeURIComponent(data.challenge.code)}&dailyDate=${encodeURIComponent(data.challenge.dailyDate ?? "")}`
          : `/game?type=${data.challenge.kind}&friendChallengeId=${encodeURIComponent(data.challenge.code)}`;
      navigate(target);
    } catch (err) {
      setPlayError(
        err instanceof Error
          ? err.message
          : "Guest play is unavailable. Try again, or sign in with email.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function copyLink() {
    setCopyError(null);
    try {
      await copyChallengeUrl(
        data?.challenge.url ?? "",
        (value) => navigator.clipboard.writeText(value),
        (value) => {
          const field = document.createElement("textarea");
          field.value = value;
          field.setAttribute("readonly", "");
          field.style.position = "fixed";
          field.style.opacity = "0";
          document.body.appendChild(field);
          field.select();
          const copied = document.execCommand("copy");
          document.body.removeChild(field);
          return copied;
        },
      );
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(
        "Could not copy the link. Select the address above instead.",
      );
    }
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4">
        <div className="w-full max-w-sm border border-[var(--wiki-rule)] bg-white p-6 text-center">
          <h1 className="mb-2 font-serif text-2xl">Challenge not found</h1>
          <p className="mb-5 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="min-h-12 w-full rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            Go to WikiRace
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--wiki-hairline)] border-t-[var(--wiki-blue)]" />
      </div>
    );
  }

  const played = data.mySession?.completed;

  return (
    <div className="min-h-screen bg-[var(--wiki-chrome)] px-4 py-10 text-[var(--wiki-ink)]">
      <div className="mx-auto max-w-md">
        <div className="border border-[var(--wiki-rule)] bg-[var(--wiki-surface)]">
          <div className="masthead-rule mx-4 mt-4" />
          <div className="px-5 py-6">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <Swords className="h-3.5 w-3.5" />
              {data.challenge.kind === "daily"
                ? "Daily Path"
                : data.challenge.kind === "practice"
                  ? "Practice race"
                  : "Private challenge"}
            </p>
            <h1 className="font-serif text-[2rem] font-semibold leading-[1.22]">
              {challengeInvitationHeading()}
            </h1>
            <p className="mt-4 font-serif text-2xl leading-8">
              <span className="font-semibold">{data.challenge.startTitle}</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-semibold text-[var(--wiki-blue-dark)]">
                {data.challenge.endTitle}
              </span>
            </p>
            {data.challenge.endDescription ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {data.challenge.endTitle} — {data.challenge.endDescription}
              </p>
            ) : null}
            <p className="mt-3 text-[15px] leading-[22px] text-muted-foreground">
              Same start, same target, blue links only. Fewest clicks wins.
            </p>

            <button
              onClick={() => void play()}
              disabled={starting}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--wiki-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--wiki-on-accent)]"
            >
              {starting
                ? "Starting race…"
                : challengeActionLabel({ played: Boolean(played) })}
            </button>
            {!user && !played ? (
              <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                Start instantly as a guest. Save the profile after the race.
              </p>
            ) : null}
            {playError ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--wiki-red)]">
                {playError}
              </p>
            ) : null}
            <button
              className="mt-3 flex min-h-11 w-full items-center justify-center border border-[var(--wiki-rule)] bg-[var(--wiki-surface)] px-4 py-2 text-[15px] font-semibold text-[var(--wiki-blue)]"
              onClick={() => void copyLink()}
              type="button"
            >
              {copied ? "Link copied" : "Copy challenge link"}
            </button>
            {copyError ? (
              <p className="mt-2 text-center text-xs leading-5 text-[var(--wiki-red)]">
                {copyError}
              </p>
            ) : null}
            {showOpenInAppButton ? (
              <a
                className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-[var(--wiki-surface)] px-4 py-2 text-[15px] font-semibold text-[var(--wiki-blue)]"
                href={getChallengeAppHref(data.challenge.code)}
              >
                Open in the WikiRace app
              </a>
            ) : null}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Don&apos;t have the app? Keep playing right here in the browser.
            </p>
          </div>
        </div>

        <div className="mt-4 border border-[var(--wiki-rule)] bg-[var(--wiki-surface)]">
          <h2 className="flex items-center gap-1.5 border-b border-[var(--wiki-hairline)] px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-[var(--wiki-gold)]" />
            Results
          </h2>
          {data.results.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No one has finished this one yet.
            </p>
          ) : (
            <ol>
              {data.results.map((r) => (
                <ExpandableFinisherRow
                  key={`${r.username}-${r.completed_at}-${r.rank}`}
                  expanded={
                    expandedResultKey ===
                    `${r.username}-${r.completed_at}-${r.rank}`
                  }
                  onToggle={() =>
                    setExpandedResultKey((current) => {
                      const next = `${r.username}-${r.completed_at}-${r.rank}`;
                      return current === next ? null : next;
                    })
                  }
                  path={r.path}
                >
                  <div
                    className={`flex items-center gap-3 ${r.is_current_user ? "bg-[var(--wiki-chrome)]" : ""}`}
                  >
                    <span
                      className={`tabular w-7 shrink-0 text-center font-serif text-lg font-semibold ${r.rank === 1 && r.won ? "text-[var(--wiki-gold)]" : "text-muted-foreground"}`}
                    >
                      {r.won ? r.rank : "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {r.display_name || r.username}
                        {r.is_current_user ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.won ? "Reached the target" : "Gave up before the target"}
                        {r.path?.length ? " · Tap to reveal path" : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="tabular text-sm font-semibold">
                        {r.clicks} {r.clicks === 1 ? "click" : "clicks"}
                      </div>
                      <div className="tabular text-xs text-muted-foreground">
                        {formatTime(r.time_seconds)}
                      </div>
                    </div>
                  </div>
                </ExpandableFinisherRow>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
