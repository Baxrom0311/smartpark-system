import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { Child, CursorPage } from "@/types";

interface UseChildrenParams {
  search?: string;
  parentId?: string;
  kindergartenId?: string;
  limit?: number;
}

export type ChildrenInfinite = InfiniteData<CursorPage<Child>, string | null>;

export function useChildren(params: UseChildrenParams = {}) {
  const { search, parentId, kindergartenId, limit = 20 } = params;
  return useInfiniteQuery<
    CursorPage<Child>,
    Error,
    ChildrenInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: ["children", { search, parentId, kindergartenId, limit }],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<Child>>("/children", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          search: search?.trim() || undefined,
          parent_id: parentId,
          kindergarten_id: kindergartenId,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });
}
