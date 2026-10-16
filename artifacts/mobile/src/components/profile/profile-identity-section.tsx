import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  EditorialCard,
  PrimaryAction,
  SectionHeading,
} from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { ProfileSummary } from "@/lib/types";

export interface ProfileIdentitySectionProps {
  canSaveUsername: boolean;
  copied: boolean;
  editingUsername: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onChangeUsername: (value: string) => void;
  onCopyFriendCode: () => void;
  onSaveUsername: () => void;
  profile: ProfileSummary;
  usernameError: string | null;
  usernameInput: string;
  usernameSaving: boolean;
  usernameValidationError: string | null;
}

export function ProfileIdentitySection({
  canSaveUsername,
  copied,
  editingUsername,
  onBeginEdit,
  onCancelEdit,
  onChangeUsername,
  onCopyFriendCode,
  onSaveUsername,
  profile,
  usernameError,
  usernameInput,
  usernameSaving,
  usernameValidationError,
}: ProfileIdentitySectionProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <SectionHeading
        editAccessibilityLabel="Edit username"
        onEditPress={onBeginEdit}
        title="Identity"
      />
      <EditorialCard style={styles.card}>
        <View style={styles.identityHeader}>
          <View style={styles.identityCopy}>
            <Text selectable style={styles.profileName}>
              {profile.displayName || profile.username}
            </Text>
            <Text selectable style={styles.username}>
              @{profile.username}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Edit username"
            accessibilityRole="button"
            disabled={usernameSaving}
            onPress={onBeginEdit}
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.pressed,
              usernameSaving && styles.disabled,
            ]}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </View>
        <View style={styles.accountStatus}>
          <Feather
            accessibilityElementsHidden
            color={profile.claimed ? colors.success : colors.warning}
            importantForAccessibility="no-hide-descendants"
            name={profile.claimed ? "check-circle" : "clock"}
            size={14}
          />
          <Text style={styles.accountStatusText}>
            {profile.claimed ? "Saved account" : "Guest profile"}
          </Text>
        </View>

        {editingUsername ? (
          <View style={styles.usernameEditor}>
            <Text style={styles.cardTitle}>Change username</Text>
            <Text style={styles.cardCopy}>
              Lowercase letters, numbers, and underscores only.
            </Text>
            <TextInput
              accessibilityLabel="Username"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!usernameSaving}
              onChangeText={onChangeUsername}
              onSubmitEditing={onSaveUsername}
              placeholder="player_one"
              placeholderTextColor={colors.inkMuted}
              returnKeyType="done"
              selectionColor={colors.accent}
              style={styles.usernameInput}
              value={usernameInput}
            />
            {usernameError || usernameValidationError ? (
              <Text style={styles.usernameErrorText}>
                {usernameError ?? usernameValidationError}
              </Text>
            ) : (
              <Text style={styles.usernameHint}>
                Save to update your handle everywhere your profile appears.
              </Text>
            )}
            <View style={styles.usernameActions}>
              <Pressable
                accessibilityLabel="Save username"
                accessibilityRole="button"
                accessibilityState={{
                  busy: usernameSaving,
                  disabled: !canSaveUsername,
                }}
                disabled={!canSaveUsername}
                onPress={onSaveUsername}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.pressed,
                  !canSaveUsername && styles.disabled,
                ]}
              >
                {usernameSaving ? (
                  <ActivityIndicator color={colors.onAccent} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel="Cancel username edit"
                accessibilityRole="button"
                disabled={usernameSaving}
                onPress={onCancelEdit}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressed,
                  usernameSaving && styles.disabled,
                ]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {profile.claimed ? (
          <Pressable
            accessibilityLabel={`Copy friend code ${profile.friendCode}`}
            accessibilityRole="button"
            onPress={onCopyFriendCode}
            style={({ pressed }) => [
              styles.friendCode,
              pressed && styles.pressed,
            ]}
          >
            <View>
              <Text style={styles.friendCodeLabel}>FRIEND CODE</Text>
              <Text style={styles.friendCodeHint}>
                Share this with a rival.
              </Text>
            </View>
            <View style={styles.friendCodeValueRow}>
              <Text selectable style={styles.friendCodeValue}>
                {profile.friendCode}
              </Text>
              <Feather
                color={copied ? colors.success : colors.link}
                name={copied ? "check" : "copy"}
                size={17}
              />
            </View>
          </Pressable>
        ) : (
          <PrimaryAction
            icon="user-plus"
            label="Save this guest profile"
            onPress={() =>
              router.push({
                pathname: "/signup",
                params: { mode: "claim", next: "/profile" },
              })
            }
          />
        )}
      </EditorialCard>
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: { gap: 9 },
    card: { gap: 13, padding: 17 },
    profileName: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 24,
      lineHeight: 30,
    },
    identityHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
    },
    identityCopy: { flex: 1, gap: 1 },
    username: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      marginTop: -9,
    },
    editButton: {
      borderColor: colors.border,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 12,
    },
    editButtonText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    accountStatus: { alignItems: "center", flexDirection: "row", gap: 6 },
    accountStatusText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
    },
    usernameEditor: {
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 9,
      paddingTop: 13,
    },
    usernameInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.inkStrong,
      fontFamily: fonts.sans,
      fontSize: 15,
      minHeight: 48,
      paddingHorizontal: 12,
    },
    usernameHint: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    usernameErrorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    usernameActions: { flexDirection: "row", gap: 8 },
    saveButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      flex: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 12,
    },
    saveButtonText: {
      color: colors.onAccent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    cancelButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: 14,
    },
    cancelButtonText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    friendCode: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 66,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    friendCodeLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 10,
      letterSpacing: 1.2,
    },
    friendCodeHint: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 11,
      marginTop: 2,
    },
    friendCodeValueRow: { alignItems: "center", flexDirection: "row", gap: 9 },
    friendCodeValue: {
      color: colors.inkStrong,
      fontFamily: fonts.mono,
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 2.2,
    },
    cardTitle: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 23,
    },
    cardCopy: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      marginTop: -7,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72 },
  });
}
