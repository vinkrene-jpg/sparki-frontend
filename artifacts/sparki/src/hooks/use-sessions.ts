import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { TrainingSession } from "@/lib/athlete-types";

export function useSessions(limit = 20) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.sessions(limit),
    queryFn: () =>
      apiFetch<TrainingSession[]>(`/api/athlete/sessions?limit=${limit}`),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}

export function useLogSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<TrainingSession>) =>
      apiFetch<TrainingSession>("/api/athlete/sessions", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.sessions() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.load() });
    },
  });
}

// Attach the subjective gap (feel + notes) to a session Sparki already has —
// used when confirming a connector-imported activity instead of re-entering it.
export function useUpdateSessionFeel() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: number;
      feelScore?: number;
      notes?: string | null;
    }) =>
      apiFetch<TrainingSession>(`/api/athlete/sessions/${data.id}`, {
        method: "PUT",
        body: JSON.stringify({ feelScore: data.feelScore, notes: data.notes }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.sessions() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.load() });
    },
  });
}
