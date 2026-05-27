/**
 * Layout for the authenticated parent stack.
 *
 * Guards the route group: if no authenticated user is available we
 * redirect to the onboarding/login flow. We treat `idle`/`loading`
 * as still-bootstrapping so the user sees a spinner instead of being
 * bounced back to login during a refresh.
 */

import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "@/stores/auth-store";

export default function ParentLayout(): React.ReactElement {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === "idle" || status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (status !== "authenticated" || user === null) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#f9fafb" },
      }}
    />
  );
}
