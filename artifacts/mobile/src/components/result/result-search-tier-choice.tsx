import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import type { SearchTier } from "@/lib/types";

export function ResultSearchTierChoice({
  selected,
  onChange,
}: {
  selected: SearchTier;
  onChange: (value: SearchTier) => void;
}) {
  const theme = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const options: Array<{ value: SearchTier; label: string }> = [
    { value: "find", label: "Find only" },
    { value: "palette", label: "Full palette" },
  ];

  return (
    <View style={styles.searchTierBlock}>
      <Text style={styles.searchTierLabel}>Search on new challenge links</Text>
      <View style={styles.searchTierRow}>
        {options.map((option) => {
          const active = selected === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => onChange(option.value)}
              style={[
                styles.searchTierChip,
                active && styles.searchTierChipActive,
              ]}
              testID={`result-search-tier-${option.value}`}
            >
              <Text
                style={[
                  styles.searchTierChipText,
                  active && styles.searchTierChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.searchTierHint}>
        Find only hides the links list. Full palette keeps both links and find.
      </Text>
    </View>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    searchTierBlock: {
      gap: 8,
      marginBottom: 2,
    },
    searchTierLabel: {
      color: colors.inkMuted,
      fontFamily: fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.8,
      lineHeight: 15,
      textAlign: "center",
      textTransform: "uppercase",
    },
    searchTierRow: {
      flexDirection: "row",
      gap: 8,
    },
    searchTierChip: {
      alignItems: "center",
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 42,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchTierChipActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    searchTierChipText: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 13,
      lineHeight: 18,
    },
    searchTierChipTextActive: {
      color: colors.accent,
    },
    searchTierHint: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
  });
}
