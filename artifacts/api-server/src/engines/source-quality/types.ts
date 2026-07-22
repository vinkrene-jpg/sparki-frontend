// Central source-quality register ("bronnenregister").
//
// One shared, deterministic assessment of every data source Sparki may reason
// over. Every chapter (training, herstel, voeding, materiaal, …) reads the SAME
// register, so no chapter can quietly assume data another chapter knows is
// missing or unreliable. Nothing here fabricates: a source without real data is
// reported as "ontbreekt" with a plain-Dutch reason.

export const SOURCE_KEYS = [
  "profiel",
  "doelen",
  "trainingen",
  "wedstrijden",
  "vermogen",
  "hartslag",
  "cadans",
  "herstel",
  "slaap",
  "voeding",
  "mentaal",
  "materiaal",
  "trainer_club",
  "omstandigheden",
] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

/** Where the data physically comes from. Null when there is no data at all. */
export type SourceOrigin = "meting" | "invoer" | "koppeling" | "afgeleid" | null;

/** Honest reliability ladder — "goed" is only earned by fresh, real data. */
export type SourceReliability = "goed" | "matig" | "onbetrouwbaar" | "ontbreekt";

/** Sensor/connection state for the source. "nvt" = manual-entry domain. */
export type SensorStatus = "actief" | "niet_gekoppeld" | "storing" | "nvt";

export type SourceQuality = {
  source: SourceKey;
  label: string;
  /** Where the current data comes from (meting/invoer/koppeling/afgeleid). */
  origin: SourceOrigin;
  /** ISO timestamp or ISO date of the newest real measurement, null if none. */
  lastMeasuredAt: string | null;
  /** 0..1 — how much of the expected data is actually present. */
  completeness: number;
  reliability: SourceReliability;
  sensorStatus: SensorStatus;
  /** May analyses draw conclusions from this source right now? */
  valid: boolean;
  /** Plain-Dutch reason, always filled when valid is false. */
  reason: string | null;
};

/** Raw, already-fetched facts the pure assessor works on. No DB access here. */
export type SourceQualityInput = {
  /** ISO date (YYYY-MM-DD) of "today" — passed in so tests are deterministic. */
  today: string;
  profile: {
    exists: boolean;
    ftp: number | null;
    ftpEstimated: boolean;
    weightKg: number | null;
    birthDate: string | null;
    weeklyHours: number | null;
    sport: string | null;
    developmentGoal: string | null;
    homeLat: number | null;
    homeLon: number | null;
    updatedAt: string | null;
  };
  /** Sessions in the recent window (newest first). */
  sessions: Array<{
    date: string;
    hasPower: boolean;
    hasHeartRate: boolean;
    hasCadence: boolean;
    hasTss: boolean;
    source: string | null;
  }>;
  windowDays: number;
  /** Daily metrics rows in the window (newest first). */
  metrics: Array<{
    date: string;
    hrv: number | null;
    restingHR: number | null;
    sleepHours: number | null;
    feelScore: number | null;
    fatigueScore: number | null;
  }>;
  nutritionLogDates: string[];
  ftpMeasurements: Array<{ measuredAt: string }>;
  upcomingRaceCount: number;
  feedbackCount: number;
  /** Paired sensors from the garage (real pairings, not wishes). */
  sensors: { power: boolean; heartRate: boolean; cadence: boolean };
  /** Connected external platforms. */
  connectors: Array<{ provider: string; status: string }>;
  garageBikeCount: number;
  hasActiveCoachLink: boolean;
};
