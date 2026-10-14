export interface ArticleLinkEntry {
  article: string;
  text: string;
  snippet: string;
}

const CONTEXT_SELECTOR = "p, li, dd, dt, figcaption, th, td, blockquote";

export function collectArticleLinks(
  container: HTMLElement,
): ArticleLinkEntry[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>("a.wiki-link[data-article]"),
  )
    .map((anchor) => {
      const article = anchor.getAttribute("data-article")?.trim() ?? "";
      const text = normalizeWhitespace(anchor.textContent ?? "").trim();
      if (!article || !text) return null;
      return {
        article,
        text,
        snippet: buildContextSnippet(anchor, text),
      };
    })
    .filter((entry): entry is ArticleLinkEntry => entry !== null);
}

function buildContextSnippet(
  anchor: HTMLAnchorElement,
  anchorText: string,
): string {
  const context =
    normalizeWhitespace(
      anchor.closest<HTMLElement>(CONTEXT_SELECTOR)?.textContent ??
        anchor.parentElement?.textContent ??
        anchor.textContent ??
        "",
    ).trim() || anchorText;

  return sliceSnippet(context, anchorText);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ");
}

function sliceSnippet(context: string, focus: string): string {
  const normalizedFocus = focus.trim();
  if (!normalizedFocus) return context;

  const lowerContext = context.toLowerCase();
  const lowerFocus = normalizedFocus.toLowerCase();
  const matchAt = lowerContext.indexOf(lowerFocus);
  if (matchAt < 0) return clampWithEllipsis(context);

  const start = Math.max(0, matchAt - 36);
  const end = Math.min(context.length, matchAt + normalizedFocus.length + 52);
  const snippet = context.slice(start, end).trim();

  return [start > 0 ? "…" : "", snippet, end < context.length ? "…" : ""].join(
    "",
  );
}

function clampWithEllipsis(value: string): string {
  if (value.length <= 96) return value;
  return `${value.slice(0, 93).trim()}…`;
}
