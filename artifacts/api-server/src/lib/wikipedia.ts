import sanitizeHtml from "sanitize-html";
import { normalizeTitle, toDisplayTitle } from "./game/titles";

const WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php";
const WIKIPEDIA_REST_SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page";

// Wikimedia asks API clients to identify themselves with a contact. If you run
// your own deployment, replace this with your own project URL or address.
const WIKI_HEADERS = {
  "User-Agent": "WikiRace/1.0 (https://github.com/Boharrisonabrams; contact: see GitHub profile)",
  "Api-User-Agent":
    "WikiRace/1.0 (https://github.com/Boharrisonabrams; contact: see GitHub profile)",
};

// ── tiny TTL cache ──────────────────────────────────────────────────────────
interface CacheEntry<T> {
  value: T;
  expires: number;
}

class TtlCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  constructor(
    private ttlMs: number,
    private maxEntries: number
  ) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
  }
}

const linksCache = new TtlCache<string[]>(5 * 60 * 1000, 500);
const articleCache = new TtlCache<WikipediaArticle>(10 * 60 * 1000, 100);
const redirectsCache = new TtlCache<string[]>(30 * 60 * 1000, 500);
const descriptionCache = new TtlCache<string | null>(30 * 60 * 1000, 500);

export interface WikipediaArticle {
  title: string;
  html: string;
  links: string[];
  exists: boolean;
}

export interface WikipediaSuggestion {
  title: string;
  description: string | null;
}

export class WikipediaUpstreamError extends Error {
  constructor(message = "Wikipedia didn't answer") {
    super(message);
    this.name = "WikipediaUpstreamError";
  }
}

async function wikiFetch(params: Record<string, string>): Promise<any> {
  const search = new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  });
  const response = await fetch(`${WIKIPEDIA_API_URL}?${search}`, {
    headers: WIKI_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Wikipedia API responded ${response.status}`);
  }
  return response.json();
}

function extractLinks(pageData: any): string[] {
  return (
    pageData.links
      ?.filter((link: any) => link.ns === 0)
      .map((link: any) => link["*"])
      .filter((link: string) => !link.startsWith("File:") && !link.startsWith("Category:")) ?? []
  );
}

/**
 * The outbound main-namespace links of an article, resolved through
 * redirects. This is the server's source of truth for move validation.
 */
export async function fetchArticleLinks(title: string): Promise<string[]> {
  const cacheKey = normalizeTitle(title);
  const cached = linksCache.get(cacheKey);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "parse",
    page: title,
    prop: "links",
    redirects: "1",
  });
  if (data.error) {
    throw new WikipediaUpstreamError(
      typeof data.error?.info === "string" ? data.error.info : "Wikipedia didn't answer"
    );
  }
  const links = extractLinks(data.parse);
  linksCache.set(cacheKey, links);
  return links;
}

/** Full article: sanitized HTML plus its valid outbound links. */
export async function fetchArticle(title: string): Promise<WikipediaArticle> {
  const cacheKey = normalizeTitle(title);
  const cached = articleCache.get(cacheKey);
  if (cached) return cached;

  const data = await wikiFetch({
    action: "parse",
    page: title,
    prop: "text|links",
    redirects: "1",
  });
  if (data.error) {
    return { title: toDisplayTitle(title), html: "", links: [], exists: false };
  }

  const pageData = data.parse;
  const links = extractLinks(pageData);
  const article: WikipediaArticle = {
    title: pageData.title,
    html: sanitizeWikipediaHtml(pageData.text["*"], links),
    links,
    exists: true,
  };
  articleCache.set(cacheKey, article);
  linksCache.set(cacheKey, links);
  return article;
}

export async function getRandomArticle(): Promise<{
  title: string;
  pageid: string;
} | null> {
  const data = await wikiFetch({
    action: "query",
    list: "random",
    rnnamespace: "0",
    rnlimit: "1",
  });
  const random = data.query?.random?.[0];
  if (!random) return null;
  return { title: random.title, pageid: String(random.id) };
}

export async function searchArticles(query: string, limit: number): Promise<string[]> {
  const data = await wikiFetch({
    action: "opensearch",
    search: query,
    limit: String(limit),
    namespace: "0",
  });
  return data[1] ?? [];
}

function plainText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const sanitized = sanitizeHtml(value, {
    allowedAttributes: {},
    allowedTags: [],
  })
    .replace(/\s+/g, " ")
    .trim();
  const text = sanitized.replace(
    /&(?:#(\d+)|#x([\da-f]+)|amp|quot|apos|lt|gt);/gi,
    (entity, decimal: string | undefined, hexadecimal: string | undefined) => {
      const codePoint = decimal
        ? Number.parseInt(decimal, 10)
        : hexadecimal
          ? Number.parseInt(hexadecimal, 16)
          : null;
      if (codePoint !== null) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
      const namedEntities: Record<string, string> = {
        "&amp;": "&",
        "&quot;": '"',
        "&apos;": "'",
        "&lt;": "<",
        "&gt;": ">",
      };
      return namedEntities[entity.toLowerCase()] ?? entity;
    }
  );
  return text || null;
}

export async function searchWikipediaSuggestions(
  query: string,
  limit = 6
): Promise<WikipediaSuggestion[]> {
  const safeLimit = Math.min(6, Math.max(1, Math.floor(limit) || 6));
  const search = new URLSearchParams({
    q: query.trim(),
    limit: String(safeLimit),
  });
  const response = await fetch(`${WIKIPEDIA_REST_SEARCH_URL}?${search}`, {
    headers: WIKI_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Wikipedia REST API responded ${response.status}`);
  }
  const data = (await response.json()) as { pages?: unknown };
  if (!Array.isArray(data.pages)) return [];
  return data.pages.flatMap((page): WikipediaSuggestion[] => {
    if (!page || typeof page !== "object") return [];
    const record = page as Record<string, unknown>;
    const title = plainText(record.title);
    if (!title) return [];
    return [
      {
        title,
        description: plainText(record.description),
      },
    ];
  });
}

export async function fetchArticleRedirectAliases(title: string): Promise<string[]> {
  const cacheKey = normalizeTitle(title);
  const cached = redirectsCache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await wikiFetch({
      action: "query",
      prop: "redirects",
      rdlimit: "max",
      titles: title,
    });
    const pages = data.query?.pages;
    const page = pages ? (Object.values(pages)[0] as any) : null;
    const aliases = Array.isArray(page?.redirects)
      ? page.redirects
          .map((redirect: any) => (typeof redirect?.title === "string" ? redirect.title : null))
          .filter((value: string | null): value is string => value !== null)
      : [];
    redirectsCache.set(cacheKey, aliases);
    return aliases;
  } catch {
    redirectsCache.set(cacheKey, []);
    return [];
  }
}

export async function fetchArticleDescription(title: string): Promise<string | null> {
  const cacheKey = normalizeTitle(title);
  const cached = descriptionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const data = await wikiFetch({
      action: "query",
      prop: "description",
      redirects: "1",
      titles: title,
    });
    const pages = data.query?.pages;
    const page = pages ? (Object.values(pages)[0] as any) : null;
    const description = plainText(page?.description);
    descriptionCache.set(cacheKey, description);
    return description;
  } catch {
    descriptionCache.set(cacheKey, null);
    return null;
  }
}

/** Does an article exist (following redirects)? Returns its canonical title. */
export async function resolveArticle(title: string): Promise<string | null> {
  const data = await wikiFetch({
    action: "query",
    titles: title,
    redirects: "1",
  });
  const pages = data.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0] as any;
  if (!page || page.missing !== undefined || page.invalid !== undefined) return null;
  return page.title as string;
}

const ALLOWED_IMAGE_HOSTS = new Set([
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "en.wikipedia.org",
]);

function normalizeImageSrc(src: string | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("data:image/")) return src;
  let url = src;
  if (url.startsWith("//")) url = `https:${url}`;
  if (url.startsWith("/")) url = `https://en.wikipedia.org${url}`;
  try {
    const parsed = new URL(url);
    parsed.protocol = "https:";
    if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitize Wikipedia `action=parse` HTML for in-game rendering.
 *
 * - allowlisted structural tags only; scripts/styles/iframes dropped with contents
 * - Wikipedia chrome removed (edit links, reference markers, reference lists, nav aids)
 * - internal /wiki/<Title> anchors become <a class="wiki-link" data-article>
 *   ONLY when the target is in the article's validated link set; everything
 *   else (external links, fragments, non-validated targets) is demoted to a
 *   plain <span> so the client cannot render an illegal clickable move
 * - images restricted to Wikimedia hosts, lazy-loaded
 */
export function sanitizeWikipediaHtml(html: string, validLinks: string[]): string {
  const validLinkSet = new Set(validLinks.map(normalizeTitle));

  return sanitizeHtml(html, {
    allowedTags: [
      "a",
      "abbr",
      "b",
      "bdi",
      "blockquote",
      "br",
      "caption",
      "cite",
      "code",
      "dd",
      "div",
      "dl",
      "dt",
      "em",
      "figcaption",
      "figure",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "q",
      "s",
      "small",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
      "wbr",
    ],
    nonTextTags: ["script", "style", "iframe", "object", "embed", "noscript", "textarea"],
    allowedAttributes: {
      a: ["href", "class", "data-article", "title"],
      img: ["src", "alt", "width", "height", "class", "loading"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      div: ["class"],
      span: ["class"],
      table: ["class"],
      ol: ["class"],
      ul: ["class"],
    },
    exclusiveFilter(frame) {
      const cls = frame.attribs?.class ?? "";
      if (frame.tag === "span" && cls.includes("mw-editsection")) return true;
      if (frame.tag === "sup" && cls.includes("reference")) return true;
      if (cls.includes("noprint")) return true;
      if (cls.includes("mw-jump-link")) return true;
      if (frame.tag === "ol" && cls.includes("references")) return true;
      if (frame.tag === "div" && (cls.includes("reflist") || cls.includes("refbegin"))) return true;
      return false;
    },
    transformTags: {
      a(tagName, attribs) {
        const href = attribs.href ?? "";
        const match = href.match(/^\/wiki\/([^#?]+)/);
        if (match) {
          let decoded: string;
          try {
            decoded = decodeURIComponent(match[1]);
          } catch {
            decoded = match[1];
          }
          if (validLinkSet.has(normalizeTitle(decoded))) {
            const attrs: Record<string, string> = {
              href: `#${encodeURIComponent(decoded)}`,
              class: "wiki-link",
              "data-article": toDisplayTitle(decoded),
            };
            return { tagName: "a", attribs: attrs };
          }
        }
        // External link, fragment, or non-validated target: keep text only.
        const deadAttrs: Record<string, string> = { class: "wiki-dead-link" };
        return { tagName: "span", attribs: deadAttrs };
      },
      img(tagName, attribs) {
        const src = normalizeImageSrc(attribs.src);
        if (!src) return { tagName: "span", attribs: {} };
        const imgAttrs: Record<string, string> = {
          src,
          alt: attribs.alt ?? "",
          loading: "lazy",
          class: attribs.class ?? "",
        };
        if (attribs.width) imgAttrs.width = attribs.width;
        if (attribs.height) imgAttrs.height = attribs.height;
        return { tagName: "img", attribs: imgAttrs };
      },
    },
  });
}
