import { describe, expect, it } from "vitest";

import { formatTime } from "./game-utils";

describe("web game utilities", () => {
  it("formats whole elapsed seconds as minutes and padded seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(67)).toBe("1:07");
    expect(formatTime(600)).toBe("10:00");
  });
});
