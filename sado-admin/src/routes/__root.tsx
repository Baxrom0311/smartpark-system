import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  ScrollRestoration,
  useRouter,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";

import { ErrorFallback } from "@/components/shared/error-fallback";
import { NotFoundPage } from "@/components/shared/not-found";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  errorComponent: ({ error, reset }) => (
    <ErrorFallback error={error} reset={reset} />
  ),
  notFoundComponent: NotFoundPage,
});

function RootComponent() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;

  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const theme = useUiStore((s) => s.theme);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (status === "idle") {
      void bootstrap();
    }
  }, [status, bootstrap]);

  useEffect(() => {
    document.documentElement.lang = i18n.language || "uz";
  }, [i18n.language]);

  // Match the toast palette to the active theme — the `Toaster` accepts
  // either "light", "dark", or "system" and resolves the latter via
  // `prefers-color-scheme`.
  const toasterTheme: "light" | "dark" | "system" =
    theme === "dark" ? "dark" : theme === "light" ? "light" : "system";

  return (
    <QueryClientProvider client={queryClient}>
      <ScrollRestoration />
      <Outlet />
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme={toasterTheme}
        toastOptions={{
          // Keep durations short enough that successive saves don't
          // pile up on screen but long enough to be readable.
          duration: 4000,
        }}
      />
    </QueryClientProvider>
  );
}
