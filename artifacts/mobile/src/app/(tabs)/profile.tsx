import Feather from "@expo/vector-icons/Feather";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EditorialCard,
  SecondaryAction,
  SectionHeading,
} from "@/components/editorial-ui";
import { ProfileAccountSection } from "@/components/profile/profile-account-section";
import { ProfileFriendLists } from "@/components/profile/profile-friend-lists";
import { ProfileIdentitySection } from "@/components/profile/profile-identity-section";
import { ProfileRecordSection } from "@/components/profile/profile-record-section";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import {
  deleteAccount,
  getFriends,
  getProfile,
  requestFriend,
  respondToFriendRequest,
  updateUsername,
} from "@/lib/api";
import {
  canSendFriendRequest,
  normalizeFriendCode,
  PRIVACY_POLICY_URL,
  profileDeletionDescription,
  SUPPORT_URL,
} from "@/lib/profile-settings";
import {
  getReminderControlCopy,
  reminderStatusFromSnapshot,
  runReminderAction,
  type ReminderAction,
  type ReminderUiStatus,
} from "@/lib/reminder-ui";
import {
  disableDailyReminder,
  enableDailyReminder,
  getDailyReminderState,
} from "@/lib/reminders";
import { getSupabase } from "@/lib/supabase";
import { normalizeUsername, validateUsername } from "@/lib/username";
import type {
  FriendProfile,
  FriendsResponse,
  ProfileResponse,
} from "@/lib/types";

const EMPTY_FRIENDS: FriendsResponse = {
  friends: [],
  pendingIncoming: [],
  pendingOutgoing: [],
};

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { colors } = theme;
  const { top } = useSafeAreaInsets();
  const topPadding = Platform.OS === "web" ? 34 : top + 14;
  const styles = useMemo(
    () => makeStyles(theme, topPadding),
    [theme, topPadding],
  );
  const requestSequence = useRef(0);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [friends, setFriends] = useState<FriendsResponse>(EMPTY_FRIENDS);
  const [friendCode, setFriendCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [reminderState, setReminderState] = useState<ReminderUiStatus>("idle");
  const [reminderRetryAction, setReminderRetryAction] =
    useState<ReminderAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setError(null);
    try {
      const [profile, relationships] = await Promise.all([
        getProfile(),
        getFriends(),
      ]);
      if (requestId !== requestSequence.current) return;
      setData(profile);
      setFriends(relationships);
    } catch (loadError) {
      if (requestId !== requestSequence.current) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load your profile",
      );
    } finally {
      if (requestId !== requestSequence.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
      return () => {
        requestSequence.current += 1;
      };
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getDailyReminderState()
        .then((state) => {
          if (cancelled) return;
          setReminderRetryAction(null);
          setReminderState(reminderStatusFromSnapshot(state));
        })
        .catch(() => {
          if (!cancelled) setReminderState("error");
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function copyFriendCode() {
    const value = data?.profile.friendCode;
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_800);
  }

  function beginUsernameEdit() {
    if (!profile) return;
    setEditingUsername(true);
    setUsernameInput(profile.username);
    setUsernameError(null);
    setMessage(null);
    setError(null);
  }

  function cancelUsernameEdit() {
    setEditingUsername(false);
    setUsernameInput(profile?.username ?? "");
    setUsernameError(null);
  }

  async function saveUsername() {
    if (!profile || usernameSaving) return;
    const validationError = validateUsername(usernameInput);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    const normalized = normalizeUsername(usernameInput);
    if (normalized === profile.username) {
      setEditingUsername(false);
      setUsernameInput(profile.username);
      setUsernameError(null);
      return;
    }

    setUsernameSaving(true);
    setUsernameError(null);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateUsername(normalized);
      setData((current) =>
        current
          ? {
              ...current,
              profile: updated.profile,
            }
          : current,
      );
      setEditingUsername(false);
      setUsernameInput(updated.profile.username);
      setMessage(`Username updated to @${updated.profile.username}.`);
    } catch (saveError) {
      setUsernameError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save username",
      );
    } finally {
      setUsernameSaving(false);
    }
  }

  async function addFriend() {
    if (!canSendFriendRequest(friendCode) || adding) return;
    setAdding(true);
    setMessage(null);
    setError(null);
    try {
      const result = await requestFriend(friendCode);
      setFriendCode("");
      setMessage(
        result.status === "accepted"
          ? `You and @${result.friend.username} are now friends.`
          : `Request sent to @${result.friend.username}.`,
      );
      await load();
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add friend",
      );
    } finally {
      setAdding(false);
    }
  }

  async function respond(friend: FriendProfile, accept: boolean) {
    if (!friend.friendshipId || respondingId) return;
    setRespondingId(friend.friendshipId);
    setMessage(null);
    setError(null);
    try {
      await respondToFriendRequest(friend.friendshipId, accept);
      setMessage(
        accept
          ? `You and @${friend.username} are now friends.`
          : `Declined @${friend.username}'s request.`,
      );
      await load();
    } catch (respondError) {
      setError(
        respondError instanceof Error
          ? respondError.message
          : "Could not update friend request",
      );
    } finally {
      setRespondingId(null);
    }
  }

  async function signOut() {
    setError(null);
    const { error: signOutError } = await getSupabase().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.replace("/");
  }

  async function handleReminderAction() {
    if (reminderState === "loading" || reminderState === "denied") return;
    const current = {
      retryAction: reminderRetryAction,
      status: reminderState,
    };
    setReminderState("loading");
    const next = await runReminderAction(current, {
      disable: disableDailyReminder,
      enable: enableDailyReminder,
      read: getDailyReminderState,
    });
    setReminderRetryAction(next.retryAction);
    setReminderState(next.status);
  }

  function confirmDeletion() {
    Alert.alert("Delete account?", profileDeletionDescription(), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: () => void performDeletion(),
      },
    ]);
  }

  async function performDeletion() {
    if (deleting) return;
    setDeleting(true);
    setMessage(null);
    setError(null);
    try {
      await deleteAccount();
      await getSupabase().auth.signOut({ scope: "local" });
      router.replace("/");
      Alert.alert(
        "Account deleted",
        "Your account and WikiRace data were permanently deleted.",
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete account",
      );
    } finally {
      setDeleting(false);
    }
  }

  const profile = data?.profile ?? null;
  const stats = data?.stats ?? null;
  const usernameValidationError =
    editingUsername && usernameInput.length > 0
      ? validateUsername(usernameInput)
      : null;
  const normalizedUsernameInput = normalizeUsername(usernameInput);
  const canSaveUsername =
    Boolean(profile) &&
    !usernameSaving &&
    normalizedUsernameInput !== "" &&
    normalizedUsernameInput !== profile?.username &&
    usernameValidationError == null;
  const winRate =
    stats && stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;
  const reminderCopy = getReminderControlCopy(reminderState);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.accent]}
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" selectable style={styles.title}>
            Your profile
          </Text>
          <Text selectable style={styles.subtitle}>
            Race history, friends, and account controls.
          </Text>
        </View>

        {error ? (
          <View accessibilityRole="alert" style={styles.errorBox}>
            <Text selectable style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}
        {message ? (
          <View accessibilityLiveRegion="polite" style={styles.successBox}>
            <Text selectable style={styles.successText}>
              {message}
            </Text>
          </View>
        ) : null}

        {loading && !profile ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Reading your record…</Text>
          </View>
        ) : profile ? (
          <>
            <ProfileIdentitySection
              canSaveUsername={canSaveUsername}
              copied={copied}
              editingUsername={editingUsername}
              onBeginEdit={beginUsernameEdit}
              onCancelEdit={cancelUsernameEdit}
              onChangeUsername={setUsernameInput}
              onCopyFriendCode={() => void copyFriendCode()}
              onSaveUsername={() => void saveUsername()}
              profile={profile}
              usernameError={usernameError}
              usernameInput={usernameInput}
              usernameSaving={usernameSaving}
              usernameValidationError={usernameValidationError}
            />

            {stats ? (
              <ProfileRecordSection stats={stats} winRate={winRate} />
            ) : null}

            {profile.claimed ? (
              <View style={styles.section}>
                <SectionHeading title="Friends" />
                <EditorialCard style={styles.card}>
                  <Text style={styles.cardTitle}>Add a friend</Text>
                  <Text style={styles.cardCopy}>
                    Enter their six-character friend code. Accepted friends
                    appear in your Friends leaderboard.
                  </Text>
                  <View style={styles.addRow}>
                    <TextInput
                      accessibilityLabel="Friend code"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!adding}
                      maxLength={6}
                      onChangeText={(value) =>
                        setFriendCode(normalizeFriendCode(value))
                      }
                      onSubmitEditing={() => void addFriend()}
                      placeholder="ABC123"
                      placeholderTextColor={colors.inkMuted}
                      returnKeyType="done"
                      selectionColor={colors.accent}
                      style={styles.input}
                      value={friendCode}
                    />
                    <Pressable
                      accessibilityLabel="Send friend request"
                      accessibilityRole="button"
                      accessibilityState={{
                        busy: adding,
                        disabled: !canSendFriendRequest(friendCode) || adding,
                      }}
                      disabled={!canSendFriendRequest(friendCode) || adding}
                      onPress={() => void addFriend()}
                      style={({ pressed }) => [
                        styles.addButton,
                        pressed && styles.pressed,
                        (!canSendFriendRequest(friendCode) || adding) &&
                          styles.disabled,
                      ]}
                    >
                      {adding ? (
                        <ActivityIndicator
                          color={colors.onAccent}
                          size="small"
                        />
                      ) : (
                        <>
                          <Feather
                            color={colors.onAccent}
                            name="user-plus"
                            size={15}
                          />
                          <Text style={styles.addButtonText}>Add</Text>
                        </>
                      )}
                    </Pressable>
                  </View>

                  <ProfileFriendLists
                    friends={friends}
                    onRespond={respond}
                    respondingId={respondingId}
                  />
                </EditorialCard>
              </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeading title="Daily reminder" />
              <EditorialCard style={styles.card}>
                <Text style={styles.cardTitle}>Daily reminder</Text>
                <Text style={styles.cardCopy}>
                  Keep tomorrow&apos;s daily from sneaking past you.
                </Text>
                <SecondaryAction
                  disabled={reminderCopy.disabled}
                  icon={reminderCopy.icon}
                  label={reminderCopy.actionLabel}
                  loading={reminderState === "loading"}
                  onPress={() => void handleReminderAction()}
                  testID="profile-reminder-btn"
                />
                {reminderCopy.note ? (
                  <Text
                    accessibilityLiveRegion={
                      reminderState === "enabled" ? "polite" : undefined
                    }
                    selectable
                    style={styles.reminderNote}
                  >
                    {reminderCopy.note}
                  </Text>
                ) : null}
                {reminderCopy.showOpenSettings ? (
                  <SecondaryAction
                    icon="external-link"
                    label="Open Settings"
                    onPress={() => void Linking.openSettings()}
                    testID="profile-reminder-settings-btn"
                  />
                ) : null}
                {reminderState === "error" ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>
                    Could not update the reminder. Try again.
                  </Text>
                ) : null}
              </EditorialCard>
            </View>

            <View style={styles.section}>
              <SectionHeading title="Help & privacy" />
              <EditorialCard>
                <LinkRow
                  icon="shield"
                  label="Privacy policy"
                  onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                />
                <LinkRow
                  icon="help-circle"
                  label="Support"
                  last
                  onPress={() => void Linking.openURL(SUPPORT_URL)}
                />
              </EditorialCard>
            </View>

            <ProfileAccountSection
              deleting={deleting}
              onConfirmDeletion={confirmDeletion}
              onSignOut={() => void signOut()}
              profile={profile}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );

  function LinkRow({
    icon,
    label,
    last,
    onPress,
  }: {
    icon: "help-circle" | "shield";
    label: string;
    last?: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="link"
        onPress={onPress}
        role="link"
        style={({ pressed }) => [
          styles.linkRow,
          last && styles.linkRowLast,
          pressed && styles.pressed,
        ]}
      >
        <Feather color={colors.link} name={icon} size={17} />
        <Text style={styles.linkText}>{label}</Text>
        <Feather color={colors.inkMuted} name="external-link" size={14} />
      </Pressable>
    );
  }
}

function makeStyles({ colors, fonts }: AppTheme, topPadding: number) {
  return StyleSheet.create({
    container: { backgroundColor: colors.chrome, flex: 1 },
    content: {
      alignSelf: "center",
      gap: 22,
      maxWidth: 620,
      paddingBottom: 44,
      paddingHorizontal: 18,
      paddingTop: topPadding,
      width: "100%",
    },
    header: { gap: 4 },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 32,
      lineHeight: 39,
    },
    subtitle: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 21,
    },
    section: { gap: 9 },
    card: { gap: 13, padding: 17 },
    loadingBlock: { alignItems: "center", gap: 9, paddingVertical: 44 },
    loadingText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
    },
    errorBox: {
      backgroundColor: colors.dangerSoft,
      borderLeftColor: colors.danger,
      borderLeftWidth: 3,
      padding: 11,
    },
    errorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    successBox: {
      backgroundColor: colors.successSoft,
      borderLeftColor: colors.success,
      borderLeftWidth: 3,
      padding: 11,
    },
    successText: {
      color: colors.success,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
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
    addRow: { flexDirection: "row", gap: 8 },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.inkStrong,
      flex: 1,
      fontFamily: fonts.mono,
      fontSize: 16,
      letterSpacing: 2,
      minHeight: 48,
      paddingHorizontal: 12,
    },
    addButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      minHeight: 48,
      minWidth: 82,
      paddingHorizontal: 13,
    },
    addButtonText: {
      color: colors.onAccent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
    },
    reminderNote: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 18,
    },
    linkRow: {
      alignItems: "center",
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 9,
      minHeight: 52,
      paddingHorizontal: 15,
    },
    linkRowLast: { borderBottomWidth: 0 },
    linkText: {
      color: colors.link,
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 14,
    },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72 },
  });
}
