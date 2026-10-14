import { describe, expect, it } from "vitest";

import {
  HEARTBEAT_INTERVAL_MS,
  createActiveTimerState,
  createTimingRequestCoordinator,
  displayedActiveTimeMs,
  reconcileActiveTimer,
  reduceActiveTimer,
} from "./active-timer";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("active timer decisions", () => {
  it("resumes only when the current article WebView reports ready", () => {
    const initial = createActiveTimerState({
      activeTimeMs: 2_000,
      timingActive: false,
      nowMs: 100,
    });

    expect(
      reduceActiveTimer(initial, { type: "webview-ready", nowMs: 500 }),
    ).toMatchObject({
      action: "resume",
      state: {
        activeTimeMs: 2_000,
        articleReady: true,
        timingActive: true,
      },
    });
  });

  it("pauses optimistically before a move", () => {
    const ready = reduceActiveTimer(
      createActiveTimerState({ activeTimeMs: 2_000, nowMs: 100 }),
      { type: "webview-ready", nowMs: 500 },
    ).state;

    expect(
      reduceActiveTimer(ready, { type: "move-start", nowMs: 2_500 }),
    ).toMatchObject({
      action: "pause",
      state: {
        activeTimeMs: 4_000,
        activeSinceMs: null,
        moving: true,
        timingActive: false,
      },
    });
  });

  it("resumes the still-ready article after a rejected move", () => {
    const ready = reduceActiveTimer(createActiveTimerState(), {
      type: "webview-ready",
      nowMs: 1_000,
    }).state;
    const moving = reduceActiveTimer(ready, {
      type: "move-start",
      nowMs: 2_000,
    }).state;

    expect(
      reduceActiveTimer(moving, { type: "move-failed", nowMs: 2_500 }),
    ).toMatchObject({
      action: "resume",
      state: {
        articleReady: true,
        moving: false,
        timingActive: true,
      },
    });
  });

  it("pauses when the app leaves the foreground", () => {
    const ready = reduceActiveTimer(createActiveTimerState(), {
      type: "webview-ready",
      nowMs: 1_000,
    }).state;

    expect(
      reduceActiveTimer(ready, {
        type: "app-state",
        appActive: false,
        nowMs: 4_000,
      }),
    ).toMatchObject({
      action: "pause",
      state: {
        activeTimeMs: 3_000,
        appActive: false,
        timingActive: false,
      },
    });
  });

  it("does not resume on foreground alone before the WebView is ready", () => {
    const backgrounded = reduceActiveTimer(createActiveTimerState(), {
      type: "app-state",
      appActive: false,
      nowMs: 1_000,
    }).state;

    const foregrounded = reduceActiveTimer(backgrounded, {
      type: "app-state",
      appActive: true,
      nowMs: 2_000,
    });

    expect(foregrounded).toMatchObject({
      action: null,
      state: {
        appActive: true,
        articleReady: false,
        timingActive: false,
      },
    });
    expect(
      reduceActiveTimer(foregrounded.state, {
        type: "webview-ready",
        nowMs: 2_500,
      }).action,
    ).toBe("resume");
  });

  it("stays paused when the app backgrounds during startup until foregrounded", () => {
    const backgroundedDuringStart = createActiveTimerState({
      appActive: false,
    });

    const readyInBackground = reduceActiveTimer(backgroundedDuringStart, {
      type: "webview-ready",
      nowMs: 1_000,
    });
    expect(readyInBackground).toMatchObject({
      action: null,
      state: {
        appActive: false,
        articleReady: true,
        timingActive: false,
      },
    });

    expect(
      reduceActiveTimer(readyInBackground.state, {
        type: "app-state",
        appActive: true,
        nowMs: 2_000,
      }),
    ).toMatchObject({
      action: "resume",
      state: { appActive: true, timingActive: true },
    });
  });

  it("emits heartbeats every 15 seconds only while active", () => {
    const ready = reduceActiveTimer(createActiveTimerState(), {
      type: "webview-ready",
      nowMs: 1_000,
    }).state;

    expect(
      reduceActiveTimer(ready, {
        type: "heartbeat-tick",
        nowMs: 1_000 + HEARTBEAT_INTERVAL_MS - 1,
      }).action,
    ).toBeNull();

    const heartbeat = reduceActiveTimer(ready, {
      type: "heartbeat-tick",
      nowMs: 1_000 + HEARTBEAT_INTERVAL_MS,
    });
    expect(heartbeat.action).toBe("heartbeat");

    const paused = reduceActiveTimer(heartbeat.state, {
      type: "app-state",
      appActive: false,
      nowMs: 1_000 + HEARTBEAT_INTERVAL_MS + 1,
    }).state;
    expect(
      reduceActiveTimer(paused, {
        type: "heartbeat-tick",
        nowMs: 1_000 + HEARTBEAT_INTERVAL_MS * 2,
      }).action,
    ).toBeNull();
  });

  it("reconciles the optimistic display to server milliseconds", () => {
    const ready = reduceActiveTimer(
      createActiveTimerState({ activeTimeMs: 2_000 }),
      { type: "webview-ready", nowMs: 1_000 },
    ).state;
    expect(displayedActiveTimeMs(ready, 4_000)).toBe(5_000);

    const reconciledActive = reconcileActiveTimer(
      ready,
      { activeTimeMs: 4_500, timingActive: true },
      4_000,
    );
    expect(displayedActiveTimeMs(reconciledActive, 5_000)).toBe(5_500);

    const reconciledPaused = reconcileActiveTimer(
      reconciledActive,
      { activeTimeMs: 5_200, timingActive: false },
      6_000,
    );
    expect(displayedActiveTimeMs(reconciledPaused, 20_000)).toBe(5_200);
  });
});

describe("timing request coordination", () => {
  it("serializes the screen-exit pause after a pending resume", async () => {
    const coordinator = createTimingRequestCoordinator();
    const token = coordinator.beginSession("session-1");
    const resumeResponse = deferred<{
      activeTimeMs: number;
      timingActive: boolean;
    }>();
    const resumeStarted = deferred<void>();
    const serverActions: string[] = [];
    const reconciled: number[] = [];

    const pendingResume = coordinator.enqueue({
      token,
      request: async () => {
        serverActions.push("resume");
        resumeStarted.resolve();
        return resumeResponse.promise;
      },
      onResponse: (response) => reconciled.push(response.activeTimeMs),
      onError: () => undefined,
    });
    await resumeStarted.promise;

    const finalPause = coordinator.finalizeSession({
      token,
      request: async () => {
        serverActions.push("pause");
      },
    });
    expect(serverActions).toEqual(["resume"]);

    resumeResponse.resolve({ activeTimeMs: 500, timingActive: true });
    await Promise.all([pendingResume, finalPause]);

    expect(serverActions).toEqual(["resume", "pause"]);
    expect(serverActions.at(-1)).toBe("pause");
    expect(reconciled).toEqual([]);
  });

  it("ignores an old response after a new session generation is installed", async () => {
    const coordinator = createTimingRequestCoordinator();
    const firstToken = coordinator.beginSession("session-1");
    const firstResponse = deferred<{
      activeTimeMs: number;
      timingActive: boolean;
    }>();
    const firstStarted = deferred<void>();
    const reconciled: number[] = [];

    const firstRequest = coordinator.enqueue({
      token: firstToken,
      request: async () => {
        firstStarted.resolve();
        return firstResponse.promise;
      },
      onResponse: (response) => reconciled.push(response.activeTimeMs),
      onError: () => undefined,
    });
    await firstStarted.promise;

    const secondToken = coordinator.beginSession("session-1");
    expect(secondToken.generation).toBeGreaterThan(firstToken.generation);
    firstResponse.resolve({ activeTimeMs: 500, timingActive: true });
    await firstRequest;

    expect(reconciled).toEqual([]);

    await coordinator.enqueue({
      token: secondToken,
      request: async () => ({ activeTimeMs: 1_000, timingActive: false }),
      onResponse: (response) => reconciled.push(response.activeTimeMs),
      onError: () => undefined,
    });
    expect(reconciled).toEqual([1_000]);
  });
});
