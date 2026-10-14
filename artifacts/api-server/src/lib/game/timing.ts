export type TimingAction = "resume" | "pause" | "heartbeat";

export type TimingState = {
  activeTimeMs: number;
  activeStartedAt: number | null;
};

export type TimingUpdate = TimingState;

const MAX_HEARTBEAT_INTERVAL_MS = 15_000;

function elapsedSince(startedAt: number, nowMs: number): number {
  return Math.max(0, nowMs - startedAt);
}

export function applyTimingTransition(
  state: TimingState,
  action: TimingAction,
  nowMs: number,
): TimingUpdate {
  if (action === "resume" && state.activeStartedAt === null) {
    return { ...state, activeStartedAt: nowMs };
  }

  if (action === "heartbeat" && state.activeStartedAt !== null) {
    return {
      activeTimeMs:
        state.activeTimeMs +
        Math.min(
          elapsedSince(state.activeStartedAt, nowMs),
          MAX_HEARTBEAT_INTERVAL_MS,
        ),
      activeStartedAt: nowMs,
    };
  }

  if (action === "pause" && state.activeStartedAt !== null) {
    return {
      activeTimeMs:
        state.activeTimeMs + elapsedSince(state.activeStartedAt, nowMs),
      activeStartedAt: null,
    };
  }

  return state;
}
