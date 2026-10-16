import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { ResultPresentation } from "@/lib/result-presentation";
import type { GameResult } from "@/lib/types";

export function ResultMasthead({
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
    </>
  );
}

function makeStyles({ colors, fonts, isDark }: AppTheme) {
  return StyleSheet.create({
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
  });
}
