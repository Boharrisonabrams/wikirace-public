export type AuthMode = "claim" | "signin";

export type SocialAuthResult =
  | { status: "success"; next: string }
  | { status: "cancelled" };

export interface AuthCallbackResult {
  expectedGuestUserId: string | null;
  mode: AuthMode;
  next: string;
  userId: string;
}

export interface AuthCallbackParameters {
  accessToken: string | null;
  refreshToken: string | null;
  next: string;
  error: string | null;
  errorCode: string | null;
}

export interface BrowserAuthResult {
  type: string;
  url?: string;
}

export interface GoogleOAuthFlowDependencies {
  createOAuthUrl: () => Promise<string>;
  openAuthSession: (url: string) => Promise<BrowserAuthResult>;
  completeCallback: (url: string) => Promise<AuthCallbackResult>;
}

type ReturnPathParameter = string | string[] | null | undefined;

export function normalizeReturnPath(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return "/";

  const trimmed = candidate.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return "/";
  }

  return trimmed;
}

export function buildInternalReturnPath(
  pathname: string,
  parameters: Record<string, ReturnPathParameter>,
): string {
  const pairs: string[] = [];

  for (const [key, rawValue] of Object.entries(parameters)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value !== "string" || value.length === 0) continue;
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }

  return normalizeReturnPath(
    pairs.length > 0 ? `${pathname}?${pairs.join("&")}` : pathname,
  );
}

function decodeParameter(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

function readParameters(value: string, target: Record<string, string>): void {
  for (const pair of value.split("&")) {
    if (!pair) continue;
    const separator = pair.indexOf("=");
    const rawKey = separator >= 0 ? pair.slice(0, separator) : pair;
    const rawValue = separator >= 0 ? pair.slice(separator + 1) : "";
    target[decodeParameter(rawKey)] = decodeParameter(rawValue);
  }
}

export function parseAuthCallbackUrl(url: string): AuthCallbackParameters {
  const parameters: Record<string, string> = {};
  const hashIndex = url.indexOf("#");
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : "";
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";

  readParameters(query, parameters);
  readParameters(fragment, parameters);

  return {
    accessToken: parameters.access_token || null,
    refreshToken: parameters.refresh_token || null,
    next: normalizeReturnPath(parameters.next),
    error:
      parameters.error_description ||
      parameters.error ||
      parameters.error_code ||
      null,
    errorCode: parameters.error_code || parameters.error || null,
  };
}

export async function runGoogleOAuthFlow(
  dependencies: GoogleOAuthFlowDependencies,
): Promise<SocialAuthResult> {
  const providerUrl = await dependencies.createOAuthUrl();
  const browserResult = await dependencies.openAuthSession(providerUrl);

  if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
    return { status: "cancelled" };
  }

  if (browserResult.type !== "success" || !browserResult.url) {
    throw new Error("Google sign-in did not return to WikiRace.");
  }

  const callback = await dependencies.completeCallback(browserResult.url);
  return { status: "success", next: callback.next };
}

export interface AppleNameParts {
  givenName?: string | null;
  middleName?: string | null;
  familyName?: string | null;
}

export interface AppleProfileEnrichmentDependencies {
  updateUserMetadata: () => Promise<void>;
  updateProfile: () => Promise<void>;
}

export async function enrichAppleProfileBestEffort(
  dependencies: AppleProfileEnrichmentDependencies,
): Promise<unknown[]> {
  const results = await Promise.allSettled([
    Promise.resolve().then(dependencies.updateUserMetadata),
    Promise.resolve().then(dependencies.updateProfile),
  ]);

  return results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
}

export function formatAppleFullName(
  name: AppleNameParts | null | undefined,
): string | null {
  if (!name) return null;
  const fullName = [name.givenName, name.middleName, name.familyName]
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || null;
}

export function isAppleCancellation(
  error: unknown,
  allowSimulatorUnknown = false,
): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? error.code : null;
  if (code === "ERR_REQUEST_CANCELED") return true;
  if (!allowSimulatorUnknown) return false;

  const message = "message" in error ? error.message : null;
  return (
    code === "ERR_REQUEST_UNKNOWN" ||
    message === "The authorization attempt failed for an unknown reason"
  );
}

export function assertAppleState(
  expected: string,
  actual: string | null,
): void {
  if (actual !== expected) {
    throw new Error("Apple sign-in state did not match.");
  }
}

export function authErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code =
      "code" in error && typeof error.code === "string" ? error.code : null;
    return code ? `${error.message} (${code})` : error.message;
  }
  return "Authentication failed.";
}
