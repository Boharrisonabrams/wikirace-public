/** Pure formatting helpers used by the native game UI. */

export { isSafeChallengeUrl } from "@workspace/share-intent";

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const DAILY_EPOCH = Date.UTC(2026, 6, 9);

export function puzzleNumber(isoDate: string): number {
  const d = new Date(`${isoDate}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((d - DAILY_EPOCH) / 86_400_000) + 1);
}

export function progressSavedCopy(articleCount: number): string {
  const safeCount = Math.max(0, Math.floor(articleCount));
  return `${safeCount} ${safeCount === 1 ? "article" : "articles"} so far · Your progress is saved.`;
}
