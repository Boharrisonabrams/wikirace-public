import { describe, expect, it } from "vitest";

import { buildGamePathMap } from "./game-path";

describe("buildGamePathMap", () => {
  it("marks the starting article as current before the first move", () => {
    expect(buildGamePathMap(["Pasta"], "France")).toEqual({
      start: "Pasta",
      current: "Pasta",
      target: "France",
      hasMoved: false,
      hiddenArticles: [],
      hiddenHopCount: 0,
    });
  });

  it("shows start and current after one move", () => {
    expect(buildGamePathMap(["Pasta", "Italy"], "France")).toEqual({
      start: "Pasta",
      current: "Italy",
      target: "France",
      hasMoved: true,
      hiddenArticles: [],
      hiddenHopCount: 0,
    });
  });

  it("compacts only the intermediate hops", () => {
    expect(
      buildGamePathMap(
        ["Pasta", "Italy", "European Union", "United Nations"],
        "France",
      ),
    ).toEqual({
      start: "Pasta",
      current: "United Nations",
      target: "France",
      hasMoved: true,
      hiddenArticles: ["Italy", "European Union"],
      hiddenHopCount: 2,
    });
  });

  it("has a defensive label for an impossible empty server path", () => {
    expect(buildGamePathMap([], "France")).toMatchObject({
      start: "Start",
      current: "Start",
      hasMoved: false,
    });
  });

  it("does not mutate the server-returned route", () => {
    const path = ["Pasta", "Italy", "France"];
    const snapshot = [...path];
    buildGamePathMap(path, "Paris");
    expect(path).toEqual(snapshot);
  });
});
