import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Platform,
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
import { ResultMasthead } from "@/components/result/result-masthead";
import { ResultRoute } from "@/components/result/result-route";
import { ResultSearchTierChoice } from "@/components/result/result-search-tier-choice";
import { ResultStandings } from "@/components/result/result-standings";
import { ResultStats } from "@/components/result/result-stats";
import {
  ResultErrorView,
  ResultLoadingView,
} from "@/components/result/result-status";
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
    return <ResultLoadingView />;
  }

  if (error || !result || !presentation) {
    return <ResultErrorView error={error} />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={styles.page}
    >
      <EditorialCard style={styles.resultCard}>
        <ResultMasthead presentation={presentation} result={result} />

        <ResultStats presentation={presentation} result={result} />

        <ResultStandings presentation={presentation} />

        <ResultRoute presentation={presentation} result={result} />

        <View style={styles.actions}>
          <ResultSearchTierChoice
            selected={searchTier}
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

function makeStyles({ colors, fonts }: AppTheme) {
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
    actions: {
      gap: 9,
      marginTop: 26,
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
  });
}
