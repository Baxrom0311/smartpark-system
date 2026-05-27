/**
 * App entry — runs the auth bootstrap on mount and routes the user
 * either into the authenticated parent stack or the onboarding flow
 * based on the persisted session.
 *
 * While the bootstrap is in flight (`idle` / `loading`) we render a
 * splash-style loading view so the app never flashes the wrong stack.
 */

import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Redirect } from "expo-router";

import { useAuthStore } from "@/stores/auth-store";

export default function IndexRoute(): React.ReactElement {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    if (status === "idle") {
      void bootstrap();
    }
  }, [status, bootstrap]);

  if (status === "idle" || status === "loading") {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-sm text-neutral-500">SADO</Text>
      </View>
    );
  }

  if (status === "authenticated") {
    return <Redirect href="/(parent)" />;
  }

  return <Redirect href="/(auth)/onboarding" />;
}
