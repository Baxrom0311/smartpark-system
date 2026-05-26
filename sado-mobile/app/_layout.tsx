import "../global.css";

import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
  },
});

export default function RootLayout(): React.ReactElement {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {
      /* hideAsync may fail if already hidden — safe to ignore. */
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "slide_from_right",
            }}
          />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
