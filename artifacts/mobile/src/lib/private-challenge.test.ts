import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  acceptChallengePreview,
  beginChallengePreview,
  buildPrivateChallengeShareText,
  clearCreatedPrivateChallengeHandoff,
  CREATE_PRIVATE_CHALLENGE_ROUTE,
  createPrivateChallengeController,
  createPrivateChallengeShareController,
  failChallengePreview,
  peekCreatedPrivateChallengeHandoff,
  privateChallengePreviewRoute,
  stageCreatedPrivateChallengeHandoff,
  validatePrivateChallengeDraft,
  type CreatedPrivateChallenge,
} from "./private-challenge";
import * as privateChallenge from "./private-challenge";

const createdChallenge: CreatedPrivateChallenge = {
  code: "abc123def4",
  endTitle: "United Nations",
  kind: "friend",
  startTitle: "Christopher Columbus",
  url: "https://play.wikipath.app/challenge/abc123def4",
};

beforeEach(() => {
  clearCreatedPrivateChallengeHandoff();
});

describe("private challenge creation", () => {
  it("uses dedicated create and preview routes", () => {
    expect(CREATE_PRIVATE_CHALLENGE_ROUTE).toBe("/challenge/create");
    expect(privateChallengePreviewRoute(createdChallenge)).toEqual({
      pathname: "/challenge/[code]",
      params: { code: "abc123def4" },
    });
  });

  it("requires both article titles before calling the API", async () => {
    expect(
      validatePrivateChallengeDraft({
        startArticle: "  ",
        endArticle: "",
        searchTier: "find",
      }),
    ).toEqual({
      ok: false,
      errors: {
        endArticle: "Enter a target article.",
        startArticle: "Enter a starting article.",
      },
    });

    const create = vi.fn();
    const navigateToPreview = vi.fn();
    const result = await createPrivateChallengeController({
      create,
      navigateToPreview,
    }).submit({
      startArticle: "",
      endArticle: "United Nations",
      searchTier: "find",
    });

    expect(result).toEqual({
      ok: false,
      errors: { startArticle: "Enter a starting article." },
    });
    expect(create).not.toHaveBeenCalled();
    expect(navigateToPreview).not.toHaveBeenCalled();
  });

  it("treats case, spaces, and underscores as the same article", () => {
    expect(
      validatePrivateChallengeDraft({
        startArticle: " United_Nations ",
        endArticle: "united   nations",
        searchTier: "find",
      }),
    ).toEqual({
      ok: false,
      errors: {
        endArticle: "Choose a different target article.",
      },
    });
  });

  it("creates the trimmed pair, then opens its preview without starting it", async () => {
    const order: string[] = [];
    const create = vi.fn(async () => {
      order.push("create");
      return createdChallenge;
    });
    const navigateToPreview = vi.fn(() => {
      order.push("preview");
    });
    const stageForPreview = vi.fn(() => {
      order.push("stage");
    });

    const result = await createPrivateChallengeController({
      create,
      navigateToPreview,
      stageForPreview,
    }).submit({
      startArticle: "  Christopher Columbus ",
      endArticle: " United Nations  ",
      searchTier: "find",
    });

    expect(create).toHaveBeenCalledWith({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });
    expect(stageForPreview).toHaveBeenCalledWith(createdChallenge);
    expect(navigateToPreview).toHaveBeenCalledWith(createdChallenge);
    expect(order).toEqual(["create", "stage", "preview"]);
    expect(result).toEqual({ ok: true, challenge: createdChallenge });
  });

  it("stages the returned preview in the default handoff before navigating", async () => {
    const navigateToPreview = vi.fn((challenge: CreatedPrivateChallenge) => {
      expect(peekCreatedPrivateChallengeHandoff(challenge.code)).toEqual(
        challenge,
      );
    });

    await createPrivateChallengeController({
      create: vi.fn().mockResolvedValue(createdChallenge),
      navigateToPreview,
    }).submit({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });

    expect(navigateToPreview).toHaveBeenCalledWith(createdChallenge);
  });
});

describe("private challenge preview state", () => {
  it("keeps a newly created preview in a short-lived handoff keyed by code", () => {
    stageCreatedPrivateChallengeHandoff(createdChallenge, 1_000);

    expect(peekCreatedPrivateChallengeHandoff("abc123def4", 300_999)).toEqual(
      createdChallenge,
    );
    expect(
      peekCreatedPrivateChallengeHandoff("abc123def4", 301_000),
    ).toBeNull();
    expect(peekCreatedPrivateChallengeHandoff("another123", 1_000)).toBeNull();

    clearCreatedPrivateChallengeHandoff("abc123def4");
    expect(peekCreatedPrivateChallengeHandoff("abc123def4", 1_000)).toBeNull();
  });

  it("ignores a late response from the previous route code", () => {
    const nextState = beginChallengePreview("next123", null);
    const staleChallenge = { ...createdChallenge, code: "old12345" };

    expect(acceptChallengePreview(nextState, "old12345", staleChallenge)).toBe(
      nextState,
    );
    expect(
      failChallengePreview(nextState, "old12345", "Old request failed."),
    ).toBe(nextState);
  });

  it("keeps a handed-off preview usable when its refresh fails", () => {
    const loading = beginChallengePreview("abc123def4", createdChallenge);

    expect(loading).toEqual({
      challenge: createdChallenge,
      code: "abc123def4",
      error: null,
      status: "refreshing",
    });
    expect(
      failChallengePreview(
        loading,
        "abc123def4",
        "Could not refresh this challenge.",
      ),
    ).toEqual({
      challenge: createdChallenge,
      code: "abc123def4",
      error: "Could not refresh this challenge.",
      status: "error",
    });
  });

  it("binds a successful refresh to the active code", () => {
    const loading = beginChallengePreview("abc123def4", null);

    expect(
      acceptChallengePreview(loading, "abc123def4", createdChallenge),
    ).toEqual({
      challenge: createdChallenge,
      code: "abc123def4",
      error: null,
      status: "ready",
    });
  });
});

describe("private challenge invitation", () => {
  it("copies only the safe HTTPS challenge link as a share fallback", async () => {
    const copyControllerFactory = (
      privateChallenge as unknown as {
        createPrivateChallengeCopyController?: (dependencies: {
          copy: (value: string) => Promise<void>;
        }) => {
          copy: (challenge: CreatedPrivateChallenge) => Promise<void>;
        };
      }
    ).createPrivateChallengeCopyController;
    expect(copyControllerFactory).toBeTypeOf("function");

    const copy = vi.fn().mockResolvedValue(undefined);
    await copyControllerFactory!({ copy }).copy(createdChallenge);

    expect(copy).toHaveBeenCalledWith(
      "https://play.wikipath.app/challenge/abc123def4",
    );
  });

  it("shares the pair with a natural invitation and safe HTTPS URL", () => {
    expect(buildPrivateChallengeShareText(createdChallenge)).toBe(
      "Christopher Columbus → United Nations\n\n" +
        "Can you find the path?\n\n" +
        "https://play.wikipath.app/challenge/abc123def4",
    );
  });

  it("refuses to share a non-HTTPS or credential-bearing URL", () => {
    expect(() =>
      buildPrivateChallengeShareText({
        ...createdChallenge,
        url: "http://play.wikipath.app/challenge/abc123def4",
      }),
    ).toThrow("Challenge link is not safe to share.");
    expect(() =>
      buildPrivateChallengeShareText({
        ...createdChallenge,
        url: "https://user:pass@example.com/challenge/abc123def4",
      }),
    ).toThrow("Challenge link is not safe to share.");
  });

  it("hands the safe invitation to the system share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);

    await createPrivateChallengeShareController({
      platform: "ios",
      share,
    }).share(createdChallenge);

    expect(share).toHaveBeenCalledWith({
      message:
        "Christopher Columbus → United Nations\n\nCan you find the path?",
      url: "https://play.wikipath.app/challenge/abc123def4",
    });
  });
});
