import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  EditorialCard,
  PrimaryAction,
  SecondaryAction,
  SectionHeading,
} from "@/components/editorial-ui";
import { ExpandableFinisherRow } from "@/components/expandable-finisher-row";
import { editorialType } from "@/constants/theme";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import {
  getSharedChallenge,
  recordChallengeStart,
  type SharedChallengeResultEntry,
  type SharedChallengeResponse,
} from "@/lib/api";
import {
  createChallengeEntryController,
  type SharedChallengePreview,
} from "@/lib/challenge-entry";
import { formatTime } from "@/lib/game-utils";
import {
  acceptChallengePreview,
  beginChallengePreview,
  clearCreatedPrivateChallengeHandoff,
  createPrivateChallengeCopyController,
  createPrivateChallengeShareController,
  failChallengePreview,
  peekCreatedPrivateChallengeHandoff,
  type ChallengePreviewState,
  type CreatedPrivateChallenge,
} from "@/lib/private-challenge";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function SharedChallengeScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const code = firstParam(params.code);
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const activeCode = useRef(code);
  activeCode.current = code;
  const [preview, setPreview] = useState<ChallengePreviewState | null>(() =>
    code
      ? beginChallengePreview(code, peekCreatedPrivateChallengeHandoff(code))
      : null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [results, setResults] = useState<SharedChallengeResultEntry[]>([]);
  const [mySession, setMySession] =
    useState<SharedChallengeResponse["mySession"]>(null);
  const [expandedResultKey, setExpandedResultKey] = useState<string | null>(
    null,
  );

  const challenge: SharedChallengePreview | null =
    code && preview?.code === code ? preview.challenge : null;
  const loadError = !code
    ? "This challenge link is incomplete."
    : preview?.code === code
      ? preview.error
      : null;
  const loading =
    Boolean(code) &&
    (!preview ||
      preview.code !== code ||
      (preview.status === "loading" && !preview.challenge));

  useEffect(() => {
    if (!code) return;
    const requestedCode = code;
    const handedOffChallenge = peekCreatedPrivateChallengeHandoff(code);
    setPreview(beginChallengePreview(code, handedOffChallenge));
    setActionError(null);
    setStarting(false);
    setSharing(false);
    setCopying(false);
    setCopied(false);
    setResults([]);
    setMySession(null);
    setExpandedResultKey(null);
    let cancelled = false;
    void getSharedChallenge(code)
      .then((response) => {
        if (cancelled) return;
        const loaded = response.challenge;
        setPreview((current) =>
          current
            ? acceptChallengePreview(current, requestedCode, loaded)
            : current,
        );
        setResults(response.results);
        setMySession(response.mySession);
        clearCreatedPrivateChallengeHandoff(requestedCode);
      })
      .catch(() => {
        if (cancelled) return;
        setPreview((current) =>
          current
            ? failChallengePreview(
                current,
                requestedCode,
                "Could not load this challenge. Check your connection and try again.",
              )
            : current,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [code, refreshAttempt]);

  async function start() {
    if (!challenge || !code || starting) return;
    const requestedCode = code;
    setStarting(true);
    setActionError(null);
    const controller = createChallengeEntryController({
      recordStart: async (challengeCode) => {
        await recordChallengeStart(challengeCode);
      },
      navigate: (gameParams) => {
        if (activeCode.current !== requestedCode) return;
        router.replace({ pathname: "/game", params: gameParams });
      },
    });
    try {
      await controller.start(challenge);
    } catch (startError) {
      if (activeCode.current === requestedCode) {
        setActionError(
          startError instanceof Error
            ? startError.message
            : "Could not start this challenge.",
        );
        setStarting(false);
      }
    }
  }

  async function shareChallenge() {
    if (
      !challenge ||
      !code ||
      challenge.kind !== "friend" ||
      !challenge.url ||
      sharing
    ) {
      return;
    }
    const requestedCode = code;
    setSharing(true);
    setActionError(null);
    try {
      await createPrivateChallengeShareController({
        platform: Platform.OS,
        share: async (payload) => {
          await Share.share(payload);
        },
      }).share(challenge as CreatedPrivateChallenge);
    } catch (shareError) {
      if (activeCode.current === requestedCode) {
        setActionError(
          shareError instanceof Error
            ? shareError.message
            : "Could not share this challenge.",
        );
      }
    } finally {
      if (activeCode.current === requestedCode) setSharing(false);
    }
  }

  async function copyChallengeLink() {
    if (
      !challenge ||
      !code ||
      challenge.kind !== "friend" ||
      !challenge.url ||
      copying
    ) {
      return;
    }
    const requestedCode = code;
    setCopying(true);
    setCopied(false);
    setActionError(null);
    try {
      await createPrivateChallengeCopyController({
        copy: async (value) => {
          if (Platform.OS === "web") {
            Clipboard.setString(value);
            return;
          }
          await Clipboard.setStringAsync(value);
        },
      }).copy(challenge as CreatedPrivateChallenge);
      if (activeCode.current === requestedCode) setCopied(true);
    } catch (copyError) {
      if (activeCode.current === requestedCode) {
        setActionError(
          copyError instanceof Error
            ? copyError.message
            : "Could not copy this challenge link.",
        );
      }
    } finally {
      if (activeCode.current === requestedCode) setCopying(false);
    }
  }

  return (
    <View style={styles.page}>
      <Stack.Screen options={{ title: "Challenge" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              Loading challenge…
            </Text>
          </View>
        ) : (
          <EditorialCard style={styles.card}>
            <Feather color={theme.colors.accent} name="send" size={24} />
            <Text style={styles.kicker}>
              {challenge?.kind === "daily"
                ? "Daily Path"
                : challenge?.kind === "practice"
                  ? "Practice race"
                  : "Private challenge"}
            </Text>
            <Text accessibilityRole="header" style={styles.title}>
              {challenge
                ? `${challenge.startTitle} → ${challenge.endTitle}`
                : "Challenge unavailable"}
            </Text>
            {challenge?.endDescription ? (
              <Text style={styles.detail}>
                {challenge.endTitle} — {challenge.endDescription}
              </Text>
            ) : null}
            <Text style={styles.detail}>
              Previewing this link does not start a race. Your attempt begins
              only after you tap Start.
            </Text>
            {loadError ? (
              <View style={styles.recovery}>
                <Text accessibilityRole="alert" style={styles.error}>
                  {loadError}
                </Text>
                {code ? (
                  <SecondaryAction
                    icon="refresh-cw"
                    label="Retry"
                    onPress={() => setRefreshAttempt((attempt) => attempt + 1)}
                    testID="retry-shared-challenge"
                  />
                ) : null}
              </View>
            ) : null}
            {actionError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {actionError}
              </Text>
            ) : null}
            {challenge ? (
              <View style={styles.actions}>
                {challenge.kind === "friend" && challenge.url ? (
                  <View style={styles.shareActions}>
                    <SecondaryAction
                      icon="share-2"
                      label="Share challenge"
                      loading={sharing}
                      onPress={() => void shareChallenge()}
                      testID="share-private-challenge"
                    />
                    <SecondaryAction
                      disabled={copied}
                      icon={copied ? "check" : "copy"}
                      label={copied ? "Link copied" : "Copy link"}
                      loading={copying}
                      onPress={() => void copyChallengeLink()}
                      testID="copy-private-challenge"
                    />
                  </View>
                ) : null}
                <PrimaryAction
                  disabled={starting}
                  icon="play"
                  label={starting ? "Starting…" : "Start"}
                  onPress={() => void start()}
                  testID="start-shared-challenge"
                />
              </View>
            ) : null}
          </EditorialCard>
        )}

        {!loading && challenge ? (
          <EditorialCard style={styles.resultsCard}>
            <SectionHeading title="Results" />
            {results.length === 0 ? (
              <Text style={styles.detail}>No one has finished this race yet.</Text>
            ) : (
              <View style={styles.resultsList}>
                {results.map((entry) => {
                  const rowKey = `${entry.username}-${entry.completed_at}-${entry.rank}`;
                  const isExpanded = expandedResultKey === rowKey;
                  const canExpand = Array.isArray(entry.path) && entry.path.length > 0;
                  return (
                    <ExpandableFinisherRow
                      key={rowKey}
                      expanded={isExpanded}
                      onToggle={() =>
                        setExpandedResultKey((current) =>
                          current === rowKey ? null : rowKey,
                        )
                      }
                      path={entry.path}
                      pathTestID={`challenge-path-${rowKey}`}
                    >
                      <View style={styles.resultRow}>
                        <Text
                          style={[
                            styles.rank,
                            entry.won && entry.rank === 1 && styles.podiumRank,
                          ]}
                        >
                          {entry.won ? entry.rank : "—"}
                        </Text>
                        <View style={styles.resultBody}>
                          <Text style={styles.resultName}>
                            {entry.display_name || entry.username}
                            {entry.is_current_user ? " (you)" : ""}
                          </Text>
                          <Text style={styles.resultStatus}>
                            {entry.won
                              ? "Reached the target"
                              : "Gave up before the target"}
                            {!canExpand ? "" : " · Tap to reveal path"}
                          </Text>
                        </View>
                        <View style={styles.score}>
                          <Text style={styles.primaryScore}>
                            {entry.clicks} {entry.clicks === 1 ? "click" : "clicks"}
                          </Text>
                          <Text style={styles.secondaryScore}>
                            {formatTime(entry.time_seconds)}
                          </Text>
                        </View>
                      </View>
                    </ExpandableFinisherRow>
                  );
                })}
              </View>
            )}
            {mySession?.completed ? (
              <Text style={styles.resultsFootnote}>
                Completed racers can inspect how other finishers got there.
              </Text>
            ) : (
              <Text style={styles.resultsFootnote}>
                Finish or give up first to reveal everyone&apos;s path for this race.
              </Text>
            )}
          </EditorialCard>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    page: {
      backgroundColor: colors.chrome,
      flex: 1,
    },
    content: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 20,
      paddingBottom: 40,
    },
    loading: {
      alignItems: "center",
      gap: 12,
      justifyContent: "center",
      minHeight: 160,
    },
    card: { gap: 14, padding: 22 },
    resultsCard: { gap: 12, padding: 22 },
    actions: { gap: 10 },
    resultsList: {
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    resultRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    rank: {
      color: colors.inkMuted,
      fontFamily: fonts.serifBold,
      fontSize: 20,
      width: 24,
    },
    podiumRank: {
      color: colors.accent,
    },
    resultBody: {
      flex: 1,
      gap: 2,
    },
    resultName: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
    },
    resultStatus: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 18,
    },
    score: {
      alignItems: "flex-end",
      gap: 2,
    },
    primaryScore: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    secondaryScore: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
    },
    shareActions: { gap: 8 },
    recovery: { gap: 10 },
    kicker: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.label,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    title: {
      color: colors.ink,
      fontFamily: fonts.serifBold,
      ...editorialType.pageTitle,
    },
    detail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      ...editorialType.body,
    },
    resultsFootnote: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    muted: { color: colors.inkMuted, fontFamily: fonts.sans },
    error: { color: colors.danger, fontFamily: fonts.sans, lineHeight: 20 },
  });
}
