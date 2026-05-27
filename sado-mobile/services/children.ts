/**
 * Children API service.
 *
 * Wraps `/api/v1/children` so screens can stay free of fetch logic.
 * Requests are paginated cursor-style — `listChildren` returns the
 * raw `Page<Child>` so callers can implement infinite scroll without
 * losing the cursor.
 */

import { apiClient } from "@/services/api";
import type {
  Child,
  ChildCreateRequest,
  Page,
} from "@/types";

export interface ListChildrenParams {
  cursor?: string | null;
  limit?: number;
  search?: string;
  parent_id?: string;
  kindergarten_id?: string;
}

/** Fetch one cursor page of children visible to the current user. */
export async function listChildren(
  params: ListChildrenParams = {},
): Promise<Page<Child>> {
  return apiClient.get<Page<Child>>("/children", {
    query: {
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? 20,
      search: params.search ?? undefined,
      parent_id: params.parent_id ?? undefined,
      kindergarten_id: params.kindergarten_id ?? undefined,
    },
  });
}

/**
 * Eagerly walk the cursor pagination to materialise every visible
 * child. Used by the parent-app home / assessment picker where we
 * never expect more than ~10 entries per parent.
 */
export async function listAllChildren(): Promise<Child[]> {
  const items: Child[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 25; i++) {
    const page: Page<Child> = await listChildren({ cursor, limit: 50 });
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}

export async function getChild(childId: string): Promise<Child> {
  return apiClient.get<Child>(`/children/${encodeURIComponent(childId)}`);
}

export async function createChild(payload: ChildCreateRequest): Promise<Child> {
  return apiClient.post<Child>("/children", payload);
}

export async function updateChild(
  childId: string,
  payload: Partial<ChildCreateRequest>,
): Promise<Child> {
  return apiClient.put<Child>(
    `/children/${encodeURIComponent(childId)}`,
    payload,
  );
}

export async function deleteChild(childId: string): Promise<void> {
  await apiClient.delete<void>(`/children/${encodeURIComponent(childId)}`);
}
