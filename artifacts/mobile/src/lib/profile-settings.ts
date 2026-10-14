// Placeholder host. Point these at the deployed web app before a release build.
export const PRIVACY_POLICY_URL = "https://wikirace.example.com/privacy";
export const SUPPORT_URL = "https://wikirace.example.com/support";

export function normalizeFriendCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function canSendFriendRequest(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(value);
}

export function profileDeletionDescription(): string {
  return "This permanently deletes this account, its race history, rankings, private challenges, and friendships. WikiRace creates a fresh guest profile if you keep playing afterward.";
}
