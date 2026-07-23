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

// Alle workout-lijstqueries delen dit prefix zodat aanmaken/wijzigen/verwijderen
// van een training ELKE koppellijst direct ververst (geen verouderde cache).
export const WORKOUTS_LIST_KEY = [
  ...queryKeys.athlete.all(),
  "workouts",
] as const;

function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  // Lokale kalenderdag (geen UTC-shift rond middernacht).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Planned workouts in a window around today (recent + upcoming), for linking a
// generated route to a workout. Defaults to last 7 days through next 21 days.
export function useUpcomingWorkouts() {
  const { isSignedIn } = useUser();
  const fromStr = localDateStr(-7);
  const toStr = localDateStr(21);
  return useQuery({
    queryKey: [...WORKOUTS_LIST_KEY, "window", fromStr, toStr],
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${fromStr}&to=${toStr}`,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

// Zoeken in overige echte trainingen (buiten het venster rond vandaag): brede
// periode uit dezelfde centrale kalenderbron; filtering op titel gebeurt bij de
// aanroeper. Geen aparte databron, geen fallback — bij een API-fout toont de
// UI de fout en nooit vervangende gegevens.
export function useWorkoutSearch(enabled: boolean) {
  const { isSignedIn } = useUser();
  const fromStr = localDateStr(-365);
  const toStr = localDateStr(365);
  return useQuery({
    queryKey: [...WORKOUTS_LIST_KEY, "search", fromStr, toStr],
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${fromStr}&to=${toStr}`,
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
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
      void qc.invalidateQueries({ queryKey: WORKOUTS_LIST_KEY });
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
      void qc.invalidateQueries({ queryKey: WORKOUTS_LIST_KEY });
    },
  });
}
