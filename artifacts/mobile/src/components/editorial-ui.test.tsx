import type { ReactElement } from "react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("@expo/vector-icons/Feather", () => ({ default: "Feather" }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
  },
  Text: "Text",
  View: "View",
}));
vi.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      accent: "#000",
      border: "#000",
      inkMuted: "#000",
      inkStrong: "#000",
      link: "#000",
      onAccent: "#fff",
      shadow: "#000",
      surface: "#fff",
    },
    fonts: {
      sans: "sans",
      sansSemiBold: "sans-semibold",
      serif: "serif",
      serifBold: "serif-bold",
      serifItalic: "serif-italic",
    },
    isDark: false,
  }),
}));

import {
  SecondaryAction,
  SectionHeading,
  WikiRaceWordmark,
} from "./editorial-ui";

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (typeof value !== "object" || value === null || !("props" in value)) {
    return "";
  }
  return textContent(
    (value as { props: { children?: unknown } }).props.children,
  );
}

describe("WikiRaceWordmark", () => {
  it("renders the public WikiRace identity", () => {
    expect(textContent(WikiRaceWordmark())).toContain(
      "WIKIRACEThe encyclopedia, as a sport.",
    );
  });
});

describe("SecondaryAction", () => {
  it("announces and blocks a profile finalization while it is loading", () => {
    const action = SecondaryAction({
      icon: "user-plus",
      label: "Finish account setup",
      loading: true,
      onPress: vi.fn(),
    }) as ReactElement<{
      accessibilityState: { busy: boolean; disabled: boolean };
      disabled: boolean;
    }>;

    expect(action.props.disabled).toBe(true);
    expect(action.props.accessibilityState).toEqual({
      busy: true,
      disabled: true,
    });
  });
});

describe("SectionHeading", () => {
  it("keeps the edit marker decorative by default", () => {
    const heading = SectionHeading({ title: "Identity" }) as ReactElement<{
      children: ReactElement[];
    }>;
    const marker = heading.props.children[1] as ReactElement<{
      accessibilityElementsHidden?: boolean;
      children?: unknown;
      importantForAccessibility?: string;
    }>;

    expect(textContent(marker)).toBe("[edit]");
    expect(marker.props.accessibilityElementsHidden).toBe(true);
    expect(marker.props.importantForAccessibility).toBe("no");
  });

  it("renders the same marker as a button when edit handling is provided", () => {
    const onEditPress = vi.fn();
    const heading = SectionHeading({
      editAccessibilityLabel: "Edit username",
      onEditPress,
      title: "Identity",
    }) as ReactElement<{
      children: ReactElement[];
    }>;
    const markerPressable = heading.props.children[1] as ReactElement<{
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: unknown;
      hitSlop?: number;
      onPress?: () => void;
    }>;
    const markerText = markerPressable.props.children as ReactElement;

    expect(markerPressable.props.accessibilityRole).toBe("button");
    expect(markerPressable.props.accessibilityLabel).toBe("Edit username");
    expect(markerPressable.props.hitSlop).toBe(8);
    expect(textContent(markerText)).toBe("[edit]");
    markerPressable.props.onPress?.();
    expect(onEditPress).toHaveBeenCalledTimes(1);
  });
});
