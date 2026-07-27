import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type {
  PlannedWorkout,
  PlannedWorkoutDetail,
  SparkiAdjustProposal,
  WorkoutChange,
  WorkoutCompletion,
  WorkoutFeedback,
  WorkoutFeedbackType,
} from "@/lib/athlete-types";

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

/** Fetch planned workouts for an arbitrary [from, to] date window. */
export function usePlanRange(from: string, to: string) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.athlete.plan(from, to),
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${from}&to=${to}`,
      ),
    enabled:
      (isSignedIn === true || DEV_PREVIEW) &&
      from.length === 10 &&
      to.length === 10,
    staleTime: STALE.session,
  });
}

/** A multi-week window of planned workouts (default: today → +21 days). */
export function usePlanWindow(weeks = 3) {
  const { isSignedIn } = useUser();
  const today = new Date();
  const from = dateStr(today);
  const to = dateStr(new Date(today.getTime() + weeks * 7 * 86_400_000));

  return useQuery({
    queryKey: queryKeys.athlete.plan(from, to),
    queryFn: () =>
      apiFetch<PlannedWorkout[]>(
        `/api/athlete/workouts?from=${from}&to=${to}`,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

/** Single workout + its feedback history. */
export function useWorkoutDetail(id: number | null) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: id != null ? queryKeys.athlete.workout(id) : ["athlete", "workout", "detail", "none"],
    queryFn: () =>
      apiFetch<PlannedWorkoutDetail>(`/api/athlete/workouts/${id}`),
    enabled: (isSignedIn === true || DEV_PREVIEW) && id != null,
    staleTime: STALE.session,
  });
}

/** Generate a real 3-week periodized plan from the athlete's own numbers. */
export function useGeneratePlan() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body?: { startDate?: string; weeks?: number }) =>
      apiFetch<{ workouts: PlannedWorkout[]; from: string; to: string }>(
        "/api/athlete/plan/generate",
        { method: "POST", body: JSON.stringify(body ?? {}) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

/** Record athlete feedback on a workout. */
export function useSubmitFeedback() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      workoutId,
      feedbackType,
      note,
      rpe,
      completion,
      deviationReason,
    }: {
      workoutId: number;
      feedbackType: WorkoutFeedbackType;
      note?: string;
      rpe?: number | null;
      completion?: WorkoutCompletion | null;
      deviationReason?: string;
    }) =>
      apiFetch<{ feedback: WorkoutFeedback }>(
        `/api/athlete/workouts/${workoutId}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({
            feedbackType,
            note,
            ...(rpe != null && { rpe }),
            ...(completion != null && { completion }),
            ...(deviationReason?.trim() && { deviationReason }),
          }),
        },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.athlete.workout(vars.workoutId),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

/**
 * Ask Sparki to explain one workout in two tiers: a short, directly readable
 * kernel plus an extended version with more depth and the real numbers. The
 * athlete always starts with the short version and can expand on demand.
 */
export function useWorkoutExplain() {
  return useMutation({
    mutationFn: (workoutId: number) =>
      apiFetch<{ short: string }>("/api/ai/workout-explain", {
        method: "POST",
        body: JSON.stringify({ workoutId }),
      }),
  });
}

/**
 * Load the deeper "Waarom?" onderbouwing on demand — only when the athlete opens
 * "Uitgebreid". This is the heavier generation, kept out of the first paint so
 * the short kernel appears almost immediately.
 */
export function useWorkoutExplainExtended() {
  return useMutation({
    mutationFn: (workoutId: number) =>
      apiFetch<{ extended: string }>("/api/ai/workout-explain-extended", {
        method: "POST",
        body: JSON.stringify({ workoutId }),
      }),
  });
}

/** Ask Sparki for an adjustment proposal based on feedback. */
export function useWorkoutAdjust() {
  return useMutation({
    mutationFn: ({
      workoutId,
      feedbackType,
      note,
      rpe,
      completion,
    }: {
      workoutId: number;
      feedbackType: WorkoutFeedbackType;
      note?: string;
      rpe?: number | null;
      completion?: WorkoutCompletion | null;
    }) =>
      apiFetch<{ proposal: SparkiAdjustProposal }>("/api/ai/workout-adjust", {
        method: "POST",
        body: JSON.stringify({
          workoutId,
          feedbackType,
          note,
          ...(rpe != null && { rpe }),
          ...(completion != null && { completion }),
        }),
      }),
  });
}

/** Wijzigingshistorie van één geplande training (append-only log). */
export function useWorkoutHistory(id: number | null, enabled: boolean) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["athlete", "workout", "history", id ?? "none"],
    queryFn: () =>
      apiFetch<{ changes: WorkoutChange[] }>(
        `/api/athlete/workouts/${id}/history`,
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && id != null && enabled,
    staleTime: 30_000,
  });
}

/** Koppel of ontkoppel een activiteit aan een geplande training. */
export function useLinkWorkoutSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      sessionId,
    }: {
      id: number;
      sessionId: number | null;
    }) =>
      apiFetch<PlannedWorkout>(`/api/athlete/workouts/${id}`, {
        method: "PUT",
        body: JSON.stringify({ sessionId }),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.workout(vars.id) });
      void qc.invalidateQueries({ queryKey: ["athlete", "workout", "history", vars.id] });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

/** Annuleer (zacht) een geplande training — telt nergens meer mee. */
export function useCancelWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<PlannedWorkout>(`/api/athlete/workouts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.workout(id) });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

/** Apply a Sparki proposal's changes to the workout (move/adjust). */
export function useApplyProposal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: number;
      changes: SparkiAdjustProposal["changes"];
    }) => {
      const body: Record<string, unknown> = { status: "modified" };
      if (changes?.targetDurationMin != null)
        body["targetDurationMin"] = changes.targetDurationMin;
      if (changes?.targetTSS != null) body["targetTSS"] = changes.targetTSS;
      if (changes?.newDate != null) body["scheduledDate"] = changes.newDate;
      if (changes?.title != null) body["title"] = changes.title;
      // Persist the adjusted intensity into the workout description so the
      // change is durable and shows up in the Practical section.
      if (changes?.intensity != null) body["description"] = changes.intensity;
      return apiFetch<PlannedWorkout>(`/api/athlete/workouts/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.athlete.workout(vars.id),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

// ── Autonomous training plan (coach-less plan engine) ──────────────────────

export type PlanReadiness = {
  label: "fresh" | "ok" | "tired" | "unknown";
  score: number | null;
};

export type PlanRace = {
  name: string;
  raceDate: string;
  priority: string;
  daysAway: number;
};

export type PlanRoute = {
  id: number;
  name: string;
  distanceKm: number | null;
  elevationGainM: number | null;
};

export type WeatherSeverity = "ok" | "caution" | "severe";

export type DayWeather = {
  label: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  apparentMinC: number | null;
  apparentMaxC: number | null;
  precipMm: number | null;
  snowfallCm: number | null;
  windMaxKmh: number | null;
  precipProbMaxPct: number | null;
};

export type WeatherAdvisory = {
  severity: WeatherSeverity;
  headline: string;
  detail: string;
  suggestion: string | null;
};

export type WeatherNutritionAdvisory = {
  severity: WeatherSeverity;
  hydrationNote: string | null;
  fuelNote: string | null;
};

export type RaceWeather = {
  available: boolean;
  reason: "ok" | "too_far" | "no_location" | "geocode_failed" | "no_forecast";
  locationLabel: string | null;
  weather: DayWeather | null;
  advisory: WeatherAdvisory | null;
};

export type PlanDay = {
  id: number;
  dayDate: string;
  weekIndex: number;
  focus: string;
  trainingType: string | null;
  intensityLabel: string | null;
  estDurationMin: number | null;
  isRest: boolean;
  routeNeeded: boolean;
  rationale: string | null;
  adaptationReason: string | null;
  committed: boolean;
  workout: { id: number; title: string; type: string; status: string } | null;
  route: PlanRoute | null;
  weather: DayWeather | null;
  trainingAdvisory: WeatherAdvisory | null;
  nutritionAdvisory: WeatherNutritionAdvisory | null;
};

export type PlanHeader = {
  id: number;
  name: string;
  maker: string;
  source: string;
  createdAt: string;
  goal: string;
  mode: "autonomous" | "advisory";
  status: string;
  summary: string | null;
  weekStartDate: string;
  horizonEndDate: string;
  weeklyHourTarget: number | null;
  generatedAt: string;
  adaptationState: {
    adaptationCount?: number;
    lastAdaptedAt?: string | null;
    notes?: string[];
  } | null;
  inputSnapshot: Record<string, unknown> | null;
};

export type PlanInputsView = {
  experienceLevel: string | null;
  availableDays: string[];
  weeklyHourTarget: number | null;
  loadCapacity: string | null;
  injuryHistory: string | null;
  trainingPreferences: string | null;
  discipline: string | null;
  phase: "base" | "build" | "peak" | "taper";
  readiness: PlanReadiness;
  healthStatus: string;
  nextRace: PlanRace | null;
  homeLat: number | null;
  homeLon: number | null;
  homeLabel: string | null;
};

export type TrainingPlanResponse = {
  hasCoach: boolean;
  mode: "autonomous" | "advisory";
  needsSetup: boolean;
  missing: string[];
  hasHome: boolean;
  inputs: PlanInputsView;
  raceWeather: RaceWeather | null;
  plan: PlanHeader | null;
  days: PlanDay[];
};

export type GenerateResponse = {
  mode: "autonomous" | "advisory";
  hasCoach: boolean;
  routesGenerated: number;
  routesAttempted: number;
  plan: PlanHeader | null;
  days: PlanDay[];
};

export type AdaptResponse = {
  adapted: boolean;
  changes: number;
  note: string;
  plan: PlanHeader | null;
  days: PlanDay[];
};

export type PlanSetupInput = {
  experienceLevel?: string;
  availableDays?: string[];
  weeklyHourTarget?: number;
  loadCapacity?: string;
  injuryHistory?: string | null;
  trainingPreferences?: string | null;
  homeLat?: number | null;
  homeLon?: number | null;
  homeLabel?: string | null;
};

export function useTrainingPlan(enabled = true) {
  return useQuery({
    queryKey: queryKeys.trainingPlan.current(),
    queryFn: () => apiFetch<TrainingPlanResponse>("/api/training-plan"),
    staleTime: STALE.session,
    enabled,
  });
}

export function useGenerateTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<GenerateResponse>("/api/training-plan/generate", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
      qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
      qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}

export function usePauseTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ paused: boolean }>("/api/training-plan/pause", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
      qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
    },
  });
}

export function useResumeTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ resumed: boolean }>("/api/training-plan/resume", {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
      qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
    },
  });
}

export function useDeleteTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ deleted: boolean }>("/api/training-plan", {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
      qc.invalidateQueries({ queryKey: queryKeys.athlete.todayWorkout() });
    },
  });
}

export function useAdaptTrainingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AdaptResponse>("/api/training-plan/adapt", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
    },
  });
}

export function useSavePlanSetup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PlanSetupInput) =>
      apiFetch("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trainingPlan.all() });
      qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
    },
  });
}
