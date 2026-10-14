import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type ClaimProfile = () => Promise<void>;

interface RequestEmailClaimOptions {
  email: string;
}

interface CompleteEmailClaimOptions {
  claimProfile: ClaimProfile;
  email: string;
  expectedUserId: string;
  password: string;
  verificationCode: string;
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

  const { data, error } = await client.auth.updateUser({
    email: options.email,
  });
  if (error) throw error;
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
): Promise<{ status: "success"; userId: string }> {
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
