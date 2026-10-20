import Feather from "@expo/vector-icons/Feather";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Updates from "expo-updates";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  SectionHeading,
  WikiRaceWordmark,
} from "@/components/editorial-ui";
import { HomeDailyActions } from "@/components/home/home-daily-actions";
import { HomeDebugReminderCard } from "@/components/home/home-debug-reminder-card";
import { HomeFooter } from "@/components/home/home-footer";
import { HomeHowToPlay } from "@/components/home/home-how-to-play";
import { HomeSeeAlso } from "@/components/home/home-see-also";
import { HomeStatsSection } from "@/components/home/home-stats-section";
import {
  HomeErrorCard,
  HomeLoadingCard,
  HomeUnavailableCard,
} from "@/components/home/home-status-cards";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { editorialType } from "@/constants/theme";
import { getDailyChallenge, getProfile } from "@/lib/api";
import {
  isCurrentDailyDate,
  isCurrentDailySessionDate,
} from "@/lib/daily-date";
import { puzzleNumber } from "@/lib/game-utils";
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
          <HomeDebugReminderCard
            debugReminderControl={debugReminderControl}
            debugReminderStatus={debugReminderStatus}
            onSchedule={() => void scheduleDebugReminder()}
          />
        ) : null}

        {loading || authLoading ? (
          <HomeLoadingCard />
        ) : error ? (
          <HomeErrorCard
            bootstrapError={bootstrapError}
            error={error}
            onRetry={() => {
              if (bootstrapError) retryBootstrap();
              else refresh();
            }}
          />
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

              <HomeDailyActions
                accountAction={accountAction}
                completed={completed}
                onAccount={() => void openAccountAction()}
                onPrimary={openPrimaryAction}
                onReplay={openReplayAction}
                primaryAction={primaryAction}
                profileClaimError={profileClaimError}
                profileClaimLoading={profileClaimLoading}
                replayAction={replayAction}
                session={session}
                signedIn={Boolean(user)}
              />
            </View>
          </EditorialCard>
        ) : (
          <HomeUnavailableCard onRetry={refresh} />
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
          <HomeStatsSection stats={stats} />
        ) : null}

        <HomeSeeAlso
          onHowToPlay={scrollToHowToPlay}
          onLeaderboard={openLeaderboard}
          onPractice={startPractice}
          signedIn={Boolean(user)}
        />

        <HomeHowToPlay onLayout={captureHowToOffset} />

        <HomeFooter
          isClaimed={isClaimed}
          onSignOut={() => void signOut()}
          versionStamp={VERSION_STAMP}
        />
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
    section: {
      gap: 10,
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
    pressed: {
      opacity: 0.68,
    },
  });
}
