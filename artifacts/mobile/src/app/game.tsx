import Ionicons from "@expo/vector-icons/Ionicons";
import { randomUUID } from "expo-crypto";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { GamePathMap } from "@/components/game-path-map";
import { GameSearchSheet } from "@/components/game-search-sheet";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  completeGame,
  getArticle,
  navigateGame,
  startGame,
  transitionGameTiming,
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
import {
  applyArticleFindEvent,
  buildArticleFindPresentation,
  createArticleFindState,
  isArticleWebViewEventForDocument,
  parseArticleWebViewEvent,
  resetArticleFindState,
  updateArticleFindQuery,
  type ArticleLinkEntry,
  type ArticleWebViewCommand,
  type FindDirection,
  type FindSnippet,
} from "@/lib/article-find";
import {
  buildSearchSections,
  resolveLinkSearchMode,
  type LinkMatch,
  type SearchSheetMode,
} from "@/lib/game-search";
import { articleShell } from "@/lib/article-shell";
import { buildInternalReturnPath } from "@/lib/auth-flow";
import { deviceTimeZone } from "@/lib/daily-context";
import { formatTime } from "@/lib/game-utils";
import {
  allowsArticleBack,
  createResultCompletionCoordinator,
  noticeForBlockedArticleTap,
  noticeForNavigateFailure,
  shouldCompleteWonSession,
} from "@/lib/game-flow";
import type { ArticleData, ChallengeType, GameSession } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isChallengeType(value: string | undefined): value is ChallengeType {
  return value === "daily" || value === "practice" || value === "friend";
}

function optionalBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

const SEARCH_SCROLL_OFFSET = 24;
const FIND_QUERY_DEBOUNCE_MS = 90;

interface LoadedArticle {
  articleTitle: string;
  documentId: string;
  data: ArticleData;
}

export default function GameScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { colors, isDark } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const webViewRef = useRef<WebView>(null);
  const findInputRef = useRef<TextInput>(null);
  const findQueryRef = useRef("");
  const articleDocumentSequenceRef = useRef(0);
  const { isGuest, loading: authLoading, user } = useAuthSession();
  const typeParam = firstParam(params.type);
  const challengeType: ChallengeType = isChallengeType(typeParam)
    ? typeParam
    : "daily";
  const challengeId = firstParam(params.challengeId);
  const friendChallengeId = firstParam(params.friendChallengeId);
  const dailyDate = firstParam(params.dailyDate);
  const replay = firstParam(params.replay) === "true";
  const routeIsGuest = optionalBoolean(firstParam(params.isGuest));
  const routeClaimed = optionalBoolean(firstParam(params.claimed));
  const gameReturnPath = buildInternalReturnPath("/game", {
    type: challengeType,
    challengeId,
    friendChallengeId,
    dailyDate,
    replay: replay ? "true" : undefined,
    isGuest: routeIsGuest === undefined ? undefined : String(routeIsGuest),
    claimed: routeClaimed === undefined ? undefined : String(routeClaimed),
  });
  const screenTitle =
    challengeType === "practice"
      ? "Practice race"
      : challengeType === "friend"
        ? "Friend race"
        : replay
          ? "Daily replay"
          : "Daily race";

  function resultParams(
    resultSession: GameSession,
    resultGaveUp: boolean,
  ): Record<string, string> {
    const values: Record<string, string> = {
      sessionId: resultSession.id,
      type: challengeType,
      gaveUp: String(resultGaveUp),
    };
    const resultDailyDate = resultSession.localDate ?? dailyDate;
    if (resultDailyDate) values.dailyDate = resultDailyDate;

    if (challengeType === "daily") {
      const resultChallengeId = resultSession.challengeId ?? challengeId;
      if (resultChallengeId) values.challengeId = resultChallengeId;
      values.replay = String(
        resultSession.isOfficial === false ||
          (resultSession.isOfficial == null && replay),
      );
      const resultIsGuest = routeIsGuest ?? isGuest;
      values.isGuest = String(resultIsGuest);
      const resultClaimed = routeClaimed ?? (resultIsGuest ? false : undefined);
      if (resultClaimed !== undefined) {
        values.claimed = String(resultClaimed);
      }
    }

    return values;
  }

  const [session, setSession] = useState<GameSession | null>(null);
  const [loadedArticle, setLoadedArticle] = useState<LoadedArticle | null>(
    null,
  );
  const [starting, setStarting] = useState(true);
  const [articleLoading, setArticleLoading] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const [searchMode, setSearchMode] = useState<SearchSheetMode>("closed");
  const [showTargetInfo, setShowTargetInfo] = useState(false);
  const [findPending, setFindPending] = useState(false);
  const [findState, setFindState] = useState(createArticleFindState);
  const [findSnippets, setFindSnippets] = useState<FindSnippet[]>([]);
  const [linkInventory, setLinkInventory] = useState<ArticleLinkEntry[] | null>(
    null,
  );
  const [keyboardShown, setKeyboardShown] = useState(false);
  const sessionRef = useRef<GameSession | null>(null);
  const timerStateRef = useRef(
    createActiveTimerState({ appActive: AppState.currentState === "active" }),
  );
  const timingCoordinatorRef = useRef(createTimingRequestCoordinator());
  const timingSessionTokenRef = useRef<TimingSessionToken | null>(null);
  const pendingTargetResultRef = useRef<GameSession | null>(null);
  const pendingGiveUpResultRef = useRef<GameSession | null>(null);
  const mountedRef = useRef(true);
  const targetCompletionCoordinatorRef = useRef(
    createResultCompletionCoordinator({
      complete: async (sessionId) => {
        await completeGame(sessionId, false);
      },
      openResult: (sessionId) => {
        const completedSession = pendingTargetResultRef.current;
        if (!completedSession || completedSession.id !== sessionId) return;
        router.replace({
          pathname: "/result",
          params: resultParams(completedSession, false),
        });
      },
    }),
  );
  const giveUpCompletionCoordinatorRef = useRef(
    createResultCompletionCoordinator({
      complete: async (sessionId) => {
        await completeGame(sessionId, true);
      },
      openResult: (sessionId) => {
        const completedSession = pendingGiveUpResultRef.current;
        if (!completedSession || completedSession.id !== sessionId) return;
        router.replace({
          pathname: "/result",
          params: resultParams(completedSession, true),
        });
      },
    }),
  );

  const currentArticle = session?.path[session.path.length - 1] ?? null;
  const activeArticle =
    loadedArticle?.articleTitle === currentArticle ? loadedArticle : null;
  const activeDocumentId = activeArticle?.documentId ?? null;
  const hasFindQuery = findState.query.trim().length > 0;
  const findPresentation = useMemo(
    () =>
      buildArticleFindPresentation({
        articleTitle: currentArticle ?? "this article",
        pending: findPending,
        state: findState,
      }),
    [currentArticle, findPending, findState],
  );
  const findNavigationDisabled = findPending || findState.total === 0;
  const linkSearch = resolveLinkSearchMode({
    challengeType,
    isOfficial: session?.isOfficial ?? true,
    searchTier: session?.searchTier,
  });
  const findOnlySearch = linkSearch.mode === "hidden";
  const searchSections = useMemo(
    () =>
      buildSearchSections({
        query: findState.query,
        linkSearchMode: linkSearch.mode,
        minLinkChars: linkSearch.minLinkChars,
        inventory: linkInventory,
        snippets: findSnippets,
        textTotal: findState.total,
        textPending: findPending,
      }),
    [
      findPending,
      findSnippets,
      findState.query,
      findState.total,
      linkInventory,
      linkSearch,
    ],
  );
  const attemptLabel =
    challengeType === "daily"
      ? session?.isOfficial === false
        ? "Unranked replay"
        : "Official"
      : challengeType === "friend"
        ? "Head-to-head"
        : "Practice";
  const articleBackAllowed = session
    ? allowsArticleBack({
        challengeType,
        isOfficial: session.isOfficial,
      })
    : false;
  const shell = useMemo(
    () =>
      activeArticle
        ? articleShell(
            activeArticle.data.title,
            activeArticle.data.html,
            activeArticle.documentId,
            { ...colors, isDark },
          )
        : null,
    [activeArticle, colors, isDark],
  );

  const postArticleCommand = useCallback((command: ArticleWebViewCommand) => {
    webViewRef.current?.postMessage(JSON.stringify(command));
  }, []);

  const resetFind = useCallback(() => {
    findQueryRef.current = "";
    setFindPending(false);
    setFindState(resetArticleFindState());
    setFindSnippets([]);
  }, []);

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
          eventId: randomUUID(),
        }),
      onResponse: (server) => {
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

  function applyTimerEvent(event: ActiveTimerEvent): Promise<void> {
    const decision = reduceActiveTimer(timerStateRef.current, event);
    timerStateRef.current = decision.state;
    refreshTimerDisplay(event.nowMs);
    const token = timingSessionTokenRef.current;
    return decision.action && token
      ? enqueueTimingAction(token, decision.action)
      : Promise.resolve();
  }

  function installSessionTimer(nextSession: GameSession) {
    const nowMs = Date.now();
    const appActive = timerStateRef.current.appActive;
    sessionRef.current = nextSession;
    timingSessionTokenRef.current = timingCoordinatorRef.current.beginSession(
      nextSession.id,
    );
    timerStateRef.current = createActiveTimerState({
      activeTimeMs: nextSession.activeTimeMs,
      appActive,
      timingActive: nextSession.timingActive,
      nowMs,
    });
    refreshTimerDisplay(nowMs);
    if (nextSession.timingActive) {
      void applyTimerEvent({ type: "article-loading", nowMs });
    }
  }

  useEffect(() => {
    resetFind();
    setLinkInventory(null);
    setSearchMode("closed");
  }, [currentArticle, resetFind]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, () => setKeyboardShown(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (searchMode === "closed" || !shell || !activeDocumentId) return;
    const query = findState.query;
    const timeout = setTimeout(() => {
      postArticleCommand({
        type: "find/query",
        documentId: activeDocumentId,
        query,
        topOffset: SEARCH_SCROLL_OFFSET,
        includeSnippets: true,
        scrollToFirst: true,
      });
    }, FIND_QUERY_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [
    activeDocumentId,
    findState.query,
    postArticleCommand,
    searchMode,
    shell,
  ]);

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      void applyTimerEvent({
        type: "app-state",
        appActive: nextState === "active",
        nowMs: Date.now(),
      });
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    onAppStateChange(AppState.currentState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace({ pathname: "/login", params: { next: gameReturnPath } });
      return;
    }

    let cancelled = false;

    async function boot() {
      setStarting(true);
      setError(null);
      try {
        const data = await startGame({
          challengeType,
          challengeId,
          friendChallengeId,
          ...(challengeType === "daily"
            ? { replay, timeZone: deviceTimeZone() }
            : {}),
        });
        if (cancelled) return;
        if (data.alreadyCompleted) {
          router.replace({
            pathname: "/result",
            params: resultParams(data.session, data.session.gaveUp),
          });
          return;
        }
        if (shouldCompleteWonSession(data.session)) {
          pendingTargetResultRef.current = data.session;
          try {
            await targetCompletionCoordinatorRef.current.completeResult(
              data.session.id,
            );
          } catch {
            router.replace({
              pathname: "/result",
              params: resultParams(data.session, false),
            });
          }
          return;
        }
        installSessionTimer(data.session);
        setSession(data.session);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not start the game",
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    challengeId,
    challengeType,
    dailyDate,
    friendChallengeId,
    gameReturnPath,
    isGuest,
    replay,
    routeClaimed,
    routeIsGuest,
    user,
  ]);

  useEffect(() => {
    if (!currentArticle) return;
    void applyTimerEvent({ type: "article-loading", nowMs: Date.now() });
    const articleTitle = currentArticle;
    const documentId = `${session?.id ?? "session"}:${++articleDocumentSequenceRef.current}`;
    let cancelled = false;

    async function loadArticle() {
      setLoadedArticle(null);
      setArticleLoading(true);
      setError(null);
      try {
        const data = await getArticle(articleTitle);
        if (!cancelled) {
          setLoadedArticle({ articleTitle, documentId, data });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load this article",
          );
        }
      } finally {
        if (!cancelled) setArticleLoading(false);
      }
    }

    void loadArticle();

    return () => {
      cancelled = true;
    };
  }, [currentArticle, session?.id]);

  useEffect(() => {
    if (!session?.id) return;
    const timer = setInterval(() => {
      const nowMs = Date.now();
      refreshTimerDisplay(nowMs);
      void applyTimerEvent({ type: "heartbeat-tick", nowMs });
    }, 1000);
    return () => clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const currentSession = sessionRef.current;
      const timingToken = timingSessionTokenRef.current;
      const decision = reduceActiveTimer(timerStateRef.current, {
        type: "screen-exit",
        nowMs: Date.now(),
      });
      timerStateRef.current = decision.state;
      timingSessionTokenRef.current = null;
      if (currentSession && timingToken) {
        void timingCoordinatorRef.current
          .finalizeSession({
            token: timingToken,
            request: () =>
              transitionGameTiming({
                sessionId: currentSession.id,
                action: "pause",
                eventId: randomUUID(),
              }),
          })
          .catch(() => undefined);
      }
    };
  }, []);

  function openSearch() {
    setSearchMode("expanded");
    requestAnimationFrame(() => findInputRef.current?.focus());
  }

  function closeSearch() {
    if (activeDocumentId) {
      postArticleCommand({
        type: "find/clear",
        documentId: activeDocumentId,
      });
    }
    setSearchMode("closed");
    resetFind();
    Keyboard.dismiss();
  }

  function collapseSearch() {
    if (hasFindQuery) setSearchMode("mini");
    else closeSearch();
  }

  function expandSearch() {
    setSearchMode("expanded");
    requestAnimationFrame(() => findInputRef.current?.focus());
  }

  function handleFindQueryChange(query: string) {
    findQueryRef.current = query;
    setFindPending(query.trim().length > 0);
    setFindState((current) => updateArticleFindQuery(current, query));
    setFindSnippets([]);
    // Refining the query from the mini bar reopens the result list.
    setSearchMode((mode) => (mode === "mini" ? "expanded" : mode));
  }

  function clearFindQuery() {
    if (activeDocumentId) {
      postArticleCommand({
        type: "find/clear",
        documentId: activeDocumentId,
      });
    }
    resetFind();
    requestAnimationFrame(() => findInputRef.current?.focus());
  }

  function navigateFind(direction: FindDirection) {
    if (findNavigationDisabled || !activeDocumentId) return;
    postArticleCommand({
      type: "find/navigate",
      documentId: activeDocumentId,
      direction,
      topOffset: SEARCH_SCROLL_OFFSET,
    });
    void Haptics.selectionAsync();
  }

  function submitFind() {
    if (!hasFindQuery || findPending) return;
    // The first match is already live-highlighted; return commits to
    // scanning it with the article visible. The keyboard stays up.
    if (findState.total > 0) setSearchMode("mini");
  }

  function handlePickLink(match: LinkMatch) {
    if (!session || moving) return;
    void Haptics.selectionAsync();
    closeSearch();
    void navigateToArticle(match.link.article);
  }

  function handlePickSnippet(snippet: FindSnippet) {
    if (!activeDocumentId) return;
    postArticleCommand({
      type: "find/activate",
      documentId: activeDocumentId,
      index: snippet.index,
      topOffset: SEARCH_SCROLL_OFFSET,
    });
    setSearchMode("mini");
    void Haptics.selectionAsync();
  }

  function handleArticleLoad() {
    if (!activeDocumentId) return;
    postArticleCommand({
      type: "links/collect",
      documentId: activeDocumentId,
    });
    if (searchMode === "closed") return;
    postArticleCommand({
      type: "find/query",
      documentId: activeDocumentId,
      query: findQueryRef.current,
      topOffset: SEARCH_SCROLL_OFFSET,
      includeSnippets: true,
      scrollToFirst: true,
    });
  }

  async function handleArticleMessage(event: WebViewMessageEvent) {
    let message: ReturnType<typeof parseArticleWebViewEvent> = null;
    try {
      message = parseArticleWebViewEvent(JSON.parse(event.nativeEvent.data));
    } catch {
      message = null;
    }
    if (
      !message ||
      !activeDocumentId ||
      !isArticleWebViewEventForDocument(message, activeDocumentId)
    ) {
      return;
    }

    if (message.type === "article/ready") {
      void applyTimerEvent({ type: "webview-ready", nowMs: Date.now() });
      postArticleCommand({
        type: "links/collect",
        documentId: activeDocumentId,
      });
      return;
    }

    if (message.type === "links/inventory") {
      setLinkInventory(message.links);
      return;
    }

    if (message.type === "find/snippets") {
      if (message.query === findQueryRef.current) {
        setFindSnippets(message.snippets);
      }
      return;
    }

    if (message.type !== "article/link") {
      if (message.query !== findQueryRef.current) return;
      if (message.type === "find/match-count") setFindPending(false);
      setFindState((current) => applyArticleFindEvent(current, message));
      return;
    }

    await navigateToArticle(message.article);
  }

  async function navigateToArticle(destinationTitle: string) {
    if (!session || moving) return;
    let targetReached = false;

    setMoving(true);
    setNotice(null);
    try {
      await applyTimerEvent({ type: "move-start", nowMs: Date.now() });
      const data = await navigateGame({
        sessionId: session.id,
        destinationTitle,
      });
      const nextSession = {
        ...session,
        clicks: data.clicks,
        path: data.path,
        won: data.won,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
      resetFind();

      if (data.won) {
        targetReached = true;
        pendingTargetResultRef.current = nextSession;
        await applyTimerEvent({ type: "screen-exit", nowMs: Date.now() });
        await targetCompletionCoordinatorRef.current.completeResult(session.id);
        return;
      }
      void applyTimerEvent({ type: "article-loading", nowMs: Date.now() });
    } catch (err) {
      if (targetReached) {
        const completedSession = pendingTargetResultRef.current;
        if (completedSession) {
          router.replace({
            pathname: "/result",
            params: resultParams(completedSession, false),
          });
        }
        return;
      }
      setNotice(noticeForNavigateFailure(err));
      await applyTimerEvent({ type: "move-failed", nowMs: Date.now() });
    } finally {
      setMoving(false);
    }
  }

  async function goBack() {
    if (!session || moving || session.path.length <= 1) return;

    setMoving(true);
    setNotice(null);
    try {
      await applyTimerEvent({ type: "move-start", nowMs: Date.now() });
      const data = await navigateGame({ sessionId: session.id, back: true });
      const nextSession = { ...session, clicks: data.clicks, path: data.path };
      sessionRef.current = nextSession;
      void applyTimerEvent({ type: "article-loading", nowMs: Date.now() });
      setSession(nextSession);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Back failed.");
      await applyTimerEvent({ type: "move-failed", nowMs: Date.now() });
    } finally {
      setMoving(false);
    }
  }

  async function finishGiveUp() {
    if (!session) return;
    setMoving(true);
    pendingGiveUpResultRef.current = session;
    await applyTimerEvent({ type: "screen-exit", nowMs: Date.now() });
    try {
      await giveUpCompletionCoordinatorRef.current.completeResult(session.id);
    } catch {
      router.replace({
        pathname: "/result",
        params: resultParams(session, true),
      });
    }
  }

  function giveUp() {
    if (!session) return;
    Alert.alert("Give up?", `Reveal the target: ${session.endArticle}`, [
      { text: "Keep playing", style: "cancel" },
      {
        text: "Give up",
        style: "destructive",
        onPress: () => void finishGiveUp(),
      },
    ]);
  }

  async function exitGame() {
    if (moving) return;
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setMoving(true);
    await applyTimerEvent({ type: "screen-exit", nowMs: Date.now() });
    router.dismissTo("/");
  }

  if (authLoading || starting) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text selectable style={styles.centeredText}>
          Loading race...
        </Text>
      </View>
    );
  }

  if (error && !session) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>
        <Pressable
          accessibilityLabel="Back home"
          accessibilityRole="button"
          role="button"
          onPress={() => router.dismissTo("/")}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Back home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <View
        style={[styles.chrome, { paddingTop: Math.max(insets.top, 8) + 4 }]}
      >
        <View style={styles.headerTopRow}>
          <View style={styles.headerControls}>
            <Pressable
              accessibilityHint="Returns Home. Use Give up to end this race."
              accessibilityLabel="Exit race"
              accessibilityRole="button"
              role="button"
              disabled={moving}
              hitSlop={4}
              onPress={() => void exitGame()}
              style={({ pressed }) => [
                styles.exitButton,
                pressed && styles.pressed,
                moving && styles.disabled,
              ]}
            >
              <Ionicons color={colors.ink} name="close" size={22} />
            </Pressable>
          </View>
          <View style={styles.headerStatus}>
            <Text style={styles.attemptBadge}>{attemptLabel}</Text>
            <Text
              accessibilityLabel={`${screenTitle}. ${attemptLabel}. ${session?.clicks ?? 0} ${
                session?.clicks === 1 ? "click" : "clicks"
              }. Active time ${formatTime(Math.floor(activeTimeMs / 1_000))}.`}
              selectable
              style={styles.headerMeta}
            >
              {session?.clicks ?? 0}{" "}
              {session?.clicks === 1 ? "click" : "clicks"}
              {" · Active "}
              {formatTime(Math.floor(activeTimeMs / 1_000))}
            </Text>
          </View>
        </View>

        <GamePathMap
          compact={searchMode !== "closed"}
          onTargetPress={() => setShowTargetInfo(true)}
          path={session?.path ?? []}
          targetDescription={session?.endDescription ?? null}
          target={session?.endArticle ?? "Target"}
        />

        {notice ? (
          <Text selectable style={styles.notice}>
            {notice}
          </Text>
        ) : null}
      </View>

      <View style={styles.articleFrame}>
        {articleLoading || !shell ? (
          <View style={styles.articleLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text selectable style={styles.centeredText}>
              Loading article...
            </Text>
          </View>
        ) : (
          <WebView
            bounces
            decelerationRate="normal"
            directionalLockEnabled
            ref={webViewRef}
            key={`${activeDocumentId}:${isDark ? "dark" : "light"}`}
            javaScriptEnabled
            nestedScrollEnabled
            originWhitelist={["*"]}
            source={{ html: shell }}
            onLoadEnd={handleArticleLoad}
            onMessage={handleArticleMessage}
            onShouldStartLoadWithRequest={(request) =>
              request.url === "about:blank" ||
              request.url.startsWith("about:srcdoc")
            }
            overScrollMode="always"
            scrollEnabled
            showsVerticalScrollIndicator
            startInLoadingState
            style={styles.webview}
          />
        )}

        {searchMode === "expanded" ? (
          <Pressable
            accessibilityLabel="Hide search results"
            accessibilityRole="button"
            onPress={collapseSearch}
            role="button"
            style={styles.searchScrim}
            testID="search-scrim"
          />
        ) : null}

        {moving ? (
          <Pressable
            accessibilityHint="Wait for the current move to finish."
            accessibilityLabel="Move in progress"
            onPress={() => setNotice(noticeForBlockedArticleTap())}
            style={styles.movingOverlay}
          >
            <ActivityIndicator color={colors.accent} />
            <Text selectable style={styles.movingOverlayText}>
              Moving...
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowTargetInfo(false)}
        transparent
        visible={showTargetInfo && Boolean(session?.endDescription)}
      >
        <Pressable
          accessibilityLabel="Close target details"
          onPress={() => setShowTargetInfo(false)}
          style={styles.targetInfoBackdrop}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={styles.targetInfoCard}
          >
            <Text style={styles.targetInfoTitle}>
              Exact page: {session?.endArticle ?? "Target"}
            </Text>
            <Text style={styles.targetInfoBody}>
              {session?.endDescription ?? ""}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {searchMode === "closed" ? (
        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          {articleBackAllowed ? (
            <Pressable
              accessibilityHint="Returns to the previous article and counts as a click."
              accessibilityLabel="Back one article"
              accessibilityRole="button"
              role="button"
              disabled={!session || moving || session.path.length <= 1}
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
                (!session || moving || session.path.length <= 1) &&
                  styles.disabled,
              ]}
            >
              <Ionicons color={colors.ink} name="arrow-back" size={17} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityHint={
              findOnlySearch
                ? "Find text inside this article."
                : "Search this page’s links and text."
            }
            accessibilityLabel={
              findOnlySearch ? "Find in this article" : "Search this page"
            }
            accessibilityRole="button"
            role="button"
            disabled={!session || articleLoading || moving}
            onPress={openSearch}
            style={({ pressed }) => [
              styles.searchButton,
              pressed && styles.pressed,
              (!session || articleLoading || moving) && styles.disabled,
            ]}
            testID="search-open"
          >
            <Ionicons color={colors.onAccent} name="search" size={17} />
            <Text style={styles.searchButtonText}>
              {findOnlySearch ? "Find" : "Search"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Give up"
            accessibilityRole="button"
            role="button"
            disabled={!session || moving}
            onPress={giveUp}
            style={({ pressed }) => [
              styles.giveUpButton,
              pressed && styles.pressed,
              (!session || moving) && styles.disabled,
            ]}
          >
            <Text style={styles.giveUpButtonText}>Give up</Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={{
            paddingBottom: keyboardShown ? 0 : Math.max(insets.bottom, 8),
            backgroundColor: colors.chrome,
          }}
        >
          <GameSearchSheet
            articleTitle={currentArticle ?? "this article"}
            inputRef={findInputRef}
            mode={searchMode}
            navigationDisabled={findNavigationDisabled}
            onChangeQuery={handleFindQueryChange}
            onClear={clearFindQuery}
            onClose={closeSearch}
            onExpand={expandSearch}
            onNavigate={navigateFind}
            onPickLink={handlePickLink}
            onPickSnippet={handlePickSnippet}
            onSubmit={submitFind}
            presentation={findPresentation}
            query={findState.query}
            sections={searchSections}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles({ colors, fonts, isDark, radius }: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.chrome,
      flex: 1,
    },
    chrome: {
      backgroundColor: colors.chrome,
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingBottom: 9,
    },
    headerTopRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    headerControls: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    exitButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      marginLeft: -8,
      width: 44,
    },
    headerStatus: {
      alignItems: "flex-end",
      gap: 3,
    },
    attemptBadge: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.borderSoft,
      borderRadius: radius.small,
      borderWidth: 1,
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 9,
      letterSpacing: 0.8,
      overflow: "hidden",
      paddingHorizontal: 7,
      paddingVertical: 3,
      textTransform: "uppercase",
    },
    headerMeta: {
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    notice: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 14,
      paddingTop: 2,
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      minWidth: 160,
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    articleFrame: {
      backgroundColor: colors.surface,
      flex: 1,
      position: "relative",
    },
    webview: {
      backgroundColor: colors.surface,
      flex: 1,
    },
    articleLoading: {
      alignItems: "center",
      flex: 1,
      gap: 10,
      justifyContent: "center",
    },
    movingOverlay: {
      alignItems: "center",
      backgroundColor: isDark
        ? "rgba(0, 0, 0, 0.38)"
        : "rgba(250, 247, 240, 0.48)",
      bottom: 0,
      justifyContent: "center",
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 20,
    },
    movingOverlayText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      marginTop: 10,
    },
    targetInfoBackdrop: {
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.28)",
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    targetInfoCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      maxWidth: 360,
      padding: 18,
      width: "100%",
    },
    targetInfoTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 23,
    },
    targetInfoBody: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      marginTop: 8,
    },
    searchScrim: {
      backgroundColor: colors.overlay,
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
      zIndex: 10,
    },
    actionBar: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.borderSoft,
      borderRadius: radius.medium,
      borderWidth: 1,
      flex: 0.85,
      flexDirection: "row",
      gap: 6,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    searchButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.medium,
      flex: 1.2,
      flexDirection: "row",
      gap: 7,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    searchButtonText: {
      color: colors.onAccent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    giveUpButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      flex: 0.8,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    giveUpButtonText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    centered: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 22,
    },
    centeredText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
