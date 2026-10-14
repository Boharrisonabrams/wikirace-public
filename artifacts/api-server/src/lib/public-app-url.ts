// Placeholder default for local runs and tests. Set PUBLIC_APP_URL to the
// deployed web origin in production so share links and preview metadata point
// at the real host.
export const DEFAULT_PUBLIC_APP_URL = "https://wikirace.example.com";

export function getPublicAppUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? DEFAULT_PUBLIC_APP_URL).replace(
    /\/$/,
    "",
  );
}
