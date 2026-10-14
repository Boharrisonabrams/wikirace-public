// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { darkColors, lightColors } from "../constants/theme";
import {
  applyArticleFindEvent,
  buildArticleFindPresentation,
  createArticleFindState,
  isArticleWebViewEventForDocument,
  parseArticleWebViewEvent,
  resetArticleFindState,
  stepMatchIndex,
  type ArticleWebViewCommand,
  type ArticleWebViewEvent,
} from "./article-find";
import { articleBridgeScript, articleShell } from "./article-shell";

declare global {
  interface Window {
    ReactNativeWebView: { postMessage: (data: string) => void };
    __wikipathArticleBridgeInstalled?: boolean;
    __wikipathDocumentId?: string;
  }
}

const DOCUMENT_ID = "fixture-document";

const fixture = `
  <p id="plain">Portal text opens a portal in plain prose.</p>
  <p id="linked">
    The linked <a class="wiki-link" data-article="Target_article" href="#">portal</a>
    is a legal doorway.
  </p>
  <p id="split">World <em>War</em> spans an inline element.</p>
  <div id="nested">alpha <p>inner needle</p> omega needle</div>
  <div class="navbox" style="display: none">A hidden portal must not count.</div>
  <p id="links">
    Visit <a class="wiki-link" data-article="Kenya" href="#">Kenya</a> and the
    <a class="wiki-link" data-article="Mount Kenya" href="#">mountain</a> beside
    <span class="wiki-dead-link">Nairobi</span> plus
    <a class="wiki-link" data-article="Kenya" href="#">Kenya again</a>.
  </p>
  <div class="navbox" style="display: none">
    <a class="wiki-link" data-article="Hidden Article" href="#">Hidden Article</a>
  </div>
`;

function dispatch(
  command: ArticleWebViewCommand,
  target: Window | Document = window,
) {
  target.dispatchEvent(
    new MessageEvent("message", {
      data: JSON.stringify(command),
    }),
  );
}

describe("article find protocol", () => {
  let messages: ArticleWebViewEvent[];

  beforeEach(() => {
    messages = [];
    document.body.innerHTML = `<div id="root">${fixture}</div>`;
    window.__wikipathDocumentId = DOCUMENT_ID;
    window.ReactNativeWebView = {
      postMessage(data) {
        messages.push(JSON.parse(data) as ArticleWebViewEvent);
      },
    };
    Object.defineProperty(window, "pageYOffset", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    if (!window.__wikipathArticleBridgeInstalled)
      window.eval(articleBridgeScript);
  });

  it("highlights literal plain and linked matches while preserving link activation", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 72,
    });

    const marks = Array.from(
      document.querySelectorAll<HTMLElement>("mark[data-wikipath-find]"),
    );
    expect(marks).toHaveLength(3);
    expect(marks[0].classList.contains("find-match-current")).toBe(true);
    expect(marks[1].classList.contains("find-match")).toBe(true);
    expect(marks[2].closest("a.wiki-link")?.getAttribute("data-article")).toBe(
      "Target_article",
    );
    expect(messages).toContainEqual({
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "portal",
      total: 3,
    });
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(messages).toContainEqual({
      type: "find/active-index",
      documentId: DOCUMENT_ID,
      query: "portal",
      index: 0,
      total: 3,
    });

    marks[0].click();
    expect(messages.some((message) => message.type === "article/link")).toBe(
      false,
    );

    marks[2].click();
    expect(messages).toContainEqual({
      type: "article/link",
      documentId: DOCUMENT_ID,
      article: "Target_article",
    });
  });

  it("ships vertical touch and momentum hints in the article shell", () => {
    const shell = articleShell(
      "Momentum",
      "<p>Fast scanning</p>",
      DOCUMENT_ID,
      { ...lightColors, isDark: false },
    );

    expect(shell).toContain("touch-action: pan-y");
    expect(shell).toContain(".wiki-article table {\n  display: block;");
    expect(shell).toContain("touch-action: pan-x pan-y");
    expect(shell).toContain(".wiki-article th,\n.wiki-article td {");
    expect(shell).toContain("word-break: normal");
    expect(shell).toContain("-webkit-overflow-scrolling: touch");
    expect(shell).toContain("overscroll-behavior-y: auto");
  });

  it("wraps next and previous navigation and offsets the active match below the bar", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 72,
    });
    const marks = Array.from(
      document.querySelectorAll<HTMLElement>("mark[data-wikipath-find]"),
    );
    marks[2].getBoundingClientRect = () =>
      ({ top: 260 }) as Pick<DOMRect, "top"> as DOMRect;

    dispatch({
      type: "find/navigate",
      documentId: DOCUMENT_ID,
      direction: "next",
      topOffset: 72,
    });
    dispatch({
      type: "find/navigate",
      documentId: DOCUMENT_ID,
      direction: "next",
      topOffset: 72,
    });
    expect(marks[2].classList.contains("find-match-current")).toBe(true);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      behavior: "smooth",
      top: 288,
    });

    dispatch({
      type: "find/navigate",
      documentId: DOCUMENT_ID,
      direction: "next",
      topOffset: 72,
    });
    expect(marks[0].classList.contains("find-match-current")).toBe(true);

    dispatch({
      type: "find/navigate",
      documentId: DOCUMENT_ID,
      direction: "previous",
      topOffset: 72,
    });
    expect(marks[2].classList.contains("find-match-current")).toBe(true);
  });

  it("reports zero matches and clearing restores the original article DOM", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 72,
    });
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "missing doorway",
      topOffset: 72,
    });

    expect(document.querySelectorAll("mark[data-wikipath-find]")).toHaveLength(
      0,
    );
    expect(messages).toContainEqual({
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "missing doorway",
      total: 0,
    });
    expect(messages).toContainEqual({
      type: "find/active-index",
      documentId: DOCUMENT_ID,
      query: "missing doorway",
      index: null,
      total: 0,
    });

    dispatch({ type: "find/clear", documentId: DOCUMENT_ID });
    expect(document.querySelectorAll("mark[data-wikipath-find]")).toHaveLength(
      0,
    );
    expect(document.querySelector("#plain")?.textContent).toBe(
      "Portal text opens a portal in plain prose.",
    );
  });

  it("matches a phrase across inline article markup", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "World War",
      topOffset: 72,
    });

    const marks = Array.from(
      document.querySelectorAll<HTMLElement>('mark[data-find-index="0"]'),
    );
    expect(marks).toHaveLength(2);
    expect(marks.map((mark) => mark.textContent).join("")).toBe("World War");
    expect(marks[1].closest("em")).not.toBeNull();
    expect(messages).toContainEqual({
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "World War",
      total: 1,
    });
  });

  it("keeps nested block matches in DOM order without joining across blocks", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "needle",
      topOffset: 72,
    });

    const marks = Array.from(
      document.querySelectorAll<HTMLElement>("#nested mark[data-find-index]"),
    );
    expect(marks).toHaveLength(2);
    expect(marks.map((mark) => mark.dataset.findIndex)).toEqual(["0", "1"]);
    expect(marks[0].classList.contains("find-match-current")).toBe(true);

    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "alpha omega",
      topOffset: 72,
    });
    expect(messages).toContainEqual({
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "alpha omega",
      total: 0,
    });
  });

  it("resets native find state when the article changes", () => {
    let state = createArticleFindState();
    state = { ...state, query: "portal" };
    state = applyArticleFindEvent(state, {
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "portal",
      total: 3,
    });
    state = applyArticleFindEvent(state, {
      type: "find/active-index",
      documentId: DOCUMENT_ID,
      query: "portal",
      index: 1,
      total: 3,
    });

    expect(state).toMatchObject({ query: "portal", total: 3, activeIndex: 1 });
    expect(resetArticleFindState()).toEqual(createArticleFindState());
  });

  it("keeps wrap/index logic deterministic", () => {
    expect(stepMatchIndex(null, 4, "next")).toBe(0);
    expect(stepMatchIndex(3, 4, "next")).toBe(0);
    expect(stepMatchIndex(0, 4, "previous")).toBe(3);
    expect(stepMatchIndex(0, 0, "next")).toBeNull();
  });

  it("rejects stale document messages and accepts the document event path", () => {
    dispatch(
      {
        type: "find/query",
        documentId: "stale-document",
        query: "portal",
        topOffset: 72,
      },
      document,
    );
    expect(document.querySelectorAll("mark[data-wikipath-find]")).toHaveLength(
      0,
    );

    dispatch(
      {
        type: "find/query",
        documentId: DOCUMENT_ID,
        query: "portal",
        topOffset: 72,
      },
      document,
    );
    expect(document.querySelectorAll("mark[data-wikipath-find]")).toHaveLength(
      3,
    );

    const currentEvent = parseArticleWebViewEvent({
      type: "find/match-count",
      documentId: DOCUMENT_ID,
      query: "portal",
      total: 3,
    });
    const staleEvent = parseArticleWebViewEvent({
      type: "find/match-count",
      documentId: "stale-document",
      query: "portal",
      total: 99,
    });
    expect(currentEvent).not.toBeNull();
    expect(staleEvent).not.toBeNull();
    expect(
      currentEvent &&
        isArticleWebViewEventForDocument(currentEvent, DOCUMENT_ID),
    ).toBe(true);
    expect(
      staleEvent && isArticleWebViewEventForDocument(staleEvent, DOCUMENT_ID),
    ).toBe(false);
  });

  it("accepts a document-scoped WebView ready event", () => {
    expect(
      parseArticleWebViewEvent({
        type: "article/ready",
        documentId: DOCUMENT_ID,
      }),
    ).toEqual({
      type: "article/ready",
      documentId: DOCUMENT_ID,
    });
  });

  it("parses palette events strictly and keeps them off the find state", () => {
    const snippetsEvent = parseArticleWebViewEvent({
      type: "find/snippets",
      documentId: DOCUMENT_ID,
      query: "portal",
      snippets: [{ index: 0, text: "a portal", matchStart: 2, matchLength: 6 }],
      total: 3,
    });
    expect(snippetsEvent).toMatchObject({ type: "find/snippets", total: 3 });

    expect(
      parseArticleWebViewEvent({
        type: "find/snippets",
        documentId: DOCUMENT_ID,
        query: "portal",
        snippets: [
          { index: 0, text: "a portal", matchStart: 2, matchLength: 0 },
        ],
        total: 3,
      }),
    ).toBeNull();

    const inventoryEvent = parseArticleWebViewEvent({
      type: "links/inventory",
      documentId: DOCUMENT_ID,
      links: [{ article: "Kenya", text: "Kenya", snippet: "Visit Kenya" }],
    });
    expect(inventoryEvent).toMatchObject({ type: "links/inventory" });
    expect(
      inventoryEvent &&
        isArticleWebViewEventForDocument(inventoryEvent, "other-document"),
    ).toBe(false);

    expect(
      parseArticleWebViewEvent({
        type: "links/inventory",
        documentId: DOCUMENT_ID,
        links: [{ article: "", text: "Kenya", snippet: "" }],
      }),
    ).toBeNull();
    expect(
      parseArticleWebViewEvent({
        type: "links/inventory",
        documentId: DOCUMENT_ID,
        links: "Kenya",
      }),
    ).toBeNull();

    const state = { query: "portal", total: 3, activeIndex: 1 };
    expect(snippetsEvent && applyArticleFindEvent(state, snippetsEvent)).toBe(
      state,
    );
    expect(inventoryEvent && applyArticleFindEvent(state, inventoryEvent)).toBe(
      state,
    );
  });

  it("ships the same installed bridge inside the article shell", () => {
    const html = articleShell("Fixture", fixture, DOCUMENT_ID, {
      ...lightColors,
      isDark: false,
    });
    expect(html).toContain(articleBridgeScript);
    expect(html).toContain("send({ type: 'article/ready' });");
    expect(html).toContain(`window.__wikipathDocumentId="${DOCUMENT_ID}"`);
    expect(html).toContain('data-article="Target_article"');
    expect(html).toContain(`--wiki-surface: ${lightColors.surface}`);
    expect(html).toContain(`--wiki-blue: ${lightColors.link}`);
    expect(html).toContain("color-scheme: light");
    expect(html).not.toContain("fonts.googleapis.com");
  });

  it("renders the same bridge with the dark editorial article palette", () => {
    const html = articleShell("Fixture", fixture, DOCUMENT_ID, {
      ...darkColors,
      isDark: true,
    });
    expect(html).toContain(articleBridgeScript);
    expect(html).toContain(`--wiki-surface: ${darkColors.surface}`);
    expect(html).toContain(`--wiki-blue: ${darkColors.link}`);
    expect(html).toContain(`background: ${darkColors.findMatch}`);
    expect(html).toContain("color-scheme: dark");
  });

  it("inventories only live server-marked links, deduped, with block snippets", () => {
    // The bridge caches the inventory per document instance, so this test
    // makes both collect dispatches itself and asserts the cached replay.
    dispatch({ type: "links/collect", documentId: DOCUMENT_ID });
    dispatch({ type: "links/collect", documentId: DOCUMENT_ID });

    const inventories = messages.filter(
      (
        message,
      ): message is Extract<ArticleWebViewEvent, { type: "links/inventory" }> =>
        message.type === "links/inventory",
    );
    expect(inventories).toHaveLength(2);
    expect(inventories[1]).toEqual(inventories[0]);

    const links = inventories[0].links;
    expect(links.map((link) => link.article)).toEqual([
      "Target_article",
      "Kenya",
      "Mount Kenya",
    ]);
    expect(links.map((link) => link.text)).toEqual([
      "portal",
      "Kenya",
      "mountain",
    ]);
    expect(links[0].snippet).toContain("legal doorway");
    expect(links[1].snippet).toContain("Visit Kenya and the");
    // The dead span and the hidden link never become navigable entries;
    // dead-span words may still appear inside a neighbor's prose snippet.
    expect(
      links.some(
        (entry) =>
          entry.article === "Nairobi" || entry.article === "Hidden Article",
      ),
    ).toBe(false);
  });

  it("ignores a stale links/collect command", () => {
    dispatch({ type: "links/collect", documentId: "stale-document" });
    expect(messages.some((message) => message.type === "links/inventory")).toBe(
      false,
    );
  });

  it("reports capped snippets with exact highlight offsets when asked", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 24,
      includeSnippets: true,
    });

    const snippetEvents = messages.filter(
      (
        message,
      ): message is Extract<ArticleWebViewEvent, { type: "find/snippets" }> =>
        message.type === "find/snippets",
    );
    expect(snippetEvents).toHaveLength(1);
    const { snippets, total } = snippetEvents[0];
    expect(total).toBe(3);
    expect(snippets).toHaveLength(3);
    expect(snippets.map((snippet) => snippet.index)).toEqual([0, 1, 2]);
    for (const snippet of snippets) {
      expect(
        snippet.text
          .slice(snippet.matchStart, snippet.matchStart + snippet.matchLength)
          .toLowerCase(),
      ).toBe("portal");
    }
    expect(snippets[0].text).toContain("Portal text opens");
    // Without scrollToFirst the article never jumps under the racer.
    expect(window.scrollTo).not.toHaveBeenCalled();

    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "",
      topOffset: 24,
      includeSnippets: true,
    });
    expect(messages).toContainEqual({
      type: "find/snippets",
      documentId: DOCUMENT_ID,
      query: "",
      snippets: [],
      total: 0,
    });
  });

  it("live-scrolls to the first match only when scrollToFirst is set", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 24,
      scrollToFirst: true,
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );

    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "doorway",
      topOffset: 24,
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "missing doorway",
      topOffset: 24,
      scrollToFirst: true,
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it("activates a tapped match index and scrolls to it", () => {
    dispatch({
      type: "find/query",
      documentId: DOCUMENT_ID,
      query: "portal",
      topOffset: 24,
    });
    dispatch({
      type: "find/activate",
      documentId: DOCUMENT_ID,
      index: 2,
      topOffset: 24,
    });

    const marks = Array.from(
      document.querySelectorAll<HTMLElement>("mark[data-wikipath-find]"),
    );
    expect(marks[2].classList.contains("find-match-current")).toBe(true);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(messages).toContainEqual({
      type: "find/active-index",
      documentId: DOCUMENT_ID,
      query: "portal",
      index: 2,
      total: 3,
    });
  });
});

describe("article find presentation", () => {
  it("invites a live query without showing an empty result count", () => {
    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: createArticleFindState(),
      }),
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
      }),
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
      }),
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
      }),
    ).toMatchObject({ counterLabel: "12 of 12", progress: 1 });
  });

  it("distinguishes a completed empty search from an idle field", () => {
    expect(
      buildArticleFindPresentation({
        articleTitle: "Diamond",
        pending: false,
        state: { activeIndex: null, query: "penguin", total: 0 },
      }),
    ).toEqual({
      clearVisible: true,
      counterLabel: "0",
      progress: 0,
      status: "empty",
      statusLabel: "No matches in Diamond",
    });
  });
});
