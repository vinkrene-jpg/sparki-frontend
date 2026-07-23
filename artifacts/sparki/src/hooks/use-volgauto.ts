// Volgauto (Opdracht 3) — instelling + plan per route.
//
// De fietsroute blijft altijd intact; het volgautoplan is een aparte laag met
// een eigen autoroute, vergelijking (gedeeld/gesplitst) en aansluitpunten.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Contractvorm van de server (lib/db schema volgauto.ts).
export type VolgautoSegment = {
  kind: "gedeeld" | "gescheiden";
  startKm: number;
  endKm: number;
};

export type VolgautoMeetpoint = {
  bikeKm: number;
  carKm: number | null;
  lat: number;
  lon: number;
  name: string;
  source: "parkeerplaats" | "route";
};

export type VolgautoPlan = {
  enabled: boolean;
  carGeometry: [number, number][] | null;
  carNav: { km: number; dir: string; note: string }[] | null;
  carDistanceKm: number | null;
  carDurationSec: number | null;
  segments: VolgautoSegment[];
  meetpoints: VolgautoMeetpoint[];
  dataNotes: string[];
  routeVersion: number | null;
  computedAt?: string | null;
  outdated?: boolean;
  disclaimer: string;
};

export function useVolgautoPlan(routeId: number | null) {
  return useQuery({
    enabled: routeId != null,
    queryKey: ["volgauto-plan", routeId],
    queryFn: () =>
      apiFetch<{ plan: VolgautoPlan | null }>(
        `/api/routes/${routeId}/volgauto`,
      ).then((r) => r.plan),
  });
}

/** Instelling aanzetten (berekent/verniewt het plan) of uitzetten. */
export function useSetVolgauto(routeId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (routeId == null) throw new Error("Geen route geopend.");
      if (enabled) {
        return apiFetch<{ plan: VolgautoPlan }>(
          `/api/routes/${routeId}/volgauto`,
          { method: "POST" },
        ).then((r) => r.plan);
      }
      await apiFetch(`/api/routes/${routeId}/volgauto`, { method: "DELETE" });
      return null;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["volgauto-plan", routeId] });
    },
  });
}
