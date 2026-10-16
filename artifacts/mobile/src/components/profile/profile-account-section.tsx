import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EditorialCard, SectionHeading } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { profileDeletionDescription } from "@/lib/profile-settings";
import type { ProfileSummary } from "@/lib/types";

export function ProfileAccountSection({
  deleting,
  onConfirmDeletion,
  onSignOut,
  profile,
}: {
  deleting: boolean;
  onConfirmDeletion: () => void;
  onSignOut: () => void;
  profile: ProfileSummary;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <SectionHeading title="Account" />
      <EditorialCard style={styles.card}>
        {profile.claimed ? (
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            onPress={onSignOut}
            style={({ pressed }) => [
              styles.accountButton,
              pressed && styles.pressed,
            ]}
          >
            <Feather color={colors.link} name="log-out" size={16} />
            <Text style={styles.accountButtonText}>Sign out</Text>
          </Pressable>
        ) : null}
        <Text style={styles.deleteCopy}>{profileDeletionDescription()}</Text>
        <Pressable
          accessibilityLabel="Delete account"
          accessibilityRole="button"
          accessibilityState={{ busy: deleting, disabled: deleting }}
          disabled={deleting}
          onPress={onConfirmDeletion}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
            deleting && styles.disabled,
          ]}
        >
          {deleting ? (
            <ActivityIndicator color={colors.danger} size="small" />
          ) : (
            <Feather color={colors.danger} name="trash-2" size={16} />
          )}
          <Text style={styles.deleteButtonText}>Delete account</Text>
        </Pressable>
      </EditorialCard>
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: { gap: 9 },
    card: { gap: 13, padding: 17 },
    accountButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 46,
    },
    accountButtonText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    deleteCopy: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    deleteButton: {
      alignItems: "center",
      borderColor: colors.danger,
      borderWidth: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 46,
    },
    deleteButtonText: {
      color: colors.danger,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72 },
  });
}
