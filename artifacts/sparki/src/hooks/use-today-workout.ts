import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { PlannedWorkout } from "@/lib/athlete-types";

export function useTodayWorkout() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.todayWorkout(),
    queryFn: () => apiFetch<PlannedWorkout | null>("/api/athlete/workouts/today"),
    enabled: isSignedIn === true,
    staleTime: STALE.live,
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
