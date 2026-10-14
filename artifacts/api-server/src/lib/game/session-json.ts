import { declaredSearchTier } from "./session-mode";
import { toDisplayTitle } from "./titles";

/** Snake_case DB row → camelCase API shape for game_sessions. */
export function sessionToJson(s: any) {
  const searchTier = declaredSearchTier({
    challengeType: s.challenge_type,
    isOfficial: s.is_official ?? true,
    friendSearchTier: s.search_tier,
  });

  return {
    id: s.id,
    challengeType: s.challenge_type,
    challengeId: s.challenge_id,
    friendChallengeId: s.friend_challenge_id ?? null,
    startArticle: toDisplayTitle(s.start_article),
    endArticle: toDisplayTitle(s.end_article),
    startDescription: s.start_description ?? null,
    endDescription: s.end_description ?? null,
    path: (s.path ?? []).map(toDisplayTitle),
    clicks: s.clicks,
    completed: s.completed,
    won: s.won,
    gaveUp: s.gave_up,
    timeSeconds: s.time_seconds,
    startedAt: s.created_at,
    completedAt: s.completed_at,
    attemptNumber: s.attempt_number ?? 1,
    isOfficial: s.is_official ?? true,
    localDate: s.local_date ?? null,
    timeZone: s.timezone_at_start ?? null,
    activeTimeMs: Number(s.active_time_ms ?? 0),
    timingActive: Boolean(s.active_started_at),
    ...(searchTier ? { searchTier } : {}),
  };
}
