import Feather from "@expo/vector-icons/Feather";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useAuthSession } from "@/hooks/use-auth-session";

export default function TabLayout() {
  const { colors, fonts } = useAppTheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAuthSession();
  const bottomInset = Platform.OS === "web" ? 12 : bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.chrome },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.link,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: fonts.sansMedium,
          fontSize: 10,
        },
        tabBarStyle: {
          height: 60 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          backgroundColor: colors.chrome,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              color={color}
              name="home"
              size={21}
              strokeWidth={focused ? 2.6 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          href: user ? undefined : null,
          title: "Rank",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              color={color}
              name="award"
              size={21}
              strokeWidth={focused ? 2.6 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <Feather
              color={color}
              name="user"
              size={21}
              strokeWidth={focused ? 2.6 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
