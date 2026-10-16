import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function GameLoadingView() {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
      <Text selectable style={styles.centeredText}>
        Loading race...
      </Text>
    </View>
  );
}

export function GameStartError({ error }: { error: string }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.centered}>
      <Text selectable style={styles.errorText}>
        {error}
      </Text>
      <Pressable
        accessibilityLabel="Back home"
        accessibilityRole="button"
        role="button"
        onPress={() => router.dismissTo("/")}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Back home</Text>
      </Pressable>
    </View>
  );
}

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    centered: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      flex: 1,
      gap: 12,
      justifyContent: "center",
      padding: 22,
    },
    centeredText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      minWidth: 160,
      paddingHorizontal: 14,
    },
    secondaryButtonText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
  });
}
