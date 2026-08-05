import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// ANALYSE_UITBREIDING §2 — ontkoppeling (HR:Power) + efficiëntie per rit,
// server-side berekend met de gedeelde analyse-functies (@workspace/analysis).
export type OntkoppelingRit = {
  sessionId: number;
  date: string; // YYYY-MM-DD
  title: string | null;
  durationMin: number | null;
  ontkoppelingPct: number | null;
  efficientieWPerSlag: number | null;
  /** Eerlijke reden waarom er geen getal is (alleen bij null). */
  reden: string | null;
};

export type OntkoppelingData = { days: number; ritten: OntkoppelingRit[] };

export function useOntkoppeling(days = 180) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: [...queryKeys.athlete.load(), "ontkoppeling", days],
    queryFn: () => apiFetch<OntkoppelingData>(`/api/athlete/ontkoppeling?days=${days}`),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}
