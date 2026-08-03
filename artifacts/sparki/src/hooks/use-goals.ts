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
  // F4: verplichte keuze over het bestaande hoofddoel bij een nieuw hoofddoel.
  previousGoalDecision?:
    | "behaald"
    | "niet_meer_relevant"
    | "wordt_nevendoel"
    | "blijft_hoofddoel";
  // DOELEN_01: doelsoort en (bij schuifbalkdoelen) thema + stand.
  kind?: "event" | "prestatie" | "gedrag" | "slider";
  theme?: string | null;
  themeLevel?: number | null;
  // DOE-44: vertaal-audit bij een via vrije invoer vertaald doel.
  translation?: {
    originalInput: string;
    followUpCount: number;
    proposedGoal: unknown;
    confirmed: boolean;
  } | null;
};

// DOELEN_01 — leeftijdsband + toegestane doelsoorten/thema's. De server
// bepaalt dit; de frontend rendert alleen wat hier terugkomt (DOE-46).
export type GoalPolicy = {
  band: "under14" | "14-16" | "16-18" | "18+";
  form: "slider" | "regular";
  allowedKinds: string[];
  blockWeightRelated: boolean;
  description: string;
  themes: { key: string; label: string }[];
  kinds: { key: string; label: string; uitleg: string }[];
};

export function useGoalPolicy() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["goals", "policy"] as const,
    queryFn: () => apiFetch<GoalPolicy>("/api/goals/policy"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

// DOELEN_01 F3 — vertaalstap (DOE-18 t/m DOE-21).
export type TranslateResult =
  | { status: "question"; question: string; followUpCount: number }
  | {
      status: "proposal";
      goal: {
        kind: "event" | "prestatie" | "gedrag";
        title: string;
        measure: string | null;
        targetValue: string | null;
        targetDate: string | null;
      };
      followUpCount: number;
      fallback: boolean;
    };

/* ── DOELEN_01: trainer- en ouderkant ─────────────────────────────────── */

// Welke doelsoorten mag DEZE sporter krijgen? (DOE-16: het trainerscherm
// rendert alleen wat de sporterband toelaat.)
export function useTrainerGoalPolicy(athleteId: string | null) {
  return useQuery({
    queryKey: ["goals", "trainer-policy", athleteId] as const,
    queryFn: () => apiFetch<GoalPolicy>(`/api/goals/trainer/${athleteId}/policy`),
    enabled: !!athleteId,
    staleTime: STALE.session,
  });
}

// Doelinzage voor de voorstellende trainer (DOE-32/36/37). 403 = geen
// bestaand trainerdoel → eerlijk uitgelegd, geen inzage.
export function useTrainerAthleteGoals(athleteId: string | null) {
  return useQuery({
    queryKey: ["goals", "trainer-view", athleteId] as const,
    queryFn: () => apiFetch<{ goals: Goal[] }>(`/api/goals/trainer/${athleteId}`),
    enabled: !!athleteId,
    retry: false,
    staleTime: STALE.session,
  });
}

export function useProposeGoalToAthlete(athleteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      title: string;
      description?: string | null;
      measure?: string | null;
      targetValue?: string | null;
      targetDate?: string | null;
      reasoning?: string | null;
      theme?: string | null;
    }) =>
      apiFetch<{ proposal: GoalProposal }>(`/api/goals/trainer/${athleteId}/proposals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["goals", "trainer-view", athleteId] });
    },
  });
}

// Ouder-meekijk (DOE-38/39): alleen lezen, geen acties.
export function useParentChildGoals(childId: string | null) {
  return useQuery({
    queryKey: ["goals", "parent-view", childId] as const,
    queryFn: () =>
      apiFetch<{ goals: Goal[]; events: { id: number; eventType: string; note: string | null; createdAt: string }[]; readOnly: true }>(
        `/api/goals/parent/${childId}`,
      ),
    enabled: !!childId,
    retry: false,
    staleTime: STALE.session,
  });
}

export function useTranslateGoal() {
  return useMutation({
    mutationFn: (input: {
      input: string;
      history: { question: string; answer: string }[];
    }) =>
      apiFetch<TranslateResult>("/api/goals/translate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

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
