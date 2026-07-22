import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Feedbacklus op analyses en adviezen. Idempotent: één oordeel per persoon per
// onderwerp — opnieuw klikken vervangt het eerdere oordeel.

export type AnalysisFeedbackVerdict =
  | "nuttig"
  | "al_bekend"
  | "niet_relevant"
  | "onjuist"
  | "opgevolgd"
  | "niet_opgevolgd";

export type AnalysisFeedbackSubjectType =
  | "observation"
  | "coach_analysis"
  | "recovery_advice"
  | "plan_adjustment"
  | "coach_proposal"
  | "state";

export type AnalysisFeedbackRow = {
  id: number;
  subjectType: AnalysisFeedbackSubjectType;
  subjectKey: string;
  verdict: AnalysisFeedbackVerdict;
  reasonCode: string | null;
  reasonText: string | null;
  actionKind: string | null;
  updatedAt: string;
};

export function useAnalysisFeedbackFor(
  subjectType: AnalysisFeedbackSubjectType,
  subjectKeys: string[],
) {
  return useQuery({
    queryKey: ["analysis-feedback", subjectType, subjectKeys.join(",")],
    enabled: subjectKeys.length > 0,
    queryFn: () =>
      apiFetch<{ feedback: AnalysisFeedbackRow[] }>(
        `/api/analysis-feedback?subjectType=${subjectType}&subjectKeys=${encodeURIComponent(subjectKeys.join(","))}`,
      ),
  });
}

export function useGiveAnalysisFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      subjectType: AnalysisFeedbackSubjectType;
      subjectKey: string;
      verdict: AnalysisFeedbackVerdict;
      reasonCode?: string;
      reasonText?: string;
      actionKind?: string;
      context?: Record<string, unknown>;
    }) =>
      apiFetch<{ feedback: AnalysisFeedbackRow }>("/api/analysis-feedback", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["analysis-feedback"] });
    },
  });
}
