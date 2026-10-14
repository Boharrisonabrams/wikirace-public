import { describe, it, expect } from "vitest";
import { validateMove } from "./validate-move";

describe("validateMove", () => {
  it("accepts a destination that is in the source article links", () => {
    const result = validateMove({
      fromArticle: "Pizza",
      toArticle: "Italy",
      fromArticleLinks: ["Italy", "Cheese", "Tomato"],
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects a destination that is not in the source article links", () => {
    const result = validateMove({
      fromArticle: "Pizza",
      toArticle: "Quantum Mechanics",
      fromArticleLinks: ["Italy", "Cheese", "Tomato"],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/not linked/i);
  });

  it("rejects when source equals destination (no-op move)", () => {
    const result = validateMove({
      fromArticle: "Pizza",
      toArticle: "Pizza",
      fromArticleLinks: ["Pizza", "Italy"],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/same/i);
  });

  it("compares titles case-insensitively after normalizing underscores", () => {
    const result = validateMove({
      fromArticle: "Pizza",
      toArticle: "New_York_City",
      fromArticleLinks: ["New York City"],
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects when fromArticleLinks is empty", () => {
    const result = validateMove({
      fromArticle: "Pizza",
      toArticle: "Italy",
      fromArticleLinks: [],
    });
    expect(result.valid).toBe(false);
  });
});
