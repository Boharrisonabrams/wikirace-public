import { type ReactNode, useEffect, useRef, useState } from "react";
import { Undo2, Flag } from "lucide-react";

import { formatTime } from "@/lib/game-utils";
import type { GameSession } from "@/lib/store/game-store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GameHeaderProps {
  elapsedSeconds: number;
  session: GameSession;
  moving: boolean;
  onBack: () => void;
  onGiveUp: () => void;
  searchControl?: ReactNode;
}

/**
 * Sticky game chrome: target, clicks, timer, back + give up, and the path
 * trail — your route so far, rendered as a chain of wiki links.
 */
export default function GameHeader({
  elapsedSeconds,
  session,
  moving,
  onBack,
  onGiveUp,
  searchControl,
}: GameHeaderProps) {
  const trailRef = useRef<HTMLDivElement>(null);
  const [targetOpen, setTargetOpen] = useState(false);

  useEffect(() => {
    // keep the newest hop visible
    trailRef.current?.scrollTo({ left: trailRef.current.scrollWidth });
  }, [session.path.length]);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--wiki-rule)] bg-[var(--wiki-chrome)]/95 backdrop-blur">
      <div className="mx-auto max-w-2xl px-3 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Find your way to
            </div>
            {session.endDescription ? (
              <Popover open={targetOpen} onOpenChange={setTargetOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="truncate font-serif text-left text-lg font-semibold leading-tight text-[var(--wiki-blue-dark)] underline decoration-dotted underline-offset-4"
                    type="button"
                  >
                    {session.endArticle}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="max-w-xs border-[var(--wiki-rule)] bg-white text-sm"
                >
                  <p className="font-semibold text-foreground">
                    Exact page: {session.endArticle}
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">
                    {session.endDescription}
                  </p>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="truncate font-serif text-lg font-semibold leading-tight text-[var(--wiki-blue-dark)]">
                {session.endArticle}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-sm">
            {searchControl}
            <span className="tabular rounded border border-[var(--wiki-hairline)] bg-white px-2 py-1 font-medium">
              {session.clicks} {session.clicks === 1 ? "click" : "clicks"}
            </span>
            <span className="tabular rounded border border-[var(--wiki-hairline)] bg-white px-2 py-1 font-mono text-[13px]">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div className="mt-1.5 flex items-center gap-1 pb-1.5">
          <button
            onClick={onBack}
            disabled={session.path.length <= 1 || moving}
            aria-label="Go back one article (counts as a click)"
            title="Back (counts as a click)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[var(--wiki-hairline)] bg-white text-muted-foreground disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <div
            ref={trailRef}
            className="path-trail flex-1 whitespace-nowrap text-[13px] leading-9"
          >
            {session.path.map((step, i) => (
              <span key={`${step}-${i}`}>
                {i > 0 && <span className="mx-1 text-muted-foreground">→</span>}
                <span
                  className={
                    i === session.path.length - 1
                      ? "font-semibold text-foreground"
                      : "text-[var(--wiki-blue)]"
                  }
                >
                  {step}
                </span>
              </span>
            ))}
          </div>
          <button
            onClick={onGiveUp}
            className="flex h-9 shrink-0 items-center gap-1 rounded border border-[var(--wiki-hairline)] bg-white px-2.5 text-[13px] font-medium text-[var(--wiki-red)]"
          >
            <Flag className="h-3.5 w-3.5" />
            Give up
          </button>
        </div>
      </div>
    </header>
  );
}
