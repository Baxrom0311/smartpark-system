/**
 * Notifications inbox hooks.
 *
 * Wraps the `/notifications` endpoints exposed by the API:
 *   - `GET    /notifications`              — cursor-paginated list
 *   - `GET    /notifications/unread-count` — cheap badge counter
 *   - `PUT    /notifications/{id}/read`    — mark a single notification as read
 *   - `POST   /notifications/read-all`     — bulk mark-as-read
 *   - `DELETE /notifications/{id}`         — soft-archive
 *
 * The unread-count query is short-staled and polled so the header bell
 * can update without forcing a full list refetch every time the user
 * navigates around the dashboard.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type {
  CursorPage,
  Notification,
  UnreadCountResponse,
} from "@/types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const UNREAD_COUNT_QUERY_KEY = [
  ...NOTIFICATIONS_QUERY_KEY,
  "unread-count",
] as const;

/** How often to refetch the unread badge counter (ms). */
export const UNREAD_REFETCH_INTERVAL_MS = 60_000;

export interface UseNotificationsParams {
  /** Only return unread notifications. */
  unreadOnly?: boolean;
  /** Include archived notifications in the list. */
  includeArchived?: boolean;
  /** Page size — server clamps to 1..MAX_PAGE_SIZE. */
  limit?: number;
}

export type NotificationsInfinite = InfiniteData<
  CursorPage<Notification>,
  string | null
>;

export function useNotifications(
  params: UseNotificationsParams = {},
): UseInfiniteQueryResult<NotificationsInfinite, Error> {
  const { unreadOnly = false, includeArchived = false, limit = 20 } = params;
  return useInfiniteQuery<
    CursorPage<Notification>,
    Error,
    NotificationsInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: [
      ...NOTIFICATIONS_QUERY_KEY,
      "list",
      { unreadOnly, includeArchived, limit },
    ],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<Notification>>("/notifications", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          unread_only: unreadOnly || undefined,
          include_archived: includeArchived || undefined,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 15_000,
  });
}

export function useUnreadNotificationCount(
  enabled = true,
): UseQueryResult<UnreadCountResponse, Error> {
  return useQuery<UnreadCountResponse, Error>({
    queryKey: UNREAD_COUNT_QUERY_KEY,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.get<UnreadCountResponse>("/notifications/unread-count", {
        signal,
      }),
    staleTime: 15_000,
    refetchInterval: UNREAD_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Patch the inbox cache so a mutated notification appears as
 * (un)read or archived without forcing a full refetch. Returns a list
 * of cache-invalidation calls the caller can `await` if needed.
 */
function patchNotificationInCache(
  qc: ReturnType<typeof useQueryClient>,
  next: Notification,
): void {
  qc.setQueriesData<NotificationsInfinite>(
    { queryKey: [...NOTIFICATIONS_QUERY_KEY, "list"] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((n) => (n.id === next.id ? next : n)),
        })),
      };
    },
  );
}

function removeNotificationFromCache(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  qc.setQueriesData<NotificationsInfinite>(
    { queryKey: [...NOTIFICATIONS_QUERY_KEY, "list"] },
    (current) => {
      if (!current) return current;
      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((n) => n.id !== id),
        })),
      };
    },
  );
}

export function useMarkNotificationRead(): UseMutationResult<
  Notification,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<Notification, Error, string>({
    mutationFn: (id) =>
      apiClient.put<Notification>(`/notifications/${id}/read`),
    onSuccess: async (next) => {
      patchNotificationInCache(qc, next);
      await qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export function useMarkAllNotificationsRead(): UseMutationResult<
  UnreadCountResponse,
  Error,
  void
> {
  const qc = useQueryClient();
  return useMutation<UnreadCountResponse, Error, void>({
    mutationFn: () =>
      apiClient.post<UnreadCountResponse>("/notifications/read-all"),
    onSuccess: async () => {
      const now = new Date().toISOString();
      qc.setQueriesData<NotificationsInfinite>(
        { queryKey: [...NOTIFICATIONS_QUERY_KEY, "list"] },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              items: page.items.map((n) =>
                n.read_at ? n : { ...n, read_at: now },
              ),
            })),
          };
        },
      );
      qc.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, {
        unread: 0,
      });
      await qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export function useArchiveNotification(): UseMutationResult<
  void,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => apiClient.delete<void>(`/notifications/${id}`),
    onSuccess: async (_void, id) => {
      removeNotificationFromCache(qc, id);
      await qc.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
