interface StartModeInput {
  challengeType: string;
  replay?: boolean;
}

export type SearchTier = "find" | "palette";

// Hold all declared sessions at palette after the 2026-07-27 mobile perf rollback.
export const SEARCH_TIER_HOLD = true;

export const DEFAULT_FRIEND_SEARCH_TIER: SearchTier = "find";

export function allowsArticleBack(session: {
  challengeType: string;
  isOfficial: boolean;
}): boolean {
  return session.challengeType !== "daily" || !session.isOfficial;
}

export function parseStoredSearchTier(value: unknown): SearchTier | null {
  return value === "find" || value === "palette" ? value : null;
}

export function parseRequestedSearchTier(value: unknown): SearchTier {
  if (value === undefined || value === null) {
    return DEFAULT_FRIEND_SEARCH_TIER;
  }
  const parsed = parseStoredSearchTier(value);
  if (!parsed) {
    throw new Error("Invalid searchTier");
  }
  return parsed;
}

type SearchTierSession = {
  challengeType: string;
  isOfficial: boolean;
  friendSearchTier?: unknown;
};

export function deriveDeclaredSearchTier(session: SearchTierSession): SearchTier | undefined {
  if (session.challengeType === "friend") {
    return parseStoredSearchTier(session.friendSearchTier) ?? undefined;
  }
  return session.challengeType === "daily" && session.isOfficial ? "find" : "palette";
}

export function declaredSearchTier(session: SearchTierSession): SearchTier {
  return SEARCH_TIER_HOLD ? "palette" : (deriveDeclaredSearchTier(session) ?? "palette");
}

export function parseStartMode({ challengeType, replay = false }: StartModeInput): {
  isOfficial: boolean;
} {
  if (replay && challengeType !== "daily") {
    throw new Error("Replay is daily-only");
  }

  return { isOfficial: !replay };
}
