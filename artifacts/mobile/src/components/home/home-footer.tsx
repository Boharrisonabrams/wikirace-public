import Feather from "@expo/vector-icons/Feather";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function HomeFooter({
  isClaimed,
  onSignOut,
  versionStamp,
}: {
  isClaimed: boolean;
  onSignOut: () => void;
  versionStamp: string;
}) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      {isClaimed ? (
        <Pressable
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          onPress={onSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
        >
          <Feather
            accessibilityElementsHidden
            color={colors.inkMuted}
            importantForAccessibility="no-hide-descendants"
            name="log-out"
            size={14}
          />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}

      <Text selectable style={styles.versionStamp}>
        {versionStamp}
      </Text>
    </>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    signOut: {
      alignItems: "center",
      alignSelf: "center",
      flexDirection: "row",
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    signOutText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      textDecorationLine: "underline",
    },
    versionStamp: {
      alignSelf: "center",
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 16,
      marginTop: -8,
      paddingBottom: 4,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
