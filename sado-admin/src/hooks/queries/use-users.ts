import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type UseMutationResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { CreateUserPayload } from "@/lib/validation/user";
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

/**
 * Admin-only mutation that creates a new user via ``POST /users``.
 *
 * On success we invalidate every cached page of the users list so the
 * new row appears at the top without a manual refetch.
 */
export function useCreateUser(): UseMutationResult<
  UserPublic,
  Error,
  CreateUserPayload
> {
  const qc = useQueryClient();
  return useMutation<UserPublic, Error, CreateUserPayload>({
    mutationFn: (payload) => apiClient.post<UserPublic>("/users", payload),
    onSuccess: async (created) => {
      qc.setQueryData(["users", "detail", created.id], created);
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
