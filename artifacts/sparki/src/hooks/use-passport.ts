// Golf 20 — Sportpaspoort: samengesteld paspoort, ontwikkelingsbeeld,
// waarde-invoer met herkomst, voorstellen en export.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type PassportFieldView = {
  field: string;
  label: string;
  unit: string | null;
  value: string | null;
  origin: "gemeten" | "handmatig" | "berekend" | "geschat" | "onbekend";
  source: string | null;
  since: string | null;
  confidence: number | null;
  estimated: boolean;
  stale: boolean;
  zonesAffecting: boolean;
};

export type PassportProposal = {
  id: number;
  field: string;
  proposedValue: string;
  currentValue: string | null;
  origin: string;
  source: string | null;
  reason: string;
  status: string;
  createdAt: string;
};

export type PassportEvent = {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  origin: string;
  source: string | null;
  actorType: string;
  measuredAt: string | null;
  note: string | null;
  createdAt: string;
};

export type Passport = {
  fields: PassportFieldView[];
  history: PassportEvent[];
  proposals: PassportProposal[];
  quality: {
    missing: string[];
    estimated: string[];
    stale: string[];
    unknownOrigin: string[];
    staleAfterDays: number;
  };
};

export type PassportOntwikkeling = {
  reliable: boolean;
  reliableReason: string | null;
  ftpSeries: Array<{ measuredAt: string; ftpWatts: number; testType: string }>;
  weightSeries: Array<{ date: string; weightKg: number | null }>;
  powerBests: Record<string, { watts: number; date: string }>;
  sessionCount: number;
};

export function usePassport() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.athlete.passport(),
    queryFn: () => apiFetch<Passport>("/api/passport"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}

export function usePassportOntwikkeling(enabled: boolean) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.athlete.passportOntwikkeling(),
    queryFn: () => apiFetch<PassportOntwikkeling>("/api/passport/ontwikkeling"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: STALE.profile,
  });
}

function invalidatePassport(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: queryKeys.athlete.passport() });
  void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
  void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
  void qc.invalidateQueries({ queryKey: queryKeys.athlete.ftpHistory() });
}

export function useSavePassportValue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      field: string;
      value: string | number | null;
      origin?: "gemeten" | "handmatig";
      source?: string;
      measuredAt?: string;
      note?: string;
    }) =>
      apiFetch<{ ok: true; changed: boolean }>("/api/passport/waarde", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => invalidatePassport(qc),
  });
}

export function useDecideProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { id: number; besluit: "geaccepteerd" | "afgewezen" }) =>
      apiFetch<{ ok: true; status: string }>(
        `/api/passport/voorstellen/${data.id}/besluit`,
        { method: "POST", body: JSON.stringify({ besluit: data.besluit }) },
      ),
    onSuccess: () => invalidatePassport(qc),
  });
}

export function useExportPassport() {
  return useMutation({
    mutationFn: (sections: string[]) =>
      apiFetch<{ export: Record<string, unknown>; defaultOff: string[] }>(
        "/api/passport/export",
        { method: "POST", body: JSON.stringify({ sections }) },
      ),
  });
}
