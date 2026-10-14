import { createRef } from "react";
import * as React from "react";
import type { TextInput } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("@expo/vector-icons/Ionicons", () => ({ default: "Ionicons" }));
vi.mock("react-native", () => ({
  Pressable: "Pressable",
  SectionList: "SectionList",
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    hairlineWidth: 1,
  },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
  useWindowDimensions: () => ({ height: 852, width: 393 }),
}));
vi.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      accent: "#000",
      accentSoft: "#eee",
      border: "#000",
      borderSoft: "#ddd",
      chrome: "#fff",
      ink: "#000",
      inkMuted: "#666",
      link: "#00f",
      onAccent: "#fff",
      surfaceMuted: "#f5f5f5",
    },
    fonts: {
      mono: "mono",
      sans: "sans",
      sansSemiBold: "sans-semibold",
    },
    isDark: false,
    radius: { large: 14, pill: 999, small: 8 },
  }),
}));
vi.mock("@/lib/game-search", () => vi.importActual("../lib/game-search"));

import { buildSearchSections } from "../lib/game-search";
import {
  GameSearchSheet,
  type GameSearchSheetProps,
} from "./game-search-sheet";

interface ElementLike {
  type?: unknown;
  props?: { children?: unknown; style?: unknown; testID?: unknown };
}

function isElement(node: unknown): node is Required<ElementLike> {
  return typeof node === "object" && node !== null && "props" in node;
}

// Children as React sees them: raw slots, nulls included, because slot
// position is what decides whether React reuses or remounts an instance.
function slots(node: Required<ElementLike>): unknown[] {
  const children = (node.props as { children?: unknown }).children;
  if (children === undefined) return [];
  return Array.isArray(children) ? children : [children];
}

function findByTestID(
  node: unknown,
  testID: string,
): Required<ElementLike> | null {
  if (!isElement(node)) return null;
  if ((node.props as { testID?: unknown }).testID === testID) return node;
  for (const child of slots(node)) {
    const found = findByTestID(child, testID);
    if (found) return found;
  }
  return null;
}

// Reconciliation identity of the node with the given testID: the chain of
// element types and child-slot indexes from the root. Two renders remount a
// node exactly when this path differs between them.
function pathToTestID(
  node: unknown,
  testID: string,
  trail: string[] = [],
): string[] | null {
  if (!isElement(node)) return null;
  const step = [...trail, String(node.type)];
  if ((node.props as { testID?: unknown }).testID === testID) return step;
  const children = slots(node);
  for (let i = 0; i < children.length; i++) {
    const found = pathToTestID(children[i], testID, [...step, `#${i}`]);
    if (found) return found;
  }
  return null;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (merged, entry) => ({ ...merged, ...flattenStyle(entry) }),
      {},
    );
  }
  return style as Record<string, unknown>;
}

function makeProps(mode: "expanded" | "mini"): GameSearchSheetProps {
  return {
    articleTitle: "Bronze",
    inputRef: createRef<TextInput | null>(),
    mode,
    navigationDisabled: false,
    onChangeQuery: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    onExpand: vi.fn(),
    onNavigate: vi.fn(),
    onPickLink: vi.fn(),
    onPickSnippet: vi.fn(),
    onSubmit: vi.fn(),
    presentation: {
      clearVisible: true,
      counterLabel: "1 of 2",
      progress: 0.5,
      status: "matches",
      statusLabel: "1 of 2 matches",
    },
    query: "me",
    sections: buildSearchSections({
      inventory: [
        {
          article: "Metallurgy",
          snippet: "Early metallurgy.",
          text: "metallurgy",
        },
        { article: "Gold", snippet: "Gold is dense.", text: "gold" },
      ],
      linkSearchMode: "palette",
      minLinkChars: 0,
      query: "me",
      snippets: [
        { index: 0, matchLength: 2, matchStart: 6, text: "Early metallurgy." },
      ],
      textPending: false,
      textTotal: 1,
    }),
  };
}

describe("GameSearchSheet mini mode", () => {
  it("keeps the results list mounted while the sheet is collapsed", () => {
    const mini = GameSearchSheet(makeProps("mini"));

    expect(findByTestID(mini, "search-results")).not.toBeNull();
  });

  it("hides the results list visually in mini mode only", () => {
    const mini = findByTestID(
      GameSearchSheet(makeProps("mini")),
      "search-results",
    );
    const expanded = findByTestID(
      GameSearchSheet(makeProps("expanded")),
      "search-results",
    );

    expect(flattenStyle(mini?.props.style).display).toBe("none");
    expect(flattenStyle(expanded?.props.style).display).not.toBe("none");
  });

  it("renders input and results at identical tree positions in both modes, so mini to expanded is a style toggle rather than a remount", () => {
    const mini = GameSearchSheet(makeProps("mini"));
    const expanded = GameSearchSheet(makeProps("expanded"));

    for (const testID of ["search-input", "search-results"]) {
      const miniPath = pathToTestID(mini, testID);
      expect(miniPath).not.toBeNull();
      expect(miniPath).toEqual(pathToTestID(expanded, testID));
    }
  });

  it("still offers the mini bar controls when collapsed and Done when expanded", () => {
    const mini = GameSearchSheet(makeProps("mini"));
    const expanded = GameSearchSheet(makeProps("expanded"));

    for (const testID of [
      "search-mini-bar",
      "search-mini-expand",
      "search-count",
      "search-previous",
      "search-next",
      "search-close",
    ]) {
      expect(findByTestID(mini, testID)).not.toBeNull();
    }
    expect(findByTestID(mini, "search-done")).toBeNull();
    expect(findByTestID(expanded, "search-done")).not.toBeNull();
    expect(findByTestID(expanded, "search-mini-expand")).toBeNull();
  });
});
