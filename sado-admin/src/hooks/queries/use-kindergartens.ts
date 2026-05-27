import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CursorPage, Kindergarten, KindergartenStats } from "@/types";

interface UseKindergartensParams {
  search?: string;
  regionId?: string;
  limit?: number;
}

export type KindergartensInfinite = InfiniteData<
  CursorPage<Kindergarten>,
  string | null
>;

export function useKindergartens(params: UseKindergartensParams = {}) {
  const { search, regionId, limit = 20 } = params;
  return useInfiniteQuery<
    CursorPage<Kindergarten>,
    Error,
    KindergartensInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: ["kindergartens", { search, regionId, limit }],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<Kindergarten>>("/kindergartens", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          search: search?.trim() || undefined,
          region_id: regionId,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function useKindergartenStats(kindergartenId: string | undefined) {
  return useQuery<KindergartenStats>({
    queryKey: ["kindergartens", "stats", kindergartenId],
    enabled: Boolean(kindergartenId),
    queryFn: ({ signal }) =>
      apiClient.get<KindergartenStats>(
        `/kindergartens/${kindergartenId}/stats`,
        { signal },
      ),
    staleTime: 60_000,
  });
}
