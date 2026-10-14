import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { AppleSignInButtonProps } from "./apple-sign-in-button.types";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function AppleSignInButton({
  busy,
  disabled,
  onPress,
}: AppleSignInButtonProps) {
  const { isDark, radius } = useAppTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((isAvailable) => {
        if (active) setAvailable(isAvailable);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!available) return null;

  return (
    <View
      pointerEvents={disabled || busy ? "none" : "auto"}
      style={styles.wrapper}
    >
      <AppleAuthentication.AppleAuthenticationButton
        accessibilityLabel="Continue with Apple"
        accessibilityState={{ disabled: disabled || busy }}
        buttonStyle={
          isDark
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        cornerRadius={radius.small}
        onPress={onPress}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 52,
    width: "100%",
  },
  button: {
    height: 52,
    width: "100%",
  },
});
