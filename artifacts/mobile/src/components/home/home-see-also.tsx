import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SectionHeading } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

export function HomeSeeAlso({
  onHowToPlay,
  onLeaderboard,
  onPractice,
  signedIn,
}: {
  onHowToPlay: () => void;
  onLeaderboard: () => void;
  onPractice: () => void;
  signedIn: boolean;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View style={styles.section}>
      <SectionHeading title="See also" />
      <View style={styles.seeAlsoList}>
        {signedIn ? (
          <>
            <SeeAlsoLink
              detail="random article pair"
              label="Practice mode"
              onPress={onPractice}
            />
            <SeeAlsoLink
              detail="today's fastest paths"
              label="Daily leaderboard"
              onPress={onLeaderboard}
            />
          </>
        ) : null}
        <SeeAlsoLink label="How to play (rules)" onPress={onHowToPlay} />
      </View>
    </View>
  );

  function SeeAlsoLink({
    detail,
    label,
    onPress,
  }: {
    detail?: string;
    label: string;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        accessibilityRole="link"
        onPress={onPress}
        style={({ pressed }) => [styles.seeAlsoItem, pressed && styles.pressed]}
      >
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.seeAlsoText}>
          <Text style={styles.seeAlsoLink}>{label}</Text>
          {detail ? (
            <Text style={styles.seeAlsoDetail}> — {detail}</Text>
          ) : null}
        </Text>
      </Pressable>
    );
  }
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: 10,
    },
    seeAlsoList: {
      gap: 3,
      paddingHorizontal: 4,
    },
    seeAlsoItem: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 8,
      minHeight: 44,
      paddingVertical: 6,
    },
    bullet: {
      color: colors.ink,
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 20,
    },
    seeAlsoText: {
      flex: 1,
      lineHeight: 20,
    },
    seeAlsoLink: {
      color: colors.link,
      fontFamily: fonts.serif,
      fontSize: 15,
      textDecorationColor: colors.border,
      textDecorationLine: "underline",
    },
    seeAlsoDetail: {
      color: colors.inkMuted,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.68,
    },
  });
}
