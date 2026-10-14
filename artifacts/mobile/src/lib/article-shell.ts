import type { AppColors } from "@/constants/theme";

export type ArticleShellTheme = Pick<
  AppColors,
  | "surface"
  | "surfaceMuted"
  | "chrome"
  | "ink"
  | "inkMuted"
  | "border"
  | "borderSoft"
  | "link"
  | "accent"
  | "accentSoft"
  | "findMatch"
  | "findMatchBorder"
  | "findCurrent"
  | "findCurrentBorder"
> & { isDark: boolean };

function buildWikiArticleCss(theme: ArticleShellTheme): string {
  return `
:root {
  --app-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --app-font-serif: Georgia, "Times New Roman", serif;
  --wiki-surface: ${theme.surface};
  --wiki-ink: ${theme.ink};
  --wiki-muted: ${theme.inkMuted};
  --wiki-blue: ${theme.link};
  --wiki-soft: ${theme.surfaceMuted};
  --wiki-hairline: ${theme.borderSoft};
  --wiki-chrome: ${theme.chrome};
  --wiki-rule: ${theme.border};
  --wiki-accent: ${theme.accent};
  --wiki-accent-soft: ${theme.accentSoft};
  color-scheme: ${theme.isDark ? "dark" : "light"};
}

html {
  background: var(--wiki-surface);
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: auto;
  touch-action: pan-y;
}

body {
  background: var(--wiki-surface);
  color: var(--wiki-ink);
  margin: 0;
  padding: 18px 16px 32px;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: var(--wiki-accent-soft);
}

.article-title {
  border-bottom: 1px solid var(--wiki-hairline);
  font-family: var(--app-font-serif);
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 0.25rem;
  padding-bottom: 0.35rem;
}

.article-subtitle {
  color: var(--wiki-muted);
  font-family: var(--app-font-sans);
  font-size: 0.75rem;
  margin: 0 0 1rem;
}

.wiki-article {
  font-family: var(--app-font-sans);
  font-size: 1rem;
  line-height: 1.65;
  color: var(--wiki-ink);
  word-break: break-word;
}

.wiki-article .wiki-link {
  color: var(--wiki-blue);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--wiki-blue) 40%, transparent);
  text-underline-offset: 2px;
  cursor: pointer;
}
.wiki-article .wiki-link:active {
  background: var(--wiki-accent-soft);
}

.wiki-article p {
  margin: 0 0 0.9em;
}

.wiki-article h2,
.wiki-article h3,
.wiki-article h4 {
  font-family: var(--app-font-serif);
  font-weight: 600;
  line-height: 1.25;
  margin: 1.4em 0 0.5em;
}
.wiki-article h2 {
  font-size: 1.45rem;
  border-bottom: 1px solid var(--wiki-hairline);
  padding-bottom: 0.2em;
}
.wiki-article h3 {
  font-size: 1.2rem;
}
.wiki-article h4 {
  font-size: 1.05rem;
}

.wiki-article ul,
.wiki-article ol {
  margin: 0 0 0.9em;
  padding-left: 1.4em;
}
.wiki-article ul {
  list-style: disc;
}
.wiki-article ol {
  list-style: decimal;
}
.wiki-article li {
  margin-bottom: 0.25em;
}

.wiki-article blockquote {
  border-left: 3px solid var(--wiki-accent);
  margin: 0 0 0.9em;
  padding: 0.2em 0 0.2em 1em;
  color: var(--wiki-muted);
}

.wiki-article img {
  max-width: 100%;
  height: auto;
}

.wiki-article figure,
.wiki-article .thumb {
  margin: 0.5em auto 1em;
  max-width: 100%;
  font-size: 0.85rem;
  color: var(--wiki-muted);
}
.wiki-article figcaption {
  padding-top: 0.3em;
  font-size: 0.85rem;
  color: var(--wiki-muted);
}

.wiki-article table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  touch-action: pan-x pan-y;
  border-collapse: collapse;
  font-size: 0.85em;
  margin: 0 0 1em;
}
.wiki-article th,
.wiki-article td {
  border: 1px solid var(--wiki-hairline);
  padding: 0.3em 0.5em;
  text-align: left;
  vertical-align: top;
  word-break: normal;
}
.wiki-article th {
  background: var(--wiki-chrome);
}

.wiki-article .infobox {
  width: 100%;
  background: var(--wiki-chrome);
  border: 1px solid var(--wiki-rule);
  margin: 0 0 1em;
}

/* Wikipedia hides these on mobile; so do we. */
.wiki-article .navbox,
.wiki-article .vertical-navbox,
.wiki-article .sistersitebox,
.wiki-article .metadata,
.wiki-article .mw-empty-elt,
.wiki-article .hatnote + .hatnote {
  display: none;
}

.wiki-article .hatnote {
  border-left: 3px solid var(--wiki-accent);
  font-size: 0.85rem;
  font-style: italic;
  color: var(--wiki-muted);
  margin-bottom: 0.7em;
  padding-left: 0.75em;
}

.wiki-article .shortdescription {
  display: none;
}

mark[data-wikipath-find="match"] {
  border-radius: 2px;
  color: inherit;
  padding: 0 1px;
}

.find-match {
  background: ${theme.findMatch};
  box-shadow: 0 0 0 1px ${theme.findMatchBorder} inset;
}

.find-match-current {
  background: ${theme.findCurrent};
  box-shadow:
    0 0 0 1.5px ${theme.findCurrentBorder} inset,
    0 0 0 4px ${theme.accentSoft};
}
`;
}

export const articleBridgeScript = String.raw`
(function () {
  if (window.__wikipathArticleBridgeInstalled) return;
  window.__wikipathArticleBridgeInstalled = true;

  var highlights = [];
  var activeIndex = null;
  var activeQuery = '';
  var linkInventory = null;
  var SNIPPET_RADIUS = 44;
  var SNIPPET_CAP = 60;
  var BLOCK_SELECTOR = 'address, article, aside, blockquote, div, dl, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, li, main, nav, ol, p, pre, section, table, td, th, tr, ul';
  var documentId = typeof window.__wikipathDocumentId === 'string'
    ? window.__wikipathDocumentId
    : '';

  function send(message) {
    try {
      message.documentId = documentId;
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    } catch (error) {
      // The shell can also render during static tests where the native bridge is absent.
    }
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
  }

  function clearHighlights() {
    var marks = document.querySelectorAll('mark[data-wikipath-find="match"]');
    for (var index = 0; index < marks.length; index += 1) {
      var mark = marks[index];
      var parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
      if (parent.normalize) parent.normalize();
    }
    highlights = [];
    activeIndex = null;
  }

  function isHiddenText(element, root) {
    var current = element;
    while (current) {
      if (
        current.hidden ||
        current.getAttribute('aria-hidden') === 'true' ||
        current.matches(
          '.navbox, .vertical-navbox, .sistersitebox, .metadata, .mw-empty-elt, .shortdescription, .hatnote + .hatnote'
        )
      ) {
        return true;
      }
      var style = window.getComputedStyle ? window.getComputedStyle(current) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) {
        return true;
      }
      if (current === root) break;
      current = current.parentElement;
    }
    return false;
  }

  function scrollMatchIntoView(match, topOffset) {
    if (!match) return;
    var rect = match.getBoundingClientRect();
    var top = Math.max(window.pageYOffset + rect.top - Math.max(topOffset || 0, 0), 0);
    try {
      window.scrollTo({ top: top, behavior: 'smooth' });
    } catch (error) {
      window.scrollTo(0, top);
    }
  }

  function activate(index, topOffset, shouldScroll) {
    if (!highlights.length || index === null) {
      activeIndex = null;
      send({
        type: 'find/active-index',
        query: activeQuery,
        index: null,
        total: 0,
      });
      return;
    }

    activeIndex = ((index % highlights.length) + highlights.length) % highlights.length;
    for (var highlightIndex = 0; highlightIndex < highlights.length; highlightIndex += 1) {
      var highlightGroup = highlights[highlightIndex];
      var isCurrent = highlightIndex === activeIndex;
      for (var segmentIndex = 0; segmentIndex < highlightGroup.length; segmentIndex += 1) {
        var highlight = highlightGroup[segmentIndex];
        highlight.classList.toggle('find-match-current', isCurrent);
        highlight.classList.toggle('find-match', !isCurrent);
        highlight.dataset.active = isCurrent ? 'true' : 'false';
      }
    }
    if (shouldScroll) scrollMatchIntoView(highlights[activeIndex][0], topOffset);
    send({
      type: 'find/active-index',
      query: activeQuery,
      index: activeIndex,
      total: highlights.length,
    });
  }

  function flattenBreaks(value) {
    return value.replace(/[\n\r\t]/g, ' ');
  }

  function snippetWindow(text, start, length) {
    var from = Math.max(0, start - SNIPPET_RADIUS);
    var to = Math.min(text.length, start + length + SNIPPET_RADIUS);
    var prefix = from > 0 ? '…' : '';
    var suffix = to < text.length ? '…' : '';
    return {
      text: flattenBreaks(prefix + text.slice(from, to) + suffix),
      matchStart: start - from + prefix.length,
    };
  }

  function findMatches(query, topOffset, includeSnippets, scrollToFirst) {
    clearHighlights();
    activeQuery = typeof query === 'string' ? query : '';
    var normalizedQuery = activeQuery.trim();

    if (!normalizedQuery) {
      send({ type: 'find/match-count', query: activeQuery, total: 0 });
      if (includeSnippets) {
        send({ type: 'find/snippets', query: activeQuery, snippets: [], total: 0 });
      }
      send({
        type: 'find/active-index',
        query: activeQuery,
        index: null,
        total: 0,
      });
      return;
    }

    var root = document.getElementById('root');
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent || parent.closest('script, style, mark[data-wikipath-find="match"]')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (isHiddenText(parent, root)) return NodeFilter.FILTER_REJECT;
        return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });

    var textNodes = [];
    var currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode);
      currentNode = walker.nextNode();
    }

    var blocks = [];

    for (var nodeIndex = 0; nodeIndex < textNodes.length; nodeIndex += 1) {
      var textNode = textNodes[nodeIndex];
      var parent = textNode.parentElement;
      var block = parent && parent.closest ? parent.closest(BLOCK_SELECTOR) : null;
      if (!block || !root.contains(block)) block = root;

      var blockEntry = blocks.length > 0 ? blocks[blocks.length - 1] : null;
      if (!blockEntry || blockEntry.element !== block) {
        blockEntry = { element: block, text: '', nodes: [] };
        blocks.push(blockEntry);
      }

      var nodeText = textNode.textContent || '';
      var nodeStart = blockEntry.text.length;
      blockEntry.nodes.push({
        node: textNode,
        start: nodeStart,
        end: nodeStart + nodeText.length,
        text: nodeText,
      });
      blockEntry.text += nodeText;
    }

    var snippets = [];

    for (var groupIndex = 0; groupIndex < blocks.length; groupIndex += 1) {
      var group = blocks[groupIndex];
      var matcher = new RegExp(escapeRegExp(normalizedQuery), 'gi');
      var ranges = [];
      var match = matcher.exec(group.text);

      while (match) {
        var logicalIndex = highlights.length;
        ranges.push({
          start: match.index,
          end: match.index + match[0].length,
          index: logicalIndex,
        });
        if (includeSnippets && snippets.length < SNIPPET_CAP) {
          var window_ = snippetWindow(group.text, match.index, match[0].length);
          snippets.push({
            index: logicalIndex,
            text: window_.text,
            matchStart: window_.matchStart,
            matchLength: match[0].length,
          });
        }
        highlights.push([]);
        match = matcher.exec(group.text);
      }

      if (!ranges.length) continue;

      for (var entryIndex = 0; entryIndex < group.nodes.length; entryIndex += 1) {
        var entry = group.nodes[entryIndex];
        var intersections = [];

        for (var rangeIndex = 0; rangeIndex < ranges.length; rangeIndex += 1) {
          var range = ranges[rangeIndex];
          if (range.start < entry.end && range.end > entry.start) {
            intersections.push({
              start: Math.max(range.start, entry.start) - entry.start,
              end: Math.min(range.end, entry.end) - entry.start,
              index: range.index,
            });
          }
        }

        if (!intersections.length) continue;

        var fragment = document.createDocumentFragment();
        var lastIndex = 0;
        for (var intersectionIndex = 0; intersectionIndex < intersections.length; intersectionIndex += 1) {
          var intersection = intersections[intersectionIndex];
          fragment.appendChild(
            document.createTextNode(entry.text.slice(lastIndex, intersection.start))
          );
          var mark = document.createElement('mark');
          mark.dataset.wikipathFind = 'match';
          mark.dataset.findIndex = String(intersection.index);
          mark.className = 'find-match';
          mark.textContent = entry.text.slice(intersection.start, intersection.end);
          fragment.appendChild(mark);
          highlights[intersection.index].push(mark);
          lastIndex = intersection.end;
        }

        fragment.appendChild(document.createTextNode(entry.text.slice(lastIndex)));
        entry.node.parentNode.replaceChild(fragment, entry.node);
      }
    }

    send({
      type: 'find/match-count',
      query: activeQuery,
      total: highlights.length,
    });
    if (includeSnippets) {
      send({
        type: 'find/snippets',
        query: activeQuery,
        snippets: snippets,
        total: highlights.length,
      });
    }
    activate(
      highlights.length > 0 ? 0 : null,
      topOffset,
      scrollToFirst === true && highlights.length > 0
    );
  }

  function navigateMatches(direction, topOffset) {
    if (!highlights.length) {
      activate(null, topOffset, false);
      return;
    }
    var delta = direction === 'previous' ? -1 : 1;
    var current = activeIndex === null ? (delta > 0 ? -1 : 0) : activeIndex;
    activate(current + delta, topOffset, true);
  }

  function activateMatch(index, topOffset) {
    if (!highlights.length || typeof index !== 'number') {
      activate(null, topOffset, false);
      return;
    }
    activate(index, topOffset, true);
  }

  function linkSnippet(link, anchorText) {
    var block = link.closest ? link.closest(BLOCK_SELECTOR) : null;
    var blockText = block ? block.textContent || '' : '';
    if (!blockText) return anchorText;
    var position = anchorText ? blockText.indexOf(anchorText) : -1;
    if (position < 0) {
      return flattenBreaks(blockText.slice(0, SNIPPET_RADIUS * 2))
        .replace(/\s+/g, ' ')
        .trim();
    }
    return snippetWindow(blockText, position, anchorText.length)
      .text.replace(/\s+/g, ' ')
      .trim();
  }

  function collectLinks() {
    if (linkInventory) {
      send({ type: 'links/inventory', links: linkInventory });
      return;
    }
    var root = document.getElementById('root');
    if (!root) return;
    var anchors = root.querySelectorAll('a.wiki-link[data-article]');
    var seen = {};
    var links = [];
    for (var index = 0; index < anchors.length; index += 1) {
      var anchor = anchors[index];
      var article = anchor.getAttribute('data-article');
      if (!article || seen[article]) continue;
      if (isHiddenText(anchor, root)) continue;
      seen[article] = true;
      var anchorText = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      links.push({
        article: article,
        text: anchorText || article,
        snippet: linkSnippet(anchor, anchorText),
      });
    }
    linkInventory = links;
    send({ type: 'links/inventory', links: links });
  }

  function handleCommand(event) {
    var command;
    try {
      command = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch (error) {
      return;
    }
    if (
      !command ||
      typeof command.type !== 'string' ||
      command.documentId !== documentId
    ) {
      return;
    }

    if (command.type === 'find/query') {
      findMatches(
        command.query,
        command.topOffset,
        command.includeSnippets === true,
        command.scrollToFirst === true
      );
    } else if (command.type === 'find/navigate') {
      navigateMatches(command.direction, command.topOffset);
    } else if (command.type === 'find/activate') {
      activateMatch(command.index, command.topOffset);
    } else if (command.type === 'find/clear') {
      clearHighlights();
      activeQuery = '';
    } else if (command.type === 'links/collect') {
      collectLinks();
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a.wiki-link') : null;
    if (!link) return;
    event.preventDefault();
    var article = link.getAttribute('data-article');
    if (!article) return;
    send({ type: 'article/link', article: article });
  });

  window.addEventListener('message', handleCommand);
  document.addEventListener('message', handleCommand);
  send({ type: 'article/ready' });
})();
true;
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function scriptJson(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function articleShell(
  title: string,
  html: string,
  documentId: string,
  theme: ArticleShellTheme,
): string {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <meta name="color-scheme" content="${theme.isDark ? "dark" : "light"}" />
  <style>${buildWikiArticleCss(theme)}</style>
</head>
<body>
  <h1 class="article-title">${escapeHtml(title)}</h1>
  <p class="article-subtitle">From Wikipedia, the free encyclopedia</p>
  <div id="root" class="wiki-article">${html}</div>
  <script>window.__wikipathDocumentId=${scriptJson(documentId)};</script>
  <script>${articleBridgeScript}</script>
</body>
</html>`;
}
