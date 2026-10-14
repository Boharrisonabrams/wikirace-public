import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditorialCard,
  PrimaryAction,
  SecondaryAction,
  SectionHeading,
  WikiRaceWordmark,
} from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { editorialType } from "@/constants/theme";
import { getDailyChallenge, getProfile } from "@/lib/api";
import {
  isCurrentDailyDate,
  isCurrentDailySessionDate,
} from "@/lib/daily-date";
import { formatTime, progressSavedCopy, puzzleNumber } from "@/lib/game-utils";
import {
  formatIssuedDate,
  getHomeAccountAction,
  getHomeIdentityChip,
  getHomePrimaryAction,
  getHomeReplayAction,
} from "@/lib/home-model";
import { finalizeProfileClaim } from "@/lib/profile-claim";
import { CREATE_PRIVATE_CHALLENGE_ROUTE } from "@/lib/private-challenge";
import {
  getDebugReminderControl,
  type DebugReminderStatus,
} from "@/lib/reminder-ui";
import { scheduleReminderTest } from "@/lib/reminders";
import { getSupabase } from "@/lib/supabase";
import { formatMobileVersionStamp } from "@/lib/version-stamp";
import type { DailyChallenge, GameSession, ProfileStats } from "@/lib/types";

function pluralize(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function impact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS !== "web") void Haptics.impactAsync(style);
}

const IS_DEVELOPMENT = typeof __DEV__ !== "undefined" && __DEV__;
const VERSION_STAMP = formatMobileVersionStamp({
  version: Constants.expoConfig?.version ?? "unknown",
  isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  createdAt: Updates.createdAt ?? null,
});

export default function HomeScreen() {
  const { debugReminder } = useLocalSearchParams<{
    debugReminder?: string | string[];
  }>();
  const theme = useAppTheme();
  const { colors } = theme;
  const { top } = useSafeAreaInsets();
  const {
    bootstrapError,
    isClaimed,
    isGuest,
    loading: authLoading,
    retryBootstrap,
    user,
  } = useAuthSession();
  const scrollRef = useRef<ScrollView>(null);
  const howToOffset = useRef(0);
  const requestSequence = useRef(0);
  const loadInFlight = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [localDate, setLocalDate] = useState<string | null>(null);
  const [replayAvailable, setReplayAvailable] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [profileClaimed, setProfileClaimed] = useState<boolean | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [profileClaimError, setProfileClaimError] = useState<string | null>(
    null,
  );
  const [profileClaimLoading, setProfileClaimLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugReminderStatus, setDebugReminderStatus] =
    useState<DebugReminderStatus>("idle");
  const topPadding = Platform.OS === "web" ? 34 : top + 14;
  const styles = useMemo(
    () => makeStyles(theme, topPadding),
    [theme, topPadding],
  );
  const debugReminderControl = getDebugReminderControl(
    IS_DEVELOPMENT,
    debugReminder,
    debugReminderStatus,
  );

  const load = useCallback(async () => {
    if (authLoading) return;
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (bootstrapError) {
      setError(bootstrapError);
      setLoading(false);
      setRefreshing(false);
      loadInFlight.current = false;
      return;
    }
    const requestId = ++requestSequence.current;
    setError(null);
    try {
      const daily = await getDailyChallenge();
      let nextStats: ProfileStats | null = null;
      let nextProfileClaimed: boolean | null = null;
      let nextProfileUsername: string | null = null;
      if (user) {
        const profile = await getProfile();
        nextStats = profile.stats;
        nextProfileClaimed = profile.profile.claimed;
        nextProfileUsername = profile.profile.username;
      }
      if (requestId !== requestSequence.current) return;
      setChallenge(daily.challenge);
      setSession(daily.session);
      setLocalDate(daily.localDate);
      setReplayAvailable(daily.replayAvailable);
      setStats(nextStats);
      setProfileClaimed(nextProfileClaimed);
      setProfileUsername(nextProfileUsername);
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : "Could not load WikiRace");
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
      loadInFlight.current = false;
    }
  }, [authLoading, bootstrapError, user]);

  const refresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        requestSequence.current += 1;
      };
    }, [refresh]),
  );

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (appStateRef.current !== "active" && nextState === "active") {
        refresh();
      }
      appStateRef.current = nextState;
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [refresh]);

  const staleChallenge = challenge
    ? !isCurrentDailyDate(localDate ?? challenge.date)
    : false;
  const staleSession = session ? !isCurrentDailySessionDate(session) : false;
  const staleDailyState = staleChallenge || staleSession;

  useEffect(() => {
    if (!staleDailyState || loading) return;
    setChallenge(null);
    setSession(null);
    setLocalDate(null);
    setReplayAvailable(false);
    refresh();
  }, [loading, refresh, staleDailyState]);

  async function signOut() {
    impact(Haptics.ImpactFeedbackStyle.Light);
    await getSupabase().auth.signOut();
    setSession(null);
    setLocalDate(null);
    setReplayAvailable(false);
    setStats(null);
    setProfileClaimed(null);
    setProfileUsername(null);
  }

  const primaryAction = getHomePrimaryAction({
    authenticated: Boolean(user),
    challenge,
    isGuest,
    profileClaimed,
    session,
  });
  const accountAction = getHomeAccountAction({ isGuest, profileClaimed });
  const replayAction = getHomeReplayAction({
    challenge,
    isGuest,
    profileClaimed,
    replayAvailable,
    session,
  });
  const identityChip = getHomeIdentityChip({
    isGuest,
    profileClaimed,
    username: profileUsername,
  });
  const completed = session?.completed ?? false;

  function openPrimaryAction() {
    if (!primaryAction) return;
    impact(Haptics.ImpactFeedbackStyle.Medium);
    router.push(primaryAction.destination);
  }

  function openReplayAction() {
    if (!replayAction) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    router.push(replayAction.destination);
  }

  async function openAccountAction() {
    if (!accountAction) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    if (accountAction.kind === "navigate") {
      router.push(accountAction.destination);
      return;
    }
    if (profileClaimLoading) return;

    setProfileClaimLoading(true);
    setProfileClaimError(null);
    try {
      await finalizeProfileClaim();
      setProfileClaimed(true);
    } catch (claimError) {
      const message =
        claimError instanceof Error
          ? claimError.message
          : "Could not finish account setup.";
      setProfileClaimError(`${message} Try again.`);
    } finally {
      setProfileClaimLoading(false);
    }
  }

  function startPractice() {
    impact(Haptics.ImpactFeedbackStyle.Light);
    router.push("/game?type=practice");
  }

  function createPrivateGame() {
    impact(Haptics.ImpactFeedbackStyle.Light);
    router.push(CREATE_PRIVATE_CHALLENGE_ROUTE);
  }

  function openLeaderboard() {
    impact(Haptics.ImpactFeedbackStyle.Light);
    router.push("/leaderboard");
  }

  function openProfile() {
    impact(Haptics.ImpactFeedbackStyle.Light);
    router.push("/profile");
  }

  function scrollToHowToPlay() {
    scrollRef.current?.scrollTo({
      y: Math.max(howToOffset.current - 12, 0),
      animated: true,
    });
  }

  function captureHowToOffset(event: LayoutChangeEvent) {
    howToOffset.current = event.nativeEvent.layout.y;
  }

  async function scheduleDebugReminder() {
    if (!debugReminderControl || debugReminderStatus === "loading") return;
    setDebugReminderStatus("loading");
    try {
      await scheduleReminderTest(60);
      setDebugReminderStatus("scheduled");
    } catch {
      setDebugReminderStatus("error");
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <WikiRaceWordmark />

        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel={`Profile. ${identityChip.label}`}
            accessibilityRole="button"
            onPress={openProfile}
            style={({ pressed }) => [
              styles.identityChip,
              identityChip.tone === "saved"
                ? styles.identityChipSaved
                : identityChip.tone === "setup"
                  ? styles.identityChipSetup
                  : styles.identityChipGuest,
              pressed && styles.pressed,
            ]}
            testID="home-identity-chip"
          >
            <Feather
              accessibilityElementsHidden
              color={colors.inkMuted}
              importantForAccessibility="no-hide-descendants"
              name="user"
              size={13}
            />
            <Text style={styles.identityChipText}>{identityChip.label}</Text>
          </Pressable>
        </View>

        <View style={styles.hatnote}>
          <Text style={styles.hatnoteText}>
            For today's shared race, see Today's challenge. For a new route, see
            Practice mode.
          </Text>
        </View>

        {debugReminderControl ? (
          <EditorialCard style={styles.debugReminderCard}>
            <Text style={styles.debugReminderTitle}>
              Development notification proof
            </Text>
            <Pressable
              accessibilityLabel={debugReminderControl.accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{
                busy: debugReminderStatus === "loading",
                disabled: debugReminderControl.disabled,
              }}
              disabled={debugReminderControl.disabled}
              onPress={() => void scheduleDebugReminder()}
              role="button"
              style={({ pressed }) => [
                styles.debugReminderAction,
                pressed && styles.pressed,
              ]}
              testID={debugReminderControl.buttonTestID}
            >
              <Feather
                accessibilityElementsHidden
                color={colors.link}
                importantForAccessibility="no-hide-descendants"
                name="bell"
                size={15}
              />
              <Text style={styles.debugReminderActionText}>
                {debugReminderControl.buttonLabel}
              </Text>
            </Pressable>
            <Text
              accessibilityLiveRegion="polite"
              selectable
              style={[
                styles.debugReminderStatus,
                debugReminderStatus === "error" && styles.errorText,
              ]}
              testID={debugReminderControl.statusTestID}
            >
              {debugReminderControl.statusText}
            </Text>
          </EditorialCard>
        ) : null}

        {loading || authLoading ? (
          <EditorialCard style={styles.loadingCard}>
            <ActivityIndicator color={colors.accent} />
            <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
              Opening today's encyclopedia…
            </Text>
          </EditorialCard>
        ) : error ? (
          <EditorialCard style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              {error}
            </Text>
            <PrimaryAction
              icon="refresh-cw"
              label="Try again"
              onPress={() => {
                if (bootstrapError) retryBootstrap();
                else refresh();
              }}
            />
            {bootstrapError ? (
              <SecondaryAction
                icon="log-in"
                label="Sign in with email"
                onPress={() => router.push("/login")}
              />
            ) : null}
          </EditorialCard>
        ) : challenge ? (
          <EditorialCard>
            <View style={styles.infoboxHeader}>
              <View style={styles.infoboxTitleRow}>
                <Text style={styles.infoboxTitle}>Today's challenge</Text>
                <Text style={styles.infoboxNumber}>
                  No. {puzzleNumber(challenge.date)}
                </Text>
              </View>
              <Text style={styles.infoboxKicker}>
                {completed ? "Official complete" : "Official attempt"}
              </Text>
            </View>

            <View style={styles.infoboxBody}>
              <InfoRow label="From" link value={challenge.startTitle} />
              <InfoRow label="To" link value={challenge.endTitle} />
              {challenge.endDescription ? (
                <InfoRow
                  label="Target"
                  value={`${challenge.endTitle} — ${challenge.endDescription}`}
                />
              ) : null}
              <InfoRow
                label="Issued"
                value={formatIssuedDate(localDate ?? challenge.date)}
              />
              <InfoRow
                label="Route"
                last
                value="Same start and target for everyone"
              />

              {completed && session ? (
                <View
                  style={[
                    styles.sessionNote,
                    session.won ? styles.sessionWon : styles.sessionGaveUp,
                  ]}
                >
                  <Feather
                    accessibilityElementsHidden
                    color={session.won ? colors.success : colors.warning}
                    importantForAccessibility="no-hide-descendants"
                    name={session.won ? "check-circle" : "flag"}
                    size={16}
                  />
                  <Text style={styles.sessionNoteText}>
                    {session.won
                      ? `${pluralize(session.clicks, "click")} · ${formatTime(
                          session.timeSeconds ?? 0,
                        )}`
                      : "Route archived. Tomorrow is a fresh race."}
                  </Text>
                </View>
              ) : session ? (
                <Text style={styles.resumeNote}>
                  {progressSavedCopy(session.path.length)}
                </Text>
              ) : null}

              {primaryAction ? (
                <PrimaryAction
                  icon={completed ? "book-open" : "play"}
                  label={primaryAction.label}
                  onPress={openPrimaryAction}
                  testID="play-daily-btn"
                />
              ) : null}

              {replayAction ? (
                <SecondaryAction
                  icon="rotate-ccw"
                  label={replayAction.label}
                  onPress={openReplayAction}
                  testID="replay-daily-btn"
                />
              ) : null}

              {accountAction ? (
                <>
                  <SecondaryAction
                    icon="user-plus"
                    label={accountAction.label}
                    loading={
                      accountAction.kind === "finalize-profile" &&
                      profileClaimLoading
                    }
                    onPress={() => void openAccountAction()}
                    testID="claim-account-btn"
                  />
                  {profileClaimError ? (
                    <Text
                      accessibilityRole="alert"
                      selectable
                      style={styles.accountErrorText}
                    >
                      {profileClaimError}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {!user ? (
                <SecondaryAction
                  icon="log-in"
                  label="Sign in"
                  onPress={() => router.push("/login")}
                />
              ) : null}
            </View>
          </EditorialCard>
        ) : (
          <EditorialCard style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>
              Today's challenge is unavailable. Pull to refresh and try again.
            </Text>
            <PrimaryAction
              icon="refresh-cw"
              label="Try again"
              onPress={refresh}
            />
          </EditorialCard>
        )}

        {user ? (
          <View style={styles.section}>
            <SectionHeading title="Play with friends" />
            <EditorialCard style={styles.privateGameCard}>
              <Text style={styles.privateGameTitle}>
                Make your own WikiRace
              </Text>
              <Text style={styles.privateGameDetail}>
                Pick the start and target articles, then send the challenge to
                friends.
              </Text>
              <PrimaryAction
                icon="send"
                label="Create a private game"
                onPress={createPrivateGame}
                testID="create-private-game-btn"
              />
            </EditorialCard>
          </View>
        ) : null}

        {profileClaimed === true && stats ? (
          <View style={styles.section}>
            <SectionHeading title="Official Daily statistics" />
            <EditorialCard style={styles.statsCard}>
              <StatRow label="Games played" value={String(stats.gamesPlayed)} />
              <StatRow label="Wins" value={String(stats.gamesWon)} />
              <StatRow
                label="Current streak"
                value={pluralize(stats.currentStreak, "day")}
              />
              <StatRow
                label="Best streak"
                value={pluralize(stats.longestStreak, "day")}
              />
              <StatRow
                label="Average clicks"
                value={stats.averageClicks?.toFixed(1) ?? "—"}
              />
              <StatRow
                label="Average active time"
                value={
                  stats.averageActiveTimeMs === null
                    ? "—"
                    : formatTime(Math.round(stats.averageActiveTimeMs / 1_000))
                }
              />
              <StatRow
                label="Best path"
                value={
                  stats.bestClicks === null
                    ? "—"
                    : pluralize(stats.bestClicks, "click")
                }
              />
              <StatRow
                label="Fastest solve"
                last
                value={
                  stats.fastestTimeMs === null
                    ? "—"
                    : formatTime(Math.round(stats.fastestTimeMs / 1_000))
                }
              />
            </EditorialCard>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading title="See also" />
          <View style={styles.seeAlsoList}>
            {user ? (
              <>
                <SeeAlsoLink
                  detail="random article pair"
                  label="Practice mode"
                  onPress={startPractice}
                />
                <SeeAlsoLink
                  detail="today's fastest paths"
                  label="Daily leaderboard"
                  onPress={openLeaderboard}
                />
              </>
            ) : null}
            <SeeAlsoLink
              label="How to play (rules)"
              onPress={scrollToHowToPlay}
            />
          </View>
        </View>

        <View onLayout={captureHowToOffset} style={styles.section}>
          <SectionHeading title="How to play" />
          <EditorialCard style={styles.rulesCard}>
            {[
              "You start on one Wikipedia article.",
              "Tap blue article links to move through the encyclopedia.",
              "Reach the target in as few clicks as possible.",
              "Use Find in article when you need a doorway on the current page.",
            ].map((rule, index) => (
              <View key={rule} style={styles.ruleRow}>
                <View style={styles.ruleIndex}>
                  <Text style={styles.ruleIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </EditorialCard>
        </View>

        {isClaimed ? (
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
          >
            <Feather
              accessibilityElementsHidden
              color={colors.inkMuted}
              importantForAccessibility="no-hide-descendants"
              name="log-out"
              size={14}
            />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        ) : null}

        <Text selectable style={styles.versionStamp}>
          {VERSION_STAMP}
        </Text>
      </ScrollView>
    </View>
  );

  function InfoRow({
    label,
    last,
    link,
    value,
    detail,
  }: {
    label: string;
    last?: boolean;
    link?: boolean;
    value: string;
    detail?: string | null;
  }) {
    return (
      <View style={[styles.infoRow, last && styles.infoRowLast]}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          numberOfLines={2}
          style={[styles.infoValue, link && styles.infoLink]}
        >
          {value}
        </Text>
        {detail ? <Text style={styles.infoDetail}>{detail}</Text> : null}
      </View>
    );
  }

  function StatRow({
    label,
    last,
    value,
  }: {
    label: string;
    last?: boolean;
    value: string;
  }) {
    return (
      <View style={[styles.statRow, last && styles.statRowLast]}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    );
  }

  function SeeAlsoLink({
    detail,
    label,
    onPress,
  }: {
    detail?: string;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityRole="link"
        onPress={onPress}
        style={({ pressed }) => [styles.seeAlsoItem, pressed && styles.pressed]}
      >
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.seeAlsoText}>
          <Text style={styles.seeAlsoLink}>{label}</Text>
          {detail ? (
            <Text style={styles.seeAlsoDetail}> — {detail}</Text>
          ) : null}
        </Text>
      </Pressable>
    );
  }
}

function makeStyles({ colors, fonts, radius }: AppTheme, topPadding: number) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.chrome,
      flex: 1,
    },
    content: {
      gap: 22,
      paddingBottom: 32,
      paddingHorizontal: 20,
      paddingTop: topPadding,
    },
    headerRow: {
      alignItems: "flex-start",
      marginTop: -8,
    },
    identityChip: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      minHeight: 30,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    identityChipGuest: {
      backgroundColor: colors.surface,
      borderColor: colors.borderSoft,
    },
    identityChipSaved: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    identityChipSetup: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning,
    },
    identityChipText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 16,
    },
    hatnote: {
      borderLeftColor: colors.borderSoft,
      borderLeftWidth: 3,
      paddingLeft: 12,
    },
    hatnoteText: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 13,
      lineHeight: 19,
    },
    loadingCard: {
      alignItems: "center",
      gap: 10,
      justifyContent: "center",
      minHeight: 180,
      padding: 24,
    },
    loadingText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
    },
    errorCard: {
      gap: 14,
      padding: 18,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    accountErrorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    debugReminderCard: {
      gap: 10,
      padding: 14,
    },
    debugReminderTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    debugReminderAction: {
      alignItems: "center",
      borderColor: colors.border,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    debugReminderActionText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    debugReminderStatus: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    infoboxHeader: {
      backgroundColor: colors.surfaceMuted,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    infoboxTitleRow: {
      alignItems: "baseline",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    infoboxTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 15,
      lineHeight: 19,
    },
    infoboxNumber: {
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 10,
    },
    infoboxKicker: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      letterSpacing: 1,
      marginTop: 2,
      textTransform: "uppercase",
    },
    infoboxBody: {
      gap: 12,
      padding: 14,
    },
    infoRow: {
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      minHeight: 38,
      paddingBottom: 9,
    },
    infoRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 0,
    },
    infoLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.8,
      lineHeight: 14,
      textTransform: "uppercase",
      width: 72,
    },
    infoValue: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 14,
      lineHeight: 19,
    },
    infoDetail: {
      color: colors.inkMuted,
      flex: 1,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 4,
      textAlign: "right",
    },
    infoLink: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
    },
    sessionNote: {
      alignItems: "center",
      borderRadius: radius.small,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    sessionWon: {
      backgroundColor: colors.successSoft,
    },
    sessionGaveUp: {
      backgroundColor: colors.warningSoft,
    },
    sessionNoteText: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 17,
    },
    resumeNote: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 12,
      lineHeight: 18,
    },
    section: {
      gap: 10,
    },
    statsCard: {
      overflow: "hidden",
    },
    privateGameCard: {
      gap: 10,
      padding: 14,
    },
    privateGameTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      ...editorialType.cardTitle,
    },
    privateGameDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      ...editorialType.body,
      marginBottom: 2,
    },
    statRow: {
      alignItems: "center",
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    statRowLast: {
      borderBottomWidth: 0,
    },
    statLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.serif,
      fontSize: 14,
    },
    statValue: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 14,
    },
    seeAlsoList: {
      gap: 3,
      paddingHorizontal: 4,
    },
    seeAlsoItem: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 8,
      minHeight: 44,
      paddingVertical: 6,
    },
    bullet: {
      color: colors.ink,
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 20,
    },
    seeAlsoText: {
      flex: 1,
      lineHeight: 20,
    },
    seeAlsoLink: {
      color: colors.link,
      fontFamily: fonts.serif,
      fontSize: 15,
      textDecorationColor: colors.border,
      textDecorationLine: "underline",
    },
    seeAlsoDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
    rulesCard: {
      gap: 10,
      padding: 13,
    },
    ruleRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
    },
    ruleIndex: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderColor: colors.borderSoft,
      borderRadius: 11,
      borderWidth: 1,
      height: 22,
      justifyContent: "center",
      marginTop: 1,
      width: 22,
    },
    ruleIndexText: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
    },
    ruleText: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 14,
      lineHeight: 20,
    },
    signOut: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    signOutText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      textDecorationLine: "underline",
    },
    versionStamp: {
      alignSelf: "center",
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 16,
      marginTop: -8,
      paddingBottom: 4,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
