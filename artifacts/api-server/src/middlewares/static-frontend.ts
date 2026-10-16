import { readFile } from "node:fs/promises";
import path from "node:path";
import express, { type Express } from "express";
import { getPublicAppUrl } from "../lib/public-app-url";
import { challengePreviewLimiter } from "./rate-limit";

const NO_CACHE = "no-cache";
const CHALLENGE_PREVIEW_CACHE = "public, max-age=300, stale-while-revalidate=86400";
const MAX_PREVIEW_CACHE_ENTRIES = 500;
const CHALLENGE_REFERENCE =
  /^(?:[a-zA-Z0-9_-]{6,16}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export type ChallengePreviewMetadata = {
  code: string;
  endTitle: string;
  startTitle: string;
};

type StaticFrontendOptions = {
  loadChallengePreview?: (code: string) => Promise<ChallengePreviewMetadata | null>;
  publicAppUrl?: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function replaceMeta(
  html: string,
  attribute: "name" | "property",
  key: string,
  value: string
): string {
  const escaped = escapeHtml(value);
  const pattern = new RegExp(`<meta\\s+${attribute}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attribute}="${key}" content="${escaped}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

export function challengePreviewHtml(
  html: string,
  challenge: ChallengePreviewMetadata,
  publicAppUrl: string
): string {
  const title = `${challenge.startTitle} → ${challenge.endTitle} | WikiRace`;
  const description = `Can you find the path from ${challenge.startTitle} to ${challenge.endTitle}?`;
  const url = `${publicAppUrl.replace(/\/$/, "")}/challenge/${challenge.code}`;
  let result = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  result = replaceMeta(result, "property", "og:title", title);
  result = replaceMeta(result, "property", "og:description", description);
  result = replaceMeta(result, "property", "og:url", url);
  result = replaceMeta(
    result,
    "property",
    "og:image",
    `${publicAppUrl.replace(/\/$/, "")}/wikirace-share-card.jpg`
  );
  result = replaceMeta(result, "name", "twitter:title", title);
  result = replaceMeta(result, "name", "twitter:description", description);
  result = replaceMeta(
    result,
    "name",
    "twitter:image",
    `${publicAppUrl.replace(/\/$/, "")}/wikirace-share-card.jpg`
  );
  return result;
}

export function mountStaticFrontend(
  app: Express,
  dir: string,
  options: StaticFrontendOptions = {}
) {
  if (options.loadChallengePreview) {
    const previewHtmlCache = new Map<string, string>();
    let indexHtml: Promise<string> | null = null;
    app.get("/challenge/:code", challengePreviewLimiter, async (req, res, next) => {
      const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
      if (!code || !CHALLENGE_REFERENCE.test(code)) {
        next();
        return;
      }
      try {
        const cached = previewHtmlCache.get(code);
        if (cached) {
          res.setHeader("Cache-Control", CHALLENGE_PREVIEW_CACHE).type("html").send(cached);
          return;
        }
        const challenge = await options.loadChallengePreview?.(code);
        if (!challenge) {
          next();
          return;
        }
        indexHtml ??= readFile(path.join(dir, "index.html"), "utf8");
        const html = challengePreviewHtml(
          await indexHtml,
          challenge,
          options.publicAppUrl ?? getPublicAppUrl()
        );
        if (previewHtmlCache.size >= MAX_PREVIEW_CACHE_ENTRIES) {
          const oldest = previewHtmlCache.keys().next().value;
          if (oldest) previewHtmlCache.delete(oldest);
        }
        previewHtmlCache.set(code, html);
        res.setHeader("Cache-Control", CHALLENGE_PREVIEW_CACHE).type("html").send(html);
      } catch {
        req.log?.warn("Challenge preview metadata unavailable");
        next();
      }
    });
  }

  app.use(
    express.static(dir, {
      index: false,
      etag: true,
      maxAge: "1y",
      immutable: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", NO_CACHE);
        }
      },
    })
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }

    if (req.path.startsWith("/api")) {
      next();
      return;
    }

    res.sendFile("index.html", {
      root: dir,
      headers: {
        "Cache-Control": NO_CACHE,
      },
    });
  });
}
