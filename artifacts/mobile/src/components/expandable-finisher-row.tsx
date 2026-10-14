import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";

interface ExpandableFinisherRowProps {
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  path?: string[];
  pathTestID?: string;
}

export function ExpandableFinisherRow({
  children,
  expanded,
  onToggle,
  path,
  pathTestID = "finisher-path",
}: ExpandableFinisherRowProps) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const canExpand = Array.isArray(path) && path.length > 0;
  const Container = canExpand ? Pressable : View;

  return (
    <View style={styles.wrapper}>
      <Container
        {...(canExpand
          ? {
              accessibilityLabel: expanded
                ? "Hide finisher path"
                : "Reveal finisher path",
              accessibilityRole: "button" as const,
              accessibilityState: { expanded },
              onPress: onToggle,
            }
          : {})}
        style={styles.row}
      >
        <View style={styles.rowBody}>{children}</View>
        {canExpand ? (
          <Text style={styles.toggleLabel}>
            {expanded ? "Hide path" : "Reveal path"}
          </Text>
        ) : null}
      </Container>
      {canExpand && expanded ? (
        <View style={styles.pathPanel} testID={pathTestID}>
          {path.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.pathRow}>
              <Text style={styles.pathIndex}>{index + 1}.</Text>
              <Text style={styles.pathStep}>{step}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    wrapper: {
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    rowBody: {
      flex: 1,
    },
    toggleLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    pathPanel: {
      backgroundColor: colors.chrome,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    pathRow: {
      flexDirection: "row",
      gap: 8,
    },
    pathIndex: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      width: 20,
    },
    pathStep: {
      color: colors.link,
      flex: 1,
      fontFamily: fonts.sans,
    },
  });
}
