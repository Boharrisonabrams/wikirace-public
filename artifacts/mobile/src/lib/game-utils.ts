/** Pure formatting helpers used by the native game UI. */

export { puzzleNumber } from "@workspace/game-client";
export { isSafeChallengeUrl } from "@workspace/share-intent";

export function formatTime(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function progressSavedCopy(articleCount: number): string {
  const safeCount = Math.max(0, Math.floor(articleCount));
  return `${safeCount} ${safeCount === 1 ? "article" : "articles"} so far · Your progress is saved.`;
}
