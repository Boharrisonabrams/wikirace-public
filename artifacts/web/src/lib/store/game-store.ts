import { create } from "zustand";

import { api, ApiError } from "@/lib/api";

export type ChallengeType = "daily" | "friend" | "practice";
export type SearchTier = "find" | "palette";
export type GameStatus = "idle" | "loading" | "playing" | "finished" | "error";

export interface GameSession {
  id: string;
  challengeType: ChallengeType;
  challengeId: string | null;
  friendChallengeId: string | null;
  startArticle: string;
  endArticle: string;
  startDescription?: string | null;
  endDescription?: string | null;
  path: string[];
  clicks: number;
  completed: boolean;
  won: boolean;
  gaveUp: boolean;
  timeSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  attemptNumber?: number;
  isOfficial: boolean;
  searchTier?: SearchTier;
  localDate?: string | null;
  timeZone?: string | null;
  activeTimeMs?: number;
  timingActive?: boolean;
}

export interface StreakInfo {
  current: number;
  longest: number;
  extended: boolean;
}

export interface GameResult {
  won: boolean;
  gaveUp: boolean;
  clicks: number;
  timeSeconds: number;
  path: string[];
  endArticle: string;
  streak: StreakInfo | null;
  activeTimeMs?: number;
  claimed?: boolean;
  isGuest?: boolean;
}

export interface StartParams {
  challengeType: ChallengeType;
  challengeId?: string | null;
  friendChallengeId?: string | null;
}

interface GameState {
  session: GameSession | null;
  status: GameStatus;
  error: string | null;
  /** a navigate request is in flight */
  moving: boolean;
  result: GameResult | null;

  start: (params: StartParams) => Promise<void>;
  navigate: (
    destinationTitle: string,
  ) => Promise<{ won: boolean } | { invalid: string } | null>;
  goBack: () => Promise<boolean>;
  giveUp: () => Promise<void>;
  reset: () => void;
}

function resultFromSession(session: GameSession): GameResult {
  return {
    won: session.won,
    gaveUp: session.gaveUp,
    clicks: session.clicks,
    timeSeconds: session.timeSeconds ?? 0,
    path: session.path,
    endArticle: session.endArticle,
    streak: null,
    activeTimeMs: session.activeTimeMs,
  };
}

/**
 * Server-driven game state. The server owns the path, click count, win flag
 * and elapsed time; this store only mirrors what the API returns.
 */
export const useGameStore = create<GameState>((set, get) => ({
  session: null,
  status: "idle",
  error: null,
  moving: false,
  result: null,

  start: async (params) => {
    set({ status: "loading", error: null, result: null, session: null });
    try {
      const data = await api<{
        session: GameSession;
        alreadyCompleted?: boolean;
      }>("/game/start", { method: "POST", body: params });
      if (data.alreadyCompleted) {
        set({
          session: data.session,
          status: "finished",
          result: resultFromSession(data.session),
        });
        return;
      }
      set({ session: data.session, status: "playing" });
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? "Sign in to play"
          : err instanceof Error
            ? err.message
            : "Failed to start the game";
      set({ status: "error", error: message });
    }
  },

  navigate: async (destinationTitle) => {
    const { session, status, moving } = get();
    if (!session || status !== "playing" || moving) return null;

    set({ moving: true });
    try {
      const data = await api<{
        valid: boolean;
        won: boolean;
        clicks: number;
        currentArticle: string;
        path: string[];
      }>("/game/navigate", {
        method: "POST",
        body: { sessionId: session.id, destinationTitle },
      });

      set({
        session: {
          ...session,
          path: data.path,
          clicks: data.clicks,
          won: data.won,
        },
        moving: false,
      });

      if (data.won) {
        await finishGame(set, get, false);
        return { won: true };
      }
      return { won: false };
    } catch (err) {
      set({ moving: false });
      if (err instanceof ApiError && err.status === 400) {
        return { invalid: err.reason ?? "That link is not on this page" };
      }
      if (err instanceof ApiError && err.status === 409) {
        return null; // duplicate click — ignore
      }
      throw err;
    }
  },

  goBack: async () => {
    const { session, status, moving } = get();
    if (!session || status !== "playing" || moving || session.path.length <= 1)
      return false;

    set({ moving: true });
    try {
      const data = await api<{
        clicks: number;
        currentArticle: string;
        path: string[];
      }>("/game/navigate", {
        method: "POST",
        body: { sessionId: session.id, back: true },
      });
      set({
        session: { ...session, path: data.path, clicks: data.clicks },
        moving: false,
      });
      return true;
    } catch {
      set({ moving: false });
      return false;
    }
  },

  giveUp: async () => {
    await finishGame(set, get, true);
  },

  reset: () => {
    set({
      session: null,
      status: "idle",
      error: null,
      moving: false,
      result: null,
    });
  },
}));

async function finishGame(
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
  gaveUp: boolean,
) {
  const { session } = get();
  if (!session) return;
  try {
    const result = await api<GameResult>("/game/complete", {
      method: "POST",
      body: { sessionId: session.id, gaveUp },
    });
    set({
      status: "finished",
      result: { ...result, gaveUp },
      session: { ...session, completed: true, won: result.won, gaveUp },
    });
  } catch (err) {
    set({
      status: "error",
      error: err instanceof Error ? err.message : "Failed to save your result",
    });
  }
}
