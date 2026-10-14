import { Platform } from "react-native";

export const fontFamilies = {
  serif: "LibreCaslonText_400Regular",
  serifBold: "LibreCaslonText_700Bold",
  serifItalic: "LibreCaslonText_400Regular_Italic",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemiBold: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  mono:
    Platform.select({
      ios: "Menlo",
      android: "monospace",
      web: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      default: "monospace",
    }) ?? "monospace",
} as const;
