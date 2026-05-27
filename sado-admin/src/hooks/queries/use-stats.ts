import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import type { SystemStats } from "@/types";

export function useSystemStats() {
  return useQuery<SystemStats>({
    queryKey: ["stats", "system"],
    queryFn: ({ signal }) =>
      apiClient.get<SystemStats>("/stats/system", { signal }),
    staleTime: 30_000,
    retry: 1,
  });
}
