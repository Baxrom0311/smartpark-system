import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
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

/** Fetch a single kindergarten by id. */
export function useKindergarten(
  kindergartenId: string | undefined,
): UseQueryResult<Kindergarten, Error> {
  return useQuery<Kindergarten, Error>({
    queryKey: ["kindergartens", "detail", kindergartenId],
    enabled: Boolean(kindergartenId),
    queryFn: ({ signal }) =>
      apiClient.get<Kindergarten>(`/kindergartens/${kindergartenId}`, {
        signal,
      }),
    staleTime: 30_000,
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

export interface UpdateKindergartenInput {
  kindergartenId: string;
  name?: string;
  address?: string | null;
  phone?: string | null;
  teacher_count?: number;
  child_count?: number;
  region_id?: string | null;
}

/** Patch a kindergarten via `PUT /kindergartens/{id}`. Admin only. */
export function useUpdateKindergarten(): UseMutationResult<
  Kindergarten,
  Error,
  UpdateKindergartenInput
> {
  const qc = useQueryClient();
  return useMutation<Kindergarten, Error, UpdateKindergartenInput>({
    mutationFn: ({ kindergartenId, ...rest }) =>
      apiClient.put<Kindergarten>(`/kindergartens/${kindergartenId}`, rest),
    onSuccess: async (next) => {
      qc.setQueryData(["kindergartens", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["kindergartens"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

/** Delete a kindergarten. Admin only. */
export function useDeleteKindergarten(): UseMutationResult<
  void,
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (kgId) => apiClient.delete<void>(`/kindergartens/${kgId}`),
    onSuccess: async (_void, kgId) => {
      qc.removeQueries({ queryKey: ["kindergartens", "detail", kgId] });
      qc.removeQueries({ queryKey: ["kindergartens", "stats", kgId] });
      await qc.invalidateQueries({ queryKey: ["kindergartens"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
