import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryAction, SecondaryAction } from "@/components/editorial-ui";
import { pluralize } from "@/components/home/pluralize";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { formatTime, progressSavedCopy } from "@/lib/game-utils";
import type {
  getHomeAccountAction,
  getHomePrimaryAction,
  getHomeReplayAction,
} from "@/lib/home-model";
import type { GameSession } from "@/lib/types";

export interface HomeDailyActionsProps {
  accountAction: ReturnType<typeof getHomeAccountAction>;
  completed: boolean;
  onAccount: () => void;
  onPrimary: () => void;
  onReplay: () => void;
  primaryAction: ReturnType<typeof getHomePrimaryAction>;
  profileClaimError: string | null;
  profileClaimLoading: boolean;
  replayAction: ReturnType<typeof getHomeReplayAction>;
  session: GameSession | null;
  signedIn: boolean;
}

export function HomeDailyActions({
  accountAction,
  completed,
  onAccount,
  onPrimary,
  onReplay,
  primaryAction,
  profileClaimError,
  profileClaimLoading,
  replayAction,
  session,
  signedIn,
}: HomeDailyActionsProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <>
      {completed && session ? (
        <View
          style={[
            styles.sessionNote,
            session.won ? styles.sessionWon : styles.sessionGaveUp,
          ]}
        >
          <Feather
            accessibilityElementsHidden
            color={session.won ? colors.success : colors.warning}
            importantForAccessibility="no-hide-descendants"
            name={session.won ? "check-circle" : "flag"}
            size={16}
          />
          <Text style={styles.sessionNoteText}>
            {session.won
              ? `${pluralize(session.clicks, "click")} · ${formatTime(
                  session.timeSeconds ?? 0,
                )}`
              : "Route archived. Tomorrow is a fresh race."}
          </Text>
        </View>
      ) : session ? (
        <Text style={styles.resumeNote}>
          {progressSavedCopy(session.path.length)}
        </Text>
      ) : null}

      {primaryAction ? (
        <PrimaryAction
          icon={completed ? "book-open" : "play"}
          label={primaryAction.label}
          onPress={onPrimary}
          testID="play-daily-btn"
        />
      ) : null}

      {replayAction ? (
        <SecondaryAction
          icon="rotate-ccw"
          label={replayAction.label}
          onPress={onReplay}
          testID="replay-daily-btn"
        />
      ) : null}

      {accountAction ? (
        <>
          <SecondaryAction
            icon="user-plus"
            label={accountAction.label}
            loading={
              accountAction.kind === "finalize-profile" && profileClaimLoading
            }
            onPress={onAccount}
            testID="claim-account-btn"
          />
          {profileClaimError ? (
            <Text
              accessibilityRole="alert"
              selectable
              style={styles.accountErrorText}
            >
              {profileClaimError}
            </Text>
          ) : null}
        </>
      ) : null}

      {!signedIn ? (
        <SecondaryAction
          icon="log-in"
          label="Sign in"
          onPress={() => router.push("/login")}
        />
      ) : null}
    </>
  );
}

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    accountErrorText: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    sessionNote: {
      alignItems: "center",
      borderRadius: radius.small,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    sessionWon: {
      backgroundColor: colors.successSoft,
    },
    sessionGaveUp: {
      backgroundColor: colors.warningSoft,
    },
    sessionNoteText: {
      color: colors.ink,
      flex: 1,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 17,
    },
    resumeNote: {
      color: colors.inkMuted,
      fontFamily: fonts.serifItalic,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
