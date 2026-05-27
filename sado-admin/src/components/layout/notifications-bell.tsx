import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useUnreadNotificationCount } from "@/hooks/queries/use-notifications";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Header bell that links to the notifications inbox and surfaces an
 * unread badge. The query is gated behind an authenticated user so we
 * don't fire it on the login screen.
 *
 * Implemented as a styled `<Link>` (rather than a `<Button asChild>`)
 * because the shared `Button` component is a plain `<button>` and does
 * not forward to a router link element.
 */
export function NotificationsBell() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const enabled = status === "authenticated";
  const { data } = useUnreadNotificationCount(enabled);
  const unread = data?.unread ?? 0;
  const display = unread > 99 ? "99+" : String(unread);

  return (
    <Link
      to="/notifications"
      aria-label={t("notifications.bellAriaLabel", { count: unread })}
      title={t("notifications.bellTitle")}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-lg",
        "text-brand-900 transition-colors hover:bg-brand-100",
        "dark:text-brand-100 dark:hover:bg-brand-800",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
      )}
      data-testid="notifications-bell"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unread > 0 && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-risk-red px-1 text-[10px] font-bold leading-none text-white shadow-sm"
          aria-hidden
          data-testid="notifications-bell-badge"
        >
          {display}
        </span>
      )}
      <span className="sr-only">
        {t("notifications.unreadCount", { count: unread })}
      </span>
    </Link>
  );
}
