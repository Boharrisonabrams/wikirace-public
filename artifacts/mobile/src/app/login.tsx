import { router, type Href, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EditorialCard, PrimaryAction } from "@/components/editorial-ui";
import SocialAuthButtons from "@/components/social-auth-buttons";
import { useAppTheme, type AppTheme } from "@/hooks/use-app-theme";
import { normalizeReturnPath } from "@/lib/auth-flow";
import { getSupabase } from "@/lib/supabase";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ next?: string | string[] }>();
  const returnPath = normalizeReturnPath(params.next);
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const passwordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formDisabled = submitting || socialSubmitting;
  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function submit() {
    if (formDisabled || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.dismissTo(returnPath as Href);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.intro}>
            <Text selectable style={styles.kicker}>
              WIKIRACE ACCOUNT
            </Text>
            <Text accessibilityRole="header" selectable style={styles.title}>
              Welcome back
            </Text>
            <Text selectable style={styles.copy}>
              Sign in to keep your stats, streaks, and shared races together.
            </Text>
          </View>

          <EditorialCard style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                accessibilityLabel="Email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!formDisabled}
                inputMode="email"
                onChangeText={setEmail}
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                placeholder="you@example.com"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="next"
                selectionColor={colors.accent}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                ref={passwordInputRef}
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete="current-password"
                editable={!formDisabled}
                onChangeText={setPassword}
                onSubmitEditing={() => void submit()}
                placeholder="••••••••"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="go"
                secureTextEntry
                selectionColor={colors.accent}
                style={styles.input}
                textContentType="password"
                value={password}
              />
            </View>

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text selectable style={styles.error}>
                  {error}
                </Text>
              </View>
            ) : null}

            <PrimaryAction
              disabled={!canSubmit || socialSubmitting}
              icon="log-in"
              label="Sign in"
              loading={submitting}
              onPress={() => void submit()}
              testID="login-submit"
            />

            <SocialAuthButtons
              disabled={submitting}
              next={returnPath}
              onBusyChange={setSocialSubmitting}
              onError={setError}
            />
          </EditorialCard>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New here?</Text>
            <Pressable
              accessibilityLabel="Create an account"
              accessibilityRole="link"
              disabled={formDisabled}
              onPress={() =>
                router.replace({
                  pathname: "/signup",
                  params: { next: returnPath },
                })
              }
              role="link"
              style={({ pressed }) => [
                styles.linkButton,
                pressed && styles.pressed,
                formDisabled && styles.disabled,
              ]}
            >
              <Text style={styles.linkText}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles({ colors, fonts }: AppTheme) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.chrome,
      flex: 1,
    },
    content: {
      flexGrow: 1,
      padding: 20,
      paddingBottom: 48,
      paddingTop: 28,
    },
    inner: {
      alignSelf: "center",
      maxWidth: 520,
      width: "100%",
    },
    intro: {
      marginBottom: 18,
    },
    kicker: {
      color: colors.accent,
      fontFamily: fonts.sansSemiBold,
      fontSize: 10,
      letterSpacing: 1.2,
      lineHeight: 15,
    },
    title: {
      color: colors.inkStrong,
      fontFamily: fonts.serif,
      fontSize: 34,
      lineHeight: 42,
      marginTop: 4,
    },
    copy: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
      maxWidth: 430,
    },
    formCard: {
      gap: 15,
      padding: 18,
    },
    field: {
      gap: 6,
    },
    label: {
      color: colors.inkMuted,
      fontFamily: fonts.sansMedium,
      fontSize: 12,
      lineHeight: 17,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 0,
      borderWidth: 1,
      color: colors.inkStrong,
      fontFamily: fonts.sans,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    errorBox: {
      backgroundColor: colors.dangerSoft,
      borderLeftColor: colors.danger,
      borderLeftWidth: 3,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    error: {
      color: colors.danger,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    footerRow: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      justifyContent: "center",
      marginTop: 18,
    },
    footerText: {
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
    },
    linkButton: {
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    linkText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      textDecorationLine: "underline",
    },
    pressed: {
      opacity: 0.7,
    },
    disabled: {
      opacity: 0.45,
    },
  });
}
