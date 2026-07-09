import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PhotoPayload } from "@/hooks/use-material";

export type NutritionContext =
  | "normal_day"
  | "training_day"
  | "race_day"
  | "recovery_day";

export type NutritionLog = {
  id: number;
  clerkId: string;
  logDate: string;
  context: NutritionContext;
  preTrainingFood: string | null;
  duringTrainingCarbsGrams: number | null;
  duringTrainingFluidMl: number | null;
  duringTrainingSodiumMg: number | null;
  postTrainingFood: string | null;
  bodyWeightBefore: string | null;
  bodyWeightAfter: string | null;
  stomachIssues: boolean;
  notes: string | null;
  photoPaths: string[];
  createdAt: string;
};

export type NutritionLogInput = {
  logDate: string;
  context: NutritionContext;
  preTrainingFood?: string | null;
  duringTrainingCarbsGrams?: number | null;
  duringTrainingFluidMl?: number | null;
  duringTrainingSodiumMg?: number | null;
  postTrainingFood?: string | null;
  bodyWeightBefore?: string | null;
  bodyWeightAfter?: string | null;
  stomachIssues?: boolean;
  notes?: string | null;
  photos?: PhotoPayload[];
};

export type MealPhotoAdvice = {
  detectedItem: string;
  confidence: "high" | "medium" | "low" | "unknown";
  needsMorePhoto: boolean;
  followUpQuestion: string | null;
  advice: {
    summary: string;
    pros: string[];
    cons: string[];
    risks: string[];
    alternatives: string[];
  };
};

export type CreateNutritionResult = {
  log: NutritionLog;
  flagged: number;
  photoAdvice: MealPhotoAdvice | null;
  photoAdviceFailed: boolean;
};

export type NutritionGuidanceTopic = {
  title: string;
  what: string;
  why: string;
  how: string;
};

export type NutritionGuidance = {
  level: "youth" | "adult";
  intro: string;
  topics: NutritionGuidanceTopic[];
};

export function useNutritionLogs(limit = 30) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.nutrition.logs(limit),
    queryFn: () =>
      apiFetch<{ logs: NutritionLog[] }>(`/api/nutrition?limit=${limit}`),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 2 * 60_000,
  });
}

export function useCreateNutritionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NutritionLogInput) =>
      apiFetch<CreateNutritionResult>("/api/nutrition", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.nutrition.all() });
      void qc.invalidateQueries({
        queryKey: queryKeys.aiMemory.observations(),
      });
    },
  });
}

export function useNutritionGuidance(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.nutrition.guidance(),
    queryFn: () =>
      apiFetch<{ guidance: NutritionGuidance }>("/api/nutrition/guidance"),
    enabled: enabled && (isSignedIn === true || DEV_PREVIEW),
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export type NutritionDayAnalysis = {
  date: string;
  level: "youth" | "adult";
  summary: string;
  points: { title: string; finding: string; advice: string }[];
  gaps: string[];
  logCount: number;
  photoCount: number;
  trainedThatDay: boolean;
  plannedThatDay: boolean;
};

export type NutritionDayResult = {
  analysis: NutritionDayAnalysis | null;
  reason?: string;
};

// On-demand (button-triggered) whole-day analysis — modelled as a mutation
// because it is slow and costly, so it never fires automatically.
export function useNutritionDayAnalysis() {
  return useMutation({
    mutationFn: (date: string) =>
      apiFetch<NutritionDayResult>(
        `/api/nutrition/day-analysis?date=${encodeURIComponent(date)}`,
      ),
  });
}

export type FuelingPhase = { phase: string; title: string; advice: string };

export type FuelingPlan = {
  date: string;
  level: "youth" | "adult";
  summary: string;
  phases: FuelingPhase[];
  gaps: string[];
  raceCount: number;
  workoutCount: number;
};

export type FuelingPlanResult = {
  plan: FuelingPlan | null;
  reason?: string;
};

// On-demand four-phase fueling plan for a day with a KNOWN planned training or
// race — voorbereiding / tijdens / direct erna / de uren erna (herstel).
export function useFuelingPlan() {
  return useMutation({
    mutationFn: (date: string) =>
      apiFetch<FuelingPlanResult>(
        `/api/nutrition/fueling-plan?date=${encodeURIComponent(date)}`,
      ),
  });
}

export type SeasonGoalSteering = {
  deltaKg: number | null;
  weeksToSeasonStart: number | null;
  weeksToPeak: number | null;
  requiredKgPerWeek: number | null;
  feasible: boolean | null;
  summary: string;
  warning: string | null;
};

export type SeasonGoalResult =
  | { eligible: false; reason: "birth_year_missing" | "too_young"; message: string }
  | {
      eligible: true;
      goal: {
        seasonStartDate: string | null;
        peakDate: string | null;
        targetWeightKg: number | null;
        note: string | null;
      };
      currentWeightKg: number | null;
      nextQuestion: { field: string; question: string; why: string } | null;
      steering: SeasonGoalSteering | null;
    };

export function useSeasonGoal(enabled: boolean) {
  return useQuery({
    queryKey: ["nutrition", "season-goal"],
    queryFn: () => apiFetch<SeasonGoalResult>("/api/nutrition/season-goal"),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useUpdateSeasonGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      seasonStartDate?: string | null;
      peakDate?: string | null;
      targetWeightKg?: number | null;
      currentWeightKg?: number | null;
      note?: string | null;
    }) =>
      apiFetch<{ ok: true }>("/api/nutrition/season-goal", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", "season-goal"] });
    },
  });
}

export function useDeleteNutritionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/nutrition/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.nutrition.all() });
    },
  });
}
