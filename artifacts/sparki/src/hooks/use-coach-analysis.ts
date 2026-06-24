import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Local mirror of the engine's CoachAnalysis shape (the engine lives in a
// separate package; this is the read-only contract the UI relies on).

export type Confidence = {
  score: number;
  level: "low" | "medium" | "high";
  reasons: string[];
  uncertainties: string[];
};

export type IntakeSignal = {
  kind: string;
  status: "present" | "insufficient" | "missing";
  label: string;
  value: string | null;
  reason?: string;
  dataPoints: number;
};

export type Observation = {
  topic: string;
  statement: string;
  category: string;
  tone: "positive" | "concern" | "neutral";
  severity: string;
  detectedPattern: string | null;
  confidence: Confidence;
  signalsUsed: IntakeSignal[];
  signalsMissing: string[];
};

export type AdviceExplainers = {
  watIkZie: string;
  watIkDenk: string;
  waaromDitAdvies: string;
  watAlsHetAndersIs: string;
  watVerandertMijnAdvies: string;
};

export type Advice = {
  headline: string;
  intensity: "rust" | "herstel" | "rustig" | "normaal" | "stevig";
  explainers: AdviceExplainers;
  confidence: Confidence;
};

export type FollowUpOption = { value: string; label: string };

export type FollowUpQuestion = {
  id: string;
  question: string;
  because: string;
  resolves: string[];
  options: FollowUpOption[];
};

export type CoachActionKind =
  | "adjust_training"
  | "check_in"
  | "rest"
  | "nutrition"
  | "add_race"
  | "check_gear";

export type CoachAction = {
  key: string;
  kind: CoachActionKind;
  label: string;
  reason: string;
};

export type PersonalityKey =
  | "beginner"
  | "ervaren"
  | "jeugdrenner"
  | "ouder"
  | "trainer"
  | "topsporter";

export type Personality = {
  key: PersonalityKey;
  label: string;
  vocabulary: "simpel" | "normaal" | "technisch";
  encouragement: "hoog" | "normaal" | "laag";
  detail: "kort" | "normaal" | "uitgebreid";
  basis: string;
};

export type CoachAnalysis = {
  date: string;
  athleteName: string;
  personality: Personality;
  watValtOp: string | null;
  patronen: string | null;
  beterDanVerwacht: string | null;
  verdientAandacht: string | null;
  adviesVandaag: string;
  waaromAdvies: string;
  observations: Observation[];
  followUps: FollowUpQuestion[];
  advice: Advice;
  actions: CoachAction[];
  missing: string[];
};

export type CoachFeedbackSignal =
  | "advice_followed"
  | "advice_ignored"
  | "wants_more_detail"
  | "wants_less_detail"
  | "wants_more_guidance"
  | "wants_less_guidance"
  | "too_strict"
  | "too_soft";

export function useCoachAnalysis() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.coach.analysis(),
    queryFn: () => apiFetch<CoachAnalysis>("/api/coach/analysis"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.live,
  });
}

/**
 * Answer a follow-up question. The backend persists the answer (a check-in
 * answer becomes a real daily metric), re-runs the engine, and returns the fresh
 * analysis — which we drop straight into the cache so the advice updates at once.
 */
export function useAnswerFollowUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: string; answer: string }) =>
      apiFetch<CoachAnalysis>("/api/coach/followup", {
        method: "POST",
        body: JSON.stringify(vars),
      }),
    onSuccess: (fresh) => {
      qc.setQueryData(queryKeys.coach.analysis(), fresh);
      // A check-in answer changes shared daily metrics other views read.
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
    },
  });
}

/** Record how the athlete reacted to the advice (adapts the begeleidingsprofiel). */
export function useCoachFeedback() {
  return useMutation({
    mutationFn: (signal: CoachFeedbackSignal) =>
      apiFetch<{ ok: boolean }>("/api/coach/feedback", {
        method: "POST",
        body: JSON.stringify({ signal }),
      }),
  });
}
