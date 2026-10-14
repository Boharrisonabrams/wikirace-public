import { describe, expect, it, vi } from "vitest";

import {
  createArticleSuggestionController,
  selectedPrivateChallengeDraft,
  type WikipediaSuggestion,
} from "./article-suggestions";

const castle: WikipediaSuggestion = {
  title: "Castle",
  description: "type of fortified structure",
};

describe("private-game article suggestions", () => {
  it("waits for two characters and debounces a live query by 250 ms", async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockResolvedValue([castle]);
    const controller = createArticleSuggestionController({ search });

    controller.changeQuery("c");
    await vi.advanceTimersByTimeAsync(500);
    expect(search).not.toHaveBeenCalled();

    controller.changeQuery("ca");
    await vi.advanceTimersByTimeAsync(249);
    expect(search).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledWith("ca", 6);
    expect(controller.getState()).toMatchObject({
      status: "ready",
      suggestions: [castle],
    });
    vi.useRealTimers();
  });

  it("ignores stale responses after the query changes", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: WikipediaSuggestion[]) => void;
    const search = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WikipediaSuggestion[]>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce([castle]);
    const controller = createArticleSuggestionController({ search });

    controller.changeQuery("sk");
    await vi.advanceTimersByTimeAsync(250);
    controller.changeQuery("cas");
    await vi.advanceTimersByTimeAsync(250);
    resolveFirst([{ title: "Skateboarding", description: null }]);
    await Promise.resolve();

    expect(controller.getState()).toMatchObject({
      query: "cas",
      suggestions: [castle],
      status: "ready",
    });
    vi.useRealTimers();
  });

  it("clears a selected value when its text is edited", () => {
    const controller = createArticleSuggestionController({
      search: vi.fn().mockResolvedValue([]),
    });

    controller.select(castle);
    expect(controller.getState().selected).toEqual(castle);
    controller.changeQuery("Castle town");
    expect(controller.getState().selected).toBeNull();
  });

  it("requires two selected results and rejects the same article", () => {
    expect(selectedPrivateChallengeDraft(null, castle)).toEqual({
      ok: false,
      errors: { startArticle: "Select a starting article from the results." },
    });
    expect(selectedPrivateChallengeDraft(castle, castle)).toEqual({
      ok: false,
      errors: { endArticle: "Choose a different target article." },
    });
    expect(
      selectedPrivateChallengeDraft(
        { title: "Skateboarding", description: "sport" },
        castle,
      ),
    ).toEqual({
      ok: true,
      value: { startArticle: "Skateboarding", endArticle: "Castle" },
    });
  });
});
