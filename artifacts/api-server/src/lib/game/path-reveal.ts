import type { SupabaseClient } from "@supabase/supabase-js";
import { toDisplayTitle } from "./titles";

type RaceScope =
  | {
      challengeId: string;
      type: "daily";
    }
  | {
      challengeId: string;
      type: "friend";
    };

type FinisherRow = {
  clicks: number | string | null;
  completed_at: string | null;
  time_seconds: number | string | null;
  user_id: string;
};

type SessionMoveRow = {
  clicks: number | string | null;
  completed_at: string | null;
  game_moves?:
    | Array<{
        move_number: number | string | null;
        to_article: string | null;
      }>
    | null;
  start_article: string | null;
  time_seconds: number | string | null;
  user_id: string;
};

function finisherKey(row: FinisherRow): string {
  return [
    row.user_id,
    String(row.clicks ?? ""),
    String(row.time_seconds ?? ""),
    row.completed_at ?? "",
  ].join("::");
}

function buildPath(row: SessionMoveRow): string[] | null {
  if (!row.start_article) return null;
  const moves = Array.isArray(row.game_moves) ? [...row.game_moves] : [];
  moves.sort(
    (left, right) =>
      Number(left.move_number ?? 0) - Number(right.move_number ?? 0),
  );
  return [row.start_article, ...moves.map((move) => move.to_article ?? "")]
    .filter((title) => title.length > 0)
    .map(toDisplayTitle);
}

async function loadPathLookup(
  admin: SupabaseClient,
  scope: RaceScope,
  userIds: string[],
): Promise<Map<string, string[]>> {
  if (userIds.length === 0) return new Map();

  const query = admin
    .from("game_sessions")
    .select(
      "user_id, clicks, time_seconds, completed_at, start_article, game_moves(move_number, to_article)",
    )
    .in("user_id", userIds)
    .eq("completed", true);

  const scopedQuery =
    scope.type === "daily"
      ? query
          .eq("challenge_id", scope.challengeId)
          .eq("challenge_type", "daily")
          .eq("is_official", true)
          .eq("won", true)
      : query.eq("friend_challenge_id", scope.challengeId);

  const { data, error } = await scopedQuery;
  if (error || !data) return new Map();

  const lookup = new Map<string, string[]>();
  for (const row of data as SessionMoveRow[]) {
    const path = buildPath(row);
    if (!path) continue;
    const key = finisherKey(row);
    if (!lookup.has(key)) lookup.set(key, path);
  }
  return lookup;
}

export async function callerCompletedDailyRace(
  admin: SupabaseClient,
  userId: string,
  challengeId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("game_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_type", "daily")
    .eq("challenge_id", challengeId)
    .eq("completed", true)
    .limit(1)
    .maybeSingle();

  return !error && Boolean(data?.id);
}

export async function attachFinisherPaths<T extends FinisherRow>(
  admin: SupabaseClient,
  scope: RaceScope,
  rows: T[],
): Promise<Array<T & { path?: string[] }>> {
  if (rows.length === 0) return rows;

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const lookup = await loadPathLookup(admin, scope, userIds);

  return rows.map((row) => {
    const path = lookup.get(finisherKey(row));
    return path ? { ...row, path } : row;
  });
}
