import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

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
