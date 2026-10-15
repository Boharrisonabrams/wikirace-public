// @ts-nocheck
import { describe, expect, it } from "vitest";

import { formatShareIntent } from "./index";

const link = "https://play.wikipath.app/challenge/abc123def4";

describe("formatShareIntent", () => {
  it("keeps the elapsed time when it is present and positive", () => {
    expect(
      formatShareIntent({
        intent: "result",
        outcome: "won",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        clicks: 9,
        elapsedSeconds: 182,
        challengeUrl: link,
      })
    ).toEqual({
      text: "I finished Skateboarding → Castle.\n" + "\n9 clicks · 3:02\n\n" + "Can you beat me?",
      url: link,
    });
  });

  it("omits the time segment when elapsed seconds are zero", () => {
    expect(
      formatShareIntent({
        intent: "result",
        outcome: "won",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        clicks: 4,
        elapsedSeconds: 0,
        challengeUrl: link,
      })
    ).toEqual({
      text: "I finished Skateboarding → Castle.\n" + "\n4 clicks\n\n" + "Can you beat me?",
      url: link,
    });
  });

  it("omits the time segment when elapsed seconds are absent", () => {
    expect(
      formatShareIntent({
        intent: "result",
        outcome: "won",
        startTitle: "Skateboarding",
        endTitle: "Castle",
        clicks: 4,
        challengeUrl: link,
      })
    ).toEqual({
      text: "I finished Skateboarding → Castle.\n" + "\n4 clicks\n\n" + "Can you beat me?",
      url: link,
    });
  });

  it("never leaks route details from extra result fields", () => {
    const copy = formatShareIntent({
      intent: "result",
      outcome: "won",
      startTitle: "Skateboarding",
      endTitle: "Castle",
      clicks: 4,
      elapsedSeconds: 75,
      challengeUrl: link,
      path: ["Skateboarding", "Sport", "Architecture", "Castle"],
      sessionId: "secret-session",
      userId: "secret-user",
    } as never);

    expect(copy).toEqual({
      text: "I finished Skateboarding → Castle.\n" + "\n4 clicks · 1:15\n\n" + "Can you beat me?",
      url: link,
    });
    expect(JSON.stringify(copy)).not.toMatch(/Sport|Architecture|secret-session|secret-user/);
  });
});
