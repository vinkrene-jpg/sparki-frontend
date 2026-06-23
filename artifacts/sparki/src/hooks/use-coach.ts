import { useQuery } from "@tanstack/react-query";
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

export type CoachAthletePlanResponse = {
  sharing: "none" | "summary" | "full";
  athlete: {
    athleteClerkId: string;
    displayName: string | null;
    discipline: string | null;
  } | null;
  plan: PlanHeader | null;
  days: PlanDay[];
  message?: string;
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
