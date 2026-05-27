/**
 * Layout for the authenticated teacher stack.
 *
 * Mirrors the parent layout's auth guard, but additionally checks
 * that the user's role is `teacher` (or `admin`, who may impersonate
 * the teacher view). Anyone else is bounced into the parent flow so
 * they can still use the app.
 */

import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";

import { useAuthStore } from "@/stores/auth-store";

export default function TeacherLayout(): React.ReactElement {
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

  if (user.role !== "teacher" && user.role !== "admin") {
    return <Redirect href="/(parent)" />;
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
