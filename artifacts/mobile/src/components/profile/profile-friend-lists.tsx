import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { FriendProfile, FriendsResponse } from "@/lib/types";

export function ProfileFriendLists({
  friends,
  onRespond,
  respondingId,
}: {
  friends: FriendsResponse;
  onRespond: (friend: FriendProfile, accept: boolean) => Promise<void>;
  respondingId: string | null;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      {friends.pendingIncoming.length > 0 ? (
        <View style={styles.friendGroup}>
          <Text style={styles.groupLabel}>REQUESTS</Text>
          {friends.pendingIncoming.map((friend) => (
            <View key={friend.userId} style={styles.requestRow}>
              <View style={styles.friendIdentity}>
                <Text style={styles.friendName}>
                  {friend.displayName || friend.username}
                </Text>
                <Text style={styles.friendUsername}>@{friend.username}</Text>
              </View>
              <View style={styles.requestActions}>
                <MiniAction
                  disabled={respondingId !== null}
                  label="Accept"
                  onPress={() => void onRespond(friend, true)}
                  primary
                />
                <MiniAction
                  disabled={respondingId !== null}
                  label="Decline"
                  onPress={() => void onRespond(friend, false)}
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
            No friends yet. Share your code to start a private leaderboard.
          </Text>
        ) : (
          friends.friends.map((friend) => (
            <View key={friend.userId} style={styles.friendRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.friendName}>
                {friend.displayName || friend.username}
              </Text>
              <Text style={styles.friendUsername}>@{friend.username}</Text>
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
    </>
  );

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
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
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
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.72 },
  });
}
