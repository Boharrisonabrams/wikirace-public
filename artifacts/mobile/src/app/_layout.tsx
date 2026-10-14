import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { LibreCaslonText_400Regular } from "@expo-google-fonts/libre-caslon-text/400Regular";
import { LibreCaslonText_400Regular_Italic } from "@expo-google-fonts/libre-caslon-text/400Regular_Italic";
import { LibreCaslonText_700Bold } from "@expo-google-fonts/libre-caslon-text/700Bold";
import * as Notifications from "expo-notifications";
import { router, Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { AppState } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import {
  foregroundReminderBehavior,
  reconcileDailyReminder,
} from "@/lib/reminders";
import { startNotificationCoordinator } from "@/lib/notification-coordinator";

SplashScreen.preventAutoHideAsync();

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => foregroundReminderBehavior(),
  });
} catch {
  // Notifications are optional on unsupported runtimes.
}

function NotificationCoordinator() {
  useEffect(() => {
    return startNotificationCoordinator({
      addAppStateListener: (listener) =>
        AppState.addEventListener("change", listener),
      addReceivedListener: Notifications.addNotificationReceivedListener,
      addResponseListener:
        Notifications.addNotificationResponseReceivedListener,
      clearLastResponse: Notifications.clearLastNotificationResponse,
      getLastResponse: Notifications.getLastNotificationResponse,
      navigateHome: (destination) => router.replace(destination),
      reconcile: reconcileDailyReminder,
    });
  }, []);

  return null;
}

export default function RootLayout() {
  const { colors, fonts, isDark } = useAppTheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    LibreCaslonText_400Regular,
    LibreCaslonText_400Regular_Italic,
    LibreCaslonText_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  const navigationTheme = useMemo(() => {
    const baseTheme = isDark ? DarkTheme : DefaultTheme;
    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colors.link,
        background: colors.chrome,
        card: colors.chrome,
        text: colors.ink,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [colors, isDark]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.chrome },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontFamily: fonts.sansSemiBold },
          contentStyle: { backgroundColor: colors.chrome },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            title: "Sign in",
            contentStyle: { backgroundColor: colors.chrome },
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            title: "Create account",
            contentStyle: { backgroundColor: colors.chrome },
          }}
        />
        <Stack.Screen
          name="auth/callback"
          options={{
            title: "Completing sign in",
            headerBackVisible: false,
            contentStyle: { backgroundColor: colors.chrome },
          }}
        />
        <Stack.Screen
          name="game"
          options={{
            title: "Daily race",
            headerBackVisible: false,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="result"
          options={{
            title: "Result",
            headerBackVisible: false,
            contentStyle: { backgroundColor: colors.chrome },
          }}
        />
        <Stack.Screen
          name="challenge/create"
          options={{ title: "Create a private game" }}
        />
        <Stack.Screen
          name="challenge/[code]"
          options={{ title: "Challenge" }}
        />
      </Stack>
      <NotificationCoordinator />
      <StatusBar
        backgroundColor={colors.chrome}
        style={isDark ? "light" : "dark"}
      />
    </ThemeProvider>
  );
}
