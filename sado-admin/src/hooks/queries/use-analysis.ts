/**
 * Analysis query hooks.
 *
 * Two endpoints back this:
 *   `GET /analysis/{assessment_id}`           — parent-safe summary
 *   `GET /analysis/{assessment_id}/detailed`  — therapist/admin only
 *
 * The detailed endpoint returns the raw acoustic features
 * (MFCC matrix, pitch f0 series, formant tracks, phoneme scores)
 * that the therapist analysis page renders as charts.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type {
  AssessmentAnalysisResponse,
  AssessmentDetailedAnalysisResponse,
} from "@/types";

export function useAnalysis(
  assessmentId: string | undefined,
): UseQueryResult<AssessmentAnalysisResponse, Error> {
  return useQuery<AssessmentAnalysisResponse, Error>({
    queryKey: ["analysis", assessmentId],
    enabled: Boolean(assessmentId),
    queryFn: ({ signal }) =>
      apiClient.get<AssessmentAnalysisResponse>(`/analysis/${assessmentId}`, {
        signal,
      }),
    staleTime: 30_000,
  });
}

export function useAnalysisDetailed(
  assessmentId: string | undefined,
  enabled = true,
): UseQueryResult<AssessmentDetailedAnalysisResponse, Error> {
  return useQuery<AssessmentDetailedAnalysisResponse, Error>({
    queryKey: ["analysis", "detailed", assessmentId],
    enabled: enabled && Boolean(assessmentId),
    queryFn: ({ signal }) =>
      apiClient.get<AssessmentDetailedAnalysisResponse>(
        `/analysis/${assessmentId}/detailed`,
        { signal },
      ),
    staleTime: 30_000,
  });
}
