// Typed race/logistics provider layer (task #4).
//
// Architectural constraint: every race & logistics value the homepages consume
// flows through these types and the pure helpers in race-context / race-planner /
// team-planner. Today the data comes from the athlete via the races API; later an
// integration adapter (TrainingPeaks / Coach Portal / Garmin) can produce the
// exact same shapes, so the homepages never need a redesign. Nothing here invents
// live data — derived clock times are flagged `isEstimate`.

export type RacePriority = "A" | "B" | "C";

/** Athlete-entered travel inputs used to compute the logistics timeline. */
export type RaceLogisticsInput = {
  departureLocation?: string | null;
  /** Door-to-venue travel time in minutes (entered, not live traffic). */
  travelDurationMin?: number | null;
  /** How early before the start to arrive at the venue. */
  arrivalBufferMin?: number | null;
  /** Minutes needed for registration / number pickup after arrival. */
  registrationMin?: number | null;
  /** Warm-up duration in minutes. */
  warmupMin?: number | null;
  /** Minutes before the start for call-up / staging. */
  callUpMin?: number | null;
  /** Minutes before departure to have breakfast. */
  breakfastBeforeDepartureMin?: number | null;
  parkingNotes?: string | null;
  navigationNotes?: string | null;
};

/** A rider attending the same race — used by the Team Meeting Planner. */
export type TeamRider = {
  id: string;
  name: string;
  startLocation?: string | null;
  /** This rider's travel time to the meeting point, in minutes (entered). */
  travelDurationMin?: number | null;
};

/** Persisted checklist state: catalog item id → checked. */
export type ChecklistState = Record<string, boolean>;

/** A race/event as returned by the API (jsonb sub-objects typed). */
export type Race = {
  id: number;
  clerkId: string;
  name: string;
  raceDate: string; // YYYY-MM-DD
  startTime: string | null; // "HH:MM"
  location: string | null;
  priority: RacePriority;
  discipline: string | null;
  notes: string | null;
  plannedWorkoutId: number | null;
  travelDate: string | null;
  course: string | null;
  distanceKm: string | null;
  elevationM: number | null;
  technicalSections: string | null;
  weatherNote: string | null;
  teamName: string | null;
  teamInfo: string | null;
  coachInstructions: string | null;
  logistics: RaceLogisticsInput | null;
  checklist: ChecklistState | null;
  teamRiders: TeamRider[] | null;
  routeId: number | null;
  /** Aantal lokale ronden (wedstrijdmodus) — null = niet vastgelegd. */
  localLaps: number | null;
  /** Persoonlijke opdracht voor deze wedstrijd (van coach of renner zelf). */
  assignment: string | null;
  category: string | null;
  registrationStatus: RaceRegistrationStatus | null;
  goal: string | null;
  status: RaceStatus;
  createdAt: string;
  updatedAt: string;
};

/** Inschrijvingsstatus — plain Dutch in de UI. */
export type RaceRegistrationStatus =
  | "niet_ingeschreven"
  | "ingeschreven"
  | "bevestigd";

/** Wedstrijdstatus — geannuleerd telt nergens in mee. */
export type RaceStatus = "gepland" | "geannuleerd";

/** Payload for creating/updating a race (all optional except create-required). */
export type RaceInput = Partial<Omit<Race, "id" | "clerkId" | "createdAt" | "updatedAt">> & {
  name?: string;
  raceDate?: string;
};

/**
 * The race-week phase, derived from days until the nearest relevant race.
 * Maps to a day-type / homepage in the engine:
 *  - race_week_build  (7–4 days): training focus
 *  - race_week_taper  (3–2 days): recovery focus
 *  - day_before       (1 day):    preparation mode
 *  - race_day         (0 days):   competition mode
 *  - post_race        (race just done): recovery & analysis
 *  - travel           (travelDate is today): travel day
 */
export type RacePhase =
  | "race_week_build"
  | "race_week_taper"
  | "day_before"
  | "race_day"
  | "post_race"
  | "travel";

/** Resolved race context the homepages and day-type engine consume. */
export type RaceContext = {
  race: Race;
  /** Whole days until race day (0 = today, 1 = tomorrow, negative = past). */
  daysUntil: number;
  phase: RacePhase;
};

// ── Preparation checklist catalog ────────────────────────────────────────────
// The fixed set of prep items. Checked state persists per race (Race.checklist).
export type ChecklistItem = { id: string; label: string };

export const PREP_CHECKLIST: ReadonlyArray<ChecklistItem> = [
  { id: "bike", label: "Fiets" },
  { id: "helmet", label: "Helm" },
  { id: "shoes", label: "Schoenen" },
  { id: "race_number", label: "Rugnummer" },
  { id: "transponder", label: "Transponder" },
  { id: "nutrition", label: "Voeding" },
  { id: "bidons", label: "Bidons" },
  { id: "pump", label: "Pomp" },
  { id: "co2", label: "CO₂" },
  { id: "tools", label: "Gereedschap" },
  { id: "clothing", label: "Kleding" },
  { id: "tyres", label: "Banden" },
  { id: "chain", label: "Ketting" },
  { id: "electronics", label: "Elektronica geladen" },
];
