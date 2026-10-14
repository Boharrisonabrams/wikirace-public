import type { FindSnippet } from "@/lib/article-find";
import type { ChallengeType, SearchTier } from "@/lib/store/game-store";
import type { ArticleLinkEntry } from "@/lib/article-links";

export const LINK_RESULT_CAP = 50;
export type LinkSearchMode = "hidden" | "gated" | "palette";

export function resolveLinkSearchMode(options: {
  challengeType: ChallengeType;
  isOfficial: boolean;
  searchTier?: SearchTier | null;
}): { mode: LinkSearchMode; minLinkChars: number } {
  if (options.searchTier === "find") {
    return { mode: "hidden", minLinkChars: 0 };
  }
  if (options.searchTier === "palette") {
    return { mode: "palette", minLinkChars: 0 };
  }
  const minLinkChars =
    options.challengeType === "daily" && options.isOfficial ? 2 : 0;
  return {
    mode: minLinkChars > 0 ? "gated" : "palette",
    minLinkChars,
  };
}

export interface LinkMatch {
  link: ArticleLinkEntry;
  textRange: [number, number] | null;
}

function deepFold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .trim();
}

function simpleFold(value: string): string {
  return value.toLowerCase().replace(/_/g, " ");
}

function scoreMatch(haystack: string, needle: string): number {
  if (haystack === needle) return 0;
  if (haystack.startsWith(needle)) return 1;
  if (haystack.includes(` ${needle}`)) return 2;
  if (haystack.includes(needle)) return 3;
  return Infinity;
}

function highlightRange(text: string, query: string): [number, number] | null {
  const foldedText = simpleFold(text);
  if (foldedText.length !== text.length) return null;
  const foldedQuery = simpleFold(query.trim());
  if (!foldedQuery) return null;
  const at = foldedText.indexOf(foldedQuery);
  return at < 0 ? null : [at, at + foldedQuery.length];
}

export function filterArticleLinks(
  links: ArticleLinkEntry[],
  query: string,
): LinkMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return links.map((link) => ({ link, textRange: null }));
  const needle = deepFold(trimmed);
  if (!needle) return links.map((link) => ({ link, textRange: null }));

  const scored: { match: LinkMatch; score: number; order: number }[] = [];
  links.forEach((link, order) => {
    const score = Math.min(
      scoreMatch(deepFold(link.text), needle),
      scoreMatch(deepFold(link.article), needle),
    );
    if (score === Infinity) return;
    scored.push({
      match: { link, textRange: highlightRange(link.text, trimmed) },
      score,
      order,
    });
  });
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.map((entry) => entry.match);
}

export type LinkSectionStatus =
  | "hidden"
  | "loading"
  | "gated"
  | "browse"
  | "results"
  | "empty";
export type TextSectionStatus = "idle" | "searching" | "results" | "empty";

export interface SearchSections {
  links: {
    status: LinkSectionStatus;
    items: LinkMatch[];
    totalLinks: number;
    hint: string | null;
  };
  text: {
    status: TextSectionStatus;
    snippets: FindSnippet[];
    total: number;
  };
}

export function buildSearchSections(options: {
  query: string;
  linkSearchMode: LinkSearchMode;
  minLinkChars: number;
  inventory: ArticleLinkEntry[] | null;
  snippets: FindSnippet[];
  textTotal: number;
  textPending: boolean;
}): SearchSections {
  const trimmed = options.query.trim();
  const totalLinks = options.inventory?.length ?? 0;

  let links: SearchSections["links"];
  if (options.linkSearchMode === "hidden") {
    links = { status: "hidden", items: [], totalLinks, hint: null };
  } else if (trimmed.length < options.minLinkChars) {
    links = {
      status: "gated",
      items: [],
      totalLinks,
      hint: `Type ${options.minLinkChars}+ letters to see links (Official race).`,
    };
  } else if (options.inventory === null) {
    links = { status: "loading", items: [], totalLinks: 0, hint: null };
  } else if (!trimmed) {
    links = {
      status: "browse",
      items: filterArticleLinks(options.inventory, ""),
      totalLinks,
      hint: null,
    };
  } else {
    const items = filterArticleLinks(options.inventory, trimmed).slice(
      0,
      LINK_RESULT_CAP,
    );
    links =
      items.length === 0
        ? {
            status: "empty",
            items,
            totalLinks,
            hint: `No links match “${trimmed}”.`,
          }
        : { status: "results", items, totalLinks, hint: null };
  }

  let text: SearchSections["text"];
  if (!trimmed) {
    text = { status: "idle", snippets: [], total: 0 };
  } else if (options.textPending) {
    text = { status: "searching", snippets: [], total: 0 };
  } else if (options.textTotal === 0) {
    text = { status: "empty", snippets: [], total: 0 };
  } else {
    text = {
      status: "results",
      snippets: options.snippets,
      total: options.textTotal,
    };
  }

  return { links, text };
}

export function linkRowSubtitle(link: ArticleLinkEntry): string | null {
  if (simpleFold(link.article).trim() !== simpleFold(link.text).trim()) {
    return `Goes to “${link.article}”`;
  }
  if (link.snippet && link.snippet !== link.text) return link.snippet;
  return null;
}

export function splitByRange(
  text: string,
  range: [number, number] | null,
): [string, string, string] {
  if (!range) return [text, "", ""];
  const start = Math.max(0, Math.min(range[0], text.length));
  const end = Math.max(start, Math.min(range[1], text.length));
  return [text.slice(0, start), text.slice(start, end), text.slice(end)];
}

export function splitSnippet(snippet: FindSnippet): [string, string, string] {
  const start = Math.max(0, Math.min(snippet.matchStart, snippet.text.length));
  const end = Math.max(
    start,
    Math.min(start + snippet.matchLength, snippet.text.length),
  );
  return [
    snippet.text.slice(0, start),
    snippet.text.slice(start, end),
    snippet.text.slice(end),
  ];
}
