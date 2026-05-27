import "../global.css";

import { useEffect, useState } from "react";
import { ActivityIndicator, DeviceEventEmitter, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { initI18n } from "@/i18n/config";
import { AUTH_EXPIRED_EVENT } from "@/services/api";
import { useNotifications } from "@/hooks/useNotifications";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useAuthStore } from "@/stores/auth-store";

// Keep splash visible while resources are loading. Hidden in the root effect.
void SplashScreen.preventAutoHideAsync().catch(() => {
  /* preventAutoHideAsync may already have been called — safe to ignore. */
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export default function RootLayout(): React.ReactElement {
  const [ready, setReady] = useState(false);
  const authStatus = useAuthStore((state) => state.status);

  // Only run the push-registration flow once the user has finished
  // bootstrapping AND is authenticated — asking for notification
  // permission before they've signed in is jarring on iOS.
  useNotifications({ enabled: ready && authStatus === "authenticated" });

  // Hydrate the offline queue + start the connectivity poller as soon
  // as the user is signed in. The hook is a no-op until `enabled` so
  // we don't probe the API during the splash screen.
  useOfflineSync({ enabled: ready && authStatus === "authenticated" });

  useEffect(() => {
    let cancelled = false;
    const start = async (): Promise<void> => {
      try {
        await initI18n();
        await useAuthStore.getState().bootstrap();
      } finally {
        if (!cancelled) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => {
            /* hideAsync may fail if already hidden — safe to ignore. */
          });
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      AUTH_EXPIRED_EVENT,
      () => {
        // Refresh failed in the background — drop the user back at the
        // auth flow so they can re-enter credentials.
        useAuthStore.getState().reset();
        router.replace("/(auth)/login");
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          {ready ? (
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
              }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#ffffff",
              }}
            >
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
