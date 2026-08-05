import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";

// ANALYSE_UITBREIDING §3/§4 — analyse op verzoek. Dezelfde selectie over
// dezelfde periode geeft hetzelfde antwoord (server dwingt dat af via een
// digest-cache); de daglimiet is zichtbaar.

export const ANALYSE_KAARTEN = [
  { key: "belastingsverloop", label: "Belastingsverloop" },
  { key: "opbouwsnelheid", label: "Opbouwsnelheid" },
  { key: "ontkoppeling", label: "Ontkoppeling" },
  { key: "efficientie", label: "Efficiëntie" },
  { key: "slaap", label: "Slaap" },
] as const;
export type AnalyseKaartKey = (typeof ANALYSE_KAARTEN)[number]["key"];

export type AnalyseRij = {
  id: number;
  kaarten: AnalyseKaartKey[];
  periodeDays: number;
  tekst: string;
  adviceDossierId: number | null;
  createdAt: string;
};

export type AnalysesData = {
  analyses: AnalyseRij[];
  gebruiktVandaag: number;
  limiet: number;
};

const KEY = ["athlete", "analyses"] as const;

export function useAnalyses() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<AnalysesData>("/api/athlete/analyses"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 60_000,
  });
}

export function useVraagAnalyse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kaarten: AnalyseKaartKey[]; periodeDays: number }) =>
      apiFetch<{
        analyse: AnalyseRij;
        hergebruikt: boolean;
        gebruiktVandaag: number;
        limiet: number;
      }>("/api/athlete/analyses", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
