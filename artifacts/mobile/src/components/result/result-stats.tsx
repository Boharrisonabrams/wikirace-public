import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { ResultPresentation } from "@/lib/result-presentation";
import type { GameResult } from "@/lib/types";

export function ResultStats({
  presentation,
  result,
}: {
  presentation: ResultPresentation;
  result: GameResult;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
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
    </>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
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
  });
}
