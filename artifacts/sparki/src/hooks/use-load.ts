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
};

export function useLoad() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.load(),
    queryFn: () => apiFetch<LoadData>("/api/athlete/load"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
