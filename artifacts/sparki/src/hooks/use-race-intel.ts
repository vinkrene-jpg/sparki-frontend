import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { RaceIntel } from "@/lib/race-intel-types";

// Race Intelligence provider. Computed server-side from the athlete's own race +
// profile (phased prep, race-day report, fuel, multi-day checklist). Keyed per
// race so each upcoming event has its own cache entry.
export function useRaceIntel(raceId: number | null | undefined) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.races.intel(raceId ?? 0),
    queryFn: () => apiFetch<RaceIntel>(`/api/races/${raceId}/intel`),
    enabled: raceId != null && (isSignedIn === true || DEV_PREVIEW),
    staleTime: STALE.session,
  });
}
