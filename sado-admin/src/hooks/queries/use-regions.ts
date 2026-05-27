import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CursorPage, Region } from "@/types";

interface UseRegionsParams {
  search?: string;
  type?: "country" | "region" | "district";
  parentId?: string;
  limit?: number;
}

export type RegionsInfinite = InfiniteData<CursorPage<Region>, string | null>;

/**
 * List regions, suitable for filter dropdowns. Pulls every page in one
 * go because the dataset is tiny (a handful of countries / oblasts).
 */
export function useRegions(
  params: UseRegionsParams = {},
): ReturnType<typeof useInfiniteQuery<CursorPage<Region>, Error, RegionsInfinite, readonly unknown[], string | null>> {
  const { search, type, parentId, limit = 100 } = params;
  return useInfiniteQuery<
    CursorPage<Region>,
    Error,
    RegionsInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: ["regions", { search, type, parentId, limit }],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<Region>>("/regions", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          search: search?.trim() || undefined,
          type,
          parent_id: parentId,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
    staleTime: 5 * 60_000,
  });
}

/** Fetch a single region by id (used to render a region's name on detail pages). */
export function useRegion(
  regionId: string | null | undefined,
): UseQueryResult<Region, Error> {
  return useQuery<Region, Error>({
    queryKey: ["regions", "detail", regionId],
    enabled: Boolean(regionId),
    queryFn: ({ signal }) =>
      apiClient.get<Region>(`/regions/${regionId}`, { signal }),
    staleTime: 5 * 60_000,
  });
}
