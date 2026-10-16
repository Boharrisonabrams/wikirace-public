export type FindDirection = "next" | "previous";

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
      : Math.min(Math.max(options.state.activeIndex, 0), options.state.total - 1);
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

export function updateArticleFindQuery(state: ArticleFindState, query: string): ArticleFindState {
  if (query === state.query) return state;
  return { query, total: 0, activeIndex: null };
}

export function stepMatchIndex(
  currentIndex: number | null,
  total: number,
  direction: FindDirection
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
