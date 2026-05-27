import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CursorPage, UserPublic, UserRole } from "@/types";

interface UseUsersParams {
  search?: string;
  role?: UserRole;
  limit?: number;
}

export type UsersInfinite = InfiniteData<
  CursorPage<UserPublic>,
  string | null
>;

export function useUsers(params: UseUsersParams = {}) {
  const { search, role, limit = 20 } = params;
  return useInfiniteQuery<
    CursorPage<UserPublic>,
    Error,
    UsersInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: ["users", { search, role, limit }],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<UserPublic>>("/users", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          search: search?.trim() || undefined,
          role,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });
}
