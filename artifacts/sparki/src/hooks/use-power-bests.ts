import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type PowerBestEntry = { watts: number; date: string };

export type PowerBestsData = {
  /** Best per window-seconds key ("5", "10", …) over alle ritten. */
  allTime: Record<string, PowerBestEntry>;
  /** Best per window over de laatste 42 dagen. */
  recent: Record<string, PowerBestEntry>;
  /** Hoeveel ritten echte per-seconde vermogensdata droegen. */
  sessionsWithBests: number;
};

export function usePowerBests() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.powerBests(),
    queryFn: () => apiFetch<PowerBestsData>("/api/athlete/power-bests"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
