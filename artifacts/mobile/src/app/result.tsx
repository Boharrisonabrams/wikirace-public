import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatShareIntent, type ShareIntent } from "@workspace/share-intent";

import {
  EditorialCard,
  PrimaryAction,
  SecondaryAction,
} from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  completeGame,
  createChallengeLink,
  createCustomChallenge,
} from "@/lib/api";
import { buildInternalReturnPath } from "@/lib/auth-flow";
import { isSafeChallengeUrl } from "@/lib/game-utils";
import {
  createPrivateChallengeController,
  privateChallengePreviewRoute,
} from "@/lib/private-challenge";
import { finalizeProfileClaim } from "@/lib/profile-claim";
import {
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminderState,
} from "@/lib/reminders";
import {
  getReminderControlCopy,
  reminderStatusFromSnapshot,
  runReminderAction,
  type ReminderAction,
  type ReminderUiStatus,
} from "@/lib/reminder-ui";
import {
  buildResultPresentation,
  resolveResultFallback,
} from "@/lib/result-presentation";
import { buildNativeSharePayload } from "@/lib/share-intent";
import type { ChallengeType, GameResult, SearchTier } from "@/lib/types";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function asChallengeType(value: string | undefined): ChallengeType {
  return value === "practice" || value === "friend" || value === "daily"
    ? value
    : "daily";
}

function optionalBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { isGuest, loading: authLoading, user } = useAuthSession();
  const sessionId = firstParam(params.sessionId);
  const kind = asChallengeType(firstParam(params.type));
  const dailyDate = firstParam(params.dailyDate);
  const challengeId = firstParam(params.challengeId);
  const replay = firstParam(params.replay) === "true";
  const routeIsGuest = optionalBoolean(firstParam(params.isGuest));
  const routeClaimed = optionalBoolean(firstParam(params.claimed));
  const gaveUp = firstParam(params.gaveUp) === "true";
  const resultReturnPath = buildInternalReturnPath("/result", {
    sessionId,
    type: kind,
    dailyDate,
    challengeId,
    replay: replay ? "true" : "false",
    isGuest: routeIsGuest === undefined ? undefined : String(routeIsGuest),
    claimed: routeClaimed === undefined ? undefined : String(routeClaimed),
    gaveUp: gaveUp ? "true" : "false",
  });

  const [result, setResult] = useState<GameResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [sharingIntent, setSharingIntent] = useState<ShareIntent | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [raceAgainLoading, setRaceAgainLoading] = useState(false);
  const [raceAgainError, setRaceAgainError] = useState<string | null>(null);
  const [searchTier, setSearchTier] = useState<SearchTier>("find");
  const [reminderState, setReminderState] = useState<ReminderUiStatus>("idle");
  const [reminderRetryAction, setReminderRetryAction] =
    useState<ReminderAction | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace({
        pathname: "/login",
        params: { next: resultReturnPath },
      });
      return;
    }
    if (!sessionId) {
      setError("Missing game session.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await completeGame(sessionId!, gaveUp);
        if (!cancelled) {
          const fallbackIsGuest = routeIsGuest ?? isGuest;
          setResult(
            resolveResultFallback(
              { ...data, gaveUp },
              {
                challengeId,
                claimed: routeClaimed ?? (fallbackIsGuest ? false : undefined),
                currentIsGuest: isGuest,
                dailyDate,
                isGuest: fallbackIsGuest,
                replay,
              },
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not save result",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    challengeId,
    dailyDate,
    gaveUp,
    isGuest,
    replay,
    resultReturnPath,
    routeClaimed,
    routeIsGuest,
    sessionId,
    user,
  ]);

  const presentation = useMemo(
    () => (result ? buildResultPresentation(result, kind) : null),
    [kind, result],
  );
  const reminderCopy = useMemo(
    () => getReminderControlCopy(reminderState),
    [reminderState],
  );

  useEffect(() => {
    if (!presentation?.showDailyReminder) return;
    let cancelled = false;
    void getDailyReminderState()
      .then((state) => {
        if (cancelled) return;
        setReminderRetryAction(null);
        setReminderState(reminderStatusFromSnapshot(state));
      })
      .catch(() => {
        if (!cancelled) setReminderState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [presentation?.showDailyReminder]);

  async function share(intent: ShareIntent) {
    if (!result || sharingIntent) return;
    setSharingIntent(intent);
    setShareError(null);
    let challengeUrl = result.challengeUrl ?? undefined;
    if (sessionId && !challengeUrl) {
      try {
        const { challenge } = await createChallengeLink(sessionId, searchTier);
        if (!isSafeChallengeUrl(challenge.url)) {
          throw new Error("Challenge link was not a safe short HTTPS URL");
        }
        challengeUrl = challenge.url;
      } catch {
        setShareError("Could not create the challenge link. Try again.");
        setSharingIntent(null);
        return;
      }
    }
    if (!challengeUrl) {
      setShareError("Could not create the challenge link. Try again.");
      setSharingIntent(null);
      return;
    }

    const startTitle = result.path[0] ?? "Start";
    const base = {
      challengeUrl,
      endTitle: result.endArticle,
      startTitle,
    };
    const content =
      intent === "challenge"
        ? formatShareIntent({ ...base, intent })
        : result.won
          ? formatShareIntent({
              ...base,
              clicks: result.clicks,
              elapsedSeconds:
                result.activeTimeMs === undefined
                  ? result.timeSeconds
                  : Math.round(Math.max(0, result.activeTimeMs) / 1_000),
              intent,
              outcome: "won",
              replay,
            })
          : formatShareIntent({
              ...base,
              intent,
              outcome: "stopped",
              stoppedAt: result.path.at(-1) ?? startTitle,
            });
    try {
      await Share.share(buildNativeSharePayload(content, Platform.OS));
    } finally {
      setSharingIntent(null);
    }
  }

  async function raceAgain() {
    if (!result || kind !== "friend" || raceAgainLoading) return;

    const startArticle = presentation?.startArticle ?? result.path[0];
    if (!startArticle) {
      setRaceAgainError("Could not create the new challenge. Try again.");
      return;
    }

    setRaceAgainLoading(true);
    setRaceAgainError(null);
    try {
      await createPrivateChallengeController({
        create: async (draft) => (await createCustomChallenge(draft)).challenge,
        navigateToPreview: (challenge) => {
          router.push(privateChallengePreviewRoute(challenge));
        },
      }).submit({
        startArticle,
        endArticle: result.endArticle,
        searchTier,
      });
    } catch {
      setRaceAgainError("Could not create the new challenge. Try again.");
    } finally {
      setRaceAgainLoading(false);
    }
  }

  async function handleAccountAction() {
    if (!presentation?.accountAction || accountLoading) return;
    setAccountError(null);

    if (presentation.accountAction.kind === "claim") {
      router.push({
        pathname: "/signup",
        params: {
          mode: "claim",
          next: resultReturnPath,
        },
      });
      return;
    }

    setAccountLoading(true);
    try {
      await finalizeProfileClaim();
      setResult((current) =>
        current ? { ...current, claimed: true, isGuest: false } : current,
      );
      if (sessionId) {
        try {
          const refreshed = await completeGame(sessionId, gaveUp);
          setResult(
            resolveResultFallback(
              { ...refreshed, gaveUp },
              {
                challengeId,
                claimed: true,
                dailyDate,
                isGuest: false,
                replay,
              },
            ),
          );
        } catch {
          // Claiming succeeded. A later focus/reload can refresh optional ranks.
        }
      }
    } catch (claimError) {
      setAccountError(
        claimError instanceof Error
          ? `${claimError.message} Try again.`
          : "Could not finish account setup. Try again.",
      );
    } finally {
      setAccountLoading(false);
    }
  }

  async function handleReminderAction() {
    if (reminderState === "loading" || reminderState === "denied") return;
    const current = {
      retryAction: reminderRetryAction,
      status: reminderState,
    };
    setReminderState("loading");
    const next = await runReminderAction(current, {
      disable: disableDailyReminder,
      enable: enableDailyReminder,
      read: getDailyReminderState,
    });
    setReminderRetryAction(next.retryAction);
    setReminderState(next.status);
  }

  function replayDaily() {
    if (!result?.challengeId) return;
    router.replace({
      pathname: "/game",
      params: {
        type: "daily",
        challengeId: result.challengeId,
        dailyDate: result.dailyDate ?? dailyDate,
        replay: "true",
        ...(result.isGuest === undefined
          ? {}
          : { isGuest: String(result.isGuest) }),
        ...(result.claimed === undefined
          ? {}
          : { claimed: String(result.claimed) }),
      },
    });
  }

  if (loading || authLoading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
        <Text selectable style={styles.mutedText}>
          Saving result…
        </Text>
      </View>
    );
  }

  if (error || !result || !presentation) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorIcon}>
          <Feather color={colors.danger} name="alert-circle" size={22} />
        </View>
        <Text accessibilityRole="alert" selectable style={styles.errorText}>
          {error ?? "Result unavailable."}
        </Text>
        <View style={styles.centeredAction}>
          <PrimaryAction
            icon="home"
            label="Back home"
            onPress={() => router.dismissTo("/")}
            testID="result-error-home"
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.page}
    >
      <EditorialCard style={styles.resultCard}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.mastheadRule}
        >
          <View style={styles.mastheadRuleInner} />
        </View>

        <View style={styles.masthead}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.outcomeIcon,
              result.won ? styles.outcomeIconWon : styles.outcomeIconMissed,
            ]}
          >
            <Feather
              color={result.won ? colors.success : colors.inkMuted}
              name={result.won ? "check" : "flag"}
              size={21}
            />
          </View>
          <Text selectable style={styles.kicker}>
            {presentation.kicker}
            {" · "}
            {presentation.startArticle} → {result.endArticle}
          </Text>
          <Text
            accessibilityLabel={presentation.headline}
            accessibilityRole="header"
            selectable
            style={[styles.title, !result.won && styles.titleMissed]}
          >
            {result.won ? (
              <>
                You reached{" "}
                <Text style={styles.titleTarget}>{result.endArticle}</Text>.
              </>
            ) : (
              presentation.headline
            )}
          </Text>
          {!result.won ? (
            <Text selectable style={styles.subtitle}>
              {presentation.detail}
            </Text>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          {presentation.stats.map((stat) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.label}: ${stat.value}`}
              style={styles.stat}
            >
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                selectable
                style={styles.statValue}
              >
                {stat.value}
              </Text>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                selectable
                style={styles.statLabel}
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {presentation.showStreak && result.streak?.extended ? (
          <View style={styles.streakNote}>
            <Feather
              accessibilityElementsHidden
              color={colors.success}
              importantForAccessibility="no-hide-descendants"
              name="trending-up"
              size={15}
            />
            <Text selectable style={styles.streakNoteText}>
              Daily streak extended. Longest streak: {result.streak.longest}.
            </Text>
          </View>
        ) : null}

        {presentation.rankCards.length > 0 ? (
          <View style={styles.rankingSection}>
            <Text
              accessibilityRole="header"
              selectable
              style={styles.routeTitle}
            >
              Today&apos;s standings
            </Text>
            {presentation.championSweep ? (
              <View
                accessible
                accessibilityLabel="Daily champion sweep. Number one in Shortest Path and Fastest Solve."
                style={styles.sweepNote}
              >
                <Feather
                  accessibilityElementsHidden
                  color={colors.warning}
                  importantForAccessibility="no-hide-descendants"
                  name="award"
                  size={17}
                />
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  selectable
                  style={styles.sweepText}
                >
                  Daily champion sweep
                </Text>
              </View>
            ) : null}
            <View style={styles.rankGrid}>
              {presentation.rankCards.map((card) => (
                <View
                  key={card.board}
                  accessible
                  accessibilityLabel={`${card.label}: ${card.value}. ${
                    card.champion ? "Daily champion. " : ""
                  }${card.detail}.`}
                  style={[
                    styles.rankCard,
                    card.champion && styles.championCard,
                  ]}
                >
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    selectable
                    style={styles.rankLabel}
                  >
                    {card.label}
                  </Text>
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    selectable
                    style={styles.rankValue}
                  >
                    {card.value}
                  </Text>
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    selectable
                    style={styles.rankDetail}
                  >
                    {card.champion ? "Daily champion · " : ""}
                    {card.detail}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {presentation.rankTease ? (
          <View
            accessible
            accessibilityLabel={`${presentation.rankTease.copy}. ${presentation.rankTease.ctaLabel}.`}
            style={styles.rankTeaseCard}
          >
            <Feather
              accessibilityElementsHidden
              color={colors.warning}
              importantForAccessibility="no-hide-descendants"
              name="award"
              size={17}
            />
            <View style={styles.rankTeaseCopyBlock}>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                selectable
                style={styles.rankTeaseCopy}
              >
                {presentation.rankTease.copy}
              </Text>
              <Text
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                selectable
                style={styles.rankTeaseDetail}
              >
                Save this guest result to join today&apos;s claimed standings.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.routeSection}>
          <Text accessibilityRole="header" selectable style={styles.routeTitle}>
            Your route
          </Text>

          <View style={styles.routeList}>
            {result.path.length > 0 ? (
              result.path.map((title, index) => {
                const isWinningStep =
                  result.won && index === result.path.length - 1;
                return (
                  <View
                    key={`${title}-${index}`}
                    accessible
                    accessibilityLabel={`Step ${index + 1} of ${result.path.length}: ${title}`}
                    style={styles.pathRow}
                  >
                    <Text
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      selectable
                      style={styles.pathIndex}
                    >
                      {index + 1}.
                    </Text>
                    <Text
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      selectable
                      style={[
                        styles.pathTitle,
                        isWinningStep && styles.pathTitleWon,
                      ]}
                    >
                      {title}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text selectable style={styles.emptyRoute}>
                No route recorded.
              </Text>
            )}

            {presentation.targetMissed ? (
              <View
                accessible
                accessibilityLabel={`Target not reached: ${presentation.targetMissed}`}
                style={styles.targetMissed}
              >
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={styles.targetMissedMark}
                >
                  ×
                </Text>
                <Text
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  selectable
                  style={styles.targetMissedText}
                >
                  never reached {presentation.targetMissed}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <ResultSearchTierChoice
            selected={searchTier}
            styles={styles}
            onChange={setSearchTier}
          />
          {presentation.accountAction ? (
            <>
              <PrimaryAction
                icon="user-plus"
                label={presentation.accountAction.label}
                loading={accountLoading}
                onPress={() => void handleAccountAction()}
                testID="result-account-btn"
              />
              {accountError ? (
                <Text
                  accessibilityRole="alert"
                  selectable
                  style={styles.accountError}
                >
                  {accountError}
                </Text>
              ) : null}
            </>
          ) : (
            <PrimaryAction
              icon="users"
              label="Challenge a friend"
              loading={sharingIntent === "challenge"}
              onPress={() => void share("challenge")}
              testID="challenge-friend-btn"
            />
          )}
          {presentation.accountAction ? (
            <SecondaryAction
              icon="users"
              label="Challenge a friend"
              loading={sharingIntent === "challenge"}
              onPress={() => void share("challenge")}
              testID="challenge-friend-btn"
            />
          ) : null}
          {kind === "friend" ? (
            <SecondaryAction
              icon="rotate-ccw"
              label="Race again"
              loading={raceAgainLoading}
              onPress={() => void raceAgain()}
              testID="result-race-again-btn"
            />
          ) : null}
          <SecondaryAction
            icon="share-2"
            label="Share my result"
            loading={sharingIntent === "result"}
            onPress={() => void share("result")}
            testID="share-result-btn"
          />
          {shareError ? (
            <Text accessibilityRole="alert" style={styles.accountError}>
              {shareError}
            </Text>
          ) : null}
          {raceAgainError ? (
            <Text accessibilityRole="alert" style={styles.accountError}>
              {raceAgainError}
            </Text>
          ) : null}
          {kind === "daily" && result.challengeId ? (
            <SecondaryAction
              icon="rotate-ccw"
              label="Replay unranked"
              onPress={replayDaily}
              testID="result-replay-btn"
            />
          ) : null}
          {presentation.showDailyReminder ? (
            <>
              <SecondaryAction
                disabled={reminderCopy.disabled}
                icon={reminderCopy.icon}
                label={reminderCopy.actionLabel}
                loading={reminderState === "loading"}
                onPress={() => void handleReminderAction()}
                testID="result-reminder-btn"
              />
              {reminderCopy.note ? (
                <Text
                  accessibilityLiveRegion={
                    reminderState === "enabled" ? "polite" : undefined
                  }
                  selectable
                  style={styles.reminderNote}
                >
                  {reminderCopy.note}
                </Text>
              ) : null}
              {reminderCopy.showOpenSettings ? (
                <SecondaryAction
                  icon="external-link"
                  label="Open Settings"
                  onPress={() => void Linking.openSettings()}
                  testID="result-reminder-settings-btn"
                />
              ) : null}
              {reminderState === "error" ? (
                <Text
                  accessibilityRole="alert"
                  selectable
                  style={styles.accountError}
                >
                  Could not update the reminder. Share, Replay, and Home still
                  work.
                </Text>
              ) : null}
            </>
          ) : null}
          <SecondaryAction
            icon="home"
            label="Home"
            onPress={() => router.dismissTo("/")}
            testID="result-home-btn"
          />
        </View>
      </EditorialCard>
    </ScrollView>
  );
}

function ResultSearchTierChoice({
  selected,
  styles,
  onChange,
}: {
  selected: SearchTier;
  styles: ReturnType<typeof makeStyles>;
  onChange: (value: SearchTier) => void;
}) {
  const options: Array<{ value: SearchTier; label: string }> = [
    { value: "find", label: "Find only" },
    { value: "palette", label: "Full palette" },
  ];

  return (
    <View style={styles.searchTierBlock}>
      <Text style={styles.searchTierLabel}>Search on new challenge links</Text>
      <View style={styles.searchTierRow}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={[
                styles.searchTierChip,
                active && styles.searchTierChipActive,
              ]}
              testID={`result-search-tier-${option.value}`}
            >
              <Text
                style={[
                  styles.searchTierChipText,
                  active && styles.searchTierChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.searchTierHint}>
        Find only hides the links list. Full palette keeps both links and find.
      </Text>
    </View>
  );
}

function makeStyles({ colors, fonts, isDark }: AppTheme) {
  return StyleSheet.create({
    page: {
      backgroundColor: colors.chrome,
    },
    content: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 40,
    },
    resultCard: {
      alignSelf: "center",
      maxWidth: 620,
      padding: 16,
      width: "100%",
    },
    mastheadRule: {
      backgroundColor: colors.ink,
      height: 4,
      justifyContent: "flex-end",
      marginBottom: 22,
      opacity: isDark ? 0.75 : 0.86,
      paddingBottom: 1,
    },
    mastheadRuleInner: {
      backgroundColor: colors.surface,
      height: 1,
    },
    masthead: {
      alignItems: "flex-start",
    },
    outcomeIcon: {
      alignItems: "center",
      borderRadius: 20,
      height: 40,
      justifyContent: "center",
      marginBottom: 12,
      width: 40,
    },
    outcomeIconWon: {
      backgroundColor: colors.successSoft,
    },
    outcomeIconMissed: {
      backgroundColor: colors.surfaceMuted,
    },
    kicker: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      letterSpacing: 1.05,
      lineHeight: 15,
      textTransform: "uppercase",
    },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 31,
      lineHeight: 38,
      marginTop: 7,
    },
    titleMissed: {
      color: colors.inkMuted,
    },
    titleTarget: {
      color: colors.link,
    },
    subtitle: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 7,
    },
    statsGrid: {
      backgroundColor: colors.borderSoft,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: StyleSheet.hairlineWidth,
      marginTop: 22,
    },
    stat: {
      alignItems: "center",
      backgroundColor: colors.surface,
      flex: 1,
      justifyContent: "center",
      minHeight: 78,
      paddingHorizontal: 4,
      paddingVertical: 11,
    },
    statValue: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 23,
      fontVariant: ["tabular-nums"],
      lineHeight: 29,
      textAlign: "center",
    },
    statLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 9,
      letterSpacing: 0.8,
      lineHeight: 14,
      textAlign: "center",
      textTransform: "uppercase",
    },
    streakNote: {
      alignItems: "center",
      backgroundColor: colors.successSoft,
      flexDirection: "row",
      gap: 7,
      marginTop: 12,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    streakNoteText: {
      color: colors.success,
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 17,
    },
    rankingSection: {
      gap: 9,
      marginTop: 24,
    },
    rankTeaseCard: {
      alignItems: "flex-start",
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
      borderRadius: 22,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    rankTeaseCopyBlock: {
      flex: 1,
      gap: 3,
    },
    rankTeaseCopy: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 16,
      lineHeight: 20,
    },
    rankTeaseDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 18,
    },
    sweepNote: {
      alignItems: "center",
      backgroundColor: colors.warningSoft,
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    sweepText: {
      color: colors.warning,
      flex: 1,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      lineHeight: 17,
      textTransform: "uppercase",
    },
    rankGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    rankCard: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderWidth: 1,
      flex: 1,
      minWidth: 138,
      padding: 12,
    },
    championCard: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    rankLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 9,
      letterSpacing: 0.7,
      lineHeight: 14,
      textTransform: "uppercase",
    },
    rankValue: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 25,
      fontVariant: ["tabular-nums"],
      lineHeight: 31,
      marginTop: 2,
    },
    rankDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },
    routeSection: {
      marginTop: 24,
    },
    routeTitle: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 27,
      paddingBottom: 3,
    },
    routeList: {
      paddingTop: 6,
    },
    pathRow: {
      alignItems: "baseline",
      flexDirection: "row",
      gap: 8,
      minHeight: 32,
      paddingVertical: 5,
    },
    pathIndex: {
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
      lineHeight: 19,
      textAlign: "right",
      width: 28,
    },
    pathTitle: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 14,
      lineHeight: 20,
    },
    pathTitleWon: {
      color: colors.success,
      fontFamily: fonts.sansSemiBold,
    },
    emptyRoute: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 14,
      lineHeight: 21,
      paddingVertical: 10,
    },
    targetMissed: {
      alignItems: "baseline",
      flexDirection: "row",
      gap: 8,
      minHeight: 32,
      paddingVertical: 5,
    },
    targetMissedMark: {
      color: colors.danger,
      fontFamily: fonts.sansBold,
      fontSize: 15,
      lineHeight: 20,
      textAlign: "right",
      width: 28,
    },
    targetMissedText: {
      color: colors.inkMuted,
      flex: 1,
      fontFamily: fonts.serifItalic,
      fontSize: 14,
      lineHeight: 20,
    },
    actions: {
      gap: 9,
      marginTop: 26,
    },
    searchTierBlock: {
      gap: 8,
      marginBottom: 2,
    },
    searchTierLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.8,
      lineHeight: 15,
      textAlign: "center",
      textTransform: "uppercase",
    },
    searchTierRow: {
      flexDirection: "row",
      gap: 8,
    },
    searchTierChip: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchTierChipActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    searchTierChipText: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      lineHeight: 18,
    },
    searchTierChipTextActive: {
      color: colors.accent,
    },
    searchTierHint: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    accountError: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    reminderNote: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    centered: {
      alignItems: "stretch",
      backgroundColor: colors.chrome,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 24,
    },
    centeredAction: {
      alignSelf: "center",
      marginTop: 4,
      minWidth: 210,
    },
    errorIcon: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.dangerSoft,
      borderRadius: 22,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    mutedText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      textAlign: "center",
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
  });
}
