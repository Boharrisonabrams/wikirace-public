import Feather from "@expo/vector-icons/Feather";
import * as Linking from "expo-linking";
import { router, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { EditorialCard, PrimaryAction } from "@/components/editorial-ui";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import {
  finishAuthCallbackRoute,
  resolveAuthCallbackRecovery,
  type AuthCallbackRecovery,
} from "@/lib/auth-callback-route";
import { authErrorMessage } from "@/lib/auth-flow";

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const linkingUrl = Linking.useLinkingURL();
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<AuthCallbackRecovery | null>(null);

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      try {
        const initialUrl = linkingUrl ?? (await Linking.getInitialURL());
        if (!initialUrl) {
          throw new Error("Missing authentication callback URL.");
        }
        const result = await finishAuthCallbackRoute(initialUrl);
        if (active) router.dismissTo(result.next as Href);
      } catch (callbackError) {
        const nextRecovery = await resolveAuthCallbackRecovery(callbackError);
        if (active) {
          setError(authErrorMessage(callbackError));
          setRecovery(nextRecovery);
        }
      }
    }

    void finishSignIn();
    return () => {
      active = false;
    };
  }, [linkingUrl]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      style={styles.page}
    >
      <EditorialCard style={styles.card}>
        {error ? (
          <>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.errorIcon}
            >
              <Feather color={colors.danger} name="alert-circle" size={23} />
            </View>
            <Text accessibilityRole="header" selectable style={styles.title}>
              {recovery?.mode === "claim"
                ? "Account setup could not finish"
                : "Sign-in could not finish"}
            </Text>
            <View accessibilityRole="alert" style={styles.errorBox}>
              <Text selectable style={styles.error}>
                {error}
              </Text>
            </View>
            <PrimaryAction
              icon="arrow-left"
              label={recovery?.label ?? "Back to sign in"}
              onPress={() =>
                router.dismissTo((recovery?.destination ?? "/login") as Href)
              }
              testID="auth-callback-recover"
            />
          </>
        ) : (
          <View accessibilityLiveRegion="polite" style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <Text accessibilityRole="header" selectable style={styles.title}>
              Completing sign in
            </Text>
            <Text selectable style={styles.copy}>
              Connecting your WikiRace account…
            </Text>
          </View>
        )}
      </EditorialCard>
    </ScrollView>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    page: {
      backgroundColor: colors.chrome,
    },
    container: {
      alignItems: "center",
      backgroundColor: colors.chrome,
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
    },
    card: {
      gap: 15,
      maxWidth: 460,
      padding: 22,
      width: "100%",
    },
    loading: {
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
    },
    errorIcon: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.dangerSoft,
      borderRadius: 23,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 27,
      lineHeight: 34,
      textAlign: "center",
    },
    copy: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    errorBox: {
      backgroundColor: colors.dangerSoft,
      borderLeftColor: colors.danger,
      borderLeftWidth: 3,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
  });
}
