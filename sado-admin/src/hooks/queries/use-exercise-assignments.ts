/**
 * Hooks for the exercise-assignment endpoints under
 * `/api/v1/exercises/{child_id}/assignments` etc.
 *
 * The list endpoint returns the canonical {@link CursorPage} envelope but
 * the child detail view rarely needs more than the most recent ~20
 * assignments, so we expose a flat `useChildAssignments` that flattens
 * the first page only. Callers that need full pagination can compose
 * `useInfiniteQuery` directly.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyError, notifySuccess } from "@/lib/notify";
import type {
  AssignmentStatus,
  CursorPage,
  ExerciseAssignment,
} from "@/types";

const ASSIGNMENTS_KEY = ["exercise-assignments"] as const;

interface UseChildAssignmentsParams {
  childId: string | undefined;
  status?: AssignmentStatus;
  limit?: number;
}

/**
 * `GET /exercises/{child_id}/assignments` — cursor-paginated, but for
 * the child detail card we only need the first page, sorted newest
 * first. The `enabled` guard avoids a 404 when `childId` is falsy.
 */
export function useChildAssignments(
  params: UseChildAssignmentsParams,
): UseQueryResult<CursorPage<ExerciseAssignment>, Error> {
  const { childId, status, limit = 20 } = params;
  return useQuery<CursorPage<ExerciseAssignment>, Error>({
    queryKey: [...ASSIGNMENTS_KEY, "list", childId, { status, limit }],
    enabled: Boolean(childId),
    queryFn: ({ signal }) =>
      apiClient.get<CursorPage<ExerciseAssignment>>(
        `/exercises/${childId}/assignments`,
        {
          signal,
          query: { limit, status },
        },
      ),
    staleTime: 15_000,
  });
}

export interface AssignExerciseInput {
  childId: string;
  exerciseId: string;
  dueDate?: string | null;
  notes?: string | null;
}

/** `POST /exercises/{child_id}/assign`. */
export function useAssignExercise(): UseMutationResult<
  ExerciseAssignment,
  Error,
  AssignExerciseInput
> {
  const qc = useQueryClient();
  return useMutation<ExerciseAssignment, Error, AssignExerciseInput>({
    mutationFn: ({ childId, exerciseId, dueDate, notes }) =>
      apiClient.post<ExerciseAssignment>(`/exercises/${childId}/assign`, {
        exercise_id: exerciseId,
        due_date: dueDate ?? null,
        notes: notes ?? null,
      }),
    onSuccess: async (_assignment, vars) => {
      await qc.invalidateQueries({
        queryKey: [...ASSIGNMENTS_KEY, "list", vars.childId],
      });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export interface CompleteAssignmentInput {
  assignmentId: string;
  childId: string;
  score?: number | null;
  notes?: string | null;
}

/** `PUT /exercises/assignments/{id}/complete`. */
export function useCompleteAssignment(): UseMutationResult<
  ExerciseAssignment,
  Error,
  CompleteAssignmentInput
> {
  const qc = useQueryClient();
  return useMutation<ExerciseAssignment, Error, CompleteAssignmentInput>({
    mutationFn: ({ assignmentId, score, notes }) =>
      apiClient.put<ExerciseAssignment>(
        `/exercises/assignments/${assignmentId}/complete`,
        {
          score: score ?? null,
          notes: notes ?? null,
        },
      ),
    onSuccess: async (_assignment, vars) => {
      await qc.invalidateQueries({
        queryKey: [...ASSIGNMENTS_KEY, "list", vars.childId],
      });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}

export interface DeleteAssignmentInput {
  assignmentId: string;
  childId: string;
}

/** `DELETE /exercises/assignments/{id}`. */
export function useDeleteAssignment(): UseMutationResult<
  void,
  Error,
  DeleteAssignmentInput
> {
  const qc = useQueryClient();
  return useMutation<void, Error, DeleteAssignmentInput>({
    mutationFn: ({ assignmentId }) =>
      apiClient.delete<void>(`/exercises/assignments/${assignmentId}`),
    onSuccess: async (_void, vars) => {
      await qc.invalidateQueries({
        queryKey: [...ASSIGNMENTS_KEY, "list", vars.childId],
      });
      notifySuccess();
    },
    onError: (err) => {
      notifyError(err);
    },
  });
}
