import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

import { buildRideGpx } from "@/lib/ride-gpx";
import type { RidePoint, RideSensorSample } from "@/hooks/useRideRecorder";

// Turn-by-turn cue as stored by the backend routing engine.
export type RouteStep = { km: number; dir: string; note: string };

// A single path point: [lat, lon].
export type RoutePathPoint = [number, number];

export type RouteSummary = {
  id: number;
  name: string;
  surface: string;
  status: string;
  visibility: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  durationSec: number | null;
  source: string;
  createdAt: string;
};

export type RouteDetail = RouteSummary & {
  nav: RouteStep[] | null;
  geometry: RoutePathPoint[] | null;
  rationale: string | null;
};

// Wegobject langs de route (Sparki Traffic Database) — verkeerslichten en
// spoorwegovergangen met hun positie langs de routelijn.
export type RouteRoadObject = {
  id: number;
  kind: string;
  lat: number;
  lon: number;
  roadName: string | null;
  confidence: number;
  routeKm: number;
};

export type RouteRoadObjects = {
  available: boolean;
  reason?: string;
  objects?: RouteRoadObject[];
  counts?: Record<string, number>;
  estimatedTimeLossSec?: number | null;
};

/**
 * Bekende wegobjecten langs een route (echte OSM- en detectiedata uit de
 * eigen database; nooit verzonnen). Niet-blokkerend voor navigatie: bij een
 * fout blijft de HUD gewoon zonder verkeerslicht-regel werken.
 */
export function useRouteRoadObjects(id: number | null) {
  return useQuery({
    enabled: id != null,
    staleTime: 10 * 60_000,
    queryKey: ["route-road-objects", id],
    queryFn: () =>
      customFetch<RouteRoadObjects>(`/api/road-objects/along-route/${id}`, {
        responseType: "json",
      }),
  });
}

/** All saved routes for the signed-in athlete (owner-scoped by the backend). */
export function useRoutes() {
  return useQuery({
    queryKey: ["routes"],
    queryFn: () =>
      customFetch<{ routes: RouteSummary[] }>("/api/routes?limit=50", {
        responseType: "json",
      }).then((r) => r.routes),
  });
}

/** A single saved route including geometry + turn-by-turn nav. */
export function useRoute(id: number | null) {
  return useQuery({
    enabled: id != null,
    queryKey: ["route", id],
    queryFn: () =>
      customFetch<{ route: RouteDetail }>(`/api/routes/${id}`, {
        responseType: "json",
      }).then((r) => r.route),
  });
}

/**
 * Save a RIDDEN ride (via its activity import) as a re-ridable route. Calls
 * the shared POST /api/routes/from-activity endpoint: the route geometry comes
 * from the real GPS track stored at ingest — the backend honestly refuses
 * (422) when the import carries no track, and we surface that message as-is.
 */
export function useSaveRideAsRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { importId: number; name?: string }) =>
      customFetch<{ route: RouteSummary }>("/api/routes/from-activity", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.route),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

// Shape returned by the shared activity-imports ingest endpoint.
export type SaveRideResult = {
  import: { id: number; status: string };
  parsed: boolean;
  sessionId: number | null;
};

/**
 * Save a recorded ride to the shared backend. The recorded GPS track is
 * serialized to GPX and posted to the SAME `/api/activity-imports` endpoint the
 * web app uses for file uploads, so the ride flows through the canonical Data
 * Hub: it becomes a real training session (distance/duration/geometry) that
 * every downstream analysis engine consumes. Nothing is fabricated — a track
 * with fewer than 2 real fixes cannot build a GPX and is rejected honestly.
 */
export function useSaveRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      points: RidePoint[];
      name: string;
      note?: string;
      // Real Bluetooth sensor readings logged during the ride (watts / heart
      // rate / cadence). Written into the GPX as standard track-point
      // extensions so the backend session gets real power/HR data. Optional —
      // a ride without sensors stays a plain GPS track.
      sensorSamples?: RideSensorSample[];
    }): Promise<SaveRideResult> => {
      const gpx = buildRideGpx(
        input.points,
        input.name,
        input.note,
        input.sensorSamples,
      );
      if (!gpx) {
        throw new Error(
          "Deze rit heeft te weinig locatiepunten om op te slaan.",
        );
      }
      const fileName = `${input.name.trim() || "rit"}-${new Date()
        .toISOString()
        .slice(0, 10)}.gpx`;
      return customFetch<SaveRideResult>("/api/activity-imports", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileName, content: gpx }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
      // The saved ride becomes a backend training session; refresh the ride
      // list so the measured sensor values show up immediately.
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
