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

import { useAuthStore } from "@/stores/auth-store";

export interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  const router = useRouter();
  const queryClient = router.options.context.queryClient;

  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (status === "idle") {
      void bootstrap();
    }
  }, [status, bootstrap]);

  useEffect(() => {
    document.documentElement.lang = i18n.language || "uz";
  }, [i18n.language]);

  return (
    <QueryClientProvider client={queryClient}>
      <ScrollRestoration />
      <Outlet />
    </QueryClientProvider>
  );
}
