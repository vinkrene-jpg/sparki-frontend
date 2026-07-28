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

// ── Wedstrijddossier (Golf 16) ───────────────────────────────────────────────
// Course facts + advies-typologie, samengesteld door de dossier-endpoint.
export type CourseFactKind = "feit" | "afgeleid" | "inschatting" | "ontbreekt";

export type CourseFact = {
  key: string;
  label: string;
  kind: CourseFactKind;
  value: string | null;
  origin: string;
  explanation?: string;
  confidence?: number;
  question?: string;
};

export type RaceCourseAnalysis = {
  raceId: number;
  hasRoute: boolean;
  route: { id: number; name: string } | null;
  facts: CourseFact[];
  character: string;
  gaps: { key: string; label: string; question: string }[];
};

export type AdviceKind = "feit" | "regel" | "inschatting" | "coachinstructie";

export type RaceAdviceItem = {
  id: string;
  domain: "pacing" | "bandendruk" | "warmingup" | "tactiek" | "risico";
  kind: AdviceKind;
  title: string;
  text: string;
  basis: string;
  confidence?: number;
};

export type RaceAdviceSet = {
  raceId: number;
  items: RaceAdviceItem[];
  notPossible: { domain: string; reason: string }[];
};

export type RaceWerkblad = {
  phase: "aankomend" | "racedag" | "afgerond" | "geannuleerd";
  daysUntil: number;
  course: RaceCourseAnalysis;
  advice: RaceAdviceSet;
};

export function useRaceWerkblad(raceId: number | null) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: [...queryKeys.races.all(), "dossier", raceId ?? 0],
    queryFn: () => apiFetch<RaceWerkblad>(`/api/races/${raceId}/dossier`),
    enabled: (isSignedIn === true || DEV_PREVIEW) && raceId != null && raceId > 0,
    staleTime: STALE.live,
  });
}

// ── Wizard-voorstel (stap 4) ─────────────────────────────────────────────────
// Deterministische prioriteit/doel/voorbereiding op basis van echte athletedata.
export type WizardProposal = {
  priority: { value: "A" | "B" | "C"; rationale: string; confidence: number };
  goal: { text: string; rationale: string } | null;
  preparation: { text: string; rationale: string } | null;
  basis: string;
};

export function useRaceWizardProposal(
  raceDate: string,
  discipline: string | null,
  distanceKm: string | null,
  enabled: boolean,
) {
  const { isSignedIn } = useUser();
  const params = new URLSearchParams();
  if (raceDate) params.set("raceDate", raceDate);
  if (discipline) params.set("discipline", discipline);
  if (distanceKm) params.set("distanceKm", distanceKm);
  return useQuery({
    queryKey: ["races", "wizard-proposal", raceDate, discipline, distanceKm],
    queryFn: () =>
      apiFetch<WizardProposal>(
        `/api/races/wizard-proposal?${params.toString()}`,
      ),
    enabled:
      enabled && (isSignedIn === true || DEV_PREVIEW) && raceDate !== "",
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
