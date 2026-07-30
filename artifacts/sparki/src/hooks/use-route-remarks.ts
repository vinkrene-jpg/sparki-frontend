// Routeopmerkingen: echte waarschuwingen/bijzonderheden op de route uit
// OpenStreetMap-tags (veerpont, trap, poort, onverhard, slecht wegdek,
// beperkte toegang, natuurgebied, voorde). De server verzint nooit iets; een
// fout is een eerlijk foutbeeld, geen lege "alles ok"-lijst.

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type RouteRemarkKind =
  | "veerpont"
  | "trap"
  | "poort"
  | "onverhard"
  | "slecht_wegdek"
  | "beperkte_toegang"
  | "natuurgebied"
  | "doorwaadbare_plaats";

export type RouteRemark = {
  id: string;
  kind: RouteRemarkKind;
  label: string;
  detail: string;
  lat: number;
  lon: number;
  routeKm: number;
  endKm: number | null;
  offRouteM: number;
  uncertain: boolean;
  evidence: string;
};

// Blokkade-samenvatting van de server (zelfde meting als de opmerkingen):
// fietsverbod, trap en afgesloten poort/privéterrein zijn hard — een route
// met `hard: true` mag nooit als "Klaar" of navigeerbaar getoond worden.
export type RouteBlockage = {
  steps: number;
  forbidden: number;
  blockedGates: number;
  gates: number;
  unpavedSegments: number;
  hard: boolean;
};

export type RouteRemarksResponse = {
  /**
   * Verificatiestatus van de server (taak #505, fail-closed): geslaagde
   * meting zonder blokkade = "verified_clear", met blokkade = "hard_blocked".
   * Mislukte meting geeft nooit een 200 (dus geen veld) maar een 502.
   */
  verification?: "verified_clear" | "hard_blocked"
  remarks: RouteRemark[] | null;
  dataRemarks: { label: string; detail: string }[];
  blockage?: RouteBlockage;
  source: { name: string; license: string; url: string; note: string };
};

const STALE_MS = 30 * 60_000;

export function useRouteRemarks(routeId: number | null) {
  return useQuery({
    queryKey: ["route-remarks", routeId ?? 0],
    enabled: routeId != null,
    staleTime: STALE_MS,
    retry: 1,
    queryFn: () =>
      apiFetch<RouteRemarksResponse>(`/api/routes/${routeId}/remarks`),
  });
}

// Voor een nog niet opgeslagen route in de routebouwer: de echte
// provider-geometrie gaat mee naar de server. De sleutel is een compacte
// vingerafdruk van de geometrie zodat een herberekende route opnieuw laadt.
export function useRouteRemarksPreview(
  geometry: [number, number][] | null | undefined,
) {
  const g = geometry && geometry.length >= 2 ? geometry : null;
  const key = g
    ? `${g.length}:${g[0]![0].toFixed(4)},${g[0]![1].toFixed(4)}:${g[g.length - 1]![0].toFixed(4)},${g[g.length - 1]![1].toFixed(4)}:${g[Math.floor(g.length / 2)]![0].toFixed(4)}`
    : "none";
  return useQuery({
    queryKey: ["route-remarks-preview", key],
    enabled: g != null,
    staleTime: STALE_MS,
    retry: 1,
    queryFn: () =>
      apiFetch<RouteRemarksResponse>("/api/routes/remarks-preview", {
        method: "POST",
        body: JSON.stringify({ geometry: g }),
      }),
  });
}
