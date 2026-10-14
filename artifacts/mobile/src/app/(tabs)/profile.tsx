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
  PrimaryAction,
  SecondaryAction,
  SectionHeading,
} from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import {
  deleteAccount,
  getFriends,
  getProfile,
  requestFriend,
  respondToFriendRequest,
  updateUsername,
} from "@/lib/api";
import { formatTime } from "@/lib/game-utils";
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
            <View style={styles.section}>
              <SectionHeading
                editAccessibilityLabel="Edit username"
                onEditPress={beginUsernameEdit}
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
                    onPress={beginUsernameEdit}
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
                      onChangeText={setUsernameInput}
                      onSubmitEditing={() => void saveUsername()}
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
                        Save to update your handle everywhere your profile
                        appears.
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
                        onPress={() => void saveUsername()}
                        style={({ pressed }) => [
                          styles.saveButton,
                          pressed && styles.pressed,
                          !canSaveUsername && styles.disabled,
                        ]}
                      >
                        {usernameSaving ? (
                          <ActivityIndicator
                            color={colors.onAccent}
                            size="small"
                          />
                        ) : (
                          <Text style={styles.saveButtonText}>Save</Text>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityLabel="Cancel username edit"
                        accessibilityRole="button"
                        disabled={usernameSaving}
                        onPress={cancelUsernameEdit}
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
                    onPress={() => void copyFriendCode()}
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

            {stats ? (
              <View style={styles.section}>
                <SectionHeading title="Record" />
                <EditorialCard style={styles.statsGrid}>
                  <StatCell label="Played" value={String(stats.gamesPlayed)} />
                  <StatCell label="Won" value={String(stats.gamesWon)} />
                  <StatCell label="Win rate" value={`${winRate}%`} />
                  <StatCell
                    label="Best path"
                    value={
                      stats.bestClicks == null ? "—" : String(stats.bestClicks)
                    }
                  />
                  <StatCell
                    label="Fastest"
                    value={
                      stats.fastestTimeMs == null
                        ? "—"
                        : formatTime(Math.round(stats.fastestTimeMs / 1_000))
                    }
                  />
                  <StatCell
                    label="Streak"
                    value={String(stats.currentStreak)}
                  />
                </EditorialCard>
              </View>
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

                  {friends.pendingIncoming.length > 0 ? (
                    <View style={styles.friendGroup}>
                      <Text style={styles.groupLabel}>REQUESTS</Text>
                      {friends.pendingIncoming.map((friend) => (
                        <View key={friend.userId} style={styles.requestRow}>
                          <View style={styles.friendIdentity}>
                            <Text style={styles.friendName}>
                              {friend.displayName || friend.username}
                            </Text>
                            <Text style={styles.friendUsername}>
                              @{friend.username}
                            </Text>
                          </View>
                          <View style={styles.requestActions}>
                            <MiniAction
                              disabled={respondingId !== null}
                              label="Accept"
                              onPress={() => void respond(friend, true)}
                              primary
                            />
                            <MiniAction
                              disabled={respondingId !== null}
                              label="Decline"
                              onPress={() => void respond(friend, false)}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.friendGroup}>
                    <Text style={styles.groupLabel}>YOUR FRIENDS</Text>
                    {friends.friends.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No friends yet. Share your code to start a private
                        leaderboard.
                      </Text>
                    ) : (
                      friends.friends.map((friend) => (
                        <View key={friend.userId} style={styles.friendRow}>
                          <View style={styles.onlineDot} />
                          <Text style={styles.friendName}>
                            {friend.displayName || friend.username}
                          </Text>
                          <Text style={styles.friendUsername}>
                            @{friend.username}
                          </Text>
                        </View>
                      ))
                    )}
                    {friends.pendingOutgoing.length > 0 ? (
                      <Text style={styles.pendingText}>
                        Waiting on{" "}
                        {friends.pendingOutgoing
                          .map((friend) => `@${friend.username}`)
                          .join(", ")}
                      </Text>
                    ) : null}
                  </View>
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

            <View style={styles.section}>
              <SectionHeading title="Account" />
              <EditorialCard style={styles.card}>
                {profile.claimed ? (
                  <Pressable
                    accessibilityLabel="Sign out"
                    accessibilityRole="button"
                    onPress={() => void signOut()}
                    style={({ pressed }) => [
                      styles.accountButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather color={colors.link} name="log-out" size={16} />
                    <Text style={styles.accountButtonText}>Sign out</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.deleteCopy}>
                  {profileDeletionDescription()}
                </Text>
                <Pressable
                  accessibilityLabel="Delete account"
                  accessibilityRole="button"
                  accessibilityState={{ busy: deleting, disabled: deleting }}
                  disabled={deleting}
                  onPress={confirmDeletion}
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
          </>
        ) : null}
      </ScrollView>
    </View>
  );

  function StatCell({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.statCell}>
        <Text selectable style={styles.statValue}>
          {value}
        </Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  }

  function MiniAction({
    disabled,
    label,
    onPress,
    primary,
  }: {
    disabled: boolean;
    label: string;
    onPress: () => void;
    primary?: boolean;
  }) {
    return (
      <Pressable
        accessibilityLabel={`${label} friend request`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.miniAction,
          primary && styles.miniActionPrimary,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Text
          style={[
            styles.miniActionText,
            primary && styles.miniActionPrimaryText,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

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
    statsGrid: { flexDirection: "row", flexWrap: "wrap" },
    statCell: {
      alignItems: "center",
      borderBottomColor: colors.borderSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.borderSoft,
      borderRightWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 5,
      paddingVertical: 13,
      width: "33.333%",
    },
    statValue: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 20,
      lineHeight: 25,
    },
    statLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 10,
      letterSpacing: 0.5,
      textTransform: "uppercase",
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
    friendGroup: {
      borderTopColor: colors.borderSoft,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 9,
      paddingTop: 13,
    },
    groupLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 10,
      letterSpacing: 1.1,
    },
    requestRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
    },
    friendIdentity: { flex: 1 },
    friendName: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
    },
    friendUsername: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
    },
    requestActions: { flexDirection: "row", gap: 6 },
    miniAction: {
      borderColor: colors.border,
      borderWidth: 1,
      minHeight: 38,
      paddingHorizontal: 10,
      justifyContent: "center",
    },
    miniActionPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    miniActionText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 12,
    },
    miniActionPrimaryText: { color: colors.onAccent },
    friendRow: { alignItems: "center", flexDirection: "row", gap: 7 },
    onlineDot: {
      backgroundColor: colors.success,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    emptyText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    pendingText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 11,
      lineHeight: 17,
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
