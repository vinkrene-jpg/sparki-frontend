import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { PlannedWorkout } from "@/lib/athlete-types";

export function useTodayWorkout() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.todayWorkout(),
    queryFn: () => apiFetch<PlannedWorkout | null>("/api/athlete/workouts/today"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.live,
  });
}

// Today + upcoming planned workouts (next ~30 days), so the route generator can
// link a route to a scheduled session and derive its target distance.
export function useUpcomingWorkouts() {
  const { isSignedIn } = useUser();
  const today = new Date();
  const from = today.toISOString().split("T")[0]!;
  const to = new Date(today.getTime() + 30 * 86_400_000)
    .toISOString()
    .split("T")[0]!;

  return useQuery({
    queryKey: [...queryKeys.athlete.all(), "workouts", "upcoming", from, to],
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${from}&to=${to}`,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<PlannedWorkout>) =>
      apiFetch<PlannedWorkout>("/api/athlete/workouts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}

export function useUpdateWorkout() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<PlannedWorkout> & { id: number }) =>
      apiFetch<PlannedWorkout>(`/api/athlete/workouts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}
