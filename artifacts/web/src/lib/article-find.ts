import {
  stepMatchIndex,
  type FindDirection,
  type FindSnippet,
} from "@workspace/game-client";

export {
  buildArticleFindPresentation,
  createArticleFindState,
  resetArticleFindState,
  stepMatchIndex,
  updateArticleFindQuery,
} from "@workspace/game-client";
export type {
  ArticleFindPresentation,
  ArticleFindState,
  FindDirection,
  FindSnippet,
} from "@workspace/game-client";

interface HighlightSnapshot {
  activeIndex: number | null;
  snippets: FindSnippet[];
  total: number;
}

const MARK_SELECTOR = "mark[data-article-find-match]";

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase();
}

function stripHighlight(root: HTMLElement) {
  for (const mark of root.querySelectorAll<HTMLElement>(MARK_SELECTOR)) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

function buildSnippet(
  text: string,
  start: number,
  matchLength: number,
): Omit<FindSnippet, "index"> {
  const radius = 34;
  const sliceStart = Math.max(0, start - radius);
  const sliceEnd = Math.min(text.length, start + matchLength + radius);
  const raw = text.slice(sliceStart, sliceEnd);
  const leadingTrim = raw.match(/^\s*/)?.[0].length ?? 0;
  const trailingTrim = raw.match(/\s*$/)?.[0].length ?? 0;
  const body = raw.slice(leadingTrim, raw.length - trailingTrim);
  const prefix = sliceStart > 0 ? "…" : "";
  const suffix = sliceEnd < text.length ? "…" : "";
  return {
    text: `${prefix}${body}${suffix}`,
    matchStart: prefix.length + start - sliceStart - leadingTrim,
    matchLength,
  };
}

function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest(MARK_SELECTOR)) return NodeFilter.FILTER_REJECT;
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return (node.nodeValue ?? "").trim().length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function buildHighlights(root: HTMLElement, query: string): HighlightSnapshot & {
  marks: HTMLElement[];
} {
  stripHighlight(root);
  const trimmed = query.trim();
  if (!trimmed) {
    return { activeIndex: null, marks: [], snippets: [], total: 0 };
  }

  const needle = normalizeSearchText(trimmed);
  const marks: HTMLElement[] = [];
  const snippets: FindSnippet[] = [];

  for (const node of collectTextNodes(root)) {
    const text = node.nodeValue ?? "";
    const folded = normalizeSearchText(text);
    const ranges: Array<{ start: number; end: number }> = [];
    let searchFrom = 0;
    while (searchFrom < folded.length) {
      const at = folded.indexOf(needle, searchFrom);
      if (at < 0) break;
      ranges.push({ start: at, end: at + trimmed.length });
      searchFrom = at + Math.max(trimmed.length, 1);
    }
    if (ranges.length === 0) continue;

    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        fragment.append(text.slice(cursor, range.start));
      }
      const mark = document.createElement("mark");
      mark.dataset.articleFindMatch = String(marks.length);
      mark.className = "article-find-match";
      mark.textContent = text.slice(range.start, range.end);
      fragment.append(mark);
      marks.push(mark);
      snippets.push({
        index: snippets.length,
        ...buildSnippet(text, range.start, range.end - range.start),
      });
      cursor = range.end;
    }
    if (cursor < text.length) {
      fragment.append(text.slice(cursor));
    }

    node.parentNode?.replaceChild(fragment, node);
  }

  return {
    activeIndex: marks.length > 0 ? 0 : null,
    marks,
    snippets,
    total: marks.length,
  };
}

function setActiveMark(
  marks: HTMLElement[],
  nextIndex: number | null,
  scroll = true,
): number | null {
  marks.forEach((mark, index) => {
    const active = nextIndex !== null && index === nextIndex;
    mark.classList.toggle("article-find-match-current", active);
    if (active) mark.dataset.articleFindCurrent = "true";
    else delete mark.dataset.articleFindCurrent;
  });
  if (nextIndex !== null && scroll) {
    const current = marks[nextIndex];
    if (typeof current?.scrollIntoView === "function") {
      current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  return nextIndex;
}
export function createDomArticleFindController(options: {
  onUpdate: (snapshot: HighlightSnapshot) => void;
}) {
  let root: HTMLElement | null = null;
  let marks: HTMLElement[] = [];
  let snippets: FindSnippet[] = [];
  let activeIndex: number | null = null;

  function emit() {
    options.onUpdate({
      activeIndex,
      snippets,
      total: marks.length,
    });
  }

  return {
    attach(nextRoot: HTMLElement | null, query = "") {
      if (root && root !== nextRoot) stripHighlight(root);
      root = nextRoot;
      if (!root) {
        marks = [];
        snippets = [];
        activeIndex = null;
        emit();
        return;
      }
      if (query.trim()) {
        this.search(query);
      } else {
        marks = [];
        snippets = [];
        activeIndex = null;
        emit();
      }
    },
    clear() {
      if (root) stripHighlight(root);
      marks = [];
      snippets = [];
      activeIndex = null;
      emit();
    },
    search(query: string) {
      if (!root) {
        marks = [];
        snippets = [];
        activeIndex = null;
        emit();
        return;
      }
      const next = buildHighlights(root, query);
      marks = next.marks;
      snippets = next.snippets;
      activeIndex = setActiveMark(marks, next.activeIndex, false);
      emit();
    },
    activate(index: number) {
      if (marks.length === 0) return;
      const clamped = Math.min(Math.max(index, 0), marks.length - 1);
      activeIndex = setActiveMark(marks, clamped);
      emit();
    },
    navigate(direction: FindDirection) {
      const next = stepMatchIndex(activeIndex, marks.length, direction);
      if (next === null) return;
      activeIndex = setActiveMark(marks, next);
      emit();
    },
    dispose() {
      if (root) stripHighlight(root);
      root = null;
      marks = [];
      snippets = [];
      activeIndex = null;
    },
  };
}
