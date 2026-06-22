import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type HealthStatus = "ok" | "sick" | "injured";

// Mutation to set the athlete's health status (blueprint §4 #1). On success it
// invalidates the dashboard so the day-type engine re-resolves Home (e.g. into
// the Emergency recovery-only view, or back to a normal day when cleared).
export function useSetHealthStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (healthStatus: HealthStatus) =>
      apiFetch<{ healthStatus: HealthStatus }>("/api/athlete/health-status", {
        method: "PUT",
        body: JSON.stringify({ healthStatus }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
    },
  });
}
