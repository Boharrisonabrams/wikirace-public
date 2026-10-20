import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { ResultPresentation } from "@/lib/result-presentation";

export function ResultStandings({
  presentation,
}: {
  presentation: ResultPresentation;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      {presentation.rankCards.length > 0 ? (
        <View style={styles.rankingSection}>
          <Text accessibilityRole="header" selectable style={styles.routeTitle}>
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
                style={[styles.rankCard, card.champion && styles.championCard]}
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
    </>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    rankingSection: {
      gap: 9,
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
  });
}
