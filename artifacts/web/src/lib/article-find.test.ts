// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  buildArticleFindPresentation,
  createArticleFindState,
  createDomArticleFindController,
  updateArticleFindQuery,
} from "@/lib/article-find";

describe("web article find", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("highlights matches in article text and steps through them", () => {
    const root = document.createElement("div");
    root.innerHTML =
      "<p>Republic of Kenya borders the Indian Ocean.</p><p>Kenya has many parks.</p>";
    document.body.appendChild(root);

    const updates: Array<{ total: number; activeIndex: number | null }> = [];
    const controller = createDomArticleFindController({
      onUpdate(snapshot) {
        updates.push({
          total: snapshot.total,
          activeIndex: snapshot.activeIndex,
        });
      },
    });

    controller.attach(root);
    controller.search("Kenya");
    controller.navigate("next");

    const marks = root.querySelectorAll("mark[data-article-find-match]");
    expect(marks).toHaveLength(2);
    expect(marks[1]?.dataset.articleFindCurrent).toBe("true");
    expect(updates.at(-1)).toEqual({ total: 2, activeIndex: 1 });
  });

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
