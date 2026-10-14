export type FindDirection = "next" | "previous";

export type ArticleWebViewCommand =
  | {
      type: "find/query";
      documentId: string;
      query: string;
      topOffset: number;
      includeSnippets?: boolean;
      scrollToFirst?: boolean;
    }
  | {
      type: "find/navigate";
      documentId: string;
      direction: FindDirection;
      topOffset: number;
    }
  | {
      type: "find/activate";
      documentId: string;
      index: number;
      topOffset: number;
    }
  | { type: "find/clear"; documentId: string }
  | { type: "links/collect"; documentId: string };

export interface FindSnippet {
  index: number;
  text: string;
  matchStart: number;
  matchLength: number;
}

export interface ArticleLinkEntry {
  article: string;
  text: string;
  snippet: string;
}

export type ArticleWebViewEvent =
  | { type: "article/ready"; documentId: string }
  | { type: "article/link"; documentId: string; article: string }
  | {
      type: "find/match-count";
      documentId: string;
      query: string;
      total: number;
    }
  | {
      type: "find/active-index";
      documentId: string;
      query: string;
      index: number | null;
      total: number;
    }
  | {
      type: "find/snippets";
      documentId: string;
      query: string;
      snippets: FindSnippet[];
      total: number;
    }
  | {
      type: "links/inventory";
      documentId: string;
      links: ArticleLinkEntry[];
    };

export interface ArticleFindState {
  query: string;
  total: number;
  activeIndex: number | null;
}

export interface ArticleFindPresentation {
  clearVisible: boolean;
  counterLabel: string;
  progress: number;
  status: "idle" | "searching" | "matches" | "empty";
  statusLabel: string;
}

export function buildArticleFindPresentation(options: {
  articleTitle: string;
  pending: boolean;
  state: ArticleFindState;
}): ArticleFindPresentation {
  const articleTitle = options.articleTitle.trim() || "this article";
  const hasQuery = options.state.query.trim().length > 0;
  if (!hasQuery) {
    return {
      clearVisible: false,
      counterLabel: "",
      progress: 0,
      status: "idle",
      statusLabel: `Type to highlight matches in ${articleTitle}.`,
    };
  }
  if (options.pending) {
    return {
      clearVisible: true,
      counterLabel: "…",
      progress: 0,
      status: "searching",
      statusLabel: `Searching ${articleTitle}…`,
    };
  }
  if (options.state.total <= 0) {
    return {
      clearVisible: true,
      counterLabel: "0",
      progress: 0,
      status: "empty",
      statusLabel: `No matches in ${articleTitle}`,
    };
  }

  const activeIndex =
    options.state.activeIndex === null
      ? 0
      : Math.min(
          Math.max(options.state.activeIndex, 0),
          options.state.total - 1,
        );
  return {
    clearVisible: true,
    counterLabel: `${activeIndex + 1} of ${options.state.total}`,
    progress: (activeIndex + 1) / options.state.total,
    status: "matches",
    statusLabel: `${options.state.total} ${
      options.state.total === 1 ? "match" : "matches"
    } in ${articleTitle}`,
  };
}

export function createArticleFindState(): ArticleFindState {
  return { query: "", total: 0, activeIndex: null };
}

export function resetArticleFindState(): ArticleFindState {
  return createArticleFindState();
}

export function updateArticleFindQuery(
  state: ArticleFindState,
  query: string,
): ArticleFindState {
  if (query === state.query) return state;
  return { query, total: 0, activeIndex: null };
}

export function stepMatchIndex(
  currentIndex: number | null,
  total: number,
  direction: FindDirection,
): number | null {
  if (!Number.isInteger(total) || total <= 0) return null;
  const current =
    currentIndex === null || currentIndex < 0 || currentIndex >= total
      ? direction === "next"
        ? -1
        : 0
      : currentIndex;
  const delta = direction === "next" ? 1 : -1;
  return (current + delta + total) % total;
}

export function applyArticleFindEvent(
  state: ArticleFindState,
  event: ArticleWebViewEvent,
): ArticleFindState {
  if (
    event.type === "article/link" ||
    event.type === "article/ready" ||
    event.type === "links/inventory" ||
    event.type === "find/snippets" ||
    event.query !== state.query
  )
    return state;

  if (event.type === "find/match-count") {
    return {
      ...state,
      total: event.total,
      activeIndex: event.total > 0 ? state.activeIndex : null,
    };
  }

  return {
    ...state,
    total: event.total,
    activeIndex: event.index,
  };
}

export function isArticleWebViewEventForDocument(
  event: ArticleWebViewEvent,
  documentId: string,
): boolean {
  return documentId.length > 0 && event.documentId === documentId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseArticleWebViewEvent(
  value: unknown,
): ArticleWebViewEvent | null {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    typeof value.documentId !== "string" ||
    value.documentId.length === 0
  ) {
    return null;
  }

  if (value.type === "article/link") {
    return typeof value.article === "string" && value.article.length > 0
      ? {
          type: value.type,
          documentId: value.documentId,
          article: value.article,
        }
      : null;
  }

  if (value.type === "article/ready") {
    return { type: value.type, documentId: value.documentId };
  }

  if (
    value.type === "find/match-count" &&
    typeof value.query === "string" &&
    isNonNegativeInteger(value.total)
  ) {
    return {
      type: value.type,
      documentId: value.documentId,
      query: value.query,
      total: value.total,
    };
  }

  if (
    value.type === "find/active-index" &&
    typeof value.query === "string" &&
    isNonNegativeInteger(value.total) &&
    (value.index === null || isNonNegativeInteger(value.index)) &&
    (value.index === null || value.index < value.total)
  ) {
    return {
      type: value.type,
      documentId: value.documentId,
      query: value.query,
      index: value.index,
      total: value.total,
    };
  }

  if (
    value.type === "find/snippets" &&
    typeof value.query === "string" &&
    isNonNegativeInteger(value.total) &&
    Array.isArray(value.snippets) &&
    value.snippets.every(isFindSnippet)
  ) {
    return {
      type: value.type,
      documentId: value.documentId,
      query: value.query,
      snippets: value.snippets.map((snippet) => ({
        index: snippet.index,
        text: snippet.text,
        matchStart: snippet.matchStart,
        matchLength: snippet.matchLength,
      })),
      total: value.total,
    };
  }

  if (
    value.type === "links/inventory" &&
    Array.isArray(value.links) &&
    value.links.every(isArticleLinkEntry)
  ) {
    return {
      type: value.type,
      documentId: value.documentId,
      links: value.links.map((link) => ({
        article: link.article,
        text: link.text,
        snippet: link.snippet,
      })),
    };
  }

  return null;
}

function isFindSnippet(value: unknown): value is FindSnippet {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.index) &&
    typeof value.text === "string" &&
    isNonNegativeInteger(value.matchStart) &&
    typeof value.matchLength === "number" &&
    Number.isInteger(value.matchLength) &&
    value.matchLength > 0
  );
}

function isArticleLinkEntry(value: unknown): value is ArticleLinkEntry {
  return (
    isRecord(value) &&
    typeof value.article === "string" &&
    value.article.length > 0 &&
    typeof value.text === "string" &&
    typeof value.snippet === "string"
  );
}
