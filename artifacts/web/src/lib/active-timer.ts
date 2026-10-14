export type ClientTimingAction = "resume" | "pause" | "heartbeat";

export const HEARTBEAT_INTERVAL_MS = 15_000;

export interface ActiveTimerState {
  activeTimeMs: number;
  activeSinceMs: number | null;
  appActive: boolean;
  articleReady: boolean;
  lastHeartbeatAtMs: number | null;
  moving: boolean;
  timingActive: boolean;
}

export interface CreateActiveTimerStateOptions {
  activeTimeMs?: number;
  appActive?: boolean;
  timingActive?: boolean;
  nowMs?: number;
}

export interface TimingSessionToken {
  generation: number;
  sessionId: string;
}

interface EnqueueTimingRequestOptions<T> {
  token: TimingSessionToken;
  request: () => Promise<T>;
  onResponse: (response: T) => void;
  onError: () => void;
}

interface FinalizeTimingSessionOptions {
  token: TimingSessionToken;
  request: () => Promise<unknown>;
}

export interface TimingRequestCoordinator {
  beginSession: (sessionId: string) => TimingSessionToken;
  enqueue: <T>(options: EnqueueTimingRequestOptions<T>) => Promise<void>;
  finalizeSession: (options: FinalizeTimingSessionOptions) => Promise<void>;
}

export type ActiveTimerEvent =
  | { type: "webview-ready"; nowMs: number }
  | { type: "article-loading"; nowMs: number }
  | { type: "move-start"; nowMs: number }
  | { type: "move-failed"; nowMs: number }
  | { type: "screen-exit"; nowMs: number }
  | { type: "app-state"; appActive: boolean; nowMs: number }
  | { type: "heartbeat-tick"; nowMs: number };

export interface ActiveTimerDecision {
  action: ClientTimingAction | null;
  state: ActiveTimerState;
}

export interface ServerTimingState {
  activeTimeMs: number;
  timingActive: boolean;
}

export function displayedActiveTimeMs(
  state: ActiveTimerState,
  nowMs: number,
): number {
  if (!state.timingActive || state.activeSinceMs === null) {
    return state.activeTimeMs;
  }
  return state.activeTimeMs + Math.max(0, nowMs - state.activeSinceMs);
}

export function reconcileActiveTimer(
  state: ActiveTimerState,
  server: ServerTimingState,
  nowMs: number,
): ActiveTimerState {
  const activeTimeMs = Number.isFinite(server.activeTimeMs)
    ? Math.max(0, server.activeTimeMs)
    : 0;
  return {
    ...state,
    activeTimeMs,
    activeSinceMs: server.timingActive ? nowMs : null,
    lastHeartbeatAtMs: server.timingActive ? nowMs : null,
    timingActive: server.timingActive,
  };
}

export function createActiveTimerState({
  activeTimeMs = 0,
  appActive = true,
  timingActive = false,
  nowMs = Date.now(),
}: CreateActiveTimerStateOptions = {}): ActiveTimerState {
  return {
    activeTimeMs: Math.max(0, activeTimeMs),
    activeSinceMs: timingActive ? nowMs : null,
    appActive,
    articleReady: false,
    lastHeartbeatAtMs: timingActive ? nowMs : null,
    moving: false,
    timingActive,
  };
}

export function createTimingRequestCoordinator(): TimingRequestCoordinator {
  let currentToken: TimingSessionToken | null = null;
  let generation = 0;
  let requestVersion = 0;
  let tail: Promise<void> = Promise.resolve();

  const isCurrent = (token: TimingSessionToken, version: number) =>
    version === requestVersion &&
    currentToken?.sessionId === token.sessionId &&
    currentToken.generation === token.generation;

  return {
    beginSession(sessionId) {
      const token = { generation: ++generation, sessionId };
      currentToken = token;
      return token;
    },

    enqueue<T>({
      token,
      request,
      onResponse,
      onError,
    }: EnqueueTimingRequestOptions<T>) {
      const version = ++requestVersion;
      const operation = tail
        .catch(() => undefined)
        .then(async () => {
          let response: T;
          try {
            response = await request();
          } catch {
            if (isCurrent(token, version)) onError();
            return;
          }
          if (isCurrent(token, version)) onResponse(response);
        });
      tail = operation;
      return operation;
    },

    finalizeSession({ token, request }) {
      if (
        currentToken?.sessionId === token.sessionId &&
        currentToken.generation === token.generation
      ) {
        currentToken = null;
        requestVersion += 1;
      }

      const operation = tail
        .catch(() => undefined)
        .then(request)
        .then(() => undefined)
        .catch(() => undefined);
      tail = operation;
      return operation;
    },
  };
}

function resumeIfInteractive(
  state: ActiveTimerState,
  nowMs: number,
): ActiveTimerDecision {
  if (
    state.timingActive ||
    !state.appActive ||
    !state.articleReady ||
    state.moving
  ) {
    return { action: null, state };
  }
  return {
    action: "resume",
    state: {
      ...state,
      activeSinceMs: nowMs,
      lastHeartbeatAtMs: nowMs,
      timingActive: true,
    },
  };
}

function pauseIfActive(
  state: ActiveTimerState,
  nowMs: number,
  updates: Partial<ActiveTimerState>,
): ActiveTimerDecision {
  const paused = { ...state, ...updates };
  if (!state.timingActive) return { action: null, state: paused };
  return {
    action: "pause",
    state: {
      ...paused,
      activeTimeMs: displayedActiveTimeMs(state, nowMs),
      activeSinceMs: null,
      lastHeartbeatAtMs: null,
      timingActive: false,
    },
  };
}

export function reduceActiveTimer(
  state: ActiveTimerState,
  event: ActiveTimerEvent,
): ActiveTimerDecision {
  if (event.type === "heartbeat-tick") {
    const lastHeartbeatAtMs = state.lastHeartbeatAtMs ?? event.nowMs;
    if (
      !state.timingActive ||
      event.nowMs - lastHeartbeatAtMs < HEARTBEAT_INTERVAL_MS
    ) {
      return { action: null, state };
    }

    return {
      action: "heartbeat",
      state: { ...state, lastHeartbeatAtMs: event.nowMs },
    };
  }

  if (event.type === "webview-ready") {
    return resumeIfInteractive(
      { ...state, articleReady: true, moving: false },
      event.nowMs,
    );
  }

  if (event.type === "article-loading") {
    return pauseIfActive(state, event.nowMs, {
      articleReady: false,
      moving: false,
    });
  }

  if (event.type === "move-start") {
    return pauseIfActive(state, event.nowMs, { moving: true });
  }

  if (event.type === "move-failed") {
    return resumeIfInteractive({ ...state, moving: false }, event.nowMs);
  }

  if (event.type === "screen-exit") {
    return pauseIfActive(state, event.nowMs, {
      articleReady: false,
      moving: false,
    });
  }

  if (!event.appActive) {
    return pauseIfActive(state, event.nowMs, { appActive: false });
  }

  return resumeIfInteractive({ ...state, appActive: true }, event.nowMs);
}
