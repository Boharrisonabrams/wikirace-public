import { describe, expect, it } from "vitest";

import {
  formatShareIntent,
  type ShareCopyInput,
} from "@workspace/share-intent";
import { buildNativeSharePayload } from "./share-intent";

const link = "https://play.wikipath.app/challenge/abc123def4";

describe("shared spoiler-safe share copy", () => {
  it("formats an invitation without a solved route", () => {
    expect(
      formatShareIntent({
        intent: "challenge",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        challengeUrl: link,
      }),
    ).toEqual({
      text: "Skateboarding → Castle\n\nCan you find the path?",
      url: link,
    });
  });

  it("formats a win and a replay with the same compact result contract", () => {
    const win: ShareCopyInput = {
      intent: "result",
      outcome: "won",
      startTitle: "Skateboarding",
      endTitle: "Castle",
      clicks: 9,
      elapsedSeconds: 182,
      challengeUrl: link,
    };

    expect(formatShareIntent(win)).toEqual({
      text:
        "I finished Skateboarding → Castle.\n" +
        "\n9 clicks · 3:02\n\n" +
        "Can you beat me?",
      url: link,
    });
    expect(formatShareIntent({ ...win, replay: true })).toEqual(
      formatShareIntent(win),
    );
  });

  it("omits the time segment when the elapsed time is missing or zero", () => {
    expect(
      formatShareIntent({
        intent: "result",
        outcome: "won",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        clicks: 4,
        elapsedSeconds: 0,
        challengeUrl: link,
      }),
    ).toEqual({
      text:
        "I finished Skateboarding → Castle.\n" +
        "\n4 clicks\n\n" +
        "Can you beat me?",
      url: link,
    });

    expect(
      formatShareIntent({
        intent: "result",
        outcome: "won",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        clicks: 4,
        challengeUrl: link,
      }),
    ).toEqual({
      text:
        "I finished Skateboarding → Castle.\n" +
        "\n4 clicks\n\n" +
        "Can you beat me?",
      url: link,
    });
  });

  it("formats a give-up without clicks, time, rank, or the full route", () => {
    const input = {
      intent: "result" as const,
      outcome: "stopped" as const,
      startTitle: "Skateboarding",
      endTitle: "Castle",
      stoppedAt: "Gothic architecture",
      challengeUrl: link,
      clicks: 17,
      elapsedSeconds: 999,
      rank: 4,
      path: ["Skateboarding", "Sport", "Architecture", "Gothic architecture"],
      userId: "user-secret",
      sessionId: "session-secret",
    };

    const copy = formatShareIntent(input);
    expect(copy).toEqual({
      text:
        "I stopped at Gothic architecture while trying to reach Castle.\n" +
        "\nCan you finish it?",
      url: link,
    });
    expect(JSON.stringify(copy)).not.toMatch(
      /17|999|rank|Sport|Architecture|user-secret|session-secret/,
    );
  });

  it("packages copy and HTTPS URL separately on iOS", () => {
    const content = formatShareIntent({
      intent: "challenge",
      startTitle: "Skateboarding",
      endTitle: "Castle",
      challengeUrl: link,
    });

    expect(buildNativeSharePayload(content, "ios")).toEqual({
      message: "Skateboarding → Castle\n\nCan you find the path?",
      url: link,
    });
    expect(buildNativeSharePayload(content, "android")).toEqual({
      message: `Skateboarding → Castle\n\nCan you find the path?\n\n${link}`,
    });
  });
});
