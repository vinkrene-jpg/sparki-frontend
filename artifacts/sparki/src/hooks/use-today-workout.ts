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

// Planned workouts in a window around today (recent + upcoming), for linking a
// generated route to a workout. Defaults to last 7 days through next 21 days.
export function useUpcomingWorkouts() {
  const { isSignedIn } = useUser();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 21);
  const fromStr = from.toISOString().split("T")[0]!;
  const toStr = to.toISOString().split("T")[0]!;
  return useQuery({
    queryKey: [...queryKeys.athlete.all(), "workouts", "window", fromStr, toStr],
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${fromStr}&to=${toStr}`,
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
