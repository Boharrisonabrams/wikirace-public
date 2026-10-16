import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { EditorialCard, SectionHeading } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { formatTime } from "@/lib/game-utils";
import type { ProfileStats } from "@/lib/types";

export function ProfileRecordSection({
  stats,
  winRate,
}: {
  stats: ProfileStats;
  winRate: number;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <SectionHeading title="Record" />
      <EditorialCard style={styles.statsGrid}>
        <StatCell label="Played" value={String(stats.gamesPlayed)} />
        <StatCell label="Won" value={String(stats.gamesWon)} />
        <StatCell label="Win rate" value={`${winRate}%`} />
        <StatCell
          label="Best path"
          value={stats.bestClicks == null ? "—" : String(stats.bestClicks)}
        />
        <StatCell
          label="Fastest"
          value={
            stats.fastestTimeMs == null
              ? "—"
              : formatTime(Math.round(stats.fastestTimeMs / 1_000))
          }
        />
        <StatCell label="Streak" value={String(stats.currentStreak)} />
      </EditorialCard>
    </View>
  );

  function StatCell({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.statCell}>
        <Text selectable style={styles.statValue}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: { gap: 9 },
    statsGrid: { flexDirection: "row", flexWrap: "wrap" },
    statCell: {
      alignItems: "center",
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.borderSoft,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 5,
      paddingVertical: 13,
      width: "33.333%",
    },
    statValue: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 20,
      lineHeight: 25,
    },
    statLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
  });
}
