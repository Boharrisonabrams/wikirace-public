import { ChevronDown, ChevronUp, Link2, Lock, Search } from "lucide-react";

import { type ReactNode, useEffect, useRef } from "react";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ArticleFindPresentation,
  FindDirection,
  FindSnippet,
} from "@/lib/article-find";
import type {
  LinkMatch,
  SearchSections,
} from "@/lib/game-search";
import { linkRowSubtitle, splitByRange, splitSnippet } from "@/lib/game-search";
import { cn } from "@/lib/utils";

interface GameSearchPanelProps {
  articleTitle: string;
  findNavigationDisabled: boolean;
  findOnly: boolean;
  presentation: ArticleFindPresentation;
  isMobile: boolean;
  navigationDisabled: boolean;
  open: boolean;
  query: string;
  sections: SearchSections;
  onNavigateFind: (direction: FindDirection) => void;
  onChangeQuery: (query: string) => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  onPickLink: (match: LinkMatch) => void;
  onPickSnippet: (snippet: FindSnippet) => void;
}

export default function GameSearchPanel({
  articleTitle,
  findNavigationDisabled,
  findOnly,
  presentation,
  isMobile,
  navigationDisabled,
  open,
  query,
  sections,
  onNavigateFind,
  onChangeQuery,
  onClear,
  onOpenChange,
  onPickLink,
  onPickSnippet,
}: GameSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const body = (
    <div
      className="flex h-full flex-col overflow-hidden bg-[var(--wiki-chrome)] text-[var(--wiki-ink)]"
      data-testid="game-search-panel"
    >
      {!isMobile && (
        <DialogHeader className="border-b border-[var(--wiki-hairline)] px-4 py-3 text-left">
          <DialogTitle className="font-serif text-xl">
            {findOnly ? "Find in this article" : "Search this race page"}
          </DialogTitle>
          <DialogDescription>
            {findOnly
              ? "Highlight article text matches and step through them."
              : "Search legal wiki links and article text. Every link selection still goes through the server move check."}
          </DialogDescription>
        </DialogHeader>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {sections.links.status !== "hidden" ? (
          <SearchSection
            count={
              sections.links.status === "browse"
                ? `${sections.links.totalLinks}`
                : sections.links.status === "results"
                  ? `${sections.links.items.length}`
                  : ""
            }
            hint={
              sections.links.status === "loading"
                ? "Reading this page’s legal links…"
                : sections.links.hint
            }
            hintTestId="search-links-hint"
            sectionTestId="search-links-section"
            title="Links on this page"
          >
            {sections.links.items.map((match, index) => (
              <SearchRow
                testId={`search-link-row-${index}`}
                key={`link:${index}:${match.link.article}`}
                disabled={navigationDisabled}
                icon={<Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wiki-blue)]" />}
                subtitle={linkRowSubtitle(match.link)}
                titleParts={splitByRange(match.link.text, match.textRange)}
                onClick={() => onPickLink(match)}
              />
            ))}
          </SearchSection>
        ) : null}

        <SearchSection
          count={
            sections.text.status === "results" ? `${sections.text.total}` : ""
          }
          hint={
            sections.text.status === "idle"
              ? "Type to search the article text."
              : sections.text.status === "searching"
                ? "Searching…"
                : sections.text.status === "empty"
                  ? "No matches in the article text."
                  : null
          }
          hintTestId="search-text-hint"
          sectionTestId="search-text-section"
          title="In the article"
        >
          {sections.text.snippets.map((snippet) => (
            <SearchRow
              testId={`search-text-row-${snippet.index}`}
              key={`snippet:${snippet.index}`}
              disabled={navigationDisabled}
              icon={<Search className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wiki-gold)]" />}
              subtitle="Jump to this match"
              titleParts={splitSnippet(snippet)}
              onClick={() => onPickSnippet(snippet)}
            />
          ))}
        </SearchSection>
      </div>

      <div className="border-t border-[var(--wiki-hairline)] bg-[var(--wiki-chrome)] px-3 py-3">
        <label
          className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          htmlFor="game-search-input"
        >
          {findOnly ? "Find in article" : "Search page"}
        </label>
        <div className="flex items-center gap-2 rounded border border-[var(--wiki-hairline)] bg-white px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            id="game-search-input"
            ref={inputRef}
            autoCapitalize="none"
            autoCorrect="off"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            placeholder={
              articleTitle
                ? findOnly
                  ? `Find in ${articleTitle}`
                  : `Search ${articleTitle}`
                : findOnly
                  ? "Find in this page"
                  : "Search this page"
            }
            type="text"
            value={query}
            onChange={(event) => onChangeQuery(event.target.value)}
          />
          {query ? (
            <button
              className="text-sm font-medium text-[var(--wiki-blue)]"
              type="button"
              onClick={onClear}
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{presentation.statusLabel}</span>
          <div className="flex items-center gap-2">
            <span
              className="min-w-[3.75rem] text-right font-mono text-[11px]"
              data-testid="search-count"
            >
              {presentation.counterLabel}
            </span>
            <button
              className="rounded border border-[var(--wiki-hairline)] bg-white p-2 disabled:opacity-50"
              disabled={findNavigationDisabled}
              type="button"
              onClick={() => onNavigateFind("previous")}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              className="rounded border border-[var(--wiki-hairline)] bg-white p-2 disabled:opacity-50"
              disabled={findNavigationDisabled}
              type="button"
              onClick={() => onNavigateFind("next")}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[78vh] border-[var(--wiki-rule)] bg-[var(--wiki-chrome)] p-0">
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-[var(--wiki-rule)] bg-[var(--wiki-chrome)] p-0">
        {body}
      </DialogContent>
    </Dialog>
  );
}

function SearchSection({
  children,
  count,
  hint,
  hintTestId,
  sectionTestId,
  title,
}: {
  children: ReactNode;
  count: string;
  hint: string | null;
  hintTestId: string;
  sectionTestId: string;
  title: string;
}) {
  return (
    <section className="mb-4 last:mb-0" data-testid={sectionTestId}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h3>
        {count ? (
          <span className="rounded border border-[var(--wiki-hairline)] bg-white px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>

      {children ? <div className="space-y-1">{children}</div> : null}

      {hint ? (
        <div className="mt-1 flex items-start gap-2 rounded border border-dashed border-[var(--wiki-hairline)] bg-white/70 px-3 py-2 text-sm text-muted-foreground">
          {hint.includes("Official race") ? (
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span data-testid={hintTestId}>{hint}</span>
        </div>
      ) : null}
    </section>
  );
}

function SearchRow({
  disabled,
  icon,
  subtitle,
  testId,
  titleParts,
  onClick,
}: {
  disabled: boolean;
  icon: ReactNode;
  subtitle: string | null;
  testId: string;
  titleParts: [string, string, string];
  onClick: () => void;
}) {
  const [before, marked, after] = titleParts;

  return (
    <button
      className={cn(
        "flex w-full items-start gap-3 rounded border border-transparent bg-white px-3 py-2 text-left transition-colors",
        disabled
          ? "opacity-50"
          : "hover:border-[var(--wiki-hairline)] hover:bg-[var(--wiki-surface)]",
      )}
      data-testid={testId}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5">
          {before}
          {marked ? (
            <mark className="bg-amber-100 px-0.5 text-inherit">{marked}</mark>
          ) : null}
          {after}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}
