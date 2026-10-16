import type { SupabaseClient, User } from "@supabase/supabase-js";
import { titleMatchesTarget } from "./titles";

type CompletionSession = {
  active_time_ms?: number | string | null;
  attempt_number?: number | null;
  challenge_id?: string | null;
  challenge_type?: string | null;
  clicks?: number | string | null;
  completed?: boolean | null;
  completed_at?: string | null;
  is_official?: boolean | null;
  local_date?: string | null;
  user_id: string;
  won?: boolean | null;
};

type ShortestLeaderboardRow = {
  active_time_ms?: number | string | null;
  clicks?: number | string | null;
  completed_at?: string | null;
};

export function deriveCompletionOutcome(options: {
  gaveUp: boolean;
  lastArticle: string;
  targetArticle: string;
  targetAliases?: readonly string[] | null;
}): { gaveUp: boolean; won: boolean } {
  return {
    gaveUp: options.gaveUp,
    won:
      !options.gaveUp &&
      titleMatchesTarget(options.lastArticle, options.targetArticle, options.targetAliases),
  };
}

export function recordsOfficialDailyStats(options: {
  challengeType?: string | null;
  isOfficial?: boolean | null;
}): boolean {
  return options.challengeType === "daily" && options.isOfficial !== false;
}

export interface CompletionResultContext {
  activeTimeMs: number;
  attemptNumber: number;
  challengeId: string | null;
  claimed?: boolean;
  dailyDate: string | null;
  difficulty?: string;
  difficultySource?: string;
  eligibleCount?: number | null;
  fastestRank?: number | null;
  isGuest?: boolean;
  isOfficial: boolean;
  shortestRank?: number | null;
  wouldBeShortestRank?: number | null;
}

function baseContext(session: CompletionSession): CompletionResultContext {
  return {
    activeTimeMs: Math.max(0, Number(session.active_time_ms ?? 0)),
    attemptNumber: session.attempt_number ?? 1,
    challengeId: session.challenge_id ?? null,
    dailyDate: session.local_date ?? null,
    isOfficial: session.is_official ?? true,
  };
}

function positiveRank(value: unknown): number | null {
  const rank = Number(value);
  return Number.isInteger(rank) && rank > 0 ? rank : null;
}

function positiveCount(value: unknown): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function orderingNumber(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function orderingTime(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function compareShortestRuns(left: ShortestLeaderboardRow, right: ShortestLeaderboardRow): number {
  const clickDelta = orderingNumber(left.clicks) - orderingNumber(right.clicks);
  if (clickDelta !== 0) return clickDelta;

  const activeDelta = orderingNumber(left.active_time_ms) - orderingNumber(right.active_time_ms);
  if (activeDelta !== 0) return activeDelta;

  return orderingTime(left.completed_at) - orderingTime(right.completed_at);
}

export function deriveWouldBeShortestRank(options: {
  leaderboard: ShortestLeaderboardRow[];
  session: ShortestLeaderboardRow;
}): number {
  return (
    options.leaderboard.filter((entry) => compareShortestRuns(entry, options.session) < 0).length +
    1
  );
}

/**
 * Adds server-owned Daily metadata to the legacy completion payload. Every
 * field is additive: a result still completes if an optional metadata lookup
 * is unavailable during a staged migration/deploy.
 */
export async function loadCompletionResultContext({
  admin,
  session,
  user,
}: {
  admin: SupabaseClient;
  session: CompletionSession;
  user: Pick<User, "id" | "is_anonymous">;
}): Promise<CompletionResultContext> {
  const base = baseContext(session);
  if (session.challenge_type !== "daily" || !session.challenge_id) return base;

  try {
    const [challengeResult, profileResult] = await Promise.all([
      admin
        .from("daily_challenges")
        .select("challenge_date, difficulty, difficulty_source")
        .eq("id", session.challenge_id)
        .single(),
      admin.from("profiles").select("claimed_at").eq("id", session.user_id).maybeSingle(),
    ]);
    const challenge = challengeResult.data;
    const claimed = Boolean(profileResult.data?.claimed_at);
    const context: CompletionResultContext = {
      ...base,
      claimed,
      dailyDate: challenge?.challenge_date ?? base.dailyDate,
      difficulty: challenge?.difficulty ?? undefined,
      difficultySource: challenge?.difficulty_source ?? undefined,
      eligibleCount: null,
      fastestRank: null,
      isGuest: user.is_anonymous === true,
      shortestRank: null,
      wouldBeShortestRank: null,
    };

    if (
      challengeResult.error ||
      profileResult.error ||
      !session.completed ||
      !session.won ||
      session.is_official === false
    ) {
      return context;
    }

    if (!claimed) {
      const leaderboardResult = await admin.rpc("get_daily_leaderboard_v2", {
        p_challenge_id: session.challenge_id,
        p_board: "shortest",
        p_limit: 1000,
        p_offset: 0,
        p_friends_only: false,
      });

      return {
        ...context,
        wouldBeShortestRank: leaderboardResult.error
          ? null
          : deriveWouldBeShortestRank({
              leaderboard: leaderboardResult.data ?? [],
              session,
            }),
      };
    }

    const rankResult = await admin.rpc("get_daily_player_ranks", {
      p_challenge_id: session.challenge_id,
      p_user_id: session.user_id,
    });
    const playerRanks = rankResult.data?.[0];

    return {
      ...context,
      eligibleCount: rankResult.error ? null : positiveCount(playerRanks?.eligible_count),
      shortestRank: rankResult.error ? null : positiveRank(playerRanks?.shortest_rank),
      fastestRank: rankResult.error ? null : positiveRank(playerRanks?.fastest_rank),
    };
  } catch {
    return {
      ...base,
      claimed: false,
      eligibleCount: null,
      fastestRank: null,
      isGuest: user.is_anonymous === true,
      shortestRank: null,
      wouldBeShortestRank: null,
    };
  }
}
