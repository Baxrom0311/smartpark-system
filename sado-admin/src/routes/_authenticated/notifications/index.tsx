import { createFileRoute } from "@tanstack/react-router";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/queries/use-notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

export const Route = createFileRoute("/_authenticated/notifications/")({
  component: NotificationsPage,
});

type Filter = "all" | "unread";

function formatTimestamp(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>("all");

  const query = useNotifications({
    unreadOnly: filter === "unread",
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const archive = useArchiveNotification();

  const items = useMemo<Notification[]>(
    () => query.data?.pages.flatMap((p) => p.items) ?? [],
    [query.data],
  );

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("notifications.title")}
        description={t("notifications.description")}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={!hasUnread || markAllRead.isPending}
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            {t("notifications.markAllRead")}
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={t("notifications.filters.all")}
        />
        <FilterChip
          active={filter === "unread"}
          onClick={() => setFilter("unread")}
          label={t("notifications.filters.unread")}
        />
      </div>

      <section
        aria-label={t("notifications.title")}
        className="flex flex-col gap-3"
      >
        {query.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))
        ) : query.isError ? (
          <p className="rounded-lg border border-risk-red/30 bg-risk-red/10 p-4 text-sm text-risk-red">
            {query.error instanceof Error
              ? query.error.message
              : t("errors.server")}
          </p>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          items.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              locale={i18n.language}
              onMarkRead={() => markRead.mutate(n.id)}
              onArchive={() => archive.mutate(n.id)}
              isMutating={markRead.isPending || archive.isPending}
            />
          ))
        )}
      </section>

      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage
              ? t("common.loading")
              : t("common.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function FilterChip({ active, label, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-200 dark:hover:bg-brand-800",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

interface NotificationRowProps {
  notification: Notification;
  locale: string;
  onMarkRead: () => void;
  onArchive: () => void;
  isMutating: boolean;
}

function NotificationRow({
  notification,
  locale,
  onMarkRead,
  onArchive,
  isMutating,
}: NotificationRowProps) {
  const { t } = useTranslation();
  const unread = !notification.read_at;
  return (
    <article
      data-testid="notification-row"
      data-unread={unread ? "true" : "false"}
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4 transition-colors",
        "dark:border-brand-800",
        unread
          ? "border-brand-300 bg-brand-50/60 dark:bg-brand-900"
          : "border-brand-200 bg-white dark:bg-brand-950",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Bell
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              unread ? "text-brand-600" : "text-brand-400",
            )}
            aria-hidden
          />
          <div className="min-w-0">
            <h3
              className={cn(
                "text-sm",
                unread
                  ? "font-semibold text-brand-900 dark:text-brand-50"
                  : "font-medium text-brand-700 dark:text-brand-200",
              )}
            >
              {notification.title}
            </h3>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-brand-400">
              {t(`notifications.types.${notification.type}`, {
                defaultValue: notification.type,
              })}
            </p>
          </div>
        </div>
        <time
          className="shrink-0 text-xs text-brand-400 dark:text-brand-500"
          dateTime={notification.created_at}
        >
          {formatTimestamp(notification.created_at, locale)}
        </time>
      </div>
      {notification.body && (
        <p className="text-sm text-brand-700 dark:text-brand-200">
          {notification.body}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {unread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkRead}
            disabled={isMutating}
            data-testid="mark-read-button"
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
            {t("notifications.markRead")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onArchive}
          disabled={isMutating}
          aria-label={t("notifications.archive")}
          title={t("notifications.archive")}
          data-testid="archive-button"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </article>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-brand-200 p-10 text-center dark:border-brand-800">
      <BellOff className="h-8 w-8 text-brand-300" aria-hidden />
      <p className="text-sm font-medium text-brand-700 dark:text-brand-200">
        {t("notifications.empty")}
      </p>
      <p className="text-xs text-brand-500 dark:text-brand-400">
        {t("notifications.emptyHint")}
      </p>
    </div>
  );
}
