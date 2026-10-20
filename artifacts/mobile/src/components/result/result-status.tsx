import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryAction } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function ResultLoadingView() {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View accessibilityLiveRegion="polite" style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
      <Text selectable style={styles.mutedText}>
        Saving result…
      </Text>
    </View>
  );
}

export function ResultErrorView({ error }: { error: string | null }) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.centered}>
      <View style={styles.errorIcon}>
        <Feather color={colors.danger} name="alert-circle" size={22} />
      </View>
      <Text accessibilityRole="alert" selectable style={styles.errorText}>
        {error ?? "Result unavailable."}
      </Text>
      <View style={styles.centeredAction}>
        <PrimaryAction
          icon="home"
          label="Back home"
          onPress={() => router.dismissTo("/")}
          testID="result-error-home"
        />
      </View>
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    centered: {
      alignItems: "stretch",
      backgroundColor: colors.chrome,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 24,
    },
    centeredAction: {
      alignSelf: "center",
      marginTop: 4,
      minWidth: 210,
    },
    errorIcon: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.dangerSoft,
      borderRadius: 22,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    mutedText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      textAlign: "center",
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
  });
}
