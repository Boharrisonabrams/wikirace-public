/** Formatting + challenge helpers for game results. */

import {
  formatShareIntent,
  isSafeChallengeUrl,
  shareContentAsMessage,
  type ShareContent,
} from "@workspace/share-intent";

export { puzzleNumber } from "@workspace/game-client";
export { formatShareIntent, isSafeChallengeUrl };

export function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export interface ChallengeShareReference {
  code?: unknown;
  url?: unknown;
}

export function challengeInvitationHeading(): string {
  return "A friend challenges you to race";
}

export function challengeActionLabel(options: { played: boolean }): string {
  return options.played ? "See your result" : "Accept the challenge";
}

export function getChallengeAppHref(code: string): string {
  return `wikirace://challenge/${code}`;
}

export async function copyChallengeUrl(
  value: string,
  writeText: (value: string) => Promise<void>,
  legacyCopy?: (value: string) => boolean,
): Promise<void> {
  if (!isSafeChallengeUrl(value)) {
    throw new Error("Challenge link is not safe to copy.");
  }
  try {
    await writeText(value);
  } catch (error) {
    if (!legacyCopy?.(value)) throw error;
  }
}

const SHORT_CHALLENGE_CODE = /^[A-Za-z0-9_-]{6,16}$/;

/** Resolve a share link from the API response without ever exposing its UUID id. */
export function getChallengeShareUrl(
  challenge: ChallengeShareReference,
  fallbackOrigin: string,
): string | null {
  if (isSafeChallengeUrl(challenge.url)) return challenge.url;
  if (
    typeof challenge.code !== "string" ||
    !SHORT_CHALLENGE_CODE.test(challenge.code)
  ) {
    return null;
  }

  try {
    const origin = new URL(fallbackOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password)
      return null;
    return `${origin.origin}/challenge/${challenge.code}`;
  } catch {
    return null;
  }
}

export async function shareOrCopy(
  content: ShareContent,
): Promise<"shared" | "copied"> {
  if (navigator.share) {
    try {
      await navigator.share({ text: content.text, url: content.url });
      return "shared";
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }
  }
  await navigator.clipboard.writeText(shareContentAsMessage(content));
  return "copied";
}
