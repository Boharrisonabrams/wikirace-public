import type { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ExpandableFinisherRowProps {
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  path?: string[];
}

export default function ExpandableFinisherRow({
  children,
  expanded,
  onToggle,
  path,
}: ExpandableFinisherRowProps) {
  const canExpand = Array.isArray(path) && path.length > 0;
  const Wrapper = canExpand ? "button" : "div";

  return (
    <li className="border-b border-[var(--wiki-soft)] last:border-b-0">
      <Wrapper
        {...(canExpand
          ? {
              "aria-expanded": expanded,
              "aria-label": expanded ? "Hide finisher path" : "Reveal finisher path",
              onClick: onToggle,
              type: "button" as const,
            }
          : {})}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left ${canExpand ? "cursor-pointer hover:bg-[var(--wiki-chrome)]" : ""}`}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {canExpand ? (
          <div className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <span>{expanded ? "Hide path" : "Reveal path"}</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        ) : null}
      </Wrapper>
      {canExpand && expanded ? (
        <div
          className="border-t border-[var(--wiki-hairline)] bg-[var(--wiki-chrome)] px-4 py-3"
          data-testid="finisher-path"
        >
          <ol className="space-y-1 text-sm">
            {path.map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-2">
                <span className="tabular w-6 shrink-0 text-right text-muted-foreground">
                  {index + 1}.
                </span>
                <span className="text-[var(--wiki-blue)]">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </li>
  );
}
