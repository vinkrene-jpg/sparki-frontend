import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ParentAthlete = {
  athleteClerkId: string;
  displayName: string | null;
  sharing: "none" | "safety_only" | "summary";
  parentConsentStatus: "not_required" | "pending" | "granted" | "revoked";
  healthStatus?: string;
  wellbeing?: {
    metricDate: string;
    sleepHours: string | null;
    sleepQuality: number | null;
    fatigueScore: number | null;
    feelScore: number | null;
  } | null;
  schedule?: { scheduledDate: string; title: string; type: string }[];
};

export function useParentAthletes(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.parent.athletes(),
    queryFn: () =>
      apiFetch<{ athletes: ParentAthlete[] }>("/api/parent/athletes"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

/**
 * A parent ends the link to an athlete from their own side. Scoped server-side
 * to the caller's own parent links; refreshes the list so the child disappears.
 */
export function useEndParentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteClerkId: string) =>
      apiFetch<{ ok: true }>(`/api/links/as-parent/${athleteClerkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.athletes() });
    },
  });
}
