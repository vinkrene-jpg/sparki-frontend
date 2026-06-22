// Race Day Planner — logistics timeline computation (task #4, steps 4 & 5).
//
// Pure functions that turn a race's start time + athlete-entered travel inputs
// into an ordered logistics timeline (breakfast → departure → arrival →
// registration → team area → warm-up → call-up → start). Every clock time is
// DERIVED, never fetched — so each step is flagged `isEstimate`. Missing inputs
// fall back to sensible defaults (also flagged), and a step whose inputs are
// unknown returns `time: null` so the UI can show "—" instead of inventing data.

import type { Race, RaceLogisticsInput } from "@/lib/race-types";

export type TimelineStep = {
  id: string;
  label: string;
  /** "HH:MM" local, or null when it cannot be derived. */
  time: string | null;
  /** Derived clock time (no live feed) — render an "EST" marker. */
  isEstimate: boolean;
  note?: string;
};

/** Default offsets (minutes) used when the athlete hasn't entered a value. */
export const PLANNER_DEFAULTS = {
  callUpMin: 15,
  warmupMin: 30,
  registrationMin: 20,
  arrivalBufferMin: 90,
  breakfastBeforeDepartureMin: 90,
} as const;

function parseHM(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function fmtHM(mins: number | null): string | null {
  if (mins == null) return null;
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type RaceTimeline = {
  start: string | null;
  steps: TimelineStep[];
};

/**
 * Compute the full logistics timeline from a race. Works backwards from the
 * start time. Returns steps in chronological order; any step that depends on a
 * missing input is still listed with `time: null`.
 */
export function computeRaceTimeline(race: Race): RaceTimeline {
  const lg: RaceLogisticsInput = race.logistics ?? {};
  const start = parseHM(race.startTime);

  const callUpMin = lg.callUpMin ?? PLANNER_DEFAULTS.callUpMin;
  const warmupMin = lg.warmupMin ?? PLANNER_DEFAULTS.warmupMin;
  const registrationMin = lg.registrationMin ?? PLANNER_DEFAULTS.registrationMin;
  const arrivalBufferMin =
    lg.arrivalBufferMin ?? PLANNER_DEFAULTS.arrivalBufferMin;
  const breakfastBefore =
    lg.breakfastBeforeDepartureMin ??
    PLANNER_DEFAULTS.breakfastBeforeDepartureMin;
  const travelMin = lg.travelDurationMin ?? null;

  const callUp = start != null ? start - callUpMin : null;
  const warmup = callUp != null ? callUp - warmupMin : null;
  const arrival = start != null ? start - arrivalBufferMin : null;
  const registration = arrival; // begins on arrival
  const teamArea = arrival != null ? arrival + registrationMin : null;
  const departure =
    arrival != null && travelMin != null ? arrival - travelMin : null;
  const breakfast = departure != null ? departure - breakfastBefore : null;

  const steps: TimelineStep[] = [
    {
      id: "breakfast",
      label: "Ontbijt",
      time: fmtHM(breakfast),
      isEstimate: true,
      note: travelMin == null ? "Reistijd nog invullen" : undefined,
    },
    {
      id: "departure",
      label: "Vertrek",
      time: fmtHM(departure),
      isEstimate: true,
      note: lg.departureLocation ?? (travelMin == null ? "Reistijd nog invullen" : undefined),
    },
    {
      id: "navigation",
      label: "Onderweg",
      time: fmtHM(departure),
      isEstimate: true,
      note: lg.navigationNotes ?? (travelMin != null ? `± ${travelMin} min rijden` : "Reistijd nog invullen"),
    },
    {
      id: "arrival",
      label: "Aankomst",
      time: fmtHM(arrival),
      isEstimate: true,
    },
    {
      id: "parking",
      label: "Parkeren",
      time: fmtHM(arrival),
      isEstimate: true,
      note: lg.parkingNotes ?? undefined,
    },
    {
      id: "registration",
      label: "Inschrijving / rugnummer",
      time: fmtHM(registration),
      isEstimate: true,
    },
    {
      id: "team_area",
      label: "Teamzone",
      time: fmtHM(teamArea),
      isEstimate: true,
    },
    {
      id: "warmup",
      label: "Warming-up",
      time: fmtHM(warmup),
      isEstimate: true,
    },
    {
      id: "call_up",
      label: "Call-up",
      time: fmtHM(callUp),
      isEstimate: true,
    },
    {
      id: "start",
      label: "Start",
      time: fmtHM(start),
      isEstimate: false,
    },
  ];

  return { start: fmtHM(start), steps };
}

/**
 * The condensed race-day timings (blueprint step 4): breakfast, departure,
 * arrival, warm-up, call-up, start. A view-friendly subset of the full timeline.
 */
export function computeRaceDayTimings(race: Race): TimelineStep[] {
  const wanted = new Set([
    "breakfast",
    "departure",
    "arrival",
    "warmup",
    "call_up",
    "start",
  ]);
  return computeRaceTimeline(race).steps.filter((s) => wanted.has(s.id));
}

/** Minutes-from-midnight of the recommended venue arrival (for team planning). */
export function venueArrivalMinutes(race: Race): number | null {
  const start = parseHM(race.startTime);
  if (start == null) return null;
  const buffer =
    race.logistics?.arrivalBufferMin ?? PLANNER_DEFAULTS.arrivalBufferMin;
  return start - buffer;
}

export { parseHM, fmtHM };
