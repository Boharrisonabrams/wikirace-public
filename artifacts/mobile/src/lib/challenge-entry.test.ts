import { describe, expect, it, vi } from "vitest";

import {
  challengeGameParams,
  createChallengeEntryController,
  type SharedChallengePreview,
} from "./challenge-entry";

const daily: SharedChallengePreview = {
  code: "daily123",
  dailyChallengeId: "challenge-id",
  dailyDate: "2026-07-10",
  endTitle: "Violin",
  kind: "daily",
  startTitle: "Mathematics",
};

describe("shared challenge entry", () => {
  it("does not start or navigate while previewing a link", () => {
    const recordStart = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn();

    createChallengeEntryController({ recordStart, navigate });

    expect(recordStart).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("records an explicit Start before entering the same Daily", async () => {
    const order: string[] = [];
    const controller = createChallengeEntryController({
      recordStart: vi.fn(async () => {
        order.push("start");
      }),
      navigate: vi.fn(() => {
        order.push("navigate");
      }),
    });

    await controller.start(daily);

    expect(order).toEqual(["start", "navigate"]);
    expect(challengeGameParams(daily)).toEqual({
      challengeId: "challenge-id",
      dailyDate: "2026-07-10",
      friendChallengeId: "daily123",
      type: "daily",
    });
  });

  it("keeps Practice and private links unranked by their original mode", () => {
    expect(
      challengeGameParams({ ...daily, code: "practice1", kind: "practice" }),
    ).toEqual({ friendChallengeId: "practice1", type: "practice" });
    expect(
      challengeGameParams({ ...daily, code: "private1", kind: "friend" }),
    ).toEqual({ friendChallengeId: "private1", type: "friend" });
  });
});
