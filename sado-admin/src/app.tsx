import { QueryClient } from "@tanstack/react-query";
import {
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

// i18next must be initialized before any component that uses
// `useTranslation` is rendered.
import "@/i18n/config";

import { routeTree } from "@/routeTree.gen";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export function App(): React.ReactElement {
  return <RouterProvider router={router} />;
}
