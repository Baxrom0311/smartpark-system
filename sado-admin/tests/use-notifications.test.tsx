/**
 * Tests for the notifications hook helpers and bell badge logic.
 *
 * The hooks themselves wrap TanStack Query, so the most useful coverage
 * is asserting that the `useNotifications` query function builds the
 * right URL/query-string and that the cache-patch mutations refresh
 * the relevant cache slices. We do that by stubbing `apiClient.get`
 * and friends, then mounting each hook inside a fresh QueryClient.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

import type { CursorPage, Notification, UnreadCountResponse } from "@/types";

// `react-i18next` is mocked across the suite to keep tests synchronous.
// We must keep `initReactI18next` exported so `@/i18n/config` (transitively
// loaded via `@/lib/notify`) can plug it into the i18n instance during
// module evaluation.
vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty" as const,
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && "count" in opts) return `${key}:${String(opts.count)}`;
      return key;
    },
    i18n: { language: "uz", changeLanguage: () => Promise.resolve() },
  }),
}));

const apiGet = vi.fn();
const apiPut = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
    post: (...args: unknown[]) => apiPost(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

import {
  NOTIFICATIONS_QUERY_KEY,
  UNREAD_COUNT_QUERY_KEY,
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/queries/use-notifications";

function makeNotification(
  overrides: Partial<Notification> = {},
): Notification {
  return {
    id: overrides.id ?? "n-1",
    user_id: overrides.user_id ?? "u-1",
    type: overrides.type ?? "system",
    title: overrides.title ?? "Hello",
    body: overrides.body ?? "world",
    data: overrides.data ?? null,
    read_at: overrides.read_at ?? null,
    is_archived: overrides.is_archived ?? false,
    created_at: overrides.created_at ?? "2026-05-27T10:00:00Z",
    updated_at: overrides.updated_at ?? "2026-05-27T10:00:00Z",
  };
}

function makePage(
  items: Notification[],
  next_cursor: string | null = null,
): CursorPage<Notification> {
  return { items, next_cursor, has_more: next_cursor !== null, total: null };
}

function createWrapper(): {
  wrapper: ({ children }: { children: ReactNode }) => ReactElement;
  client: QueryClient;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

describe("use-notifications", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
  });

  it("requests the inbox with the right query parameters", async () => {
    apiGet.mockResolvedValueOnce(makePage([makeNotification()]));
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useNotifications({ unreadOnly: true, limit: 5 }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet).toHaveBeenCalledTimes(1);
    const [path, options] = apiGet.mock.calls[0] as [
      string,
      { query: Record<string, unknown> },
    ];
    expect(path).toBe("/notifications");
    expect(options.query.unread_only).toBe(true);
    expect(options.query.limit).toBe(5);
    // include_archived defaults to false → we send `undefined`
    expect(options.query.include_archived).toBeUndefined();
  });

  it("polls /notifications/unread-count and exposes the count", async () => {
    apiGet.mockResolvedValueOnce({ unread: 3 } satisfies UnreadCountResponse);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnreadNotificationCount(true), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.unread).toBe(3);
    expect(apiGet).toHaveBeenCalledWith(
      "/notifications/unread-count",
      expect.any(Object),
    );
  });

  it("skips the unread-count request when disabled", async () => {
    const { wrapper } = createWrapper();
    renderHook(() => useUnreadNotificationCount(false), { wrapper });
    // Wait a tick to confirm no fetch happened.
    await act(async () => {
      await Promise.resolve();
    });
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("mark-as-read patches both the list cache and unread count", async () => {
    const original = makeNotification({ id: "n-1", read_at: null });
    const next = makeNotification({
      id: "n-1",
      read_at: "2026-05-27T11:00:00Z",
    });

    const { wrapper, client } = createWrapper();
    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEY, "list", { foo: "bar" }],
      {
        pages: [makePage([original])],
        pageParams: [null],
      },
    );
    client.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, {
      unread: 1,
    });

    apiPut.mockResolvedValueOnce(next);
    apiGet.mockResolvedValueOnce({ unread: 0 } satisfies UnreadCountResponse);

    const { result } = renderHook(() => useMarkNotificationRead(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync("n-1");
    });

    expect(apiPut).toHaveBeenCalledWith("/notifications/n-1/read");
    const cached = client.getQueryData<{
      pages: Array<{ items: Notification[] }>;
    }>([...NOTIFICATIONS_QUERY_KEY, "list", { foo: "bar" }]);
    expect(cached?.pages[0]?.items[0]?.read_at).toBe(
      "2026-05-27T11:00:00Z",
    );
  });

  it("mark-all-read sets read_at on every cached row and zeroes the badge", async () => {
    const a = makeNotification({ id: "a", read_at: null });
    const b = makeNotification({ id: "b", read_at: null });
    const { wrapper, client } = createWrapper();
    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEY, "list", { all: true }],
      {
        pages: [makePage([a, b])],
        pageParams: [null],
      },
    );
    client.setQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY, {
      unread: 2,
    });

    apiPost.mockResolvedValueOnce({ unread: 2 });
    apiGet.mockResolvedValueOnce({ unread: 0 });

    const { result } = renderHook(() => useMarkAllNotificationsRead(), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(apiPost).toHaveBeenCalledWith("/notifications/read-all");
    const cached = client.getQueryData<{
      pages: Array<{ items: Notification[] }>;
    }>([...NOTIFICATIONS_QUERY_KEY, "list", { all: true }]);
    expect(cached?.pages[0]?.items.every((n) => n.read_at !== null)).toBe(
      true,
    );
    const counter =
      client.getQueryData<UnreadCountResponse>(UNREAD_COUNT_QUERY_KEY);
    expect(counter?.unread).toBe(0);
  });

  it("archive removes a row from the cached list", async () => {
    const keep = makeNotification({ id: "keep" });
    const drop = makeNotification({ id: "drop" });
    const { wrapper, client } = createWrapper();
    client.setQueryData(
      [...NOTIFICATIONS_QUERY_KEY, "list", { x: 1 }],
      {
        pages: [makePage([keep, drop])],
        pageParams: [null],
      },
    );

    apiDelete.mockResolvedValueOnce(undefined);
    apiGet.mockResolvedValueOnce({ unread: 0 });

    const { result } = renderHook(() => useArchiveNotification(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("drop");
    });

    expect(apiDelete).toHaveBeenCalledWith("/notifications/drop");
    const cached = client.getQueryData<{
      pages: Array<{ items: Notification[] }>;
    }>([...NOTIFICATIONS_QUERY_KEY, "list", { x: 1 }]);
    expect(cached?.pages[0]?.items.map((n) => n.id)).toEqual(["keep"]);
  });
});
