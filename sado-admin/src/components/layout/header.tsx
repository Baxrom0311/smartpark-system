import { useNavigate } from "@tanstack/react-router";
import { LogOut, Menu, Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { NotificationsBell } from "@/components/layout/notifications-bell";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function Header() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const navigate = useNavigate();

  const ThemeIcon = themeIcons[theme];

  const cycleTheme = () => {
    const order = ["light", "dark", "system"] as const;
    const next = order[(order.indexOf(theme) + 1) % order.length];
    if (next) setTheme(next);
  };

  const cycleLanguage = () => {
    const next = i18n.language === "uz" ? "ru" : "uz";
    void i18n.changeLanguage(next);
  };

  const handleLogout = async () => {
    await logout();
    void navigate({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-brand-200 bg-white/80 px-4 backdrop-blur dark:border-brand-800 dark:bg-brand-950/80 lg:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-brand-900 dark:text-brand-50">
          {t("app.name")}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleLanguage}
          aria-label="Switch language"
          className="font-mono uppercase"
        >
          {i18n.language.slice(0, 2)}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          aria-label={`Theme: ${t(`theme.${theme}`)}`}
          title={t(`theme.${theme}`)}
        >
          <ThemeIcon className="h-5 w-5" />
        </Button>

        {user && (
          <div className="ml-2 hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-sm font-medium text-brand-900 dark:text-brand-50">
                {user.full_name || user.email || user.phone}
              </p>
              <p className="text-xs uppercase tracking-wider text-brand-500">
                {user.role}
              </p>
            </div>
          </div>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleLogout()}
          aria-label={t("auth.logout")}
          title={t("auth.logout")}
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
