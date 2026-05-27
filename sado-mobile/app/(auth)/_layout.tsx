/**
 * Layout for the unauthenticated stack: onboarding, login, register.
 *
 * Redirects authenticated users to the parent home if a session is
 * already active. Unauthenticated guests see the onboarding screen
 * by default; the login/register routes are reachable from there.
 */

import { Redirect, Stack } from "expo-router";

import { selectIsAuthenticated, useAuthStore } from "@/stores/auth-store";

export default function AuthLayout(): React.ReactElement {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(parent)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#ffffff" },
      }}
    />
  );
}
