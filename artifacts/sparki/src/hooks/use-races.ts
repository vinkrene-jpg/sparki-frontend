import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type {
  Race,
  RaceInput,
  ChecklistState,
  RaceContext,
} from "@/lib/race-types";
import { resolveRaceContext } from "@/lib/race-context";

// Race data provider (task #4). The homepages and the day-type engine consume
// races only through these hooks + the pure resolver, so a future integration
// adapter can swap the source without touching any UI.
export function useRaces() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.races.list(),
    queryFn: () => apiFetch<Race[]>("/api/races"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

/** Resolved race context (nearest race + race-week phase), or null. */
export function useRaceContext(): {
  context: RaceContext | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useRaces();
  return { context: resolveRaceContext(data), isLoading };
}

export function useCreateRace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RaceInput) =>
      apiFetch<Race>("/api/races", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.races.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}

export function useUpdateRace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: RaceInput }) =>
      apiFetch<Race>(`/api/races/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.races.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}

export function useDeleteRace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/races/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.races.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}

// ── Race insight ─────────────────────────────────────────────────────────────
// The "intelligent werkblad" data: everything Sparki derives for a race before
// the athlete types anything. Honest about every gap (never fabricated).
export type RaceInsightWeather = {
  available: boolean;
  reason: "ok" | "too_far" | "no_location" | "geocode_failed" | "no_forecast";
  locationLabel: string | null;
  weather: {
    label: string;
    tempMinC: number | null;
    tempMaxC: number | null;
    precipMm: number | null;
    windMaxKmh: number | null;
    precipProbMaxPct: number | null;
  } | null;
  advisory: { headline: string; detail: string; suggestion: string | null } | null;
};

export type RaceInsight = {
  weather: RaceInsightWeather;
  travel: {
    available: boolean;
    reason: "ok" | "no_home" | "no_location" | "geocode_failed";
    fromLabel: string | null;
    toLabel: string | null;
    straightLineKm: number | null;
  };
  departureSuggestion: string | null;
  logistics: {
    arrivalBufferMin: number;
    registrationMin: number;
    warmupMin: number;
    callUpMin: number;
    breakfastBeforeDepartureMin: number;
    rationale: string;
  };
};

export function useRaceInsight(
  location: string | null,
  raceDate: string,
  discipline: string | null,
) {
  const { isSignedIn } = useUser();
  const params = new URLSearchParams();
  if (location) params.set("location", location);
  if (raceDate) params.set("raceDate", raceDate);
  if (discipline) params.set("discipline", discipline);
  return useQuery({
    queryKey: queryKeys.races.insight(location, raceDate, discipline),
    queryFn: () =>
      apiFetch<RaceInsight>(`/api/races/insight?${params.toString()}`),
    enabled: (isSignedIn === true || DEV_PREVIEW) && raceDate !== "",
    staleTime: STALE.session,
  });
}

export function useUpdateRaceChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, checklist }: { id: number; checklist: ChecklistState }) =>
      apiFetch<Race>(`/api/races/${id}/checklist`, {
        method: "PUT",
        body: JSON.stringify({ checklist }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.races.all() });
    },
  });
}
