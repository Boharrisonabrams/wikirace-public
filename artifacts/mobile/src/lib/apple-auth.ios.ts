import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";

import {
  assertAppleState,
  enrichAppleProfileBestEffort,
  formatAppleFullName,
  isAppleCancellation,
  normalizeReturnPath,
  type AuthMode,
  type SocialAuthResult,
} from "@/lib/auth-flow";
import { claimWithSocialProvider } from "@/lib/social-auth";
import { getSupabase } from "@/lib/supabase";

export async function signInWithApple(
  next: unknown = "/",
  mode: AuthMode = "signin",
): Promise<SocialAuthResult> {
  if (mode === "claim") {
    return claimWithSocialProvider("apple", next);
  }

  const returnPath = normalizeReturnPath(next);

  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    const state = Crypto.randomUUID();
    const credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      state,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    assertAppleState(state, credential.state);
    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) throw error;
    if (!data.user) {
      throw new Error("Supabase did not return an Apple user.");
    }

    const fullName = formatAppleFullName(credential.fullName);
    if (fullName) {
      const givenName = credential.fullName?.givenName ?? null;
      const familyName = credential.fullName?.familyName ?? null;
      const enrichmentErrors = await enrichAppleProfileBestEffort({
        async updateUserMetadata() {
          const { error: metadataError } = await supabase.auth.updateUser({
            data: {
              display_name: fullName,
              full_name: fullName,
              given_name: givenName,
              family_name: familyName,
            },
          });
          if (metadataError) throw metadataError;
        },
        async updateProfile() {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ display_name: fullName })
            .eq("id", data.user.id);
          if (profileError) throw profileError;
        },
      });
      for (const enrichmentError of enrichmentErrors) {
        console.warn(
          "Apple sign-in succeeded, but name enrichment did not finish.",
          enrichmentError,
        );
      }
    }

    return { status: "success", next: returnPath };
  } catch (error) {
    if (isAppleCancellation(error, !Device.isDevice)) {
      return { status: "cancelled" };
    }
    throw error;
  }
}
