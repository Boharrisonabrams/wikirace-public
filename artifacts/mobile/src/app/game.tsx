import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { GameSearchSheet } from "@/components/game-search-sheet";
import { GameActionBar } from "@/components/game/game-action-bar";
import { GameArticleFrame } from "@/components/game/game-article-frame";
import { GameHeader } from "@/components/game/game-header";
import { GameLoadingView, GameStartError } from "@/components/game/game-status";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useGameActiveTimer } from "@/hooks/use-game-active-timer";
import { completeGame, getArticle, navigateGame, startGame } from "@/lib/api";
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
  const { activeTimeMs, applyTimerEvent, installSessionTimer, sessionRef } =
    useGameActiveTimer(session?.id);
  const [searchMode, setSearchMode] = useState<SearchSheetMode>("closed");
  const [showTargetInfo, setShowTargetInfo] = useState(false);
  const [findPending, setFindPending] = useState(false);
  const [findState, setFindState] = useState(createArticleFindState);
  const [findSnippets, setFindSnippets] = useState<FindSnippet[]>([]);
  const [linkInventory, setLinkInventory] = useState<ArticleLinkEntry[] | null>(
    null,
  );
  const [keyboardShown, setKeyboardShown] = useState(false);
  const pendingTargetResultRef = useRef<GameSession | null>(null);
  const pendingGiveUpResultRef = useRef<GameSession | null>(null);
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
    return <GameLoadingView />;
  }

  if (error && !session) {
    return <GameStartError error={error} />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <GameHeader
        activeTimeMs={activeTimeMs}
        attemptLabel={attemptLabel}
        insets={insets}
        moving={moving}
        notice={notice}
        onExit={() => void exitGame()}
        onTargetPress={() => setShowTargetInfo(true)}
        screenTitle={screenTitle}
        searchMode={searchMode}
        session={session}
      />

      <GameArticleFrame
        activeDocumentId={activeDocumentId}
        articleLoading={articleLoading}
        moving={moving}
        onBlockedTap={() => setNotice(noticeForBlockedArticleTap())}
        onCollapseSearch={collapseSearch}
        onLoadEnd={handleArticleLoad}
        onMessage={handleArticleMessage}
        searchMode={searchMode}
        shell={shell}
        webViewRef={webViewRef}
      />

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
        <GameActionBar
          articleBackAllowed={articleBackAllowed}
          articleLoading={articleLoading}
          findOnlySearch={findOnlySearch}
          insets={insets}
          moving={moving}
          onBack={goBack}
          onGiveUp={giveUp}
          onOpenSearch={openSearch}
          session={session}
        />
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

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.chrome,
      flex: 1,
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
  });
}
