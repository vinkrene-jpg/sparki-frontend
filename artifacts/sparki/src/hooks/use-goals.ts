import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { STALE } from "@/lib/query-keys";

// Doelen-engine hooks. The /you Doelen-werkblad consumes the goal picture only
// through these — the backend judges progress; the frontend never computes it.

export type GoalProgress = {
  verdict: "op_koers" | "aandacht" | "risico" | "niet_meetbaar";
  reasons: string[];
  gaps: string[];
  daysToTarget: number | null;
};

export type Goal = {
  id: number;
  parentGoalId: number | null;
  title: string;
  description: string | null;
  horizon: "season" | "year" | "multi_year";
  targetDate: string | null;
  measure: string | null;
  targetValue: string | null;
  priority: number;
  status: "active" | "achieved" | "adjusted" | "paused" | "dropped";
  statusReason: string | null;
  createdAt: string;
  updatedAt: string;
  progress: GoalProgress;
};

export type DerivedGoal = {
  derivedId: string;
  source: "race" | "development_goal" | "nutrition_season";
  title: string;
  targetDate: string | null;
  detail: string | null;
  priority: number;
  progress: GoalProgress;
};

export type GoalProposal = {
  id: number;
  goalId: number | null;
  kind: string;
  title: string;
  reasoning: string;
  status: "open" | "accepted" | "rejected";
  createdAt: string;
};

export type GoalQuestion = {
  key: string;
  question: string;
  goalId: number | null;
};

export type GoalPicture = {
  goals: Goal[];
  derived: DerivedGoal[];
  proposals: GoalProposal[];
  nextQuestion: GoalQuestion | null;
};

export type GoalInput = {
  title: string;
  description?: string | null;
  horizon?: Goal["horizon"];
  targetDate?: string | null;
  measure?: string | null;
  targetValue?: string | null;
  priority?: number;
  parentGoalId?: number | null;
  // Atomaire update-of-aanmaak op titelprefix (server-side, race-vrij) —
  // gebruikt door het Wattage-lab zodat dubbelkliks nooit duplicaten maken.
  dedupeTitlePrefix?: string;
};

const GOALS_KEY = ["goals", "picture"] as const;

export function useGoalPicture() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: GOALS_KEY,
    queryFn: () => apiFetch<GoalPicture>("/api/goals"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

function useInvalidateGoals() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: GOALS_KEY });
  };
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (input: GoalInput) =>
      apiFetch<{ goal: Goal }>("/api/goals", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: Partial<GoalInput> & { status?: Goal["status"]; statusReason?: string | null };
    }) =>
      apiFetch<{ goal: Goal }>(`/api/goals/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/goals/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useDecideGoalProposal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: number;
      decision: "accepted" | "rejected";
    }) =>
      apiFetch<{ proposal: GoalProposal }>(`/api/goals/proposals/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      }),
    onSuccess: invalidate,
  });
}

export function useBuildGoalProposals() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; skipped: number }>("/api/goals/proposals/build", {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}
