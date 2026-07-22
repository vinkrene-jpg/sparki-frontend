// Golf 14 — releaseberichten + pilotstatus vanuit de gebruiker gezien.
// Berichten verschijnen alleen rustig op Vandaag; lezen markeert ze weg.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ReleaseNote = {
  id: number;
  title: string;
  body: string;
  publishedAt: string | null;
  read: boolean;
};

export type PilotStatus = {
  releaseGroup: string;
  inPilot: boolean;
  termsVersion: string;
  consentGiven: boolean;
  consentAt: string | null;
};

const NOTES_KEY = ["release", "notes"] as const;
const PILOT_KEY = ["release", "pilot-status"] as const;

export function useReleaseNotes(enabled = true) {
  return useQuery({
    queryKey: NOTES_KEY,
    queryFn: () => apiFetch<{ notes: ReleaseNote[] }>("/api/release/notes"),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useMarkReleaseNoteRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: boolean }>(`/api/release/notes/${id}/read`, {
        method: "POST",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function usePilotStatus(enabled = true) {
  return useQuery({
    queryKey: PILOT_KEY,
    queryFn: () => apiFetch<PilotStatus>("/api/release/pilot-status"),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useAcceptPilotConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>("/api/release/pilot-consent", {
        method: "POST",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PILOT_KEY }),
  });
}
