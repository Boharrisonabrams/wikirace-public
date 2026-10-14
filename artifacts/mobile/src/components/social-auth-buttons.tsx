import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AppleSignInButton from "@/components/apple-sign-in-button";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { signInWithApple } from "@/lib/apple-auth";
import {
  authErrorMessage,
  normalizeReturnPath,
  type AuthMode,
} from "@/lib/auth-flow";
import { signInWithGoogle } from "@/lib/social-auth";
import { resolveSocialAuthVisibility } from "@/lib/social-auth-availability";

interface SocialAuthButtonsProps {
  disabled?: boolean;
  mode?: AuthMode;
  next?: unknown;
  onBusyChange?: (busy: boolean) => void;
  onError: (message: string | null) => void;
}

type SocialProvider = "google" | "apple";

export default function SocialAuthButtons({
  disabled = false,
  mode = "signin",
  next,
  onBusyChange,
  onError,
}: SocialAuthButtonsProps) {
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeProvider, setActiveProvider] = useState<SocialProvider | null>(
    null,
  );
  const busy = activeProvider !== null;
  const returnPath = normalizeReturnPath(next);
  const providers = resolveSocialAuthVisibility(Platform.OS, {
    apple: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED,
    google: process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED,
  });

  async function authenticate(provider: SocialProvider) {
    if (disabled || busy) return;
    setActiveProvider(provider);
    onBusyChange?.(true);
    onError(null);

    try {
      const result =
        provider === "google"
          ? await signInWithGoogle(returnPath, mode)
          : await signInWithApple(returnPath, mode);
      if (result.status === "success") {
        router.replace(result.next as Href);
      }
    } catch (error) {
      onError(authErrorMessage(error));
    } finally {
      setActiveProvider(null);
      onBusyChange?.(false);
    }
  }

  if (!providers.any) return null;

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      {providers.google ? (
        <Pressable
          accessibilityLabel="Continue with Google"
          accessibilityRole="button"
          disabled={disabled || busy}
          onPress={() => void authenticate("google")}
          role="button"
          style={({ pressed }) => [
            styles.googleButton,
            pressed && styles.pressed,
            (disabled || busy) && styles.disabled,
          ]}
        >
          {activeProvider === "google" ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <Text style={styles.googleMark}>G</Text>
              <Text style={styles.googleText}>Continue with Google</Text>
            </>
          )}
        </Pressable>
      ) : null}

      {providers.apple ? (
        <AppleSignInButton
          busy={activeProvider === "apple"}
          disabled={disabled || (busy && activeProvider !== "apple")}
          onPress={() => void authenticate("apple")}
        />
      ) : null}
      {providers.apple && activeProvider === "apple" ? (
        <View accessibilityLiveRegion="polite" style={styles.appleBusy}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.appleBusyText}>Finishing Apple sign-in…</Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles({ colors, fonts, radius }: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 10,
      marginTop: 2,
    },
    dividerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 10,
      marginVertical: 4,
    },
    divider: {
      backgroundColor: colors.borderSoft,
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    dividerText: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 11,
      lineHeight: 16,
    },
    googleButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.small,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: 16,
    },
    googleMark: {
      color: "#4285f4",
      fontFamily: fonts.sansBold,
      fontSize: 19,
    },
    googleText: {
      color: colors.inkStrong,
      fontFamily: fonts.sansSemiBold,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.72,
    },
    disabled: {
      opacity: 0.5,
    },
    appleBusy: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: 24,
    },
    appleBusyText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 13,
    },
  });
}
