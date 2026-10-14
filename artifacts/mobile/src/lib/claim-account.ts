import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type ClaimProfile = () => Promise<void>;

export const ACCOUNT_CLAIM_CONFLICT_MESSAGE =
  "That account already exists. Your guest result is still safe, but accounts cannot be merged yet.";

export class AccountClaimConflictError extends Error {
  readonly code = "account_conflict";

  constructor() {
    super(ACCOUNT_CLAIM_CONFLICT_MESSAGE);
    this.name = "AccountClaimConflictError";
  }
}

interface RequestEmailClaimOptions {
  email: string;
  emailRedirectTo?: string;
}

interface CompleteEmailClaimOptions {
  claimProfile: ClaimProfile;
  email: string;
  expectedUserId: string;
  password: string;
  verificationCode: string;
}

export interface ClaimSuccess {
  status: "success";
  userId: string;
}

export type OAuthClaimProvider = "google" | "apple";

interface BrowserAuthResult {
  type: string;
  url?: string;
}

interface OAuthClaimOptions {
  claimProfile: ClaimProfile;
  completeCallback: (url: string) => Promise<{ userId: string }>;
  openAuthSession: (url: string) => Promise<BrowserAuthResult>;
  provider: OAuthClaimProvider;
  redirectTo: string;
}

async function currentSession(client: SupabaseClient): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Your player session is missing.");
  return data.session;
}

function requireSameUser(session: Session, expectedUserId: string): void {
  if (session.user.id !== expectedUserId) {
    throw new Error(
      "Account claiming stopped because the player identity changed.",
    );
  }
}

async function restoreGuestSession(
  client: SupabaseClient,
  guestSession: Session,
): Promise<void> {
  const { data } = await client.auth.getSession();
  if (
    data.session?.user.id === guestSession.user.id &&
    data.session.user.is_anonymous === true
  ) {
    return;
  }

  const { error } = await client.auth.setSession({
    access_token: guestSession.access_token,
    refresh_token: guestSession.refresh_token,
  });
  if (error) throw error;
}

function claimErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

function claimErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }
  return typeof error.message === "string" ? error.message : "";
}

export function isAccountClaimConflict(error: unknown): boolean {
  const code = claimErrorCode(error);
  if (
    code === "email_exists" ||
    code === "identity_already_exists" ||
    code === "user_already_exists"
  ) {
    return true;
  }

  return /already (?:been registered|exists|linked)|belongs to (?:an existing|another) user/i.test(
    claimErrorMessage(error),
  );
}

function throwClaimError(error: unknown): never {
  if (isAccountClaimConflict(error)) {
    throw new AccountClaimConflictError();
  }
  throw error;
}

export async function requestEmailClaim(
  client: SupabaseClient,
  options: RequestEmailClaimOptions,
): Promise<{
  status: "ready-for-password" | "verification-required";
  userId: string;
}> {
  const guestSession = await currentSession(client);
  if (guestSession.user.is_anonymous !== true) {
    throw new Error("This player is already connected to an account.");
  }

  const { data, error } = options.emailRedirectTo
    ? await client.auth.updateUser(
        { email: options.email },
        { emailRedirectTo: options.emailRedirectTo },
      )
    : await client.auth.updateUser({ email: options.email });
  if (error) throwClaimError(error);
  if (!data.user || data.user.id !== guestSession.user.id) {
    throw new Error(
      "Account claiming stopped because the player identity changed.",
    );
  }

  return {
    status:
      data.user.is_anonymous === true
        ? "verification-required"
        : "ready-for-password",
    userId: guestSession.user.id,
  };
}

export async function completeEmailClaim(
  client: SupabaseClient,
  options: CompleteEmailClaimOptions,
): Promise<ClaimSuccess> {
  let session = await currentSession(client);
  requireSameUser(session, options.expectedUserId);

  if (session.user.is_anonymous === true) {
    const { data, error } = await client.auth.verifyOtp({
      email: options.email,
      token: options.verificationCode,
      type: "email_change",
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error("Email verification did not create a session.");
    }
    session = data.session;
    requireSameUser(session, options.expectedUserId);
  }

  if (session.user.is_anonymous === true) {
    throw new Error("Verify your email before creating a password.");
  }

  const { data: passwordData, error: passwordError } =
    await client.auth.updateUser({ password: options.password });
  if (passwordError) throw passwordError;
  if (!passwordData.user || passwordData.user.id !== options.expectedUserId) {
    throw new Error(
      "Account claiming stopped because the player identity changed.",
    );
  }

  await options.claimProfile();
  return { status: "success", userId: options.expectedUserId };
}

export async function claimWithOAuth(
  client: SupabaseClient,
  options: OAuthClaimOptions,
): Promise<ClaimSuccess | { status: "cancelled" }> {
  const startingSession = await currentSession(client);

  // A linked identity can outlive a transient profile-finalization failure.
  // Retrying claim mode must finalize the profile without trying to relink it.
  if (startingSession.user.is_anonymous !== true) {
    await options.claimProfile();
    return { status: "success", userId: startingSession.user.id };
  }

  const { data, error } = await client.auth.linkIdentity({
    provider: options.provider,
    options: {
      redirectTo: options.redirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throwClaimError(error);
  if (!data.url) {
    throw new Error("Supabase did not return an account-linking URL.");
  }

  const browserResult = await options.openAuthSession(data.url);
  if (browserResult.type === "cancel" || browserResult.type === "dismiss") {
    return { status: "cancelled" };
  }
  if (browserResult.type !== "success" || !browserResult.url) {
    throw new Error("Account linking did not return to WikiRace.");
  }

  let callback: { userId: string };
  try {
    callback = await options.completeCallback(browserResult.url);
  } catch (callbackError) {
    await restoreGuestSession(client, startingSession);
    throwClaimError(callbackError);
  }

  const linkedSession = await currentSession(client);
  if (
    callback.userId !== startingSession.user.id ||
    linkedSession.user.id !== startingSession.user.id
  ) {
    await restoreGuestSession(client, startingSession);
    throw new Error(
      "Account claiming stopped because the player identity changed.",
    );
  }
  if (linkedSession.user.is_anonymous === true) {
    throw new Error("The provider did not finish linking this account.");
  }

  await options.claimProfile();
  return { status: "success", userId: linkedSession.user.id };
}
