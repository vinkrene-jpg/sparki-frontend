// AI_COACH §4.2 — Proactieve coach-triggers: leespad voor de client.
//
// Hetzelfde request-patroon als use-today: één query per sessie, geen polling.
// De server zelf handelt de pacing (§4.1-guard) en idempotentie af.

import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type ProactiveTrigger = {
  /** Stabel trigger-ID (bijv. "derde_harde_dag") */
  triggerId: string;
  /** Korte Nederlandse titel voor de kaart */
  title: string;
  /** Openende coachboodschap */
  message: string;
  /** Herinnering die de trigger activeerde, of null */
  memoryObservationId: number | null;
  /** Dossier-ID voor doorklik naar bronnen (§4.3) */
  dossierId: number;
};

type ProactiveTriggerResponse = {
  trigger: ProactiveTrigger | null;
};

export function useProactiveTrigger() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.aiMemory.proactiveTrigger(),
    queryFn: () => apiFetch<ProactiveTriggerResponse>("/api/ai/proactive-trigger"),
    // Eén keer per sessie ophalen; de server vuurt hoogstens één trigger per dag.
    staleTime: STALE.session,
    enabled: !!isSignedIn,
    // Fouten zijn stil: als de trigger-check faalt, tonen we niets
    // (eerlijk stil, nooit een foutmelding voor een optionele coach-kaart).
    throwOnError: false,
    retry: 1,
  });
}
