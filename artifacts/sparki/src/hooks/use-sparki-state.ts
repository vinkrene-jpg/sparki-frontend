import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// Frontend client for the generic State Engine. The engine itself lives in the
// api-server package (no screen owns it); this hook is the shared read path that
// ANY surface can use — Vandaag, Training, Races, coach views, widgets, Sparki
// Display. It depends on nothing from Vandaag. Below is a local mirror of the
// engine's SparkiState contract (the read-only shape the UI relies on).

export type StateBand = "belastbaar" | "solide" | "wisselend" | "kwetsbaar";

export type MovementDirection = "stijgend" | "stabiel" | "dalend" | "onbekend";

export type StateSignal = {
  kind: string;
  label: string;
  reading: string;
  tone: "positive" | "concern" | "neutral";
};

export type StateAction = {
  label: string;
  reason: string;
};

export type SparkiState = {
  date: string;
  athleteName: string;
  x: number;
  y: number;
  band: StateBand;
  tension: number;
  distortion: number;
  movement: { direction: MovementDirection; label: string };
  confidence: number;
  confidenceLabel: string;
  status: string;
  action: StateAction | null;
  checkInDone: boolean;
  why: StateSignal[];
  missing: string[];
};

export function useSparkiState() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.state.current(),
    queryFn: () => apiFetch<SparkiState>("/api/state"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.live,
  });
}

/** The three honest check-in answers (mirror of the engine's missing_checkin). */
export type CheckInAnswer = "fris" | "oke" | "vermoeid";

/**
 * Today's check-in, straight from the State Card. It reuses the real follow-up
 * endpoint — a "fris/oké/vermoeid" answer is persisted as actual daily metrics —
 * then invalidates the state so the Core recomputes immediately from real data.
 */
export function useStateCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answer: CheckInAnswer) =>
      apiFetch<unknown>("/api/coach/followup", {
        method: "POST",
        body: JSON.stringify({ questionId: "missing_checkin", answer }),
      }),
    onSuccess: () => {
      // The check-in changes shared daily metrics every surface reads.
      void qc.invalidateQueries({ queryKey: queryKeys.state.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.coach.analysis() });
    },
  });
}
