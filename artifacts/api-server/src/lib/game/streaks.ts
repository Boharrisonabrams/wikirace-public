export interface StreakState {
  current_streak: number;
  longest_streak: number;
  last_daily_completed: string | null; // ISO date (YYYY-MM-DD)
}

export interface StreakUpdate {
  current_streak: number;
  longest_streak: number;
  last_daily_completed: string;
  extended: boolean; // true when the streak grew (or started) today
}

function previousDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute the new streak state after winning the daily challenge dated
 * `today` (ISO date, UTC). Pure function.
 *
 * - already counted today  -> unchanged
 * - won yesterday          -> streak + 1
 * - otherwise              -> streak restarts at 1
 */
export function computeStreakUpdate(prev: StreakState, today: string): StreakUpdate {
  if (prev.last_daily_completed === today) {
    return {
      current_streak: prev.current_streak,
      longest_streak: prev.longest_streak,
      last_daily_completed: today,
      extended: false,
    };
  }

  const current = prev.last_daily_completed === previousDate(today) ? prev.current_streak + 1 : 1;

  return {
    current_streak: current,
    longest_streak: Math.max(prev.longest_streak, current),
    last_daily_completed: today,
    extended: true,
  };
}
