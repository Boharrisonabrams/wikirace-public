export type DailyLeaderboardBoard = "shortest" | "fastest";

export function parseBoard(value: unknown): DailyLeaderboardBoard {
  if (value === undefined) return "shortest";
  if (value === "shortest" || value === "fastest") return value;

  throw new Error("Invalid board");
}
