/**
 * Wordle-style puzzle number for a daily challenge: days since the WikiRace
 * epoch (first shipped daily), 1-based.
 */
const DAILY_EPOCH = Date.UTC(2026, 6, 9); // 2026-07-09

export function puzzleNumber(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((d - DAILY_EPOCH) / 86_400_000) + 1);
}
