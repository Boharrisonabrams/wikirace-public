import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type ClaimProfile = () => Promise<void>;

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

export async function currentClaimSession(client: SupabaseClient): Promise<Session> {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Your player session is missing.");
  return data.session;
}

function requireSameUser(session: Session, expectedUserId: string): void {
  if (session.user.id !== expectedUserId) {
    throw new Error("Account claiming stopped because the player identity changed.");
  }
}

export async function completeEmailClaim(
  client: SupabaseClient,
  options: CompleteEmailClaimOptions
): Promise<ClaimSuccess> {
  let session = await currentClaimSession(client);
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

  const { data: passwordData, error: passwordError } = await client.auth.updateUser({
    password: options.password,
  });
  if (passwordError) throw passwordError;
  if (!passwordData.user || passwordData.user.id !== options.expectedUserId) {
    throw new Error("Account claiming stopped because the player identity changed.");
  }

  await options.claimProfile();
  return { status: "success", userId: options.expectedUserId };
}
