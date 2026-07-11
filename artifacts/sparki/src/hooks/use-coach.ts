import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { PlanDay, PlanHeader } from "@/hooks/use-training-plan";

export type Readiness = {
  label: "fresh" | "ok" | "tired" | "unknown";
  score: number | null;
  basis: string[];
};

export type RosterAthlete = {
  athleteClerkId: string;
  displayName: string | null;
  sharing: "none" | "summary" | "full";
  discipline?: string | null;
  healthStatus?: string;
  readiness?: Readiness;
  nextSession?: {
    scheduledDate: string;
    title: string;
    type: string;
  } | null;
};

export function useCoachRoster(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.coach.athletes(),
    queryFn: () =>
      apiFetch<{ athletes: RosterAthlete[] }>("/api/coach/athletes"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

/**
 * A coach ends the link to an athlete from their own side. Scoped server-side to
 * the caller's own coach links; refreshes the roster so the athlete disappears.
 */
export function useEndCoachLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteClerkId: string) =>
      apiFetch<{ ok: true }>(`/api/links/as-coach/${athleteClerkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.coach.athletes() });
    },
  });
}

/** A suggested advisory day, plus whether the coach has already adopted it. */
export type CoachPlanDay = PlanDay & { adopted: boolean };

export type CoachAthletePlanResponse = {
  sharing: "none" | "summary" | "full";
  athlete: {
    athleteClerkId: string;
    displayName: string | null;
    discipline: string | null;
  } | null;
  plan: PlanHeader | null;
  days: CoachPlanDay[];
  message?: string;
};

export type AdoptPlanResult = {
  adopted: number[];
  skipped: Array<{ dayId: number; reason: string }>;
};

/** Read-only view of a linked athlete's current Sparki advisory plan. */
export function useCoachAthletePlan(athleteId: string | null, enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: athleteId
      ? queryKeys.coach.plan(athleteId)
      : queryKeys.coach.plan("none"),
    queryFn: () =>
      apiFetch<CoachAthletePlanResponse>(
        `/api/coach/athletes/${athleteId}/plan`,
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled && !!athleteId,
    staleTime: STALE.session,
  });
}

/**
 * Adopt one or more advised days into the athlete's plan as coach-authored
 * sessions (source "coach"). Explicit, per-day; never overwrites existing coach
 * workouts. Refetches the advisory plan so adopted days flip to "Overgenomen".
 */
export function useAdoptCoachPlanDays(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planDayIds: number[]) =>
      apiFetch<AdoptPlanResult>(
        `/api/coach/athletes/${athleteId}/plan/adopt`,
        { method: "POST", body: JSON.stringify({ planDayIds }) },
      ),
    onSuccess: () => {
      if (athleteId) {
        void qc.invalidateQueries({ queryKey: queryKeys.coach.plan(athleteId) });
      }
    },
  });
}
