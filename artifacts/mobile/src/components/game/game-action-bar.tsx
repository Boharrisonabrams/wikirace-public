import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { GameSession } from "@/lib/types";

export interface GameActionBarProps {
  articleBackAllowed: boolean;
  articleLoading: boolean;
  findOnlySearch: boolean;
  insets: EdgeInsets;
  moving: boolean;
  onBack: () => void;
  onGiveUp: () => void;
  onOpenSearch: () => void;
  session: GameSession | null;
}

export function GameActionBar({
  articleBackAllowed,
  articleLoading,
  findOnlySearch,
  insets,
  moving,
  onBack,
  onGiveUp,
  onOpenSearch,
  session,
}: GameActionBarProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {articleBackAllowed ? (
        <Pressable
          accessibilityHint="Returns to the previous article and counts as a click."
          accessibilityLabel="Back one article"
          accessibilityRole="button"
          role="button"
          disabled={!session || moving || session.path.length <= 1}
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
            (!session || moving || session.path.length <= 1) && styles.disabled,
          ]}
        >
          <Ionicons color={colors.ink} name="arrow-back" size={17} />
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityHint={
          findOnlySearch
            ? "Find text inside this article."
            : "Search this page’s links and text."
        }
        accessibilityLabel={
          findOnlySearch ? "Find in this article" : "Search this page"
        }
        accessibilityRole="button"
        role="button"
        disabled={!session || articleLoading || moving}
        onPress={onOpenSearch}
        style={({ pressed }) => [
          styles.searchButton,
          pressed && styles.pressed,
          (!session || articleLoading || moving) && styles.disabled,
        ]}
        testID="search-open"
      >
        <Ionicons color={colors.onAccent} name="search" size={17} />
        <Text style={styles.searchButtonText}>
          {findOnlySearch ? "Find" : "Search"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Give up"
        accessibilityRole="button"
        role="button"
        disabled={!session || moving}
        onPress={onGiveUp}
        style={({ pressed }) => [
          styles.giveUpButton,
          pressed && styles.pressed,
          (!session || moving) && styles.disabled,
        ]}
      >
        <Text style={styles.giveUpButtonText}>Give up</Text>
      </Pressable>
    </View>
  );
}

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    actionBar: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.borderSoft,
      borderRadius: radius.medium,
      borderWidth: 1,
      flex: 0.85,
      flexDirection: "row",
      gap: 6,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    secondaryButtonText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    searchButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radius.medium,
      flex: 1.2,
      flexDirection: "row",
      gap: 7,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    searchButtonText: {
      color: colors.onAccent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    giveUpButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.medium,
      borderWidth: 1,
      flex: 0.8,
      height: 48,
      justifyContent: "center",
      paddingHorizontal: 10,
    },
    giveUpButtonText: {
      color: colors.ink,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
