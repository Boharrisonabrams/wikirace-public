import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { ResultPresentation } from "@/lib/result-presentation";
import type { GameResult } from "@/lib/types";

export function ResultRoute({
  presentation,
  result,
}: {
  presentation: ResultPresentation;
  result: GameResult;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
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
    </>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
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
  });
}
