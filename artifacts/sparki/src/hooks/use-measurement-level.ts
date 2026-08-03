// TRAINEN_DOELEN_SEIZOEN_01 F2 — meetniveau (as 2: wat komt er binnen).
// Zelf te kiezen, met uitleg wat elk niveau oplevert. Server is de SSOT.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { STALE } from "@/lib/query-keys";

export type MeasurementLevel = "pro" | "hartslag" | "tijd_gevoel" | "aanwezigheid";

export type MeasurementLevelResponse = {
  measurementLevel: MeasurementLevel | null;
  levels: Record<MeasurementLevel, { label: string; uitleg: string }>;
};

const KEY = ["athlete", "measurement-level"] as const;

export function useMeasurementLevel() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: KEY,
    queryFn: () =>
      apiFetch<MeasurementLevelResponse>("/api/athlete/measurement-level"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}

export function useSetMeasurementLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (measurementLevel: MeasurementLevel) =>
      apiFetch<{ measurementLevel: MeasurementLevel }>(
        "/api/athlete/measurement-level",
        { method: "PUT", body: JSON.stringify({ measurementLevel }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      // Per-rit meldingen hangen van de keuze af.
      void qc.invalidateQueries({ queryKey: ["athlete", "session-detail"] });
    },
  });
}
