import { router } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import {
  EditorialCard,
  PrimaryAction,
  SecondaryAction,
} from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function HomeLoadingCard() {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <EditorialCard style={styles.loadingCard}>
      <ActivityIndicator color={colors.accent} />
      <Text accessibilityLiveRegion="polite" style={styles.loadingText}>
        Opening today's encyclopedia…
      </Text>
    </EditorialCard>
  );
}

export function HomeErrorCard({
  bootstrapError,
  error,
  onRetry,
}: {
  bootstrapError: string | null;
  error: string;
  onRetry: () => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <EditorialCard style={styles.errorCard}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        {error}
      </Text>
      <PrimaryAction icon="refresh-cw" label="Try again" onPress={onRetry} />
      {bootstrapError ? (
        <SecondaryAction
          icon="log-in"
          label="Sign in with email"
          onPress={() => router.push("/login")}
        />
      ) : null}
    </EditorialCard>
  );
}

export function HomeUnavailableCard({ onRetry }: { onRetry: () => void }) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <EditorialCard style={styles.errorCard}>
      <Text accessibilityRole="alert" style={styles.errorText}>
        Today's challenge is unavailable. Pull to refresh and try again.
      </Text>
      <PrimaryAction icon="refresh-cw" label="Try again" onPress={onRetry} />
    </EditorialCard>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    loadingCard: {
      alignItems: "center",
      gap: 10,
      justifyContent: "center",
      minHeight: 180,
      padding: 24,
    },
    loadingText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
    },
    errorCard: {
      gap: 14,
      padding: 18,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
  });
}
