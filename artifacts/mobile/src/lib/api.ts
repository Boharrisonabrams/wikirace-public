import { getSupabase } from "@/lib/supabase";
import { deviceTimeZone } from "@/lib/daily-context";
import type { SharedChallengePreview } from "@/lib/challenge-entry";
import type {
  CreatedPrivateChallenge,
  PrivateChallengeDraft,
} from "@/lib/private-challenge";
import type { WikipediaSuggestion } from "@/lib/article-suggestions";
import type {
  ArticleData,
  DailyBoard,
  DailyChallengeResponse,
  FriendProfile,
  FriendsResponse,
  GameResult,
  GameSession,
  LeaderboardEntry,
  ProfileResponse,
  SearchTier,
  TimingAction,
  TimingState,
} from "@/lib/types";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiBaseUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not defined");
}

export class ApiError extends Error {
  status: number;
  reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.reason = reason;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

function urlFor(path: string): string {
  return `${apiBaseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(urlFor(path), {
    method: options.method ?? "GET",
    headers: await authHeaders(),
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response body.
  }

  if (!response.ok) {
    const payload = data as { error?: string; reason?: string } | null;
    throw new ApiError(
      response.status,
      payload?.error ?? `Request failed (${response.status})`,
      payload?.reason,
    );
  }

  return data as T;
}

export function getDailyChallenge(timeZone = deviceTimeZone()) {
  const params = new URLSearchParams({ timeZone });
  return api<DailyChallengeResponse>(`/daily?${params.toString()}`);
}

export function startGame(body: {
  challengeType: "daily" | "practice" | "friend";
  challengeId?: string | null;
  friendChallengeId?: string | null;
  replay?: boolean;
  timeZone?: string;
}) {
  const requestBody =
    body.challengeType === "daily" && body.timeZone === undefined
      ? { ...body, timeZone: deviceTimeZone() }
      : body;
  return api<{
    session: GameSession;
    resumed?: boolean;
    alreadyCompleted?: boolean;
  }>("/game/start", { method: "POST", body: requestBody });
}

export function navigateGame(body: {
  sessionId: string;
  destinationTitle?: string;
  back?: true;
}) {
  return api<{
    valid: boolean;
    won: boolean;
    clicks: number;
    currentArticle: string;
    path: string[];
  }>("/game/navigate", { method: "POST", body });
}

export function transitionGameTiming(body: {
  sessionId: string;
  action: TimingAction;
  eventId: string;
}) {
  return api<TimingState>("/game/timing", {
    method: "POST",
    body,
  });
}

export function completeGame(sessionId: string, gaveUp: boolean) {
  return api<GameResult>("/game/complete", {
    method: "POST",
    body: { sessionId, gaveUp },
  });
}

export function createChallengeLink(sessionId: string, searchTier: SearchTier) {
  return api<{ challenge: SharedChallengePreview & { url: string } }>(
    "/challenge",
    { method: "POST", body: { fromSessionId: sessionId, searchTier } },
  );
}

export function createCustomChallenge(body: PrivateChallengeDraft) {
  return api<{ challenge: CreatedPrivateChallenge }>("/challenge", {
    method: "POST",
    body,
  });
}

export interface SharedChallengeResultEntry {
  rank: number;
  is_current_user: boolean;
  username: string;
  display_name: string | null;
  clicks: number;
  time_seconds: number;
  won: boolean;
  gave_up: boolean;
  completed_at: string;
  path?: string[];
}

export interface SharedChallengeResponse {
  challenge: SharedChallengePreview;
  creator: { username: string; display_name: string | null };
  results: SharedChallengeResultEntry[];
  mySession: {
    completed: boolean;
    won?: boolean;
    gave_up?: boolean;
    clicks?: number;
    time_seconds?: number;
  } | null;
}

export function getSharedChallenge(code: string) {
  return api<SharedChallengeResponse>(
    `/challenge/${encodeURIComponent(code)}`,
  );
}

export function recordChallengeStart(code: string) {
  return api<{ recorded: true }>(
    `/challenge/${encodeURIComponent(code)}/start`,
    { method: "POST" },
  );
}

export function getArticle(title: string) {
  return api<ArticleData>(`/wikipedia/article/${encodeURIComponent(title)}`);
}

export function getWikipediaSuggestions(query: string, limit = 6) {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(Math.min(6, Math.max(1, Math.floor(limit) || 6))),
  });
  return api<{ suggestions: WikipediaSuggestion[] }>(
    `/wikipedia/suggestions?${params.toString()}`,
  ).then(({ suggestions }) => suggestions.slice(0, 6));
}

export function getDailyLeaderboard(
  challengeId: string,
  friendsOnly: boolean,
  board: DailyBoard = "shortest",
) {
  const params = new URLSearchParams({ challengeId, board });
  if (friendsOnly) params.set("friendsOnly", "true");
  return api<{
    board: DailyBoard;
    leaderboard: LeaderboardEntry[];
  }>(`/leaderboard/daily?${params.toString()}`);
}

export function getProfile() {
  return api<ProfileResponse>("/profile/me");
}

export function updateUsername(username: string) {
  return api<{ profile: ProfileResponse["profile"] }>("/profile/me", {
    method: "PATCH",
    body: { username },
  });
}

export function getFriends() {
  return api<FriendsResponse>("/friends");
}

export function requestFriend(friendCode: string) {
  return api<{ status: "accepted" | "pending"; friend: FriendProfile }>(
    "/friends/request",
    {
      method: "POST",
      body: { friendCode: friendCode.trim().toUpperCase() },
    },
  );
}

export function respondToFriendRequest(friendshipId: string, accept: boolean) {
  return api<{ status: "accepted" | "declined" }>("/friends/respond", {
    method: "POST",
    body: { friendshipId, accept },
  });
}

export function deleteAccount() {
  return api<{ deleted: true }>("/profile/me", {
    method: "DELETE",
    body: { confirmation: "DELETE" },
  });
}
