import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

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
      apiFetch<{ log: NutritionLog; flagged: number }>("/api/nutrition", {
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
