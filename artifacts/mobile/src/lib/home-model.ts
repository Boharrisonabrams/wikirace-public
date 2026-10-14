import { isCurrentDailySessionDate } from "./daily-date";
import type { DailyChallenge, GameSession } from "./types";

export function getHomeIdentityChip({
  isGuest,
  profileClaimed,
  username,
}: {
  isGuest: boolean;
  profileClaimed: boolean | null;
  username?: string | null;
}): { label: string; tone: "guest" | "saved" | "setup" } {
  const normalizedUsername =
    typeof username === "string" && username.trim().length > 0
      ? username.trim()
      : "player";

  if (profileClaimed === true) {
    return {
      label: `@${normalizedUsername} · Saved`,
      tone: "saved",
    };
  }

  if (isGuest) {
    return {
      label: "Guest — save your score",
      tone: "guest",
    };
  }

  return {
    label: `@${normalizedUsername} · Finish setup`,
    tone: "setup",
  };
}

function resultFallbackParams({
  isGuest,
  profileClaimed,
}: {
  isGuest?: boolean;
  profileClaimed?: boolean | null;
}): Record<string, string> {
  return {
    ...(isGuest === undefined ? {} : { isGuest: String(isGuest) }),
    ...(profileClaimed == null ? {} : { claimed: String(profileClaimed) }),
  };
}

export function getHomeAccountAction({
  isGuest,
  profileClaimed,
}: {
  isGuest: boolean;
  profileClaimed: boolean | null;
}) {
  if (profileClaimed !== false) return null;

  if (!isGuest) {
    return {
      kind: "finalize-profile" as const,
      label: "Finish account setup",
    };
  }

  return {
    kind: "navigate" as const,
    label: "Save your progress",
    destination: {
      pathname: "/signup" as const,
      params: { mode: "claim", next: "/" },
    },
  };
}

export function formatIssuedDate(date?: string): string {
  if (!date) return "—";

  const parts = date.split("-").map((part) => Number.parseInt(part, 10));
  const source =
    parts.length === 3 &&
    parts.every((part) => Number.isFinite(part)) &&
    parts[1] >= 1 &&
    parts[1] <= 12 &&
    parts[2] >= 1 &&
    parts[2] <= 31
      ? new Date(parts[0], parts[1] - 1, parts[2], 12)
      : new Date(`${date}T12:00:00`);

  if (Number.isNaN(source.getTime())) return "—";

  return source.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function getHomePrimaryAction({
  challenge,
  isGuest,
  profileClaimed,
  session,
}: {
  authenticated: boolean;
  challenge: DailyChallenge | null;
  isGuest?: boolean;
  profileClaimed?: boolean | null;
  session: GameSession | null;
}) {
  if (!challenge) return null;

  const currentSession = isCurrentDailySessionDate(session) ? session : null;

  if (currentSession?.completed) {
    return {
      label: "See result",
      destination: {
        pathname: "/result" as const,
        params: {
          sessionId: currentSession.id,
          type: "daily",
          dailyDate: challenge.date,
          gaveUp: currentSession.gaveUp ? "true" : "false",
          ...(isGuest === undefined && profileClaimed === undefined
            ? {}
            : {
                challengeId: challenge.id,
                replay: currentSession.isOfficial === false ? "true" : "false",
                ...resultFallbackParams({ isGuest, profileClaimed }),
              }),
        },
      },
    };
  }

  return {
    label: currentSession ? "Resume today's path" : "Begin today's path",
    destination: {
      pathname: "/game" as const,
      params: {
        type: "daily",
        challengeId: challenge.id,
        dailyDate: challenge.date,
        ...resultFallbackParams({ isGuest, profileClaimed }),
      },
    },
  };
}

export function getHomeReplayAction({
  challenge,
  isGuest,
  profileClaimed,
  replayAvailable,
  session,
}: {
  challenge: DailyChallenge | null;
  isGuest?: boolean;
  profileClaimed?: boolean | null;
  replayAvailable: boolean;
  session: GameSession | null;
}) {
  if (
    !challenge ||
    !replayAvailable ||
    !session?.completed ||
    !session.isOfficial
  ) {
    return null;
  }

  return {
    label: "Replay unranked",
    destination: {
      pathname: "/game" as const,
      params: {
        type: "daily",
        challengeId: challenge.id,
        dailyDate: challenge.date,
        replay: "true",
        ...resultFallbackParams({ isGuest, profileClaimed }),
      },
    },
  };
}
