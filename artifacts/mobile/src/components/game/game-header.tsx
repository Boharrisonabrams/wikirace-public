import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

import { GamePathMap } from "@/components/game-path-map";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { formatTime } from "@/lib/game-utils";
import type { SearchSheetMode } from "@/lib/game-search";
import type { GameSession } from "@/lib/types";

export interface GameHeaderProps {
  activeTimeMs: number;
  attemptLabel: string;
  insets: EdgeInsets;
  moving: boolean;
  notice: string | null;
  onExit: () => void;
  onTargetPress: () => void;
  screenTitle: string;
  searchMode: SearchSheetMode;
  session: GameSession | null;
}

export function GameHeader({
  activeTimeMs,
  attemptLabel,
  insets,
  moving,
  notice,
  onExit,
  onTargetPress,
  screenTitle,
  searchMode,
  session,
}: GameHeaderProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={[styles.chrome, { paddingTop: Math.max(insets.top, 8) + 4 }]}>
      <View style={styles.headerTopRow}>
        <View style={styles.headerControls}>
          <Pressable
            accessibilityHint="Returns Home. Use Give up to end this race."
            accessibilityLabel="Exit race"
            accessibilityRole="button"
            role="button"
            disabled={moving}
            hitSlop={4}
            onPress={onExit}
            style={({ pressed }) => [
              styles.exitButton,
              pressed && styles.pressed,
              moving && styles.disabled,
            ]}
          >
            <Ionicons color={colors.ink} name="close" size={22} />
          </Pressable>
        </View>
        <View style={styles.headerStatus}>
          <Text style={styles.attemptBadge}>{attemptLabel}</Text>
          <Text
            accessibilityLabel={`${screenTitle}. ${attemptLabel}. ${session?.clicks ?? 0} ${
              session?.clicks === 1 ? "click" : "clicks"
            }. Active time ${formatTime(Math.floor(activeTimeMs / 1_000))}.`}
            selectable
            style={styles.headerMeta}
          >
            {session?.clicks ?? 0} {session?.clicks === 1 ? "click" : "clicks"}
            {" · Active "}
            {formatTime(Math.floor(activeTimeMs / 1_000))}
          </Text>
        </View>
      </View>

      <GamePathMap
        compact={searchMode !== "closed"}
        onTargetPress={onTargetPress}
        path={session?.path ?? []}
        targetDescription={session?.endDescription ?? null}
        target={session?.endArticle ?? "Target"}
      />

      {notice ? (
        <Text selectable style={styles.notice}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    chrome: {
      backgroundColor: colors.chrome,
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingBottom: 9,
    },
    headerTopRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    headerControls: {
      alignItems: "center",
      flexDirection: "row",
      gap: 4,
    },
    exitButton: {
      alignItems: "center",
      height: 44,
      justifyContent: "center",
      marginLeft: -8,
      width: 44,
    },
    headerStatus: {
      alignItems: "flex-end",
      gap: 3,
    },
    attemptBadge: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.borderSoft,
      borderRadius: radius.small,
      borderWidth: 1,
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 9,
      letterSpacing: 0.8,
      overflow: "hidden",
      paddingHorizontal: 7,
      paddingVertical: 3,
      textTransform: "uppercase",
    },
    headerMeta: {
      color: colors.inkMuted,
      fontFamily: fonts.mono,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    notice: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 14,
      paddingTop: 2,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
