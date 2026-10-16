import type { SupabaseClient } from "@supabase/supabase-js";
import { currentClaimSession } from "@workspace/game-client";

export { completeEmailClaim } from "@workspace/game-client";
export type { ClaimProfile } from "@workspace/game-client";

interface RequestEmailClaimOptions {
  email: string;
}

export async function requestEmailClaim(
  client: SupabaseClient,
  options: RequestEmailClaimOptions,
): Promise<{
  status: "ready-for-password" | "verification-required";
  userId: string;
}> {
  const guestSession = await currentClaimSession(client);
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
