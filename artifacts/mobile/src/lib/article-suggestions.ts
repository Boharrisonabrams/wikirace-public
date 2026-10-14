import type {
  PrivateChallengeErrors,
  PrivateChallengeValidation,
} from "./private-challenge";

export interface WikipediaSuggestion {
  title: string;
  description: string | null;
}

export type ArticleSuggestionState = {
  error: string | null;
  query: string;
  selected: WikipediaSuggestion | null;
  status: "idle" | "loading" | "ready" | "empty" | "error" | "selected";
  suggestions: WikipediaSuggestion[];
};

type ArticleSuggestionDependencies = {
  onChange?: (state: ArticleSuggestionState) => void;
  search: (query: string, limit: number) => Promise<WikipediaSuggestion[]>;
};

export function createArticleSuggestionController({
  onChange,
  search,
}: ArticleSuggestionDependencies) {
  let requestVersion = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let state: ArticleSuggestionState = {
    error: null,
    query: "",
    selected: null,
    status: "idle",
    suggestions: [],
  };

  function emit(next: ArticleSuggestionState) {
    state = next;
    onChange?.(state);
  }

  function cancelPending() {
    requestVersion += 1;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  async function runSearch(query: string, version: number) {
    emit({ ...state, error: null, status: "loading", suggestions: [] });
    try {
      const suggestions = (await search(query, 6)).slice(0, 6);
      if (version !== requestVersion || state.query.trim() !== query) return;
      emit({
        ...state,
        error: null,
        status: suggestions.length > 0 ? "ready" : "empty",
        suggestions,
      });
    } catch {
      if (version !== requestVersion || state.query.trim() !== query) return;
      emit({
        ...state,
        error:
          "Could not load Wikipedia articles. Check your connection and try again.",
        status: "error",
        suggestions: [],
      });
    }
  }

  return {
    changeQuery(query: string) {
      cancelPending();
      const selected = state.selected?.title === query ? state.selected : null;
      emit({
        error: null,
        query,
        selected,
        status: selected ? "selected" : "idle",
        suggestions: [],
      });
      if (selected || query.trim().length < 2) return;
      const version = requestVersion;
      timer = setTimeout(() => {
        timer = null;
        void runSearch(query.trim(), version);
      }, 250);
    },
    clear() {
      cancelPending();
      emit({
        error: null,
        query: "",
        selected: null,
        status: "idle",
        suggestions: [],
      });
    },
    dispose() {
      cancelPending();
    },
    getState() {
      return state;
    },
    select(suggestion: WikipediaSuggestion) {
      cancelPending();
      emit({
        error: null,
        query: suggestion.title,
        selected: suggestion,
        status: "selected",
        suggestions: [],
      });
    },
  };
}

export function selectedPrivateChallengeDraft(
  start: WikipediaSuggestion | null,
  end: WikipediaSuggestion | null,
): PrivateChallengeValidation {
  const errors: PrivateChallengeErrors = {};
  if (!start) {
    errors.startArticle = "Select a starting article from the results.";
  }
  if (!end) {
    errors.endArticle = "Select a target article from the results.";
  } else if (
    start &&
    start.title.trim().replaceAll("_", " ").toLowerCase() ===
      end.title.trim().replaceAll("_", " ").toLowerCase()
  ) {
    errors.endArticle = "Choose a different target article.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          startArticle: start!.title,
          endArticle: end!.title,
        },
      };
}
