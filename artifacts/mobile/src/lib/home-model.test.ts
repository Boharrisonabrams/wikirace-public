import { describe, expect, it, vi } from "vitest";

vi.mock("./daily-date", () => ({
  isCurrentDailySessionDate: (
    session: { challengeType: string; localDate: string | null } | null,
  ) => session?.challengeType === "daily" && session.localDate === "2026-07-09",
}));

import {
  formatIssuedDate,
  getHomeAccountAction,
  getHomeIdentityChip,
  getHomePrimaryAction,
  getHomeReplayAction,
} from "./home-model";
import type { DailyChallenge, GameSession } from "./types";

const challenge: DailyChallenge = {
  id: "daily-1",
  date: "2026-07-09",
  startArticle: "Pasta",
  endArticle: "France",
  startTitle: "Pasta",
  endTitle: "France",
  difficulty: "medium",
  difficultySource: "provisional",
  generatorVersion: 1,
  generatorSeed: "2026-07-09:v1",
  startTopic: "culture",
  endTopic: "geography",
  startRecognition: "familiar",
  endRecognition: "familiar",
};

const session: GameSession = {
  id: "session-1",
  challengeType: "daily",
  challengeId: challenge.id,
  friendChallengeId: null,
  startArticle: "Pasta",
  endArticle: "France",
  path: ["Pasta"],
  clicks: 0,
  completed: false,
  won: false,
  gaveUp: false,
  timeSeconds: null,
  startedAt: "2026-07-09T12:00:00.000Z",
  completedAt: null,
  attemptNumber: 1,
  isOfficial: true,
  localDate: challenge.date,
  timeZone: "America/Los_Angeles",
  activeTimeMs: 0,
  timingActive: false,
};

describe("getHomePrimaryAction", () => {
  it("returns no action while the daily challenge is unavailable", () => {
    expect(
      getHomePrimaryAction({
        authenticated: true,
        challenge: null,
        session: null,
      }),
    ).toBeNull();
  });

  it("never puts an account wall in front of today's path", () => {
    expect(
      getHomePrimaryAction({ authenticated: false, challenge, session: null }),
    ).toEqual({
      label: "Begin today's path",
      destination: {
        pathname: "/game",
        params: {
          type: "daily",
          challengeId: challenge.id,
          dailyDate: challenge.date,
        },
      },
    });
  });

  it("starts and resumes the same server-defined daily route", () => {
    const expectedDestination = {
      pathname: "/game",
      params: {
        type: "daily",
        challengeId: challenge.id,
        dailyDate: challenge.date,
      },
    };

    expect(
      getHomePrimaryAction({ authenticated: true, challenge, session: null }),
    ).toEqual({
      label: "Begin today's path",
      destination: expectedDestination,
    });
    expect(
      getHomePrimaryAction({ authenticated: true, challenge, session }),
    ).toEqual({
      label: "Resume today's path",
      destination: expectedDestination,
    });
  });

  it("keeps an authenticated guest playable", () => {
    expect(
      getHomePrimaryAction({ authenticated: true, challenge, session: null }),
    ).toMatchObject({
      label: "Begin today's path",
      destination: { pathname: "/game" },
    });
  });

  it("refuses to resume a stale daily session", () => {
    expect(
      getHomePrimaryAction({
        authenticated: true,
        challenge: {
          ...challenge,
          date: "2099-07-24",
        },
        session: {
          ...session,
          localDate: "2026-07-23",
        },
      }),
    ).toEqual({
      label: "Begin today's path",
      destination: {
        pathname: "/game",
        params: {
          type: "daily",
          challengeId: challenge.id,
          dailyDate: "2099-07-24",
        },
      },
    });
  });

  it("carries old-API fallback context into an already-completed result", () => {
    expect(
      getHomePrimaryAction({
        authenticated: true,
        challenge,
        isGuest: true,
        profileClaimed: false,
        session: { ...session, completed: true, won: true },
      }),
    ).toMatchObject({
      destination: {
        pathname: "/result",
        params: {
          challengeId: challenge.id,
          claimed: "false",
          isGuest: "true",
          replay: "false",
        },
      },
    });
  });

  it("carries actual permanent-but-unclaimed context into Daily play", () => {
    expect(
      getHomePrimaryAction({
        authenticated: true,
        challenge,
        isGuest: false,
        profileClaimed: false,
        session,
      }),
    ).toMatchObject({
      destination: {
        pathname: "/game",
        params: {
          claimed: "false",
          isGuest: "false",
        },
      },
    });
  });

  it.each([false, true])(
    "routes a completed daily to its result (gaveUp=%s)",
    (gaveUp) => {
      const completed = { ...session, completed: true, won: !gaveUp, gaveUp };
      expect(
        getHomePrimaryAction({
          authenticated: true,
          challenge,
          session: completed,
        }),
      ).toEqual({
        label: "See result",
        destination: {
          pathname: "/result",
          params: {
            sessionId: session.id,
            type: "daily",
            dailyDate: challenge.date,
            gaveUp: String(gaveUp),
          },
        },
      });
    },
  );
});

describe("getHomeAccountAction", () => {
  it("offers a reachable same-UUID claim route to guest players", () => {
    expect(
      getHomeAccountAction({ isGuest: true, profileClaimed: false }),
    ).toEqual({
      kind: "navigate",
      label: "Save your progress",
      destination: {
        pathname: "/signup",
        params: { mode: "claim", next: "/" },
      },
    });
  });

  it("offers profile-only retry to permanent but unclaimed players", () => {
    expect(
      getHomeAccountAction({ isGuest: false, profileClaimed: false }),
    ).toEqual({
      kind: "finalize-profile",
      label: "Finish account setup",
    });
  });

  it("hides account setup after the profile is claimed or still unknown", () => {
    expect(
      getHomeAccountAction({ isGuest: false, profileClaimed: true }),
    ).toBeNull();
    expect(
      getHomeAccountAction({ isGuest: true, profileClaimed: null }),
    ).toBeNull();
  });
});

describe("getHomeIdentityChip", () => {
  it("shows saved identity copy for claimed users", () => {
    expect(
      getHomeIdentityChip({
        isGuest: false,
        profileClaimed: true,
        username: "bo",
      }),
    ).toEqual({
      label: "@bo · Saved",
      tone: "saved",
    });
  });

  it("shows save-your-score copy for guests", () => {
    expect(
      getHomeIdentityChip({
        isGuest: true,
        profileClaimed: false,
        username: "guest_player",
      }),
    ).toEqual({
      label: "Guest — save your score",
      tone: "guest",
    });
  });
});

describe("getHomeReplayAction", () => {
  it("routes a completed official Daily to an explicitly unranked replay", () => {
    expect(
      getHomeReplayAction({
        challenge,
        replayAvailable: true,
        session: { ...session, completed: true, won: true },
      }),
    ).toEqual({
      label: "Replay unranked",
      destination: {
        pathname: "/game",
        params: {
          type: "daily",
          challengeId: challenge.id,
          dailyDate: challenge.date,
          replay: "true",
        },
      },
    });
  });

  it("carries actual guest claim context into replay", () => {
    expect(
      getHomeReplayAction({
        challenge,
        isGuest: true,
        profileClaimed: false,
        replayAvailable: true,
        session: { ...session, completed: true, won: true },
      }),
    ).toMatchObject({
      destination: {
        params: {
          claimed: "false",
          isGuest: "true",
        },
      },
    });
  });
});

describe("formatIssuedDate", () => {
  it("formats a challenge date without timezone drift", () => {
    expect(formatIssuedDate("2026-07-09")).toBe("Thursday, July 9");
  });

  it("uses an em dash for unavailable or invalid dates", () => {
    expect(formatIssuedDate()).toBe("—");
    expect(formatIssuedDate("not-a-date")).toBe("—");
  });
});
