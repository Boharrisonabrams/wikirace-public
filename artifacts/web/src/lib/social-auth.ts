import { buildAuthCallbackUrl, normalizeReturnPath } from "@/lib/auth-redirect";
import { getSupabase } from "@/lib/supabase/client";

interface SocialAuthDependencies {
  client?: Pick<ReturnType<typeof getSupabase>, "auth">;
  origin?: string;
}

export async function signInWithGoogle(
  next: unknown = "/",
  dependencies: SocialAuthDependencies = {},
) {
  const client = dependencies.client ?? getSupabase();
  const origin = dependencies.origin ?? window.location.origin;

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildAuthCallbackUrl(origin, normalizeReturnPath(next)),
    },
  });

  if (error) throw error;
  return data;
}
