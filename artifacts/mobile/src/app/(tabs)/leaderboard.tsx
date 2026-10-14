import Feather from "@expo/vector-icons/Feather";
import { useFocusEffect } from "expo-router";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExpandableFinisherRow } from "@/components/expandable-finisher-row";
import { SectionHeading } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";
import { getDailyChallenge, getDailyLeaderboard } from "@/lib/api";
import { puzzleNumber } from "@/lib/game-utils";
import {
  buildLeaderboardRowPresentation,
  leaderboardBoardCopy,
} from "@/lib/result-presentation";
import type { DailyBoard, DailyChallenge, LeaderboardEntry } from "@/lib/types";

export default function LeaderboardScreen() {
  const theme = useAppTheme();
  const { colors } = theme;
  const { top } = useSafeAreaInsets();
  const { user } = useAuthSession();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [board, setBoard] = useState<DailyBoard>("shortest");
  const [audience, setAudience] = useState<"all" | "friends">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRowKey, setExpandedRowKey] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const loadInFlight = useRef(false);
  const activeLoad = useRef<{
    board: DailyBoard;
    audience: "all" | "friends";
  } | null>(null);
  const queuedLoad = useRef<{
    board: DailyBoard;
    audience: "all" | "friends";
  } | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const topPadding = Platform.OS === "web" ? 34 : top + 14;
  const styles = useMemo(
    () => makeStyles(theme, topPadding),
    [theme, topPadding],
  );

  const boardCopy = leaderboardBoardCopy(board);

  const load = useCallback(
    async (nextBoard: DailyBoard, nextAudience: "all" | "friends") => {
      if (loadInFlight.current) {
        const current = activeLoad.current;
        if (current?.board === nextBoard && current.audience === nextAudience) {
          return;
        }
        queuedLoad.current = { board: nextBoard, audience: nextAudience };
        return;
      }
      loadInFlight.current = true;
      activeLoad.current = { board: nextBoard, audience: nextAudience };
      const requestId = ++requestSequence.current;
      setError(null);
      try {
        const daily = await getDailyChallenge();
        const board = await getDailyLeaderboard(
          daily.challenge.id,
          nextAudience === "friends",
          nextBoard,
        );
        if (requestId !== requestSequence.current) return;
        setChallenge(daily.challenge);
        setEntries(board.leaderboard);
        setExpandedRowKey(null);
      } catch (err) {
        if (requestId !== requestSequence.current) return;
        setEntries([]);
        setError(
          err instanceof Error ? err.message : "Could not load leaderboard",
        );
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
          setRefreshing(false);
        }
        loadInFlight.current = false;
        activeLoad.current = null;
        const queued = queuedLoad.current;
        queuedLoad.current = null;
        if (queued) {
          setLoading(true);
          void load(queued.board, queued.audience);
        }
      }
    },
    [],
  );

  const refresh = useCallback(
    (nextBoard: DailyBoard, nextAudience: "all" | "friends") => {
      setLoading(true);
      void load(nextBoard, nextAudience);
    },
    [load],
  );

  useFocusEffect(
    useCallback(() => {
      refresh(board, audience);
      return () => {
        requestSequence.current += 1;
      };
    }, [audience, board, refresh]),
  );

  useEffect(() => {
    const onAppStateChange = (nextState: AppStateStatus) => {
      if (appStateRef.current !== "active" && nextState === "active") {
        refresh(board, audience);
      }
      appStateRef.current = nextState;
    };
    const subscription = AppState.addEventListener("change", onAppStateChange);
    return () => subscription.remove();
  }, [audience, board, refresh]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              refresh(board, audience);
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" selectable style={styles.title}>
            Daily ranking
          </Text>
          {challenge ? (
            <Text selectable style={styles.subtitle}>
              No. {puzzleNumber(challenge.date)} · {challenge.startTitle}{" "}
              <Text style={styles.routeArrow}>→</Text> {challenge.endTitle}
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Today's fastest encyclopedia paths.
            </Text>
          )}
        </View>

        <View style={styles.hatnote}>
          <Text style={styles.hatnoteText}>{boardCopy.explanation}</Text>
        </View>

        <View
          accessibilityLabel="Leaderboard metric"
          accessibilityRole="tablist"
          style={styles.segment}
        >
          <SegmentButton
            active={board === "shortest"}
            label="Shortest"
            onPress={() => setBoard("shortest")}
          />
          <SegmentButton
            active={board === "fastest"}
            label="Fastest"
            onPress={() => setBoard("fastest")}
          />
        </View>

        <View
          accessibilityLabel="Leaderboard audience"
          accessibilityRole="tablist"
          style={styles.audienceSegment}
        >
          <SegmentButton
            active={audience === "all"}
            compact
            label="Everyone"
            onPress={() => setAudience("all")}
          />
          <SegmentButton
            active={audience === "friends"}
            compact
            label="Friends"
            onPress={() => setAudience("friends")}
          />
        </View>

        <View style={styles.section}>
          <SectionHeading title={boardCopy.title} />
          <View style={styles.panel}>
            {loading ? (
              <View style={styles.centeredBlock}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.loadingText}>Reading today's results…</Text>
              </View>
            ) : error ? (
              <View style={styles.centeredBlock}>
                <Feather
                  accessibilityElementsHidden
                  color={colors.danger}
                  importantForAccessibility="no-hide-descendants"
                  name="alert-circle"
                  size={20}
                />
                <Text
                  accessibilityRole="alert"
                  selectable
                  style={styles.errorText}
                >
                  {error}
                </Text>
              </View>
            ) : entries.length === 0 ? (
              <View style={styles.centeredBlock}>
                <Feather
                  accessibilityElementsHidden
                  color={colors.inkMuted}
                  importantForAccessibility="no-hide-descendants"
                  name="book-open"
                  size={22}
                />
                <Text selectable style={styles.emptyTitle}>
                  No finishes yet
                </Text>
                <Text selectable style={styles.emptyText}>
                  {audience === "friends"
                    ? "No friend has finished today's race."
                    : "Be first and set the score to beat."}
                </Text>
              </View>
            ) : (
              entries.map((entry, index) => {
                const isMe = user?.id === entry.user_id;
                const row = buildLeaderboardRowPresentation(entry, board, isMe);
                return (
                  <ExpandableFinisherRow
                    key={`${entry.user_id}-${row.rank}`}
                    expanded={
                      expandedRowKey ===
                      `${entry.user_id}-${entry.completed_at}-${row.rank}`
                    }
                    onToggle={() =>
                      setExpandedRowKey((current) => {
                        const next = `${entry.user_id}-${entry.completed_at}-${row.rank}`;
                        return current === next ? null : next;
                      })
                    }
                    path={entry.path}
                    pathTestID={`leaderboard-path-${entry.user_id}-${row.rank}`}
                  >
                    <View
                      accessible
                      accessibilityLabel={row.accessibilityLabel}
                      style={[
                        styles.row,
                        isMe && styles.myRow,
                        index === entries.length - 1 && styles.rowLast,
                      ]}
                    >
                      <Text
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        selectable
                        style={[styles.rank, row.rank <= 3 && styles.podiumRank]}
                      >
                        {row.rank}
                      </Text>
                      <View style={styles.rowBody}>
                        <View style={styles.player}>
                          <Text
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            selectable
                            style={styles.name}
                          >
                            {entry.display_name || entry.username}
                            {isMe ? " (you)" : ""}
                          </Text>
                          <Text
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            selectable
                            style={styles.username}
                          >
                            @{entry.username}
                          </Text>
                        </View>
                        <View style={styles.score}>
                          <Text
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            selectable
                            style={styles.primaryScore}
                          >
                            {row.primary}
                          </Text>
                          <Text
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                            selectable
                            style={styles.secondaryScore}
                          >
                            {row.secondary}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </ExpandableFinisherRow>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  function SegmentButton({
    active,
    compact,
    label,
    onPress,
  }: {
    active: boolean;
    compact?: boolean;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.segmentButton,
          compact && styles.segmentButtonCompact,
          active && styles.segmentButtonActive,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
          {label}
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
      gap: 16,
      paddingBottom: 32,
      paddingHorizontal: 20,
      paddingTop: topPadding,
    },
    header: {
      gap: 4,
    },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 30,
      lineHeight: 36,
    },
    subtitle: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 13,
      lineHeight: 19,
    },
    routeArrow: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
    },
    hatnote: {
      borderLeftColor: colors.borderSoft,
      borderLeftWidth: 3,
      paddingLeft: 12,
    },
    hatnoteText: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 12,
      lineHeight: 18,
    },
    segment: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      flexDirection: "row",
      overflow: "hidden",
    },
    segmentButton: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
    },
    segmentButtonActive: {
      backgroundColor: colors.ink,
    },
    segmentText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    segmentTextActive: {
      color: colors.chrome,
    },
    audienceSegment: {
      alignSelf: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      flexDirection: "row",
      maxWidth: 310,
      overflow: "hidden",
      width: "100%",
    },
    segmentButtonCompact: {
      minHeight: 44,
    },
    section: {
      gap: 10,
    },
    panel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.small,
      borderWidth: 1,
      overflow: "hidden",
    },
    centeredBlock: {
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
      minHeight: 180,
      padding: 22,
    },
    loadingText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
    },
    emptyTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 18,
    },
    emptyText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    row: {
      alignItems: "flex-start",
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 12,
      padding: 14,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    myRow: {
      backgroundColor: colors.accentSoft,
    },
    rank: {
      color: colors.inkMuted,
      fontFamily: fonts.serifBold,
      fontSize: 20,
      fontVariant: ["tabular-nums"],
      textAlign: "center",
      width: 34,
    },
    podiumRank: {
      color: colors.warning,
    },
    player: {
      flexBasis: 150,
      flexGrow: 1,
      minWidth: 0,
    },
    rowBody: {
      alignItems: "flex-start",
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      minWidth: 0,
    },
    name: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    username: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 11,
      marginTop: 2,
    },
    score: {
      alignItems: "flex-end",
      flexBasis: 92,
      flexGrow: 1,
      maxWidth: 150,
    },
    primaryScore: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
      lineHeight: 16,
      textAlign: "right",
    },
    secondaryScore: {
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 10,
      fontVariant: ["tabular-nums"],
      lineHeight: 15,
      marginTop: 2,
      textAlign: "right",
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
