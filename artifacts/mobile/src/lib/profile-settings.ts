// Placeholder default. Set EXPO_PUBLIC_APP_URL to the deployed web origin;
// Expo inlines it into the bundle at build time (see docs/DEPLOY.md).
const DEFAULT_APP_URL = "https://wikirace.example.com";

export function resolveAppUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  return (trimmed ? trimmed : DEFAULT_APP_URL).replace(/\/+$/, "");
}

const configuredAppUrl = process.env.EXPO_PUBLIC_APP_URL;
const appUrl = resolveAppUrl(configuredAppUrl);

export const PRIVACY_POLICY_URL = `${appUrl}/privacy`;
export const SUPPORT_URL = `${appUrl}/support`;

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
