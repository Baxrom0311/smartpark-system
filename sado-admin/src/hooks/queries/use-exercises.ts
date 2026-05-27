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
import type { CursorPage, Exercise, UserLanguage } from "@/types";

interface UseExercisesParams {
  search?: string;
  category?: string;
  ageGroup?: string;
  difficulty?: string;
  language?: string;
  limit?: number;
  /** Show inactive entries — admin/therapist only on the API. */
  includeInactive?: boolean;
}

export type ExercisesInfinite = InfiniteData<
  CursorPage<Exercise>,
  string | null
>;

export function useExercises(params: UseExercisesParams = {}) {
  const {
    search,
    category,
    ageGroup,
    difficulty,
    language,
    limit = 20,
    includeInactive,
  } = params;
  return useInfiniteQuery<
    CursorPage<Exercise>,
    Error,
    ExercisesInfinite,
    readonly unknown[],
    string | null
  >({
    queryKey: [
      "exercises",
      {
        search,
        category,
        ageGroup,
        difficulty,
        language,
        limit,
        includeInactive: Boolean(includeInactive),
      },
    ],
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      apiClient.get<CursorPage<Exercise>>("/exercises", {
        signal,
        query: {
          limit,
          cursor: pageParam ?? undefined,
          search: search?.trim() || undefined,
          category,
          age_group: ageGroup,
          difficulty,
          language,
          include_inactive: includeInactive ? true : undefined,
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });
}

/** Fetch a single exercise by id. */
export function useExercise(
  exerciseId: string | undefined,
): UseQueryResult<Exercise, Error> {
  return useQuery<Exercise, Error>({
    queryKey: ["exercises", "detail", exerciseId],
    enabled: Boolean(exerciseId),
    queryFn: ({ signal }) =>
      apiClient.get<Exercise>(`/exercises/${exerciseId}`, { signal }),
    staleTime: 30_000,
  });
}

export interface ExerciseUpsertInput {
  title: string;
  description?: string | null;
  category: string;
  age_group: string;
  difficulty: string;
  language: UserLanguage;
  duration_minutes: number;
  instructions?: string | null;
  target_phonemes?: string | null;
  is_active: boolean;
}

export interface UpdateExerciseInput extends Partial<ExerciseUpsertInput> {
  exerciseId: string;
}

/** PUT /exercises/{id}. Therapist or admin only. */
export function useUpdateExercise(): UseMutationResult<
  Exercise,
  Error,
  UpdateExerciseInput
> {
  const qc = useQueryClient();
  return useMutation<Exercise, Error, UpdateExerciseInput>({
    mutationFn: ({ exerciseId, ...rest }) =>
      apiClient.put<Exercise>(`/exercises/${exerciseId}`, rest),
    onSuccess: async (next) => {
      qc.setQueryData(["exercises", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["exercises"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

/** DELETE /exercises/{id}. Admin only. */
export function useDeleteExercise(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (exerciseId) =>
      apiClient.delete<void>(`/exercises/${exerciseId}`),
    onSuccess: async (_void, exerciseId) => {
      qc.removeQueries({ queryKey: ["exercises", "detail", exerciseId] });
      await qc.invalidateQueries({ queryKey: ["exercises"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export type AssetType = "audio" | "image";

export interface UploadAssetInput {
  exerciseId: string;
  assetType: AssetType;
  file: File;
}

/**
 * POST /exercises/{id}/assets — multipart upload for the audio example
 * or illustrative image associated with an exercise. Returns the
 * updated exercise with the new storage key.
 */
export function useUploadExerciseAsset(): UseMutationResult<
  Exercise,
  Error,
  UploadAssetInput
> {
  const qc = useQueryClient();
  return useMutation<Exercise, Error, UploadAssetInput>({
    mutationFn: ({ exerciseId, assetType, file }) => {
      const data = new FormData();
      data.set("file", file, file.name);
      data.set("asset_type", assetType);
      return apiClient.request<Exercise>(`/exercises/${exerciseId}/assets`, {
        method: "POST",
        formData: data,
      });
    },
    onSuccess: async (next) => {
      qc.setQueryData(["exercises", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["exercises"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export interface DeleteAssetInput {
  exerciseId: string;
  assetType: AssetType;
}

/** DELETE /exercises/{id}/assets/{audio|image}. */
export function useDeleteExerciseAsset(): UseMutationResult<
  Exercise,
  Error,
  DeleteAssetInput
> {
  const qc = useQueryClient();
  return useMutation<Exercise, Error, DeleteAssetInput>({
    mutationFn: ({ exerciseId, assetType }) =>
      apiClient.delete<Exercise>(
        `/exercises/${exerciseId}/assets/${assetType}`,
      ),
    onSuccess: async (next) => {
      qc.setQueryData(["exercises", "detail", next.id], next);
      await qc.invalidateQueries({ queryKey: ["exercises"] });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
