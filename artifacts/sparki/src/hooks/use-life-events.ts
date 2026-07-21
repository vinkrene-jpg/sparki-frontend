import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { STALE } from "@/lib/query-keys";

export type LifeEventKind = "school" | "familie" | "werk" | "anders";
export type LifeEventImpact = "geen_training" | "minder_tijd" | "alleen_licht";

export type LifeEvent = {
  id: number;
  clerkId: string;
  kind: LifeEventKind;
  title: string;
  startDate: string;
  endDate: string | null;
  impact: LifeEventImpact;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const KEY = ["athlete", "life-events"] as const;

/** Athlete's life agenda (school/familie/werk) that Sparki plans around. */
export function useLifeEvents() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiFetch<{ events: LifeEvent[] }>("/api/athlete/life-events").then(
        (r) => r.events,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

export function useAddLifeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      kind: LifeEventKind;
      title: string;
      startDate: string;
      endDate?: string | null;
      impact: LifeEventImpact;
      notes?: string | null;
    }) =>
      apiFetch<{ event: LifeEvent }>("/api/athlete/life-events", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteLifeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/athlete/life-events/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
