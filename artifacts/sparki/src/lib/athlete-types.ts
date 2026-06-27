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
  weightKg: string | null;
  discipline: string | null;
  goals: string | null;
  weeklyHourTarget: number | null;
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

export type WorkoutFeedback = {
  id: number;
  clerkId: string;
  workoutId: number;
  feedbackType: WorkoutFeedbackType;
  note: string | null;
  createdAt: string;
};

export type PlannedWorkoutDetail = PlannedWorkout & {
  feedback: WorkoutFeedback[];
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
  tss: number | null;
  intensityFactor: string | null;
  notes: string | null;
  feelScore: number | null;
  source: string;
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
