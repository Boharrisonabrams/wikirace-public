import type { ReactElement } from "react";
import * as React from "react";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

vi.mock("react-native", () => ({
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
      border: "#ddd",
      chrome: "#f5f5f5",
      inkMuted: "#666",
      link: "#00f",
    },
    fonts: {
      sans: "sans",
      sansSemiBold: "sans-semibold",
    },
  }),
}));

import { ExpandableFinisherRow } from "./expandable-finisher-row";

interface ElementLike {
  props?: { children?: unknown; testID?: string };
  type?: unknown;
}

function isElement(node: unknown): node is Required<ElementLike> {
  return typeof node === "object" && node !== null && "props" in node;
}

function slots(node: Required<ElementLike>): unknown[] {
  const children = node.props.children;
  if (children === undefined) return [];
  return Array.isArray(children) ? children : [children];
}

function textContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textContent).join("");
  if (!isElement(value)) return "";
  return textContent(value.props.children);
}

function findByTestID(node: unknown, testID: string): Required<ElementLike> | null {
  if (!isElement(node)) return null;
  if (node.props.testID === testID) return node;
  for (const child of slots(node)) {
    const found = findByTestID(child, testID);
    if (found) return found;
  }
  return null;
}

describe("ExpandableFinisherRow", () => {
  it("keeps rows non-expandable when the server withholds the path", () => {
    const row = ExpandableFinisherRow({
      children: <React.Fragment>Winner row</React.Fragment>,
      expanded: false,
      onToggle: vi.fn(),
    }) as ReactElement;

    expect(textContent(row)).toContain("Winner row");
    expect(textContent(row)).not.toContain("Reveal path");
    expect(findByTestID(row, "finisher-path")).toBeNull();
  });

  it("shows the gated path only when expanded", () => {
    const collapsed = ExpandableFinisherRow({
      children: <React.Fragment>Winner row</React.Fragment>,
      expanded: false,
      onToggle: vi.fn(),
      path: ["Earth", "Orbit", "Moon"],
    }) as ReactElement;
    const expanded = ExpandableFinisherRow({
      children: <React.Fragment>Winner row</React.Fragment>,
      expanded: true,
      onToggle: vi.fn(),
      path: ["Earth", "Orbit", "Moon"],
    }) as ReactElement;

    expect(textContent(collapsed)).toContain("Reveal path");
    expect(findByTestID(collapsed, "finisher-path")).toBeNull();

    expect(textContent(expanded)).toContain("Hide path");
    expect(textContent(expanded)).toContain("Earth");
    expect(textContent(expanded)).toContain("Moon");
    expect(findByTestID(expanded, "finisher-path")).not.toBeNull();
  });
});
