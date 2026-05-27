import {
  useInfiniteQuery,
  type InfiniteData,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { CursorPage, Exercise } from "@/types";

interface UseExercisesParams {
  search?: string;
  category?: string;
  ageGroup?: string;
  difficulty?: string;
  language?: string;
  limit?: number;
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
      { search, category, ageGroup, difficulty, language, limit },
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
        },
      }),
    getNextPageParam: (last) => last.next_cursor,
  });
}
