import { describe, expect, it } from "vitest";

import { darkColors, lightColors } from "./theme";
import * as theme from "./theme";

describe("Warm Editorial theme", () => {
  it("keeps light and dark palettes structurally identical", () => {
    expect(Object.keys(darkColors).sort()).toEqual(
      Object.keys(lightColors).sort(),
    );
  });

  it("reserves the approved link, accent, and article highlight colors", () => {
    expect(lightColors.link).toBe("#0645ad");
    expect(lightColors.accent).toBe("#c15031");
    expect(lightColors.findMatch).toBe("#fff3a3");
    expect(lightColors.findCurrent).toBe("#ffd5c2");
    expect(darkColors.link).toBe("#6ea8ff");
  });

  it("defines one editorial type scale for page, section, body, labels, and controls", () => {
    const editorialType = (
      theme as unknown as {
        editorialType?: Record<
          string,
          { fontSize: number; lineHeight: number }
        >;
      }
    ).editorialType;

    expect(editorialType).toEqual({
      body: { fontSize: 15, lineHeight: 22 },
      cardTitle: { fontSize: 18, lineHeight: 24 },
      control: { fontSize: 15, lineHeight: 20 },
      label: { fontSize: 11, lineHeight: 15 },
      pageTitle: { fontSize: 32, lineHeight: 39 },
      sectionTitle: { fontSize: 22, lineHeight: 28 },
    });
  });
});
