import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

import type { RoutePathPoint, RouteStep } from "@/lib/routes-api";
import type { Meetpoint } from "@/lib/volgauto-meet";

// Volgauto-API (Opdracht 3). De fietsroute-endpoints blijven onaangeraakt;
// alles hier leeft onder /api/routes/:id/volgauto.

// Serverbrede contractvorm (zie lib/db schema volgauto.ts): segmenten heten
// "gedeeld"/"gescheiden" met startKm/endKm; aansluitpunten dragen name/source.
export type VolgautoSegment = {
  kind: "gedeeld" | "gescheiden";
  startKm: number;
  endKm: number;
};

type ApiMeetpoint = {
  lat: number;
  lon: number;
  bikeKm: number;
  carKm: number | null;
  name: string;
  source: "parkeerplaats" | "route";
};

export type VolgautoPlan = {
  enabled: boolean;
  carGeometry: RoutePathPoint[] | null;
  carNav: RouteStep[] | null;
  carDistanceKm: number | null;
  carDurationSec: number | null;
  segments: VolgautoSegment[];
  meetpoints: Meetpoint[];
  dataNotes: string[];
  routeVersion: number | null;
  outdated?: boolean;
  disclaimer: string;
};

/** Volgautoplan van een route (null wanneer de instelling uit staat). */
export function useVolgautoPlan(routeId: number | null) {
  return useQuery({
    enabled: routeId != null,
    staleTime: 5 * 60_000,
    queryKey: ["volgauto-plan", routeId],
    queryFn: () =>
      customFetch<{
        plan: (Omit<VolgautoPlan, "meetpoints"> & { meetpoints: ApiMeetpoint[] }) | null;
      }>(`/api/routes/${routeId}/volgauto`, { responseType: "json" }).then(
        (r): VolgautoPlan | null =>
          r.plan
            ? {
                ...r.plan,
                meetpoints: r.plan.meetpoints.map(
                  (m): Meetpoint => ({
                    bikeKm: m.bikeKm,
                    carKm: m.carKm,
                    lat: m.lat,
                    lon: m.lon,
                    kind: m.source,
                    label: m.name,
                  }),
                ),
              }
            : null,
      ),
  });
}

export type VolgautoRejoinResult = {
  path: RoutePathPoint[];
  distanceKm: number;
  durationSec: number | null;
  nav: RouteStep[];
  profile: string;
  disclaimer: string;
};

/**
 * Autoroute-herberekening voor de VOLGAUTO — altijd met het autoprofiel,
 * nooit via fietspaden. Optioneel doelpunt = het actieve aansluitpunt.
 */
export function useVolgautoRejoin(routeId: number | null) {
  return useMutation({
    mutationFn: async (input: {
      lat: number;
      lon: number;
      targetLat?: number;
      targetLon?: number;
    }): Promise<VolgautoRejoinResult> => {
      if (routeId == null) throw new Error("Geen route geopend.");
      return customFetch<VolgautoRejoinResult>(
        `/api/routes/${routeId}/volgauto/rejoin`,
        {
          method: "POST",
          responseType: "json",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
    },
  });
}

/**
 * Best-effort positie delen; mislukken blokkeert navigatie nooit. Geeft terug
 * of het versturen lukte, zodat de afzender eerlijk kan tonen dat het delen
 * hapert (i.p.v. stilletjes te doen alsof de ander je positie ziet).
 */
export async function postVolgautoPosition(
  routeId: number,
  input: { role: "renner" | "volgauto"; lat: number; lon: number; speedMps: number | null },
): Promise<boolean> {
  try {
    await customFetch(`/api/routes/${routeId}/volgauto/position`, {
      method: "POST",
      responseType: "json",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return true;
  } catch {
    return false;
  }
}

export type VolgautoPosition = {
  role: string;
  lat: number;
  lon: number;
  speedMps: number | null;
  updatedAt: string;
};

/** Recente positie(s) van de ANDERE rol; verouderd = eerlijk leeg. */
export function useVolgautoPositions(
  routeId: number | null,
  role: "renner" | "volgauto",
  enabled: boolean,
) {
  return useQuery({
    enabled: routeId != null && enabled,
    refetchInterval: 20_000,
    queryKey: ["volgauto-positions", routeId, role],
    queryFn: () =>
      customFetch<{ positions: VolgautoPosition[] }>(
        `/api/routes/${routeId}/volgauto/positions?role=${role}`,
        { responseType: "json" },
      ).then((r) => r.positions),
  });
}

// Moet 1-op-1 overeenkomen met `volgautoReportKinds` in lib/db (de server
// weigert andere waarden met 400).
export const VOLGAUTO_REPORT_KINDS = [
  { kind: "weg_afgesloten", label: "Weg was afgesloten" },
  { kind: "verboden_voor_autos", label: "Verboden voor auto's" },
  { kind: "niet_praktisch", label: "Route was niet praktisch" },
  { kind: "wachtpunt_ongeschikt", label: "Aansluitpunt ongeschikt" },
] as const;

/**
 * Melding na de rit. De backend behandelt dit uitdrukkelijk als
 * gebruikersmelding die gecontroleerd moet worden — géén universele waarheid.
 */
export function useVolgautoReport(routeId: number | null) {
  return useMutation({
    mutationFn: async (input: {
      kind: string;
      note?: string;
      lat?: number;
      lon?: number;
    }): Promise<{ uitleg: string }> => {
      if (routeId == null) throw new Error("Geen route geopend.");
      return customFetch<{ uitleg: string }>(
        `/api/routes/${routeId}/volgauto/reports`,
        {
          method: "POST",
          responseType: "json",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
    },
  });
}
