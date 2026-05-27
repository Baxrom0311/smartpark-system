/**
 * Exercises API service.
 *
 * Wraps the `/api/v1/exercises` endpoints. Two distinct surfaces:
 *
 *   - Exercise *catalogue*  → `listExercises`, `getExercise`
 *   - Exercise *assignments* per child → `listChildAssignments`,
 *     `assignExercise`, `completeAssignment`
 *
 * All list endpoints return a `Page<T>` for cursor pagination. The
 * mobile app renders a single screen for the parent, so we expose a
 * `listAllChildAssignments` helper that walks the cursor for small
 * result sets.
 */

import { apiClient } from "@/services/api";
import type {
  Exercise,
  ExerciseAssignment,
  ExerciseAssignmentCompleteRequest,
  ExerciseAssignmentCreateRequest,
  Page,
} from "@/types";

export interface ListExercisesParams {
  cursor?: string | null;
  limit?: number;
  category?: string;
  age_group?: string;
  difficulty?: string;
  language?: string;
  search?: string;
}

export async function listExercises(
  params: ListExercisesParams = {},
): Promise<Page<Exercise>> {
  return apiClient.get<Page<Exercise>>("/exercises", {
    query: {
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? 20,
      category: params.category ?? undefined,
      age_group: params.age_group ?? undefined,
      difficulty: params.difficulty ?? undefined,
      language: params.language ?? undefined,
      search: params.search ?? undefined,
    },
  });
}

export async function getExercise(exerciseId: string): Promise<Exercise> {
  return apiClient.get<Exercise>(
    `/exercises/${encodeURIComponent(exerciseId)}`,
  );
}

export interface ListChildAssignmentsParams {
  cursor?: string | null;
  limit?: number;
  status?: string;
}

export async function listChildAssignments(
  childId: string,
  params: ListChildAssignmentsParams = {},
): Promise<Page<ExerciseAssignment>> {
  return apiClient.get<Page<ExerciseAssignment>>(
    `/exercises/${encodeURIComponent(childId)}/assignments`,
    {
      query: {
        cursor: params.cursor ?? undefined,
        limit: params.limit ?? 25,
        status: params.status ?? undefined,
      },
    },
  );
}

/**
 * Materialise every assignment for a child by walking the cursor. The
 * parent app rarely shows more than ~30 entries per child so the
 * unbounded loop is safe in practice — bounded to 25 pages defensively.
 */
export async function listAllChildAssignments(
  childId: string,
): Promise<ExerciseAssignment[]> {
  const items: ExerciseAssignment[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 25; i++) {
    const page: Page<ExerciseAssignment> = await listChildAssignments(childId, {
      cursor,
      limit: 50,
    });
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}

export async function assignExercise(
  childId: string,
  payload: ExerciseAssignmentCreateRequest,
): Promise<ExerciseAssignment> {
  return apiClient.post<ExerciseAssignment>(
    `/exercises/${encodeURIComponent(childId)}/assign`,
    payload,
  );
}

export async function getAssignment(
  assignmentId: string,
): Promise<ExerciseAssignment> {
  return apiClient.get<ExerciseAssignment>(
    `/exercises/assignments/${encodeURIComponent(assignmentId)}`,
  );
}

export async function completeAssignment(
  assignmentId: string,
  payload: ExerciseAssignmentCompleteRequest = {},
): Promise<ExerciseAssignment> {
  return apiClient.put<ExerciseAssignment>(
    `/exercises/assignments/${encodeURIComponent(assignmentId)}/complete`,
    payload,
  );
}

export async function deleteAssignment(assignmentId: string): Promise<void> {
  await apiClient.delete<void>(
    `/exercises/assignments/${encodeURIComponent(assignmentId)}`,
  );
}
