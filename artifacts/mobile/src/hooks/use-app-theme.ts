import { useMemo } from "react";
import { useColorScheme } from "react-native";

import { fontFamilies } from "@/constants/fonts";
import {
  darkColors,
  editorialRadius,
  lightColors,
} from "@/constants/theme";

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      fonts: fontFamilies,
      isDark,
      radius: editorialRadius,
    }),
    [isDark],
  );
}

export type AppTheme = ReturnType<typeof useAppTheme>;
