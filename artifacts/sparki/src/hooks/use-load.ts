import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type LoadData = {
  ctl: number;
  atl: number;
  tsb: number;
  chartData: Array<{ date: string; ctl: number; atl: number; tsb: number; tss: number }>;
  /** SPOOR_H (§3.1): op welke reeks het model draait — nooit gemengd. */
  basis?: "vermogen" | "hartslag";
  basisDetail?: { metVermogen: number; metHartslag: number; buitenBasis: number };
};

// `days` stuurt alleen het grafiekvenster (7–365); het belastingsmodel zelf
// blijft server-side identiek. Invalidatie via de basissleutel raakt alle
// vensters (prefix-match).
export function useLoad(days = 42) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: [...queryKeys.athlete.load(), days],
    queryFn: () => apiFetch<LoadData>(`/api/athlete/load?days=${days}`),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
