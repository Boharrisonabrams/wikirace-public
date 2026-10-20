import { describe, expect, it } from "vitest";

import {
  buildArticleFindPresentation,
  createArticleFindState,
  stepMatchIndex,
  updateArticleFindQuery,
} from "./article-find";

describe("article find index stepping", () => {
  it("keeps wrap/index logic deterministic", () => {
    expect(stepMatchIndex(null, 4, "next")).toBe(0);
    expect(stepMatchIndex(3, 4, "next")).toBe(0);
    expect(stepMatchIndex(0, 4, "previous")).toBe(3);
    expect(stepMatchIndex(0, 0, "next")).toBeNull();
  });
});

describe("article find presentation", () => {
  it("invites a live query without showing an empty result count", () => {
    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: createArticleFindState(),
      })
    ).toEqual({
      clearVisible: false,
      counterLabel: "",
      progress: 0,
      status: "idle",
      statusLabel: "Type to highlight matches in Diamond.",
    });
  });

  it("makes the active search and match position immediately legible", () => {
    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: true,
        state: { activeIndex: null, query: "carbon", total: 0 },
      })
    ).toEqual({
      clearVisible: true,
      counterLabel: "…",
      progress: 0,
      status: "searching",
      statusLabel: "Searching Diamond…",
    });

    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: { activeIndex: 2, query: "carbon", total: 12 },
      })
    ).toEqual({
      clearVisible: true,
      counterLabel: "3 of 12",
      progress: 0.25,
      status: "matches",
      statusLabel: "12 matches in Diamond",
    });

    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: { activeIndex: 99, query: "carbon", total: 12 },
      })
    ).toMatchObject({ counterLabel: "12 of 12", progress: 1 });
  });

  it("distinguishes a completed empty search from an idle field", () => {
    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: { activeIndex: null, query: "penguin", total: 0 },
      })
    ).toEqual({
      clearVisible: true,
      counterLabel: "0",
      progress: 0,
      status: "empty",
      statusLabel: "No matches in Diamond",
    });
  });
});

describe("web client cases", () => {
  it("builds user-facing find copy from the current article state", () => {
    const empty = buildArticleFindPresentation({
      articleTitle: "Kenya",
      pending: false,
      state: createArticleFindState(),
    });
    expect(empty.status).toBe("idle");

    const state = updateArticleFindQuery(createArticleFindState(), "kenya");
    const matches = buildArticleFindPresentation({
      articleTitle: "Kenya",
      pending: false,
      state: { ...state, total: 3, activeIndex: 1 },
    });
    expect(matches.counterLabel).toBe("2 of 3");
    expect(matches.status).toBe("matches");
  });
});
