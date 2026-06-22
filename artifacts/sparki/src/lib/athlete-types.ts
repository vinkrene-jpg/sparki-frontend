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
  zones: Zone[] | null;
  wkg: number | null;
  createdAt: string;
  updatedAt: string;
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
  structure: unknown;
  status: string;
  sessionId: number | null;
  createdAt: string;
  updatedAt: string;
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
