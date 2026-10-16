import { useMemo } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { EditorialCard, SectionHeading } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function HomeHowToPlay({
  onLayout,
}: {
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View onLayout={onLayout} style={styles.section}>
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
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 10,
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
  });
}
