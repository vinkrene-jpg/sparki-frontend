import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type {
  PlannedWorkout,
  PlannedWorkoutDetail,
  SparkiAdjustProposal,
  WorkoutFeedback,
  WorkoutFeedbackType,
} from "@/lib/athlete-types";

function dateStr(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

/** A multi-week window of planned workouts (default: today → +21 days). */
export function useTrainingPlan(weeks = 3) {
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
    }: {
      workoutId: number;
      feedbackType: WorkoutFeedbackType;
      note?: string;
    }) =>
      apiFetch<{ feedback: WorkoutFeedback }>(
        `/api/athlete/workouts/${workoutId}/feedback`,
        {
          method: "POST",
          body: JSON.stringify({ feedbackType, note }),
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

/** Ask Sparki for the deep "Waarom?" philosophy behind one workout. */
export function useWorkoutExplain() {
  return useMutation({
    mutationFn: (workoutId: number) =>
      apiFetch<{ explanation: string }>("/api/ai/workout-explain", {
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
    }: {
      workoutId: number;
      feedbackType: WorkoutFeedbackType;
      note?: string;
    }) =>
      apiFetch<{ proposal: SparkiAdjustProposal }>("/api/ai/workout-adjust", {
        method: "POST",
        body: JSON.stringify({ workoutId, feedbackType, note }),
      }),
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
