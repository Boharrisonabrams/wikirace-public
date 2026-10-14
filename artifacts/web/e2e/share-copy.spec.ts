import { expect, test } from "@playwright/test";

import * as gameUtils from "../src/lib/game-utils";

const { formatShareIntent } = gameUtils;
const challengeInvitationHeading = (
  gameUtils as unknown as {
    challengeInvitationHeading?: () => string;
  }
).challengeInvitationHeading;
const challengeActionLabel = (
  gameUtils as unknown as {
    challengeActionLabel?: (options: { played: boolean }) => string;
  }
).challengeActionLabel;
const copyChallengeUrl = (
  gameUtils as unknown as {
    copyChallengeUrl?: (
      value: string,
      writeText: (value: string) => Promise<void>,
      legacyCopy?: (value: string) => boolean,
    ) => Promise<void>;
  }
).copyChallengeUrl;
const getChallengeShareUrl = (
  gameUtils as unknown as {
    getChallengeShareUrl: (
      challenge: { code?: unknown; url?: unknown },
      fallbackOrigin: string,
    ) => string | null;
  }
).getChallengeShareUrl;
const getChallengeAppHref = (
  gameUtils as unknown as {
    getChallengeAppHref?: (code: string) => string;
  }
).getChallengeAppHref;

test("winning share copy includes endpoints, score, time, and a separate short link", () => {
  expect(
    formatShareIntent({
      intent: "result",
      outcome: "won",
      challengeUrl: "https://play.wikipath.app/challenge/a1b2c3d4",
      clicks: 3,
      endTitle: "Violin",
      elapsedSeconds: 102,
      startTitle: "Mathematics",
    }),
  ).toEqual({
    text:
      "I finished Mathematics → Violin.\n" +
      "\n3 clicks · 1:42\n\n" +
      "Can you beat me?",
    url: "https://play.wikipath.app/challenge/a1b2c3d4",
  });
});

test("winning share copy omits the time segment when elapsed time is zero or absent", () => {
  expect(
    formatShareIntent({
      intent: "result",
      outcome: "won",
      challengeUrl: "https://play.wikipath.app/challenge/a1b2c3d4",
      clicks: 4,
      endTitle: "Violin",
      elapsedSeconds: 0,
      startTitle: "Mathematics",
    }),
  ).toEqual({
    text:
      "I finished Mathematics → Violin.\n" +
      "\n4 clicks\n\n" +
      "Can you beat me?",
    url: "https://play.wikipath.app/challenge/a1b2c3d4",
  });

  expect(
    formatShareIntent({
      intent: "result",
      outcome: "won",
      challengeUrl: "https://play.wikipath.app/challenge/a1b2c3d4",
      clicks: 4,
      endTitle: "Violin",
      startTitle: "Mathematics",
    }),
  ).toEqual({
    text:
      "I finished Mathematics → Violin.\n" +
      "\n4 clicks\n\n" +
      "Can you beat me?",
    url: "https://play.wikipath.app/challenge/a1b2c3d4",
  });
});

test("give-up share copy omits score, time, rank, and the solved route", () => {
  const copy = formatShareIntent({
    intent: "result",
    outcome: "stopped",
    challengeUrl: "https://play.wikipath.app/challenge/a1b2c3d4",
    endTitle: "Violin",
    startTitle: "Mathematics",
    stoppedAt: "Piano",
  });

  expect(copy).toEqual({
    text:
      "I stopped at Piano while trying to reach Violin.\n" +
      "\nCan you finish it?",
    url: "https://play.wikipath.app/challenge/a1b2c3d4",
  });
  expect(JSON.stringify(copy)).not.toMatch(/click|1:08|rank|Geometry/);
});

test("share links use only an API HTTPS short URL or short code", () => {
  expect(
    getChallengeShareUrl(
      {
        code: "a1b2c3d4",
        url: "https://play.wikipath.app/challenge/a1b2c3d4",
      },
      "https://fallback.wikipath.app",
    ),
  ).toBe("https://play.wikipath.app/challenge/a1b2c3d4");

  expect(
    getChallengeShareUrl(
      { code: "a1b2c3d4", url: "http://unsafe.example/challenge/a1b2c3d4" },
      "https://fallback.wikipath.app",
    ),
  ).toBe("https://fallback.wikipath.app/challenge/a1b2c3d4");

  expect(
    getChallengeShareUrl(
      {
        code: "00000000-0000-0000-0000-000000000099",
        url: "https://play.wikipath.app/challenge/00000000-0000-0000-0000-000000000099",
      },
      "https://fallback.wikipath.app",
    ),
  ).toBeNull();
});

test("new challenge app links prefer the WikiRace scheme", () => {
  expect(typeof getChallengeAppHref).toBe("function");
  expect(getChallengeAppHref!("abc123def4")).toBe(
    "wikirace://challenge/abc123def4",
  );
});

test("the configured HTTPS challenge URL remains canonical", () => {
  expect(
    getChallengeShareUrl(
      { code: "abc123def4" },
      "https://wikirace.example.com",
    ),
  ).toBe("https://wikirace.example.com/challenge/abc123def4");
});

test("recipient copy is human and never exposes a generated player handle", () => {
  expect(typeof challengeInvitationHeading).toBe("function");
  expect(challengeInvitationHeading!()).toBe("A friend challenges you to race");
  expect(challengeInvitationHeading!()).not.toContain("player_");
});

test("the recipient action stays consistent before and after playing", () => {
  expect(typeof challengeActionLabel).toBe("function");
  expect(challengeActionLabel!({ played: false })).toBe("Accept the challenge");
  expect(challengeActionLabel!({ played: true })).toBe("See your result");
});

test("the web fallback copies its exact HTTPS challenge URL", async () => {
  expect(typeof copyChallengeUrl).toBe("function");
  const copied: string[] = [];

  await copyChallengeUrl!(
    "https://play.wikipath.app/challenge/a1b2c3d4",
    async (value) => {
      copied.push(value);
    },
  );

  expect(copied).toEqual(["https://play.wikipath.app/challenge/a1b2c3d4"]);
});

test("copy falls back when the async clipboard requires a stronger user gesture", async () => {
  expect(typeof copyChallengeUrl).toBe("function");
  const copied: string[] = [];

  await copyChallengeUrl!(
    "https://play.wikipath.app/challenge/a1b2c3d4",
    async () => {
      throw new Error("NotAllowedError");
    },
    (value) => {
      copied.push(value);
      return true;
    },
  );

  expect(copied).toEqual(["https://play.wikipath.app/challenge/a1b2c3d4"]);
});
