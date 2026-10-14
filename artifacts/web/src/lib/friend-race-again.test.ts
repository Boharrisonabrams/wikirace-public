import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: mocks.api,
}));

import {
  createFriendRaceAgainChallenge,
  createFriendRaceAgainController,
} from "@/lib/friend-race-again";

describe("web friend race again", () => {
  it("mints a fresh friend challenge from an explicit article pair", async () => {
    mocks.api.mockResolvedValue({ challenge: { code: "fresh123" } });

    await createFriendRaceAgainChallenge({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });

    expect(mocks.api).toHaveBeenCalledWith("/challenge", {
      method: "POST",
      body: {
        startArticle: "Christopher Columbus",
        endArticle: "United Nations",
        searchTier: "find",
      },
    });
  });

  it("opens the new challenge preview after creation succeeds", async () => {
    const navigate = vi.fn();

    const code = await createFriendRaceAgainController({
      create: vi.fn().mockResolvedValue({ challenge: { code: "fresh123" } }),
      navigate,
    }).submit({
      startArticle: "Christopher Columbus",
      endArticle: "United Nations",
      searchTier: "find",
    });

    expect(code).toBe("fresh123");
    expect(navigate).toHaveBeenCalledWith("fresh123");
  });
});
