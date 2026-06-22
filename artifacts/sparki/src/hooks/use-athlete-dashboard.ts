import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { AthleteProfile, PlannedWorkout, AthleteDailyMetric } from "@/lib/athlete-types";

export type DashboardData = {
  todayWorkout: PlannedWorkout | null;
  todayMetrics: AthleteDailyMetric | null;
  load: { ctl: number; atl: number; tsb: number };
  weekTSS: Array<{ date: string; tss: number }>;
  athleteProfile: AthleteProfile | null;
};

export function useAthleteDashboard() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.dashboard(),
    queryFn: () => apiFetch<DashboardData>("/api/athlete/dashboard"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.live,
  });
}
