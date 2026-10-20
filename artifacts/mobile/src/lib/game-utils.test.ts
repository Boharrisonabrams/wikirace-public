import { describe, expect, it } from "vitest";

import {
  formatTime,
  isSafeChallengeUrl,
  progressSavedCopy,
} from "./game-utils";

describe("game utilities", () => {
  it("formats elapsed seconds and clamps invalid values", () => {
    expect(formatTime(67)).toBe("1:07");
    expect(formatTime(-4)).toBe("0:00");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("keeps saved-progress copy short and concrete", () => {
    expect(progressSavedCopy(1)).toBe(
      "1 article so far · Your progress is saved.",
    );
    expect(progressSavedCopy(2)).toBe(
      "2 articles so far · Your progress is saved.",
    );
  });

  it("accepts only short HTTPS challenge links", () => {
    expect(
      isSafeChallengeUrl("https://play.wikipath.app/challenge/a1b2c3d4"),
    ).toBe(true);
    expect(
      isSafeChallengeUrl("http://play.wikipath.app/challenge/a1b2c3d4"),
    ).toBe(false);
    expect(
      isSafeChallengeUrl(
        "https://play.wikipath.app/challenge/00000000-0000-0000-0000-000000000001",
      ),
    ).toBe(false);
  });
});
