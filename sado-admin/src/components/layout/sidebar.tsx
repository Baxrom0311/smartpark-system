import { Link } from "@tanstack/react-router";
import {
  Activity,
  Baby,
  BarChart3,
  Building2,
  Dumbbell,
  LayoutDashboard,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/users", labelKey: "nav.users", icon: Users },
  { to: "/children", labelKey: "nav.children", icon: Baby },
  {
    to: "/kindergartens",
    labelKey: "nav.kindergartens",
    icon: Building2,
  },
  { to: "/exercises", labelKey: "nav.exercises", icon: Dumbbell },
  { to: "/statistics", labelKey: "nav.statistics", icon: BarChart3 },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

export function Sidebar() {
  const { t } = useTranslation();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-brand-200 bg-white transition-transform dark:border-brand-800 dark:bg-brand-950",
          "lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-brand-200 px-6 dark:border-brand-800">
          <Link
            to="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-brand-900 dark:text-brand-50"
          >
            <Activity className="h-6 w-6 text-brand-600" aria-hidden />
            SADO
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-900 dark:text-brand-200 dark:hover:bg-brand-800 dark:hover:text-brand-50"
                    activeProps={{
                      className:
                        "bg-brand-100 text-brand-900 dark:bg-brand-800 dark:text-brand-50",
                    }}
                    activeOptions={{ exact: item.to === "/" }}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-brand-200 p-4 text-xs text-brand-500 dark:border-brand-800 dark:text-brand-400">
          {t("app.name")} · v0.1
        </div>
      </aside>
    </>
  );
}
