import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useLocation } from "wouter";

import GameSearchPanel from "@/components/GameSearchPanel";
import { useGameStore, type ChallengeType } from "@/lib/store/game-store";
import ArticleBrowser from "@/components/ArticleBrowser";
import GameHeader from "@/components/GameHeader";
import GameResultScreen from "@/components/GameResultScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildArticleFindPresentation,
  createArticleFindState,
  createDomArticleFindController,
  resetArticleFindState,
  updateArticleFindQuery,
  type FindSnippet,
} from "@/lib/article-find";
import {
  transitionGameTiming,
  type GameTimingActionResponse,
} from "@/lib/api";
import {
  createActiveTimerState,
  createTimingRequestCoordinator,
  displayedActiveTimeMs,
  reconcileActiveTimer,
  reduceActiveTimer,
  type ActiveTimerEvent,
  type ClientTimingAction,
  type TimingSessionToken,
} from "@/lib/active-timer";
import type { ArticleLinkEntry } from "@/lib/article-links";
import {
  buildSearchSections,
  resolveLinkSearchMode,
  type LinkMatch,
} from "@/lib/game-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * /game?type=daily&challengeId=X
 * /game?type=practice
 * /game?type=friend&friendChallengeId=X
 *
 * Articles come from the server; the URL never carries start/end.
 */
export default function GamePage() {
  const [, navigate] = useLocation();
  const {
    session,
    status,
    error,
    moving,
    result,
    start,
    navigate: move,
    goBack,
    giveUp,
    reset,
  } = useGameStore();
  const isMobile = useIsMobile();
  const [invalidMove, setInvalidMove] = useState<string | null>(null);
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [linkInventory, setLinkInventory] = useState<ArticleLinkEntry[] | null>(
    null,
  );
  const [findPending, setFindPending] = useState(false);
  const [findState, setFindState] = useState(createArticleFindState);
  const [findSnippets, setFindSnippets] = useState<FindSnippet[]>([]);
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  const articleFindControllerRef = useRef(
    createDomArticleFindController({
      onUpdate(snapshot) {
        setFindPending(false);
        setFindSnippets(snapshot.snippets);
        setFindState((current) => ({
          ...current,
          total: snapshot.total,
          activeIndex: snapshot.activeIndex,
        }));
      },
    }),
  );
  const timerStateRef = useRef(
    createActiveTimerState({
      appActive: document.visibilityState === "visible",
    }),
  );
  const timingCoordinatorRef = useRef(createTimingRequestCoordinator());
  const timingSessionTokenRef = useRef<TimingSessionToken | null>(null);

  function refreshTimerDisplay(nowMs = Date.now()) {
    if (!mountedRef.current) return;
    setActiveTimeMs(displayedActiveTimeMs(timerStateRef.current, nowMs));
  }

  function enqueueTimingAction(
    token: TimingSessionToken,
    action: ClientTimingAction,
  ): Promise<void> {
    return timingCoordinatorRef.current.enqueue({
      token,
      request: () =>
        transitionGameTiming({
          sessionId: token.sessionId,
          action,
          eventId: crypto.randomUUID(),
        }),
      onResponse: (server: GameTimingActionResponse) => {
        timerStateRef.current = reconcileActiveTimer(
          timerStateRef.current,
          server,
          Date.now(),
        );
        refreshTimerDisplay();
      },
      onError: () => {
        const current = timerStateRef.current;
        timerStateRef.current = {
          ...current,
          activeTimeMs: displayedActiveTimeMs(current, Date.now()),
          activeSinceMs: null,
          lastHeartbeatAtMs: null,
          timingActive: false,
        };
        refreshTimerDisplay();
      },
    });
  }

  function applyTimerEvent(
    event: ActiveTimerEvent,
    sync = true,
  ): Promise<void> {
    const decision = reduceActiveTimer(timerStateRef.current, event);
    timerStateRef.current = decision.state;
    refreshTimerDisplay(event.nowMs);
    const token = timingSessionTokenRef.current;
    return sync && decision.action && token
      ? enqueueTimingAction(token, decision.action)
      : Promise.resolve();
  }

  function installSessionTimer(
    sessionId: string,
    sessionActiveTimeMs: number,
    timingActive: boolean,
  ) {
    const nowMs = Date.now();
    const appActive = timerStateRef.current.appActive;
    timingSessionTokenRef.current =
      timingCoordinatorRef.current.beginSession(sessionId);
    timerStateRef.current = createActiveTimerState({
      activeTimeMs: sessionActiveTimeMs,
      appActive,
      timingActive,
      nowMs,
    });
    refreshTimerDisplay(nowMs);
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const type = (params.get("type") ?? "practice") as ChallengeType;
    const challengeId = params.get("challengeId");
    const friendChallengeId = params.get("friendChallengeId");

    if (type === "daily" && !challengeId) {
      navigate("/");
      return;
    }
    if (type === "friend" && !friendChallengeId) {
      navigate("/");
      return;
    }

    start({ challengeType: type, challengeId, friendChallengeId });
  }, []);

  useEffect(() => {
    if (!session || status !== "playing") return;
    if (timingSessionTokenRef.current?.sessionId === session.id) return;
    installSessionTimer(
      session.id,
      session.activeTimeMs ?? 0,
      session.timingActive ?? false,
    );
  }, [session, status]);

  async function handleNavigate(article: string) {
    setInvalidMove(null);
    setSearchOpen(false);
    void applyTimerEvent({ type: "move-start", nowMs: Date.now() }, false);
    try {
      const outcome = await move(article);
      if (outcome && "invalid" in outcome) {
        void applyTimerEvent({ type: "move-failed", nowMs: Date.now() });
        setInvalidMove(outcome.invalid);
        setTimeout(() => setInvalidMove(null), 3000);
      }
    } catch {
      void applyTimerEvent({ type: "move-failed", nowMs: Date.now() });
      setInvalidMove(
        "Connection hiccup — that click did not count. Try again.",
      );
      setTimeout(() => setInvalidMove(null), 3000);
    }
  }

  async function handleBack() {
    void applyTimerEvent({ type: "move-start", nowMs: Date.now() }, false);
    const moved = await goBack();
    if (!moved) {
      void applyTimerEvent({ type: "move-failed", nowMs: Date.now() });
    }
  }

  async function handleGiveUp() {
    void applyTimerEvent({ type: "move-start", nowMs: Date.now() }, false);
    await giveUp();
  }

  function handlePlayAgain() {
    reset();
    startedRef.current = false;
    navigate("/game?type=practice", { replace: true });
    // route stays the same component; restart manually
    start({ challengeType: "practice" });
    startedRef.current = true;
  }

  const currentArticle = session?.path?.[session.path.length - 1] ?? "";
  const linkSearch = session
    ? resolveLinkSearchMode({
        challengeType: session.challengeType,
        isOfficial: session.isOfficial,
        searchTier: session.searchTier,
      })
    : { mode: "palette" as const, minLinkChars: 0 };
  const findOnlySearch = linkSearch.mode === "hidden";
  const findPresentation = useMemo(
    () =>
      buildArticleFindPresentation({
        articleTitle,
        pending: findPending,
        state: findState,
      }),
    [articleTitle, findPending, findState],
  );
  const findNavigationDisabled = moving || findState.total === 0;
  const searchSections = useMemo(
    () =>
      buildSearchSections({
        query: searchQuery,
        linkSearchMode: linkSearch.mode,
        minLinkChars: linkSearch.minLinkChars,
        inventory: linkInventory,
        snippets: findSnippets,
        textTotal: findState.total,
        textPending: findPending,
      }),
    [findPending, findSnippets, findState.total, linkInventory, linkSearch, searchQuery],
  );

  useEffect(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setArticleTitle(currentArticle);
    setLinkInventory(null);
    setFindPending(false);
    setFindSnippets([]);
    setFindState(resetArticleFindState());
    articleFindControllerRef.current.clear();
    if (currentArticle) {
      void applyTimerEvent({ type: "article-loading", nowMs: Date.now() });
    }
  }, [currentArticle]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      void applyTimerEvent({
        type: "app-state",
        appActive: document.visibilityState === "visible",
        nowMs: Date.now(),
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    handleVisibilityChange();
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!session?.id || status !== "playing") return;
    const timer = window.setInterval(() => {
      const nowMs = Date.now();
      refreshTimerDisplay(nowMs);
      void applyTimerEvent({ type: "heartbeat-tick", nowMs });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      articleFindControllerRef.current.dispose();
      const token = timingSessionTokenRef.current;
      if (!token) return;
      const decision = reduceActiveTimer(timerStateRef.current, {
        type: "screen-exit",
        nowMs: Date.now(),
      });
      timerStateRef.current = decision.state;
      void timingCoordinatorRef.current.finalizeSession({
        token,
        request: () =>
          decision.action
            ? transitionGameTiming({
                sessionId: token.sessionId,
                action: decision.action,
                eventId: crypto.randomUUID(),
              })
            : Promise.resolve(),
      });
      timingSessionTokenRef.current = null;
    };
  }, []);

  const handleArticleReady = useCallback(
    (payload: {
      contentElement: HTMLDivElement;
      title: string;
      links: ArticleLinkEntry[];
    }) => {
      setArticleTitle(payload.title);
      setLinkInventory(payload.links);
      articleFindControllerRef.current.attach(payload.contentElement, searchQuery);
      if (searchQuery.trim()) {
        setFindPending(true);
        articleFindControllerRef.current.search(searchQuery);
      }
      void applyTimerEvent({ type: "webview-ready", nowMs: Date.now() });
    },
    [searchQuery],
  );

  useEffect(() => {
    setFindState((current) => updateArticleFindQuery(current, searchQuery));
    if (!searchQuery.trim()) {
      setFindPending(false);
      setFindSnippets([]);
      articleFindControllerRef.current.clear();
      return;
    }
    setFindPending(true);
    articleFindControllerRef.current.search(searchQuery);
  }, [searchQuery]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[var(--wiki-hairline)] border-t-[var(--wiki-blue)]" />
          <p className="text-sm text-muted-foreground">
            Opening the encyclopedia…
          </p>
        </div>
      </div>
    );
  }

  if (status === "error" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--wiki-chrome)] px-4">
        <div className="w-full max-w-sm border border-[var(--wiki-rule)] bg-white p-6 text-center">
          <h1 className="mb-2 font-serif text-2xl">Couldn't start the game</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {error ?? "Something went wrong."}
          </p>
          <button
            onClick={() =>
              navigate(error === "Sign in to play" ? "/login" : "/")
            }
            className="min-h-12 w-full rounded-[var(--radius)] bg-primary px-4 py-3 font-semibold text-primary-foreground"
          >
            {error === "Sign in to play" ? "Sign in" : "Back to home"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "finished" && result) {
    return (
      <div className="min-h-screen bg-[var(--wiki-chrome)]">
        <GameResultScreen
          session={session}
          result={result}
          onPlayAgain={handlePlayAgain}
        />
      </div>
    );
  }

  function handlePickLink(match: LinkMatch) {
    if (moving) return;
    void handleNavigate(match.link.article);
  }

  function handlePickSnippet(snippet: FindSnippet) {
    if (moving) return;
    articleFindControllerRef.current.activate(snippet.index);
  }

  const desktopSearchControl = (
    <button
      className="hidden h-9 max-w-[11rem] items-center gap-2 rounded border border-[var(--wiki-hairline)] bg-white px-3 text-[13px] font-medium text-[var(--wiki-blue)] md:flex"
      type="button"
      onClick={() => setSearchOpen(true)}
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {searchQuery.trim()
          ? searchQuery
          : findOnlySearch
            ? "Find in article"
            : "Search page"}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-white">
      <GameHeader
        elapsedSeconds={Math.floor(activeTimeMs / 1000)}
        session={session}
        moving={moving}
        onBack={() => void handleBack()}
        onGiveUp={() => setConfirmGiveUp(true)}
        searchControl={desktopSearchControl}
      />

      {invalidMove && (
        <div
          role="status"
          className="sticky top-[104px] z-10 mx-auto max-w-2xl px-3 pt-2"
        >
          <div className="rounded border border-[var(--wiki-red)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--wiki-red)]">
            {invalidMove}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-4 pb-24 md:pb-4">
        <ArticleBrowser
          article={currentArticle}
          busy={moving}
          onArticleReady={handleArticleReady}
          onNavigate={handleNavigate}
        />
      </main>

      <GameSearchPanel
        articleTitle={articleTitle}
        findNavigationDisabled={findNavigationDisabled}
        findOnly={findOnlySearch}
        presentation={findPresentation}
        isMobile={isMobile}
        navigationDisabled={moving}
        open={searchOpen}
        query={searchQuery}
        sections={searchSections}
        onNavigateFind={(direction) =>
          articleFindControllerRef.current.navigate(direction)
        }
        onChangeQuery={setSearchQuery}
        onClear={() => setSearchQuery("")}
        onOpenChange={setSearchOpen}
        onPickLink={handlePickLink}
        onPickSnippet={handlePickSnippet}
      />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--wiki-rule)] bg-[var(--wiki-chrome)]/95 px-3 py-2 backdrop-blur md:hidden">
        <button
          className="flex h-12 w-full items-center gap-3 rounded border border-[var(--wiki-hairline)] bg-white px-4 text-left"
          type="button"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--wiki-blue)]" />
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
            {searchQuery.trim()
              ? searchQuery
              : findOnlySearch
                ? "Find in article"
                : "Search page"}
          </span>
          {searchSections.text.status === "results" ? (
            <span className="rounded border border-[var(--wiki-hairline)] px-2 py-1 font-mono text-[11px] text-muted-foreground">
              {searchSections.text.total}
            </span>
          ) : null}
        </button>
      </div>

      <AlertDialog open={confirmGiveUp} onOpenChange={setConfirmGiveUp}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">
              Give up this run?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The run ends and counts as unfinished. You were {session.clicks}{" "}
              {session.clicks === 1 ? "click" : "clicks"} in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep playing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--wiki-red)] hover:bg-[var(--wiki-red)]"
              onClick={() => void handleGiveUp()}
            >
              Give up
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
