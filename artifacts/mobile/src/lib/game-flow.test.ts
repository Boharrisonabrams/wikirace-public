import { describe, expect, it, vi } from "vitest";

import {
  allowsArticleBack,
  createResultCompletionCoordinator,
  noticeForBlockedArticleTap,
  noticeForNavigateFailure,
  shouldCompleteWonSession,
} from "./game-flow";

describe("official race flow", () => {
  it("does not allow article Back during an official Daily", () => {
    expect(
      allowsArticleBack({ challengeType: "daily", isOfficial: true }),
    ).toBe(false);
    expect(
      allowsArticleBack({ challengeType: "daily", isOfficial: false }),
    ).toBe(true);
    expect(
      allowsArticleBack({ challengeType: "practice", isOfficial: true }),
    ).toBe(true);
    expect(
      allowsArticleBack({ challengeType: "friend", isOfficial: true }),
    ).toBe(true);
  });

  it("completes a target transition once before opening Result", async () => {
    let releaseCompletion: (() => void) | undefined;
    const complete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseCompletion = resolve;
        }),
    );
    const openResult = vi.fn();
    const coordinator = createResultCompletionCoordinator({
      complete,
      openResult,
    });

    const first = coordinator.completeResult("session-1");
    const duplicate = coordinator.completeResult("session-1");

    expect(complete).toHaveBeenCalledTimes(1);
    expect(openResult).not.toHaveBeenCalled();

    releaseCompletion?.();
    await Promise.all([first, duplicate]);

    expect(openResult).toHaveBeenCalledOnce();
    expect(openResult).toHaveBeenCalledWith("session-1");
  });

  it("recovers a target move that was recorded before completion", () => {
    expect(shouldCompleteWonSession({ completed: false, won: true })).toBe(
      true,
    );
    expect(shouldCompleteWonSession({ completed: false, won: false })).toBe(
      false,
    );
    expect(shouldCompleteWonSession({ completed: true, won: true })).toBe(
      false,
    );
  });

  it("maps navigation failures into player-facing notices", () => {
    expect(
      noticeForNavigateFailure({
        status: 400,
        reason: "destination is not linked from the source article",
      }),
    ).toBe("destination is not linked from the source article");
    expect(
      noticeForNavigateFailure({
        status: 409,
        message: "Move already recorded",
      }),
    ).toBe("That link already went through.");
    expect(
      noticeForNavigateFailure({
        status: 503,
        reason: "Wikipedia didn't answer — try that link again.",
      }),
    ).toBe("Wikipedia didn't answer — try that link again.");
    expect(noticeForNavigateFailure(new Error("Move failed."))).toBe(
      "Move failed.",
    );
  });

  it("explains taps that land during an in-flight move", () => {
    expect(noticeForBlockedArticleTap()).toBe("Finishing your last move...");
  });
});
