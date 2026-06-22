import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { AthleteDailyMetric } from "@/lib/athlete-types";

export function useDailyMetrics(days = 14) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.metrics(days),
    queryFn: () =>
      apiFetch<AthleteDailyMetric[]>(`/api/athlete/metrics?days=${days}`),
    enabled: isSignedIn === true,
    staleTime: STALE.session,
  });
}

export function useLogDailyMetrics() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<AthleteDailyMetric>) =>
      apiFetch<AthleteDailyMetric>("/api/athlete/metrics", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.metrics() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}
