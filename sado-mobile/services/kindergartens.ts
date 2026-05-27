/**
 * Kindergartens API service.
 *
 * Wraps `/api/v1/kindergartens` for read-only consumption from the
 * mobile teacher flow. The teacher role on the backend is scoped to
 * the user's region; the API enforces visibility, the client just
 * paginates and renders.
 */

import { apiClient } from "@/services/api";
import type {
  Kindergarten,
  KindergartenStats,
  Page,
} from "@/types";

export interface ListKindergartensParams {
  cursor?: string | null;
  limit?: number;
  search?: string;
  region_id?: string;
}

export async function listKindergartens(
  params: ListKindergartensParams = {},
): Promise<Page<Kindergarten>> {
  return apiClient.get<Page<Kindergarten>>("/kindergartens", {
    query: {
      cursor: params.cursor ?? undefined,
      limit: params.limit ?? 20,
      search: params.search ?? undefined,
      region_id: params.region_id ?? undefined,
    },
  });
}

/**
 * Eagerly walk the cursor pagination. The teacher mode rarely sees
 * more than a handful of kindergartens at once, so this keeps the
 * UI code free of cursor bookkeeping.
 */
export async function listAllKindergartens(): Promise<Kindergarten[]> {
  const items: Kindergarten[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 25; i++) {
    const page: Page<Kindergarten> = await listKindergartens({
      cursor,
      limit: 50,
    });
    items.push(...page.items);
    if (!page.has_more || !page.next_cursor) break;
    cursor = page.next_cursor;
  }
  return items;
}

export async function getKindergarten(
  kindergartenId: string,
): Promise<Kindergarten> {
  return apiClient.get<Kindergarten>(
    `/kindergartens/${encodeURIComponent(kindergartenId)}`,
  );
}

export async function getKindergartenStats(
  kindergartenId: string,
): Promise<KindergartenStats> {
  return apiClient.get<KindergartenStats>(
    `/kindergartens/${encodeURIComponent(kindergartenId)}/stats`,
  );
}
