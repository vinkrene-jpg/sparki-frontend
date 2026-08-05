export type Zone = {
  zone: number;
  label: string;
  min: number;
  max: number;
};

export type AthleteProfile = {
  clerkId: string;
  email: string;
  displayName: string | null;
  roles: string[];
  activeRole: string;
  id: number;
  ftp: number | null;
  ftpEstimated: boolean | null;
  // §5.1 Voorbeeldsporter: dit account is fictief (zichtbare markering).
  voorbeeld?: boolean;
  // WP-K2: herkomststatus per kernwaarde (Sportpaspoort) — één brondefinitie.
  herkomst?: Record<
    string,
    { origin: string; estimated: boolean; stale: boolean }
  > | null;
  weightKg: string | null;
  heightCm: number | null;
  birthYear: number | null;
  birthDate: string | null;
  discipline: string | null;
  goals: string | null;
  developmentGoal: string | null;
  // Zelfgerapporteerd niveau — voedt o.a. het automatische plannerweergave-voorstel.
  experienceLevel: string | null;
  competitionLevel: string | null;
  // Routeplanner-weergaveniveau (besluit B6); null = automatisch voorstel volgen.
  plannerView: "gratis" | "go_fietser" | "go_sport" | "wedstrijd" | null;
  weeklyHourTarget: number | null;
  weeklyHourTargetEstimated: boolean | null;
  trainingDaysPerWeek: number | null;
  healthStatus: "ok" | "sick" | "injured";
  zones: Zone[] | null;
  wkg: number | null;
  homeLat: string | null;
  homeLon: string | null;
  homeLabel: string | null;
  decorPhotoPath: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Canonical workout structure (mirrors lib/db athlete-training.ts) ──────────
export type WorkoutPhase = "base" | "build" | "peak" | "recovery";

export type WorkoutBlockKind =
  | "warmup"
  | "interval"
  | "recovery"
  | "steady"
  | "cooldown";

export type WorkoutBlock = {
  kind: WorkoutBlockKind;
  label: string;
  durationMin: number;
  zone: number;
  targetPctFtp: number | null;
  reps?: number;
};

export type WorkoutRouteNeed =
  | "outdoor_long"
  | "outdoor"
  | "indoor_ok"
  | "none";

export type WorkoutRationale = {
  whyToday: string;
  supportsGoal: string;
  whatToFeel: string;
  tooHardSigns: string;
  tooLightSigns: string;
  safeAdjust: string;
};

export type WorkoutStructure = {
  phase: WorkoutPhase;
  week: number;
  intensity: string;
  primaryZone: number;
  routeNeed: WorkoutRouteNeed;
  equipment: string[];
  blocks: WorkoutBlock[];
  recoveryAdvice: string;
  rationale: WorkoutRationale;
};

export type PlannedWorkout = {
  id: number;
  clerkId: string;
  scheduledDate: string;
  type: string;
  title: string;
  description: string | null;
  targetDurationMin: number | null;
  targetTSS: number | null;
  structure: WorkoutStructure | null;
  // Planningsdetails (alleen vooraf-velden; uitgevoerde ervaring leeft in
  // TrainingSession, nooit hier).
  planDetails: {
    discipline?: string;
    goal?: string;
    targetDistanceKm?: number;
    intensity?: string;
    bikeId?: number;
    nutritionNote?: string;
  } | null;
  routeId: number | null;
  status: string;
  source: string;
  sessionId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutFeedbackType =
  | "done"
  | "missed"
  | "too_hard"
  | "too_light"
  | "pain"
  | "tired"
  | "move";

export type WorkoutCompletion = "volledig" | "gedeeltelijk" | "niet";

export type WorkoutFeedback = {
  id: number;
  clerkId: string;
  workoutId: number;
  feedbackType: WorkoutFeedbackType;
  note: string | null;
  rpe: number | null;
  completion: WorkoutCompletion | null;
  deviationReason: string | null;
  createdAt: string;
};

export type PlannedWorkoutDetail = PlannedWorkout & {
  feedback: WorkoutFeedback[];
};

export type WorkoutChange = {
  id: number;
  workoutId: number;
  action: string;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type SparkiAdjustProposal = {
  recommendation: "keep" | "adjust" | "move" | "recovery" | "replan_week";
  title: string;
  message: string;
  changes: {
    targetDurationMin?: number;
    targetTSS?: number;
    intensity?: string;
    newDate?: string;
    title?: string;
  } | null;
  /** Deterministische onderbouwing van Sparki's beslislaag. */
  basis?: string[];
  /** 0–1 zekerheid van het voorstel. */
  confidence?: number;
};

export type TrainingSession = {
  id: number;
  clerkId: string;
  sessionDate: string;
  type: string;
  title: string | null;
  durationMin: number | null;
  distanceKm: string | null;
  elevationM: number | null;
  normalizedPower: number | null;
  avgPower: number | null;
  avgHR: number | null;
  avgSpeedKph: string | null;
  tss: number | null;
  // F3: belasting op hartslag — apart herkenbaar van de vermogensbelasting.
  hrLoad?: number | null;
  intensityFactor: string | null;
  notes: string | null;
  feelScore: number | null;
  source: string;
  /** Canonieke sportfamilie (zie data-hub/sports.ts): "cycling" | "hiking" | … */
  sport?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AthleteDailyMetric = {
  id: number;
  clerkId: string;
  metricDate: string;
  hrv: number | null;
  restingHR: number | null;
  sleepHours: string | null;
  sleepQuality: number | null;
  fatigueScore: number | null;
  feelScore: number | null;
  notes: string | null;
  weightKg: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FtpHistoryEntry = {
  id: number;
  clerkId: string;
  measuredAt: string;
  ftpWatts: number;
  testType: string;
  notes: string | null;
  createdAt: string;
};
