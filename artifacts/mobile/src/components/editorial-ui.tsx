import Feather from "@expo/vector-icons/Feather";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { editorialType } from "../constants/theme";

type FeatherName = ComponentProps<typeof Feather>["name"];

export function EditorialCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PrimaryAction({
  disabled,
  icon = "play",
  label,
  loading,
  onPress,
  testID,
}: {
  disabled?: boolean;
  icon?: FeatherName;
  label: string;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      role="button"
      style={({ pressed }) => [
        styles.primaryAction,
        pressed && styles.primaryActionPressed,
        inactive && styles.disabled,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.onAccent} size="small" />
      ) : (
        <>
          <Feather
            accessibilityElementsHidden
            color={theme.colors.onAccent}
            importantForAccessibility="no-hide-descendants"
            name={icon}
            size={15}
          />
          <Text style={styles.primaryActionText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SecondaryAction({
  disabled,
  icon,
  label,
  loading,
  onPress,
  testID,
}: {
  disabled?: boolean;
  icon?: FeatherName;
  label: string;
  loading?: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      role="button"
      style={({ pressed }) => [
        styles.secondaryAction,
        pressed && styles.pressed,
        inactive && styles.disabled,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.link} size="small" />
      ) : (
        <>
          {icon ? (
            <Feather
              accessibilityElementsHidden
              color={theme.colors.link}
              importantForAccessibility="no-hide-descendants"
              name={icon}
              size={15}
            />
          ) : null}
          <Text style={styles.secondaryActionText}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SectionHeading({
  editAccessibilityLabel,
  onEditPress,
  title,
}: {
  editAccessibilityLabel?: string;
  onEditPress?: () => void;
  title: string;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.sectionHeading}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {onEditPress ? (
        <Pressable
          accessibilityLabel={editAccessibilityLabel ?? `Edit ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onEditPress}
          role="button"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.editMarker}>[edit]</Text>
        </Pressable>
      ) : (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={styles.editMarker}
        >
          [edit]
        </Text>
      )}
    </View>
  );
}

export function WikiRaceWordmark() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  return (
    <View style={styles.identity}>
      <View accessibilityElementsHidden style={styles.globe}>
        <Text style={styles.globeText}>W</Text>
        <View style={styles.globeDotLarge} />
        <View style={styles.globeDotSmall} />
        <View style={styles.globeDashLeft} />
        <View style={styles.globeDashRight} />
      </View>
      <Text accessibilityRole="header" style={styles.wordmark}>
        WIKI<Text style={styles.wordmarkItalic}>R</Text>ACE
      </Text>
      <Text style={styles.wordmarkSubtitle}>The encyclopedia, as a sport.</Text>
    </View>
  );
}

function makeStyles({ colors, fonts, isDark }: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.18 : 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    primaryAction: {
      alignItems: "center",
      backgroundColor: colors.accent,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    primaryActionPressed: {
      transform: [{ scale: 0.985 }],
      opacity: 0.9,
    },
    primaryActionText: {
      color: colors.onAccent,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    secondaryAction: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      flexDirection: "row",
      gap: 7,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    secondaryActionText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      ...editorialType.control,
    },
    sectionHeading: {
      alignItems: "baseline",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingBottom: 3,
    },
    sectionTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      ...editorialType.sectionTitle,
    },
    editMarker: {
      color: colors.link,
      fontFamily: fonts.sans,
      ...editorialType.label,
    },
    identity: {
      alignItems: "center",
    },
    globe: {
      alignItems: "center",
      borderColor: colors.accent,
      borderRadius: 20,
      borderWidth: 1,
      height: 40,
      justifyContent: "center",
      marginBottom: 8,
      position: "relative",
      width: 40,
    },
    globeText: {
      color: colors.accent,
      fontFamily: fonts.serif,
      fontSize: 22,
      lineHeight: 27,
      marginTop: 3,
    },
    globeDotLarge: {
      backgroundColor: colors.accent,
      borderRadius: 2,
      height: 3,
      position: "absolute",
      right: 6,
      top: 3,
      width: 3,
    },
    globeDotSmall: {
      backgroundColor: colors.accent,
      borderRadius: 1,
      bottom: 4,
      height: 2,
      left: 7,
      position: "absolute",
      width: 2,
    },
    globeDashLeft: {
      backgroundColor: colors.accent,
      height: 3,
      left: -1,
      position: "absolute",
      top: 12,
      width: 2,
    },
    globeDashRight: {
      backgroundColor: colors.accent,
      bottom: 10,
      height: 2,
      position: "absolute",
      right: -1,
      width: 3,
    },
    wordmark: {
      color: colors.inkStrong,
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 39,
    },
    wordmarkItalic: {
      fontFamily: fonts.serifItalic,
    },
    wordmarkSubtitle: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 1,
    },
    disabled: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
