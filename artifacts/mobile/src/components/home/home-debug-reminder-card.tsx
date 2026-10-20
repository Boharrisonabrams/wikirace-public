import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { EditorialCard } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type {
  DebugReminderStatus,
  getDebugReminderControl,
} from "@/lib/reminder-ui";

export function HomeDebugReminderCard({
  debugReminderControl,
  debugReminderStatus,
  onSchedule,
}: {
  debugReminderControl: NonNullable<ReturnType<typeof getDebugReminderControl>>;
  debugReminderStatus: DebugReminderStatus;
  onSchedule: () => void;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <EditorialCard style={styles.debugReminderCard}>
      <Text style={styles.debugReminderTitle}>
        Development notification proof
      </Text>
      <Pressable
        accessibilityLabel={debugReminderControl.accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{
          busy: debugReminderStatus === "loading",
          disabled: debugReminderControl.disabled,
        }}
        disabled={debugReminderControl.disabled}
        onPress={onSchedule}
        role="button"
        style={({ pressed }) => [
          styles.debugReminderAction,
          pressed && styles.pressed,
        ]}
        testID={debugReminderControl.buttonTestID}
      >
        <Feather
          accessibilityElementsHidden
          color={colors.link}
          importantForAccessibility="no-hide-descendants"
          name="bell"
          size={15}
        />
        <Text style={styles.debugReminderActionText}>
          {debugReminderControl.buttonLabel}
        </Text>
      </Pressable>
      <Text
        accessibilityLiveRegion="polite"
        selectable
        style={[
          styles.debugReminderStatus,
          debugReminderStatus === "error" && styles.errorText,
        ]}
        testID={debugReminderControl.statusTestID}
      >
        {debugReminderControl.statusText}
      </Text>
    </EditorialCard>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    debugReminderCard: {
      gap: 10,
      padding: 14,
    },
    debugReminderTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    debugReminderAction: {
      alignItems: "center",
      borderColor: colors.border,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    debugReminderActionText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    debugReminderStatus: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
