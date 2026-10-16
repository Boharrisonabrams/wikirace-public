import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EditorialCard, SectionHeading } from "@/components/editorial-ui";
import { pluralize } from "@/components/home/pluralize";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { formatTime } from "@/lib/game-utils";
import type { ProfileStats } from "@/lib/types";

export function HomeStatsSection({ stats }: { stats: ProfileStats }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
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
  );

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
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 10,
    },
    statsCard: {
      overflow: "hidden",
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
  });
}
