import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

import { buildRideGpx } from "@/lib/ride-gpx";
import type {
  NearbyRoutesResponse,
  NearbySport,
} from "@/lib/nearby-filters";
import {
  enqueueRideUpload,
  getUploadQueue,
  processUploadQueue,
  type QueuedRide,
  type UploadOutcome,
} from "@/lib/upload-queue";
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
  /** Sport waarvoor de route bedoeld is ("cycling" | "hiking" | "walking" | …),
   * null bij oudere routes waarvan de sport niet bewijsbaar bekend is. */
  sport?: string | null;
  /** Routeversie — telt op bij inhoudelijke wijzigingen (Golf 19). */
  version?: number;
  /** 02c — gezet zodra de gratis bewaartermijn verstreken is (herstelbaar). */
  expiredAt?: string | null;
  /** 02c — tot wanneer de route bewaard blijft (null = geen termijn). */
  savedUntil?: string | null;
};

/** 02b — eerlijke stand van het gratis maandpotje (fiets+wandelen samen). */
export type RouteUsageStatus = {
  beperkt: boolean;
  gebruikt: number;
  limiet: number;
  bewaarLimiet: number;
  bewaard: number | null;
  ditGeteld: boolean | null;
  toegestaan: boolean;
};

export function useRouteUsageStatus(routeId: number | null) {
  return useQuery({
    queryKey: ["route-usage-status", routeId],
    enabled: routeId != null,
    queryFn: () =>
      customFetch<RouteUsageStatus>(
        `/api/routes/usage-status?routeId=${routeId}`,
        { method: "GET" },
      ),
  });
}

/**
 * 02b — meld na de rit welk deel van de route werkelijk is afgelegd
 * (fractie 0–1). Bij ≥20% telt de route deze maand als gebruikt.
 */
export function useMeldGeredenDekking() {
  return useMutation({
    mutationFn: ({ routeId, fractie }: { routeId: number; fractie: number }) =>
      customFetch<{ geteld: boolean }>(
        `/api/routes/${routeId}/gereden-dekking`,
        { method: "POST", body: JSON.stringify({ fractie }) },
      ),
  });
}

/** Route verwijderen (soft-delete met historie op de server). */
export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: number) =>
      customFetch<{ ok?: boolean }>(`/api/routes/${routeId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

/** 02c — een vervallen route terughalen (zelfde poorten als opslaan). */
export function useHerstelRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routeId: number) =>
      customFetch<{ hersteld: boolean }>(`/api/routes/${routeId}/herstel`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

/** Uitkomst van de verplichte navigatiestart-preflight (taak #505). */
export type NavStartResult =
  | { ok: true; version: number | null }
  /**
   * Server weigert bewust (409): route hard geblokkeerd of niet
   * controleerbaar — navigatie mag NIET starten (fail-closed).
   */
  | { ok: false; code: "ROUTE_BLOCKED" | "ROUTE_UNVERIFIABLE"; message: string }
  /**
   * Netwerk/serverfout zonder bewuste weigering: offline navigeren op de
   * bewaarde kopie blijft toegestaan (best-effort, geen weigering).
   */
  | { ok: true; version: null };

/**
 * Verplichte preflight vóór navigatie (taak #505, fail-closed): de backend
 * controleert de route blokkerend op blokkades en legt de gebruikte
 * routeversie vast. Een bewuste 409-weigering (ROUTE_BLOCKED /
 * ROUTE_UNVERIFIABLE) stopt de navigatie; een kale netwerkfout niet
 * (offline doorgaan op de bewaarde kopie blijft mogelijk).
 */
export async function meldNavigatieStart(
  routeId: number,
): Promise<NavStartResult> {
  try {
    const r = await customFetch<{ ok: boolean; version: number }>(
      `/api/routes/${routeId}/navigatie-start`,
      { method: "POST", responseType: "json" },
    );
    return { ok: true, version: typeof r.version === "number" ? r.version : null };
  } catch (err) {
    const anyErr = err as { status?: number; body?: { code?: string; error?: string } };
    const code = anyErr?.body?.code;
    if (
      anyErr?.status === 409 &&
      (code === "ROUTE_BLOCKED" || code === "ROUTE_UNVERIFIABLE")
    ) {
      return {
        ok: false,
        code,
        message:
          anyErr.body?.error ??
          "Deze route kan nu niet genavigeerd worden.",
      };
    }
    return { ok: true, version: null };
  }
}

export type RouteDetail = RouteSummary & {
  nav: RouteStep[] | null;
  geometry: RoutePathPoint[] | null;
  rationale: string | null;
  /** Genormaliseerd ECHT hoogteprofiel (downsampled ele-waarden) of null. */
  profile?: number[] | null;
  /** Gedetecteerde beklimmingen uit het echte hoogteprofiel, of null. */
  climbs?:
    | {
        name?: string | null;
        lengthKm?: number | null;
        avgGradePct?: number | null;
        summitKm?: number | null;
      }[]
    | null;
  /** Gebruiksdoel — "training" | "toertocht" | "wedstrijd". */
  usageType?: string;
  /**
   * Wedstrijdmodus-payload: alleen aanwezig bij usageType "wedstrijd" met een
   * gekoppelde geplande wedstrijd. Punten zijn UITSLUITEND door de renner
   * bevestigde/aangepaste punten — nooit onbevestigde AI-voorstellen.
   */
  race: RaceModePayload | null;
};

/** Bevestigd wedstrijdpunt zoals de kaartcontrole het opleverde. */
export type RacePointLite = {
  id: number;
  kind: string;
  pointClass: string;
  label: string;
  description: string | null;
  raceKm: number | null;
  lat: number | null;
  lng: number | null;
  status: string;
};

export type RaceModePayload = {
  id: number;
  name: string;
  raceDate: string;
  localLaps: number | null;
  assignment: string | null;
  points: RacePointLite[];
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

// Kaart-eerst routevoorstellen (taak #561): alle échte routes uit het eigen
// corpus rond een punt — eigen bewaard/plan, gereden kandidaten, gedeeld en
// openbaar (die laatste twee al privacy-afgeschermd door de server). Geen
// generatie; dun gebied = eerlijk weinig rijen. Filteren gebeurt client-side
// (lib/nearby-filters.ts) op deze lijst, dus de teller is live zonder
// server-bursts.
export function useNearbyRoutes(
  center: { lat: number; lon: number } | null,
  sport: NearbySport,
  radiusKm = 25,
) {
  return useQuery({
    queryKey: [
      "routes",
      "nearby",
      center ? `${center.lat.toFixed(3)},${center.lon.toFixed(3)}` : "geen",
      sport,
      radiusKm,
    ],
    enabled: center != null,
    staleTime: 60_000,
    queryFn: () =>
      customFetch<NearbyRoutesResponse>(
        `/api/routes/nearby?lat=${center!.lat}&lon=${center!.lon}&sport=${encodeURIComponent(sport)}&radiusKm=${radiusKm}`,
        { responseType: "json" },
      ),
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

// Antwoord van POST /api/routes/:id/rejoin — een ECHT gerouteerd verbindings-
// stuk (via de routedienst) terug naar de routelijn, nooit een rechte lijn.
export type RejoinResult = {
  mode: "terug" | "verder" | "bestemming";
  path: RoutePathPoint[];
  distanceKm: number;
  durationSec: number | null;
  nav: RouteStep[];
  rejoinKm: number;
};

/**
 * Herbereken een vervolg wanneer de renner van de route is geraakt:
 * "terug" = kortste echte weg terug naar de lijn, "verder" = logisch vervolg
 * naar een punt verderop. Fouten (geen routedienst, geen lijn) komen als
 * eerlijke Nederlandse meldingen van de backend en worden onveranderd getoond.
 */
export function useRejoinRoute(routeId: number | null) {
  return useMutation({
    mutationFn: async (input: {
      lat: number;
      lon: number;
      mode: "terug" | "verder" | "bestemming";
    }): Promise<RejoinResult> => {
      if (routeId == null) throw new Error("Geen route geopend.");
      return customFetch<RejoinResult>(`/api/routes/${routeId}/rejoin`, {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    },
  });
}

/** A single saved route including geometry + turn-by-turn nav. */
export function useRoute(id: number | null) {
  return useQuery({
    enabled: id != null,
    queryKey: ["route", id],
    queryFn: () =>
      customFetch<{ route: RouteDetail; race?: RaceModePayload | null }>(
        `/api/routes/${id}`,
        { responseType: "json" },
      ).then((r) => ({ ...r.route, race: r.race ?? null })),
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

/**
 * Importeer een GPX-bestand als route. Post de rauwe bestandsinhoud naar
 * hetzelfde POST /api/routes-eindpunt dat de webapp gebruikt: de server parse't
 * de GPX, berekent afstand/hoogte en ontdubbelt op inhoud. Serverfouten (bv.
 * een bestand zonder track) komen als eerlijke Nederlandse meldingen van de
 * backend terug en worden onveranderd getoond.
 */
export function useImportGpx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; name?: string }) =>
      customFetch<{ route: RouteSummary }>("/api/routes", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: input.content,
          ...(input.name ? { name: input.name } : {}),
        }),
      }).then((r) => r.route),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["routes"] });
    },
  });
}

// Shape returned by the shared activity-imports ingest endpoint.
export type ActivityImportResult = {
  import: { id: number; status: string };
  parsed: boolean;
  sessionId: number | null;
};

// Resultaat van een rit opslaan. `synced` is alleen true na een echte 2xx van
// de backend. Bij `synced: false` staat de rit veilig in de lokale wachtrij en
// wordt hij automatisch opnieuw geprobeerd — de rit is dan NIET verloren.
export type SaveRideResult = {
  synced: boolean;
  localId: string;
  sessionId: number | null;
  // Eerlijke uitleg wanneer de upload (nog) niet gelukt is.
  syncError: string | null;
};

/** De echte upload van één wachtrij-item naar de gedeelde backend. */
export async function uploadQueuedRide(entry: QueuedRide): Promise<UploadOutcome> {
  try {
    const res = await customFetch<ActivityImportResult>("/api/activity-imports", {
      method: "POST",
      responseType: "json",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: entry.fileName, content: entry.gpx }),
    });
    return { ok: true, sessionId: res.sessionId };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : "Uploaden is niet gelukt.",
    };
  }
}

/**
 * Save a recorded ride to the shared backend. The recorded GPS track is
 * serialized to GPX and posted to the SAME `/api/activity-imports` endpoint the
 * web app uses for file uploads, so the ride flows through the canonical Data
 * Hub: it becomes a real training session (distance/duration/geometry) that
 * every downstream analysis engine consumes. Nothing is fabricated — a track
 * with fewer than 2 real fixes cannot build a GPX and is rejected honestly.
 *
 * Betrouwbaarheid: de rit krijgt een lokaal rit-ID en gaat EERST de lokale
 * uploadwachtrij in (op disk). Daarna wordt direct één upload geprobeerd.
 * Lukt die niet (geen netwerk/serverfout), dan blijft de rit bewaard en wordt
 * hij later automatisch opnieuw geprobeerd. Het wachtrij-item wordt pas
 * verwijderd nadat de backend met een 2xx heeft bevestigd; de backend
 * ontdubbelt op bestandsinhoud, dus een dubbele poging levert nooit een
 * dubbele activiteit op.
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
      const name = input.name.trim() || "rit";
      const fileName = `${name}-${new Date().toISOString().slice(0, 10)}.gpx`;
      // Eerst veilig lokaal in de wachtrij — de rit kan hierna niet meer
      // verloren gaan, ook niet als de upload zo direct mislukt. Mislukt het
      // opslaan zelf, dan melden we dat eerlijk (de opname blijft in beeld).
      let localId: string;
      try {
        localId = await enqueueRideUpload({ fileName, gpx, name });
      } catch {
        throw new Error(
          "De rit kon niet op je telefoon worden bewaard (opslag vol of niet beschikbaar). Laat dit scherm open en probeer het opnieuw.",
        );
      }
      const result = await processUploadQueue(uploadQueuedRide, { force: true });
      const synced = result.uploaded.includes(localId);
      if (synced) {
        return {
          synced: true,
          localId,
          sessionId: result.lastSessionId,
          syncError: null,
        };
      }
      const queue = await getUploadQueue();
      const entry = queue.find((e) => e.localId === localId);
      return {
        synced: false,
        localId,
        sessionId: null,
        syncError:
          entry?.lastError ??
          "Uploaden is nu niet gelukt. De rit staat veilig op je telefoon en wordt automatisch opnieuw geprobeerd.",
      };
    },
    onSuccess: (res) => {
      if (!res.synced) return;
      qc.invalidateQueries({ queryKey: ["routes"] });
      // The saved ride becomes a backend training session; refresh the ride
      // list so the measured sensor values show up immediately.
      qc.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
