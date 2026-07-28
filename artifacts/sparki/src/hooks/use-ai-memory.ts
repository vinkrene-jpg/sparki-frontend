import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ObservationSignal = {
  kind: "training" | "sleep" | "recovery" | "race" | "feedback" | "memory";
  label: string;
  value: string;
  date?: string;
};

export type AiObservation = {
  id: number;
  sourceType: string;
  title: string;
  summary: string | null;
  observationText: string;
  confidence: "low" | "medium" | "high";
  category: string;
  severity: "info" | "watch" | "important" | "urgent";
  detectedPattern: string | null;
  signals: ObservationSignal[] | null;
  alternativeExplanations: string[] | null;
  confidenceScore: string | null;
  recommendedAction: string | null;
  status: "new" | "acknowledged" | "saved" | "dismissed" | "outdated";
  // Verantwoording: welke engine/regel/versie deze conclusie maakte en welke
  // data daarbij ontbrak.
  engine: string | null;
  ruleKey: string | null;
  engineVersion: string | null;
  missingData: string[] | null;
  createdAt: string;
};

export type ConnectionAnalysisResult = {
  windowDays: number;
  derived: number;
  created: number;
  deduped: number;
  gated: number;
};

// Trigger Sparki's cross-domain connection analysis, then refresh the memory.
export function useRunConnections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ConnectionAnalysisResult>("/api/ai/connections", {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.aiMemory.observations(),
      });
    },
  });
}

export type ReadinessStep = {
  id: "trainingen" | "gevoel_slaap" | "ochtendmetingen" | "feedback";
  titel: string;
  uitleg: string;
  heb: number;
  nodig: number;
  klaar: boolean;
  actie: "logtraining" | "checkin" | "feedback";
};

export type ConnectionReadiness = {
  windowDays: number;
  analyseMogelijk: boolean;
  stappen: ReadinessStep[];
};

// Eerlijk stappenplan: wat is er al en wat is er minimaal nodig voordat de
// verbanden-analyse iets kán opleveren.
export function useConnectionReadiness(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.aiMemory.connectionReadiness(),
    queryFn: () =>
      apiFetch<ConnectionReadiness>("/api/ai/connections/readiness"),
    enabled: enabled && (DEV_PREVIEW || !!isSignedIn),
    staleTime: 60_000,
  });
}

type ObservationsResponse = {
  observations: AiObservation[];
  groups: Record<string, AiObservation[]>;
};

export function useObservations(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.aiMemory.observations(),
    queryFn: () => apiFetch<ObservationsResponse>("/api/ai/observations"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

export function useUpdateObservation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: AiObservation["status"] }) =>
      apiFetch<{ observation: AiObservation }>(`/api/ai/observations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.aiMemory.observations(),
      });
    },
  });
}

export type AiPreferences = {
  communicationStyle: "direct" | "supportive" | "analytical" | "concise" | "detailed";
  coachingIntensity: "low" | "normal" | "high";
  explanationLevel: "simple" | "normal" | "expert";
  humorLevel: "uit" | "subtiel" | "normaal" | "uitgesproken";
  sensitiveTopics: string[];
  preferredUnits: string;
};

export function useAiPreferences(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.aiMemory.preferences(),
    queryFn: () =>
      apiFetch<{ preferences: AiPreferences }>("/api/ai/preferences"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateAiPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: Partial<AiPreferences>) =>
      apiFetch<{ preferences: AiPreferences }>("/api/ai/preferences", {
        method: "PUT",
        body: JSON.stringify(prefs),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.aiMemory.preferences() });
    },
  });
}
