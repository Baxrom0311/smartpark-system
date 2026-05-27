/**
 * Assessment query hooks.
 *
 * The admin dashboard uses these primarily to attach the most recent
 * risk level to each row in the children list (see
 * `_authenticated/children/index.tsx`). The backend exposes a single
 * `GET /assessments` endpoint with cursor pagination; we wrap it with
 * a query that fetches a fixed-size page (no infinite scroll) and a
 * derived hook that builds a `child_id → latest risk` map.
 */

import {
  useQuery,
  type UseQueryResult,
} from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { Assessment, CursorPage, RiskLevel } from "@/types";

export interface UseAssessmentsParams {
  childId?: string;
  status?: string;
  riskLevel?: RiskLevel;
  /** Fetch this many rows in a single request. Defaults to 100. */
  limit?: number;
}

/**
 * Fetch a single page of recent assessments. Returns the raw cursor
 * page so callers can decide whether to follow `next_cursor`.
 */
export function useAssessments(
  params: UseAssessmentsParams = {},
): UseQueryResult<CursorPage<Assessment>, Error> {
  const { childId, status, riskLevel, limit = 100 } = params;
  return useQuery<CursorPage<Assessment>, Error>({
    queryKey: ["assessments", { childId, status, riskLevel, limit }],
    queryFn: ({ signal }) =>
      apiClient.get<CursorPage<Assessment>>("/assessments", {
        signal,
        query: {
          limit,
          child_id: childId,
          status,
          risk_level: riskLevel,
        },
      }),
    staleTime: 30_000,
  });
}

export interface ChildLatestRisk {
  riskLevel: RiskLevel | null;
  assessmentId: string | null;
  completedAt: string | null;
}

/**
 * Reduce a list of assessments to a `child_id → latest risk` map.
 *
 * The backend returns assessments ordered by `created_at desc`, so
 * the first time we see a given `child_id` is the most recent one.
 */
export function buildLatestRiskMap(
  assessments: ReadonlyArray<Assessment>,
): Map<string, ChildLatestRisk> {
  const out = new Map<string, ChildLatestRisk>();
  for (const a of assessments) {
    if (out.has(a.child_id)) continue;
    out.set(a.child_id, {
      riskLevel: a.risk_level,
      assessmentId: a.id,
      completedAt: a.completed_at,
    });
  }
  return out;
}

/**
 * Convenience hook used by the children list: returns a map keyed by
 * child id with the latest risk level seen for each child. Backed by
 * a single page of recent assessments — sufficient for the visible
 * window since child rows are also paginated.
 */
export function useChildrenLatestRisk(
  enabled = true,
  limit = 200,
): {
  map: Map<string, ChildLatestRisk>;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery<CursorPage<Assessment>, Error>({
    queryKey: ["assessments", "latest-risk", { limit }],
    enabled,
    queryFn: ({ signal }) =>
      apiClient.get<CursorPage<Assessment>>("/assessments", {
        signal,
        query: { limit },
      }),
    staleTime: 30_000,
  });
  const items = query.data?.items ?? [];
  return {
    map: buildLatestRiskMap(items),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
