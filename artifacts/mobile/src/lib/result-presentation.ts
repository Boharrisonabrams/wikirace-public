import { formatTime } from "./game-utils";
import type {
  ChallengeType,
  DailyBoard,
  GameResult,
  LeaderboardEntry,
} from "./types";

export interface ResultStat {
  label: string;
  value: string;
}

export interface ResultPresentation {
  accountAction: { kind: "claim" | "finalize-profile"; label: string } | null;
  championSweep: boolean;
  detail: string;
  headline: string;
  kicker: string;
  rankTease: { copy: string; ctaLabel: string } | null;
  rankCards: Array<{
    board: DailyBoard;
    champion: boolean;
    detail: string;
    label: string;
    value: string;
  }>;
  showDailyReminder: boolean;
  showStreak: boolean;
  startArticle: string;
  stats: [ResultStat, ResultStat, ResultStat];
  targetMissed: string | null;
}

export interface ResultFallbackContext {
  challengeId?: string;
  claimed?: boolean;
  currentIsGuest?: boolean;
  dailyDate?: string;
  isGuest?: boolean;
  replay?: boolean;
}

export function resolveResultFallback(
  result: GameResult,
  fallback: ResultFallbackContext,
): GameResult {
  const completedGuestClaim =
    result.claimed === undefined &&
    result.isGuest === undefined &&
    fallback.isGuest === true &&
    fallback.currentIsGuest === false;
  return {
    ...result,
    challengeId:
      result.challengeId !== undefined
        ? result.challengeId
        : fallback.challengeId,
    claimed:
      result.claimed !== undefined
        ? result.claimed
        : completedGuestClaim
          ? true
          : fallback.claimed,
    dailyDate:
      result.dailyDate !== undefined ? result.dailyDate : fallback.dailyDate,
    isGuest:
      result.isGuest !== undefined
        ? result.isGuest
        : completedGuestClaim
          ? false
          : fallback.isGuest,
    isOfficial:
      result.isOfficial !== undefined ? result.isOfficial : !fallback.replay,
  };
}

function positiveRank(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function clickLabel(clicks: number): string {
  return `${clicks} ${clicks === 1 ? "click" : "clicks"}`;
}

function activeTimeLabel(activeTimeMs: number): string {
  return formatTime(Math.round(Math.max(0, activeTimeMs) / 1_000));
}

function percentileDetail(
  rank: number,
  eligibleCount: number | null | undefined,
): string | null {
  if (
    typeof eligibleCount !== "number" ||
    !Number.isInteger(eligibleCount) ||
    eligibleCount < rank
  ) {
    return null;
  }
  return `Top ${Math.max(1, Math.ceil((rank / eligibleCount) * 100))}%`;
}

export function leaderboardBoardCopy(board: DailyBoard): {
  explanation: string;
  title: string;
} {
  return board === "shortest"
    ? {
        title: "Shortest Path",
        explanation:
          "Fewest clicks ranks first. Ties go to lower active time, then earlier finish.",
      }
    : {
        title: "Fastest Solve",
        explanation:
          "Lowest active time ranks first. Ties go to fewer clicks, then earlier finish.",
      };
}

export function buildLeaderboardRowPresentation(
  entry: LeaderboardEntry,
  board: DailyBoard,
  isCurrentUser: boolean,
): {
  accessibilityLabel: string;
  primary: string;
  rank: number;
  secondary: string;
} {
  const selectedRank =
    board === "shortest" ? entry.shortest_rank : entry.fastest_rank;
  const rank = positiveRank(selectedRank) ?? positiveRank(entry.rank) ?? 0;
  const clicks = clickLabel(entry.clicks);
  const activeTimeMs = Number.isFinite(Number(entry.active_time_ms))
    ? Number(entry.active_time_ms)
    : entry.time_seconds * 1_000;
  const active = `Active ${activeTimeLabel(activeTimeMs)}`;
  const playerName = entry.display_name || entry.username;
  const currentUserCue = isCurrentUser ? ", you" : "";
  const metrics =
    board === "shortest"
      ? `${clicks}. Active time ${activeTimeLabel(activeTimeMs)}.`
      : `Active time ${activeTimeLabel(activeTimeMs)}. ${clicks}.`;

  return {
    rank,
    primary: board === "shortest" ? clicks : active,
    secondary: board === "shortest" ? active : clicks,
    accessibilityLabel: `Rank ${rank}. ${playerName}${currentUserCue}. ${metrics}`,
  };
}

export function buildResultPresentation(
  result: GameResult,
  kind: ChallengeType,
): ResultPresentation {
  const startArticle = result.path[0] ?? "Start";
  const hops = Math.max(0, result.path.length - 1);
  const isDaily = kind === "daily";
  const isOfficial = result.isOfficial !== false;
  const showOfficialAchievements =
    isDaily && isOfficial && result.won && result.claimed === true;
  const shortestRank = showOfficialAchievements
    ? positiveRank(result.shortestRank)
    : null;
  const fastestRank = showOfficialAchievements
    ? positiveRank(result.fastestRank)
    : null;
  const rankCards: ResultPresentation["rankCards"] = [];
  if (shortestRank !== null) {
    const percentile = percentileDetail(shortestRank, result.eligibleCount);
    rankCards.push({
      board: "shortest",
      champion: shortestRank === 1,
      detail: [percentile, "Fewest clicks, then active time"]
        .filter(Boolean)
        .join(" · "),
      label: "Shortest Path",
      value: `No. ${shortestRank}`,
    });
  }
  if (fastestRank !== null) {
    const percentile = percentileDetail(fastestRank, result.eligibleCount);
    rankCards.push({
      board: "fastest",
      champion: fastestRank === 1,
      detail: [percentile, "Active time, then clicks"]
        .filter(Boolean)
        .join(" · "),
      label: "Fastest Solve",
      value: `No. ${fastestRank}`,
    });
  }
  const showStreak = isDaily && isOfficial && Boolean(result.streak);
  const thirdStat: ResultStat =
    showStreak && result.streak
      ? { label: "day streak", value: String(result.streak.current) }
      : { label: "hops", value: String(hops) };
  const accountAction =
    isDaily && result.claimed === false
      ? result.isGuest === false
        ? {
            kind: "finalize-profile" as const,
            label: "Finish account setup",
          }
        : {
            kind: "claim" as const,
            label: "Save your score and join the rankings",
          }
      : null;
  const wouldBeShortestRank =
    isDaily && isOfficial && result.won && result.claimed === false
      ? positiveRank(result.wouldBeShortestRank)
      : null;
  const rankTease =
    wouldBeShortestRank === null || result.isGuest !== true
      ? null
      : {
          copy: `You'd be #${wouldBeShortestRank} today`,
          ctaLabel: "Save your score and join the rankings",
        };

  return {
    accountAction,
    championSweep: shortestRank === 1 && fastestRank === 1,
    detail: result.won
      ? `${startArticle} → ${result.endArticle}`
      : result.gaveUp
        ? `Gave up before reaching ${result.endArticle}.`
        : `Did not reach ${result.endArticle}.`,
    headline: result.won
      ? `You reached ${result.endArticle}.`
      : "The trail went cold.",
    kicker: isDaily
      ? `Daily challenge · ${isOfficial ? "Official result" : "Unranked replay"}`
      : kind === "friend"
        ? "Head-to-head"
        : "Practice run",
    rankTease,
    rankCards,
    showDailyReminder: isDaily && isOfficial,
    showStreak,
    startArticle,
    stats: [
      {
        label: result.clicks === 1 ? "click" : "clicks",
        value: String(result.clicks),
      },
      { label: "active time", value: formatTime(result.timeSeconds) },
      thirdStat,
    ],
    targetMissed: result.won ? null : result.endArticle,
  };
}
