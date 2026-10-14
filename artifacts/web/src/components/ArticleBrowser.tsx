import { useEffect, useRef, useState } from "react";

import {
  collectArticleLinks,
  type ArticleLinkEntry,
} from "@/lib/article-links";

interface ArticleData {
  title: string;
  html: string;
}

interface ArticleBrowserProps {
  article: string;
  /** disable link taps while a move is being validated */
  busy: boolean;
  onNavigate: (article: string) => void;
  onArticleReady?: (payload: {
    contentElement: HTMLDivElement;
    title: string;
    links: ArticleLinkEntry[];
  }) => void;
}

/**
 * Renders a server-sanitized Wikipedia article and turns .wiki-link taps
 * into game moves. Only anchors the server validated are clickable at all.
 */
export default function ArticleBrowser({
  article,
  busy,
  onNavigate,
  onArticleReady,
}: ArticleBrowserProps) {
  const [data, setData] = useState<ArticleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigateRef = useRef(onNavigate);
  const articleReadyRef = useRef(onArticleReady);
  const busyRef = useRef(busy);
  navigateRef.current = onNavigate;
  articleReadyRef.current = onArticleReady;
  busyRef.current = busy;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/wikipedia/article/${encodeURIComponent(article)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load this article");
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData({ title: json.title, html: json.html });
        setLoading(false);
        window.scrollTo({ top: 0 });
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          "Could not load this article. Check your connection and try again.",
        );
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [article]);

  useEffect(() => {
    // depends on `data`: the <article> only mounts once content is loaded
    const container = containerRef.current;
    if (!container) return;

    function handleClick(event: MouseEvent) {
      const target = (event.target as HTMLElement).closest("a.wiki-link");
      if (!target) return;
      event.preventDefault();
      if (busyRef.current) return;
      const next = target.getAttribute("data-article");
      if (next) navigateRef.current(next);
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [data]);

  useEffect(() => {
    if (!data || !contentRef.current) return;
    articleReadyRef.current?.({
      contentElement: contentRef.current,
      title: data.title,
      links: collectArticleLinks(contentRef.current),
    });
  }, [data]);

  if (loading) {
    return (
      <div
        className="animate-pulse space-y-3 py-6"
        aria-label="Loading article"
      >
        <div className="h-7 w-2/3 rounded bg-[var(--wiki-soft)]" />
        <div className="h-4 rounded bg-[var(--wiki-soft)]" />
        <div className="h-4 rounded bg-[var(--wiki-soft)]" />
        <div className="h-4 w-5/6 rounded bg-[var(--wiki-soft)]" />
        <div className="h-40 rounded bg-[var(--wiki-soft)]" />
        <div className="h-4 rounded bg-[var(--wiki-soft)]" />
        <div className="h-4 w-4/6 rounded bg-[var(--wiki-soft)]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            setData(null);
            // retrigger by re-fetching via state change
            fetch(`/api/wikipedia/article/${encodeURIComponent(article)}`)
              .then((res) => res.json())
              .then((json) => {
                setData({ title: json.title, html: json.html });
                setLoading(false);
              })
              .catch(() => {
                setError(
                  "Could not load this article. Check your connection and try again.",
                );
                setLoading(false);
              });
          }}
          className="rounded-[var(--radius)] border border-[var(--wiki-rule)] bg-white px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <article
      ref={containerRef}
      className={busy ? "opacity-60 transition-opacity" : ""}
    >
      <h1 className="mb-1 border-b border-[var(--wiki-hairline)] pb-2 font-serif text-3xl leading-tight">
        {data.title}
      </h1>
      <p className="mb-4 text-xs text-muted-foreground">
        From Wikipedia, the free encyclopedia
      </p>
      <div
        ref={contentRef}
        className="wiki-article"
        dangerouslySetInnerHTML={{ __html: data.html }}
      />
    </article>
  );
}
