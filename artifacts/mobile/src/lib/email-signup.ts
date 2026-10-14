import type { SupabaseClient } from "@supabase/supabase-js";

import { beginAuthCallback } from "./auth-callback";
import { cancelAuthTransaction } from "./auth-transaction";

interface EmailSignupOptions {
  email: string;
  next: unknown;
  password: string;
}

interface EmailSignupDependencies {
  beginAuthCallback: typeof beginAuthCallback;
  cancelAuthTransaction: typeof cancelAuthTransaction;
}

const defaultDependencies: EmailSignupDependencies = {
  beginAuthCallback,
  cancelAuthTransaction,
};

export async function signUpWithBoundCallback(
  client: SupabaseClient,
  options: EmailSignupOptions,
  dependencies: EmailSignupDependencies = defaultDependencies,
) {
  const transaction = await dependencies.beginAuthCallback({
    expectedGuestUserId: null,
    lifetime: "email-confirmation",
    mode: "signin",
    next: options.next,
  });

  try {
    const result = await client.auth.signUp({
      email: options.email,
      password: options.password,
      options: { emailRedirectTo: transaction.redirectUri },
    });
    if (result.error || result.data.session) {
      await dependencies.cancelAuthTransaction(transaction.flowId);
    }
    return result;
  } catch (error) {
    await dependencies.cancelAuthTransaction(transaction.flowId);
    throw error;
  }
}
