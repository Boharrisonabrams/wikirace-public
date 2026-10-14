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
import { api } from "@/lib/api";
import { authErrorMessage, normalizeReturnPath } from "@/lib/auth-flow";
import {
  completeEmailClaim,
  isAccountClaimConflict,
  requestEmailClaim,
} from "@/lib/claim-account";
import { signUpWithBoundCallback } from "@/lib/email-signup";
import { getSupabase } from "@/lib/supabase";

export default function SignupScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    next?: string | string[];
  }>();
  const returnPath = normalizeReturnPath(params.next);
  const mode =
    (Array.isArray(params.mode) ? params.mode[0] : params.mode) === "claim"
      ? "claim"
      : "signin";
  const claimMode = mode === "claim";
  const theme = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const passwordInputRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [claimUserId, setClaimUserId] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [socialSubmitting, setSocialSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claimConflict, setClaimConflict] = useState(false);
  const formDisabled = submitting || socialSubmitting;
  const awaitingVerification = claimMode && claimUserId !== null;
  const canSubmit = awaitingVerification
    ? (!verificationRequired || verificationCode.trim().length === 6) &&
      password.length >= 6
    : claimMode
      ? email.trim().length > 0
      : email.trim().length > 0 && password.length >= 6;

  async function submit() {
    if (formDisabled || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    setClaimConflict(false);

    if (claimMode) {
      try {
        const client = getSupabase();
        if (!claimUserId) {
          const result = await requestEmailClaim(client, {
            email: email.trim(),
          });
          setClaimUserId(result.userId);
          const needsVerification = result.status === "verification-required";
          setVerificationRequired(needsVerification);
          setMessage(
            needsVerification
              ? "Enter the 6-digit code from your email, then choose a password."
              : "Your email is ready. Choose a password to save this account.",
          );
        } else {
          await completeEmailClaim(client, {
            email: email.trim(),
            expectedUserId: claimUserId,
            password,
            verificationCode: verificationCode.trim(),
            claimProfile: async () => {
              await api<{ claimed: true }>("/profile/claim", {
                method: "POST",
              });
            },
          });
          router.dismissTo(returnPath as Href);
        }
      } catch (claimError) {
        setClaimConflict(isAccountClaimConflict(claimError));
        setError(authErrorMessage(claimError));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const { data, error: signUpError } = await signUpWithBoundCallback(
      getSupabase(),
      {
        email: email.trim(),
        next: returnPath,
        password,
      },
    );
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.dismissTo(returnPath as Href);
      return;
    }

    setMessage("Check your email to finish creating the account.");
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
              {claimMode ? "Save your WikiRace score" : "Join WikiRace"}
            </Text>
            <Text selectable style={styles.copy}>
              {claimMode
                ? "Connect this guest player to an account without changing its score or identity."
                : "Create an account, then start today’s race through the encyclopedia."}
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
                editable={!formDisabled && !awaitingVerification}
                inputMode="email"
                onChangeText={setEmail}
                onSubmitEditing={() => {
                  if (claimMode && !awaitingVerification) {
                    void submit();
                  } else {
                    passwordInputRef.current?.focus();
                  }
                }}
                placeholder="you@example.com"
                placeholderTextColor={colors.inkMuted}
                returnKeyType="next"
                selectionColor={colors.accent}
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            {awaitingVerification && verificationRequired ? (
              <View style={styles.field}>
                <Text style={styles.label}>Verification code</Text>
                <TextInput
                  accessibilityLabel="6-digit verification code"
                  autoComplete="one-time-code"
                  editable={!formDisabled}
                  inputMode="numeric"
                  maxLength={6}
                  onChangeText={setVerificationCode}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  placeholder="123456"
                  placeholderTextColor={colors.inkMuted}
                  returnKeyType="next"
                  selectionColor={colors.accent}
                  style={styles.input}
                  textContentType="oneTimeCode"
                  value={verificationCode}
                />
              </View>
            ) : null}

            {!claimMode || awaitingVerification ? (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  ref={passwordInputRef}
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  editable={!formDisabled}
                  onChangeText={setPassword}
                  onSubmitEditing={() => void submit()}
                  placeholder="At least 6 characters"
                  placeholderTextColor={colors.inkMuted}
                  returnKeyType="go"
                  secureTextEntry
                  selectionColor={colors.accent}
                  style={styles.input}
                  textContentType="newPassword"
                  value={password}
                />
              </View>
            ) : null}

            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text selectable style={styles.error}>
                  {error}
                </Text>
              </View>
            ) : null}
            {message ? (
              <View accessibilityLiveRegion="polite" style={styles.messageBox}>
                <Text selectable style={styles.message}>
                  {message}
                </Text>
              </View>
            ) : null}
            {claimMode && claimConflict ? (
              <View style={styles.conflictBox}>
                <Pressable
                  accessibilityLabel="Sign in instead"
                  accessibilityRole="link"
                  disabled={formDisabled}
                  onPress={() =>
                    router.replace({
                      pathname: "/login",
                      params: { next: returnPath },
                    })
                  }
                  role="link"
                  style={({ pressed }) => [
                    styles.conflictAction,
                    pressed && styles.pressed,
                    formDisabled && styles.disabled,
                  ]}
                >
                  <Text style={styles.conflictActionText}>Sign in instead</Text>
                </Pressable>
                <Text selectable style={styles.conflictCopy}>
                  Games played on this phone stay with its guest profile
                </Text>
              </View>
            ) : null}

            <PrimaryAction
              disabled={!canSubmit || socialSubmitting}
              icon={awaitingVerification ? "check" : "user-plus"}
              label={
                claimMode
                  ? awaitingVerification
                    ? "Save account"
                    : "Send verification code"
                  : "Create account"
              }
              loading={submitting}
              onPress={() => void submit()}
              testID="signup-submit"
            />

            <SocialAuthButtons
              disabled={submitting}
              mode={mode}
              next={returnPath}
              onBusyChange={setSocialSubmitting}
              onError={(nextError) => {
                setError(nextError);
                if (nextError) setMessage(null);
              }}
            />
          </EditorialCard>

          {!claimMode ? (
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable
                accessibilityLabel="Sign in"
                accessibilityRole="link"
                disabled={formDisabled}
                onPress={() =>
                  router.replace({
                    pathname: "/login",
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
                <Text style={styles.linkText}>Sign in</Text>
              </Pressable>
            </View>
          ) : null}
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
    messageBox: {
      backgroundColor: colors.successSoft,
      borderLeftColor: colors.success,
      borderLeftWidth: 3,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    message: {
      color: colors.success,
      fontFamily: fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    conflictBox: {
      gap: 8,
      paddingTop: 2,
    },
    conflictAction: {
      alignSelf: "flex-start",
      minHeight: 44,
      justifyContent: "center",
    },
    conflictActionText: {
      color: colors.link,
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      textDecorationLine: "underline",
    },
    conflictCopy: {
      color: colors.inkMuted,
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
