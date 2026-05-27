import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/stores/auth-store";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ location }) => {
    const status = useAuthStore.getState().status;
    // While we're still bootstrapping (status === "loading" or "idle"
    // before bootstrap completes), let the route render — the layout
    // shows a loader until the user is hydrated. We only redirect when
    // we've definitively confirmed the user is anonymous.
    if (status === "anonymous" || status === "error") {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const status = useAuthStore((s) => s.status);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600"
            aria-hidden
          />
          <p className="text-sm text-brand-500">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-brand-50 dark:bg-brand-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
