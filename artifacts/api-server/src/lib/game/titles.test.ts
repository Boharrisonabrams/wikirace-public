import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  titleMatchesTarget,
  titlesMatch,
  toDisplayTitle,
  toUrlTitle,
} from "./titles";
import { dailyPairForDate, ARTICLE_POOL } from "./article-pool";

describe("title normalization", () => {
  it("normalizes underscores, case and whitespace", () => {
    expect(normalizeTitle("New_York_City")).toBe("new york city");
    expect(normalizeTitle("  Pizza ")).toBe("pizza");
  });

  it("matches across underscore/space/case forms", () => {
    expect(titlesMatch("New_York_City", "new york city")).toBe(true);
    expect(titlesMatch("Pizza", "Italy")).toBe(false);
  });

  it("adds redirect aliases without weakening exact matches", () => {
    expect(titleMatchesTarget("Tiger", "Tiger", ["Tigers"])).toBe(true);
    expect(titleMatchesTarget("Tigers", "Tiger", ["Tigers"])).toBe(true);
    expect(titleMatchesTarget("Tigers", "Tiger", null)).toBe(false);
  });

  it("converts between display and URL forms", () => {
    expect(toDisplayTitle("New_York_City")).toBe("New York City");
    expect(toUrlTitle("New York City")).toBe("New_York_City");
  });
});

describe("dailyPairForDate", () => {
  it("is deterministic for a given date", () => {
    const a = dailyPairForDate("2026-07-08");
    const b = dailyPairForDate("2026-07-08");
    expect(a).toEqual(b);
  });

  it("produces controlled, repeat-aware pairs across 180 dates", () => {
    const topics = new Set([
      "places",
      "science",
      "animals",
      "food",
      "history",
      "technology",
      "culture",
      "sports",
      "general",
    ]);
    const recentTitles: string[][] = [];
    const pairs = new Set<string>();

    for (let day = 0; day < 180; day++) {
      const date = new Date(Date.UTC(2026, 0, day + 1)).toISOString().slice(0, 10);
      const pair = dailyPairForDate(date);

      expect(dailyPairForDate(date)).toEqual(pair);
      expect(pair.start).not.toBe(pair.end);
      expect(ARTICLE_POOL).toContain(pair.start);
      expect(ARTICLE_POOL).toContain(pair.end);
      expect(topics).toContain(pair.startTopic);
      expect(topics).toContain(pair.endTopic);
      expect(pair.startTopic).not.toBe(pair.endTopic);
      expect([pair.startRecognition, pair.endRecognition]).toContain("familiar");
      expect(["easy", "medium", "hard"]).toContain(pair.difficulty);
      expect(pair.difficultySource).toBe("provisional");
      expect(pair.generatorVersion).toBe(2);
      expect(pair.seed).toContain(date);

      const priorSevenTitles = recentTitles.slice(-7).flat();
      expect(priorSevenTitles).not.toContain(pair.start);
      expect(priorSevenTitles).not.toContain(pair.end);

      pairs.add(`${pair.start}→${pair.end}`);
      recentTitles.push([pair.start, pair.end]);
    }

    expect(pairs.size).toBeGreaterThan(160);
  });
});
