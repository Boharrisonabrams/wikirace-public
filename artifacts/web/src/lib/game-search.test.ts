import { describe, expect, it } from "vitest";

import type { FindSnippet } from "@/lib/article-find";
import type { ArticleLinkEntry } from "@/lib/article-links";
import {
  buildSearchSections,
  filterArticleLinks,
  LINK_RESULT_CAP,
  linkRowSubtitle,
  resolveLinkSearchMode,
  splitByRange,
  splitSnippet,
} from "@/lib/game-search";

function link(article: string, text = article, snippet = ""): ArticleLinkEntry {
  return { article, text, snippet };
}

describe("search tier routing", () => {
  it("uses the declared tier when present and preserves legacy sessions otherwise", () => {
    expect(
      resolveLinkSearchMode({
        challengeType: "daily",
        isOfficial: true,
        searchTier: "find",
      }),
    ).toEqual({ mode: "hidden", minLinkChars: 0 });
    expect(
      resolveLinkSearchMode({
        challengeType: "practice",
        isOfficial: true,
        searchTier: "palette",
      }),
    ).toEqual({ mode: "palette", minLinkChars: 0 });
    expect(
      resolveLinkSearchMode({
        challengeType: "daily",
        isOfficial: true,
      }),
    ).toEqual({ mode: "gated", minLinkChars: 2 });
  });
});

describe("link filtering", () => {
  const links = [
    link("Kenya National Archives"),
    link("Kenyan cuisine"),
    link("West Kenya"),
    link("Kenya"),
    link("Nairobi"),
  ];

  it("returns every link in reading order for an empty query", () => {
    const matches = filterArticleLinks(links, "  ");
    expect(matches.map((match) => match.link.article)).toEqual([
      "Kenya National Archives",
      "Kenyan cuisine",
      "West Kenya",
      "Kenya",
      "Nairobi",
    ]);
    expect(matches.every((match) => match.textRange === null)).toBe(true);
  });

  it("ranks exact over prefix over word start over substring", () => {
    const matches = filterArticleLinks(links, "kenya");
    expect(matches.map((match) => match.link.article)).toEqual([
      "Kenya",
      "Kenya National Archives",
      "Kenyan cuisine",
      "West Kenya",
    ]);
    expect(matches[0].textRange).toEqual([0, 5]);
  });
});

describe("search sections", () => {
  const inventory = [link("Kenya"), link("Nairobi"), link("Mombasa")];

  it("gates official-daily legacy links while the article find stays live", () => {
    const sections = buildSearchSections({
      query: "k",
      linkSearchMode: "gated",
      minLinkChars: 2,
      inventory,
      snippets: [],
      textTotal: 0,
      textPending: true,
    });
    expect(sections.links.status).toBe("gated");
    expect(sections.text.status).toBe("searching");
  });

  it("hides link results entirely for server-declared find-only sessions", () => {
    const sections = buildSearchSections({
      query: "kenya",
      linkSearchMode: "hidden",
      minLinkChars: 0,
      inventory,
      snippets: [],
      textTotal: 0,
      textPending: false,
    });
    expect(sections.links.status).toBe("hidden");
    expect(sections.links.items).toHaveLength(0);
    expect(sections.text.status).toBe("empty");
  });

  it("browses the full inventory on an empty palette query", () => {
    const sections = buildSearchSections({
      query: "",
      linkSearchMode: "palette",
      minLinkChars: 0,
      inventory,
      snippets: [],
      textTotal: 0,
      textPending: false,
    });
    expect(sections.links.status).toBe("browse");
    expect(sections.links.totalLinks).toBe(3);
    expect(sections.text.status).toBe("idle");
  });

  it("caps rendered link results", () => {
    const many = Array.from({ length: LINK_RESULT_CAP + 10 }, (_, index) =>
      link(`Kenya ${index}`),
    );
    const sections = buildSearchSections({
      query: "kenya",
      linkSearchMode: "palette",
      minLinkChars: 0,
      inventory: many,
      snippets: [],
      textTotal: 0,
      textPending: false,
    });
    expect(sections.links.status).toBe("results");
    expect(sections.links.items).toHaveLength(LINK_RESULT_CAP);
  });

  it("surfaces article-find snippets and counts", () => {
    const snippets: FindSnippet[] = [
      { index: 0, text: "…Republic of Kenya…", matchStart: 13, matchLength: 5 },
    ];
    const sections = buildSearchSections({
      query: "kenya",
      linkSearchMode: "palette",
      minLinkChars: 0,
      inventory,
      snippets,
      textTotal: 3,
      textPending: false,
    });
    expect(sections.text.status).toBe("results");
    expect(sections.text.total).toBe(3);
    expect(sections.text.snippets).toEqual(snippets);
  });
});

describe("display helpers", () => {
  it("reveals the destination of a piped anchor", () => {
    expect(
      linkRowSubtitle(
        link("Three-age system", "metallurgy appeared", "…metallurgy…"),
      ),
    ).toBe("Goes to “Three-age system”");
  });

  it("splits both link and snippet text around the reported match", () => {
    expect(splitByRange("West Kenya", [5, 10])).toEqual([
      "West ",
      "Kenya",
      "",
    ]);
    expect(
      splitSnippet({
        index: 0,
        text: "…Republic of Kenya…",
        matchStart: 13,
        matchLength: 5,
      }),
    ).toEqual(["…Republic of ", "Kenya", "…"]);
  });
});
