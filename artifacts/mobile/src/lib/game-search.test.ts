import { describe, expect, it } from "vitest";

import type { ArticleLinkEntry, FindSnippet } from "./article-find";
import {
  buildSearchSections,
  filterArticleLinks,
  LINK_RESULT_CAP,
  linkRowSubtitle,
  resolveLinkSearchMode,
  splitByRange,
  splitSnippet,
} from "./game-search";

function link(article: string, text = article, snippet = ""): ArticleLinkEntry {
  return { article, text, snippet };
}

describe("search tier routing", () => {
  it("uses the server-declared tier when present and preserves legacy sessions otherwise", () => {
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

  it("matches substrings case-insensitively", () => {
    const matches = filterArticleLinks(links, "ENYA");
    expect(matches.map((match) => match.link.article)).toEqual([
      "Kenya National Archives",
      "Kenyan cuisine",
      "West Kenya",
      "Kenya",
    ]);
  });

  it("folds underscores and diacritics for matching", () => {
    expect(
      filterArticleLinks([link("Mount_Kenya")], "mount kenya"),
    ).toHaveLength(1);
    const accented = filterArticleLinks([link("Café au lait")], "cafe");
    expect(accented).toHaveLength(1);
    // Diacritic folds are match-only; no misaligned visual highlight.
    expect(accented[0].textRange).toBeNull();
    expect(
      filterArticleLinks([link("Café au lait")], "café")[0].textRange,
    ).toEqual([0, 4]);
  });

  it("matches the destination title when the anchor text differs", () => {
    const matches = filterArticleLinks(
      [link("Kenyan Highlands", "the highlands")],
      "kenyan",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].textRange).toBeNull();
  });

  it("drops links that match nowhere", () => {
    expect(filterArticleLinks(links, "zanzibar")).toHaveLength(0);
  });
});

describe("search sections", () => {
  const inventory = [link("Kenya"), link("Nairobi"), link("Mombasa")];

  it("gates link results below the official minimum and keeps text search live", () => {
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
    expect(sections.links.items).toHaveLength(0);
    expect(sections.links.hint).toContain("2+");
    expect(sections.text.status).toBe("searching");
  });

  it("gates the empty official query instead of browsing", () => {
    const sections = buildSearchSections({
      query: "",
      linkSearchMode: "gated",
      minLinkChars: 2,
      inventory,
      snippets: [],
      textTotal: 0,
      textPending: false,
    });
    expect(sections.links.status).toBe("gated");
    expect(sections.text.status).toBe("idle");
  });

  it("browses the full inventory on an empty lenient query", () => {
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
    expect(sections.links.items).toHaveLength(3);
    expect(sections.links.totalLinks).toBe(3);
    expect(sections.text.status).toBe("idle");
  });

  it("reports loading until the inventory arrives", () => {
    const sections = buildSearchSections({
      query: "ke",
      linkSearchMode: "palette",
      minLinkChars: 0,
      inventory: null,
      snippets: [],
      textTotal: 0,
      textPending: true,
    });
    expect(sections.links.status).toBe("loading");
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

  it("names the query in the no-links state and surfaces text outcomes", () => {
    const snippets: FindSnippet[] = [
      { index: 0, text: "a portal appears", matchStart: 2, matchLength: 6 },
    ];
    const sections = buildSearchSections({
      query: "zanzibar",
      linkSearchMode: "palette",
      minLinkChars: 0,
      inventory,
      snippets,
      textTotal: 4,
      textPending: false,
    });
    expect(sections.links.status).toBe("empty");
    expect(sections.links.hint).toContain("zanzibar");
    expect(sections.text.status).toBe("results");
    expect(sections.text.total).toBe(4);
    expect(sections.text.snippets).toEqual(snippets);

    expect(
      buildSearchSections({
        query: "zanzibar",
        linkSearchMode: "hidden",
        minLinkChars: 0,
        inventory,
        snippets: [],
        textTotal: 0,
        textPending: false,
      }),
    ).toMatchObject({
      links: { status: "hidden" },
      text: { status: "empty" },
    });
  });

  it("hides the links section entirely for find-only sessions", () => {
    const sections = buildSearchSections({
      query: "zanzibar",
      linkSearchMode: "hidden",
      minLinkChars: 0,
      inventory,
      snippets: [],
      textTotal: 0,
      textPending: false,
    });
    expect(sections.links.status).toBe("hidden");
    expect(sections.links.items).toHaveLength(0);
    expect(sections.links.hint).toBeNull();
    expect(sections.text.status).toBe("empty");
  });
});

describe("link row subtitle", () => {
  it("reveals the destination of a piped anchor", () => {
    expect(
      linkRowSubtitle(
        link("Three-age system", "metallurgy appeared", "…metallurgy…"),
      ),
    ).toBe("Goes to “Three-age system”");
  });

  it("shows the prose snippet when the anchor names its destination", () => {
    expect(linkRowSubtitle(link("Kenya", "Kenya", "Visit Kenya and…"))).toBe(
      "Visit Kenya and…",
    );
    expect(linkRowSubtitle(link("Kenya", "kenya", "kenya"))).toBeNull();
  });
});

describe("snippet splitting", () => {
  it("splits around the reported match", () => {
    expect(
      splitSnippet({
        index: 0,
        text: "a portal appears",
        matchStart: 2,
        matchLength: 6,
      }),
    ).toEqual(["a ", "portal", " appears"]);
  });

  it("clamps out-of-range offsets instead of throwing", () => {
    expect(
      splitSnippet({ index: 0, text: "short", matchStart: 40, matchLength: 6 }),
    ).toEqual(["short", "", ""]);
  });

  it("splits link text by an optional range", () => {
    expect(splitByRange("Kenya", [0, 5])).toEqual(["", "Kenya", ""]);
    expect(splitByRange("West Kenya", [5, 10])).toEqual(["West ", "Kenya", ""]);
    expect(splitByRange("Kenya", null)).toEqual(["Kenya", "", ""]);
    expect(splitByRange("Kenya", [3, 99])).toEqual(["Ken", "ya", ""]);
  });
});
