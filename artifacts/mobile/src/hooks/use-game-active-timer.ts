import { randomUUID } from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { transitionGameTiming } from "@/lib/api";
import {
  createActiveTimerState,
  createTimingRequestCoordinator,
  displayedActiveTimeMs,
  reconcileActiveTimer,
  reduceActiveTimer,
  type ActiveTimerEvent,
  type ClientTimingAction,
  type TimingSessionToken,
} from "@/lib/active-timer";
import type { GameSession } from "@/lib/types";

/**
 * The game screen's active timer: the displayed active time, the timing
 * requests sent to the server, and the pause sent when the screen exits.
 */
export function useGameActiveTimer(sessionId: string | undefined) {
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const sessionRef = useRef<GameSession | null>(null);
  const timerStateRef = useRef(
    createActiveTimerState({ appActive: AppState.currentState === "active" }),
  );
  const timingCoordinatorRef = useRef(createTimingRequestCoordinator());
  const timingSessionTokenRef = useRef<TimingSessionToken | null>(null);
  const mountedRef = useRef(true);

  function refreshTimerDisplay(nowMs = Date.now()) {
    if (!mountedRef.current) return;
    setActiveTimeMs(displayedActiveTimeMs(timerStateRef.current, nowMs));
  }

  function enqueueTimingAction(
    token: TimingSessionToken,
    action: ClientTimingAction,
  ): Promise<void> {
    return timingCoordinatorRef.current.enqueue({
      token,
      request: () =>
        transitionGameTiming({
          sessionId: token.sessionId,
          action,
          eventId: randomUUID(),
        }),
      onResponse: (server) => {
        timerStateRef.current = reconcileActiveTimer(
          timerStateRef.current,
          server,
          Date.now(),
        );
        refreshTimerDisplay();
      },
      onError: () => {
        const current = timerStateRef.current;
        timerStateRef.current = {
          ...current,
          activeTimeMs: displayedActiveTimeMs(current, Date.now()),
          activeSinceMs: null,
          lastHeartbeatAtMs: null,
          timingActive: false,
        };
        refreshTimerDisplay();
      },
    });
  }

  function applyTimerEvent(event: ActiveTimerEvent): Promise<void> {
    const decision = reduceActiveTimer(timerStateRef.current, event);
    timerStateRef.current = decision.state;
    refreshTimerDisplay(event.nowMs);
    const token = timingSessionTokenRef.current;
    return decision.action && token
      ? enqueueTimingAction(token, decision.action)
      : Promise.resolve();
  }

  function installSessionTimer(nextSession: GameSession) {
    const nowMs = Date.now();
    const appActive = timerStateRef.current.appActive;
    sessionRef.current = nextSession;
    timingSessionTokenRef.current = timingCoordinatorRef.current.beginSession(
      nextSession.id,
    );
    timerStateRef.current = createActiveTimerState({
      activeTimeMs: nextSession.activeTimeMs,
      appActive,
      timingActive: nextSession.timingActive,
      nowMs,
    });
    refreshTimerDisplay(nowMs);
    if (nextSession.timingActive) {
      void applyTimerEvent({ type: "article-loading", nowMs });
    }
  }

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      void applyTimerEvent({
        type: "app-state",
        appActive: nextState === "active",
        nowMs: Date.now(),
      });
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    onAppStateChange(AppState.currentState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => {
      const nowMs = Date.now();
      refreshTimerDisplay(nowMs);
      void applyTimerEvent({ type: "heartbeat-tick", nowMs });
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const currentSession = sessionRef.current;
      const timingToken = timingSessionTokenRef.current;
      const decision = reduceActiveTimer(timerStateRef.current, {
        type: "screen-exit",
        nowMs: Date.now(),
      });
      timerStateRef.current = decision.state;
      timingSessionTokenRef.current = null;
      if (currentSession && timingToken) {
        void timingCoordinatorRef.current
          .finalizeSession({
            token: timingToken,
            request: () =>
              transitionGameTiming({
                sessionId: currentSession.id,
                action: "pause",
                eventId: randomUUID(),
              }),
          })
          .catch(() => undefined);
      }
    };
  }, []);

  return { activeTimeMs, applyTimerEvent, installSessionTimer, sessionRef };
}
