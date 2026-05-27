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

/**
 * Fetch a single child by id. Backed by `GET /children/{id}` which is
 * scoped on the server side per the caller's role.
 */
export function useChild(
  childId: string | undefined,
): UseQueryResult<Child, Error> {
  return useQuery<Child, Error>({
    queryKey: ["children", "detail", childId],
    enabled: Boolean(childId),
    queryFn: ({ signal }) =>
      apiClient.get<Child>(`/children/${childId}`, { signal }),
    staleTime: 30_000,
  });
}

export interface UpdateChildInput {
  childId: string;
  name?: string;
  birth_date?: string;
  gender?: "male" | "female" | "unknown";
  language?: "uz" | "ru" | "kk" | "en";
  notes?: string | null;
  kindergarten_id?: string | null;
}

/**
 * Patch a child profile via `PUT /children/{id}`. The backend ignores
 * `undefined` fields and treats `null` as "clear the value".
 */
export function useUpdateChild(): UseMutationResult<
  Child,
  Error,
  UpdateChildInput
> {
  const qc = useQueryClient();
  return useMutation<Child, Error, UpdateChildInput>({
    mutationFn: ({ childId, ...rest }) =>
      apiClient.put<Child>(`/children/${childId}`, rest),
    onSuccess: async (next) => {
      qc.setQueryData(["children", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["children"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

/** Delete a child profile. */
export function useDeleteChild(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (childId) => apiClient.delete<void>(`/children/${childId}`),
    onSuccess: async (_void, childId) => {
      qc.removeQueries({ queryKey: ["children", "detail", childId] });
      await qc.invalidateQueries({ queryKey: ["children"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
