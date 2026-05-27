import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { UserLanguage, UserPublic } from "@/types";

/**
 * Fetch a single user by id (admin only on the API).
 *
 * The backend exposes `GET /users/{id}` for admins, which is the data
 * source for the user detail/edit page.
 */
export function useUser(
  userId: string | undefined,
): UseQueryResult<UserPublic, Error> {
  return useQuery<UserPublic, Error>({
    queryKey: ["users", "detail", userId],
    enabled: Boolean(userId),
    queryFn: ({ signal }) =>
      apiClient.get<UserPublic>(`/users/${userId}`, { signal }),
    staleTime: 30_000,
  });
}

export interface UpdateProfileInput {
  full_name?: string;
  email?: string | null;
  language?: UserLanguage;
  region_id?: string | null;
}

/**
 * Patch the *currently authenticated* user via `PUT /users/me`.
 *
 * The backend deliberately scopes editable user fields to the current
 * session — admins toggle other users' active flag with
 * {@link useToggleUserActive} but cannot edit arbitrary user profiles
 * over the public API surface yet.
 */
export function useUpdateProfile(): UseMutationResult<
  UserPublic,
  Error,
  UpdateProfileInput
> {
  const qc = useQueryClient();
  return useMutation<UserPublic, Error, UpdateProfileInput>({
    mutationFn: (payload) =>
      apiClient.put<UserPublic>("/users/me", {
        full_name: payload.full_name,
        // Send `null` to clear, omit when undefined to leave untouched.
        email: payload.email === undefined ? undefined : payload.email || null,
        language: payload.language,
        region_id:
          payload.region_id === undefined ? undefined : payload.region_id,
      }),
    onSuccess: async (next) => {
      qc.setQueryData(["users", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export interface ToggleActiveInput {
  userId: string;
  isActive: boolean;
}

/**
 * Admin-only mutation that flips the `is_active` flag on a target user.
 * Backed by `PUT /users/{id}/active?is_active=...`.
 */
export function useToggleUserActive(): UseMutationResult<
  UserPublic,
  Error,
  ToggleActiveInput
> {
  const qc = useQueryClient();
  return useMutation<UserPublic, Error, ToggleActiveInput>({
    mutationFn: ({ userId, isActive }) =>
      apiClient.put<UserPublic>(`/users/${userId}/active`, undefined, {
        query: { is_active: isActive },
      }),
    onSuccess: async (next) => {
      qc.setQueryData(["users", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["users"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
