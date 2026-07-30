import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch, API_BASE } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type RouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
  // Cumulative km position of the climb's summit (top) along the route. Newer
  // field — older stored climbs may omit it, so treat it as optional.
  summitKm?: number;
};

export type RouteNavCue = {
  km: number;
  dir: string;
  note: string;
}

// A user-placed shaping point for an interactive route: [lat, lon].
export type RouteWaypoint = [number, number]

// A named meeting point ("verzamelpunt") the user drops along/near the route.
export type RouteMeetpoint = {
  lat: number
  lon: number
  name: string
  note: string | null
};

export type SparkiRoute = {
  id: number;
  clerkId: string;
  name: string;
  surface: string;
  status: string;
  visibility: string;
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  profile: number[] | null;
  climbs: RouteClimb[] | null;
  nav: RouteNavCue[] | null;
  geometry: [number, number][] | null;
  waypoints: RouteWaypoint[] | null;
  meetpoints: RouteMeetpoint[] | null;
  rationale: string | null;
  source: string;
  usageType: string | null;
  linkedActivityImportId: number | null;
  linkedPlannedWorkoutId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Sport = "cycling" | "running" | "walking" | "hiking";
export type BikeType = "racefiets" | "mtb" | "gravel";
export type ElevationPreference = "flat" | "hilly" | "any";

export type GenerateRouteInput = {
  mode: "loop" | "ptp" | "waypoints";
  startLat?: number;
  startLon?: number;
  sport: Sport;
  bikeType?: BikeType;
  elevationPreference?: ElevationPreference;
  trainingType?: string;
  plannedWorkoutId?: number;
  targetDistanceKm?: number;
  endLat?: number;
  endLon?: number;
  destinationText?: string;
  // Ordered [lat, lon] points for an interactive (waypoints) route.
  waypoints?: RouteWaypoint[];
  seed?: number;
  // Free-text wish for the route ("langs de rivier", "vermijd drukke wegen").
  wish?: string;
  // Onverhard-voorkeur (0..100, alleen gravel/MTB): gewenst percentage
  // onverhard — een voorkeur voor de kandidaatselectie, nooit een garantie.
  // Racefiets: niet meesturen (server negeert het; harde 0%-grens).
  unpavedPreferencePct?: number;
  // Vermijd drukke N-wegen (taak #462): voorkeur-straf in de routemotor op
  // doorgaande wegen (road_class primary/secondary) zonder vrijliggend
  // fietspad. Een voorkeur, geen garantie — het eerlijke resultaat komt terug
  // in `avoidReport` op de kandidaat.
  avoidBusyRoads?: boolean;
};

// Eerlijk rapport over vermijd-voorkeuren: wat is echt toegepast en wat kon de
// routebron in dit gebied niet waarmaken (inclusief reden). Nooit stil.
export type AvoidReport = {
  toegepast: string[];
  nietMogelijk: { wens: string; reden: string }[];
};

export type RouteCandidate = {
  candidateId: string;
  name: string;
  surface: string;
  sport: Sport;
  bikeType: BikeType | null;
  routingProfile: string;
  trainingType: string;
  mode: "loop" | "ptp" | "waypoints";
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: RouteClimb[];
  nav: RouteNavCue[];
  geometry: [number, number][];
  waypoints: RouteWaypoint[];
  rationale: string;
  startName: string | null;
  endName: string | null;
  plannedWorkoutId: number | null;
  targetDistanceKm: number | null;
  // Eerlijk vermijd-rapport (o.a. drukke N-wegen, taak #462). Afwezig bij
  // oudere responses.
  avoidReport?: AvoidReport;
  // Extra echte voorstellen uit dezelfde generatieronde (kaart-planner):
  // kandidaten die de motor toch al bouwde en die écht anders lopen dan de
  // winnaar. Leeg/afwezig bij cache-hits of te gelijkende kandidaten.
  alternates?: RouteCandidate[];
};

export type GeocodeResult = { lat: number; lon: number; label: string };

// Forward-geocode an address to coordinate candidates (best-first). Used by the
// home-location picker. Triggered on demand (search button / debounce), never
// auto-run, so it is a mutation rather than a query.
export function useGeocode() {
  return useMutation({
    mutationFn: (query: string) =>
      apiFetch<{ results: GeocodeResult[] }>(
        `/api/routes/geocode?q=${encodeURIComponent(query)}`,
      ),
  });
}

// The athlete's own realistic pace (median avg speed of representative recent
// rides). personalKph is null when there is not enough real ride data — the UI
// must say so honestly instead of pretending.
export type RoutePace = {
  personalKph: number | null;
  sampleCount: number;
  windowDays: number;
};

export function useRoutePace() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["routes", "pace"],
    queryFn: () => apiFetch<RoutePace>("/api/routes/pace"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoutes() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.routes.list(),
    queryFn: () => apiFetch<{ routes: SparkiRoute[] }>("/api/routes?limit=30"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

// Routes saved against a specific planned workout. Used to surface the attached
// route on the training/home session view ("open today's session, see the route
// to ride"). Disabled when no workout id is available.
export function useWorkoutRoutes(plannedWorkoutId: number | null | undefined) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.routes.byWorkout(plannedWorkoutId ?? 0),
    queryFn: () =>
      apiFetch<{ routes: SparkiRoute[] }>(
        `/api/routes?plannedWorkoutId=${plannedWorkoutId}`,
      ),
    enabled:
      (isSignedIn === true || DEV_PREVIEW) &&
      typeof plannedWorkoutId === "number" &&
      plannedWorkoutId > 0,
    staleTime: STALE.session,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      content: string;
      name?: string;
      surface?: string;
      visibility?: string;
    }) =>
      apiFetch<{ route: SparkiRoute }>("/api/routes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}

// Save a RIDDEN ride (activity import with a stored GPS track) as a re-ridable
// route. The server builds it from the real stored track, or returns 422 when
// the ride has no geometry to ride back.
export function useSaveRideAsRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      importId: number;
      name?: string;
      surface?: string;
      visibility?: string;
    }) =>
      apiFetch<{ route: SparkiRoute }>("/api/routes/from-activity", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}

// ── Route enrichment polling ─────────────────────────────────────────────────
// After receiving a generated candidate the server has started computing the
// AI-phrased rationale and road-objects data in the background. Poll this
// endpoint to receive the enriched copy; update the candidate once ready.

export type RouteEnrichment = {
  ready: boolean;
  failed?: boolean;
  rationale?: string;
  roadObjects?: {
    counts: Record<string, number>;
    signalsPerKm: number | null;
    estimatedTimeLossSec: number | null;
  } | null;
};

export function useEnrichRoute(candidateId: string | null | undefined) {
  return useQuery({
    queryKey: ["routes", "enrich", candidateId],
    queryFn: () =>
      apiFetch<RouteEnrichment>(
        `/api/routes/candidate/${candidateId}/enrich`,
      ),
    enabled: typeof candidateId === "string" && candidateId.length > 0,
    // Poll every 3 s until enrichment is ready or failed, then stop.
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 3000;
      if (d.ready || d.failed) return false;
      return 3000;
    },
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

// Propose an ORS-backed route WITHOUT saving it. Returns the candidate.
export function useGenerateRoute() {
  return useMutation({
    mutationFn: (input: GenerateRouteInput) =>
      apiFetch<{ candidate: RouteCandidate }>("/api/routes/generate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

// A distance variant returned by the 3-options chooser: a full candidate plus a
// short label ("Korter" / "Op maat" / "Langer").
export type RouteOption = RouteCandidate & { variant: string };

// Propose THREE loops at different distances (korter/gevraagd/langer) at once,
// WITHOUT saving. Loop mode only. Returns the options for the rider to pick.
export function useGenerateRouteOptions() {
  return useMutation({
    mutationFn: (input: GenerateRouteInput) =>
      apiFetch<{ options: RouteOption[] }>("/api/routes/generate/options", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

// Persist a generated candidate into the routes list (source="generated").
// Optionally attaches user-authored meeting points ("verzamelpunten").
export function useSaveGeneratedRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      candidate: RouteCandidate;
      meetpoints?: RouteMeetpoint[];
    }) =>
      apiFetch<{ route: SparkiRoute }>("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          source: "generated",
          candidateId: input.candidate.candidateId,
          name: input.candidate.name,
          meetpoints: input.meetpoints ?? [],
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}

// ── Route-paspoort (insight) ────────────────────────────────────────────────
// Honest facts about a saved route: grade split from the real elevation
// profile, live weather at the departure hour, environment (traffic lights,
// forest share) from OpenStreetMap. Each block is null when the source can't
// answer — the UI must show the gap, never invent.

export type RouteInsight = {
  grade: { flatKm: number; upKm: number; downKm: number } | null;
  weather: {
    timeLocal: string;
    tempC: number | null;
    uvIndex: number | null;
    windKmh: number | null;
    windGustKmh: number | null;
    windBft: number | null;
    windDirDeg: number | null;
    windDirLabel: string | null;
    precipProbPct: number | null;
  } | null;
  environment: {
    trafficLights: number | null;
    forestSharePct: number | null;
  } | null;
  // Wegobjecten uit de eigen Sparki-database (verkeerslichten, rotondes,
  // drempels, spoorwegovergangen) — null wanneer de bron niet antwoordde.
  roadObjects: {
    counts: Record<string, number>;
    signalsPerKm: number | null;
    estimatedTimeLossSec: number | null;
  } | null;
  hasGeometry: boolean;
  hasProfile: boolean;
};

export function useRouteInsight(
  id: number | null,
  departAt: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["route-insight", id, departAt],
    enabled: enabled && id != null,
    staleTime: 10 * 60_000,
    queryFn: () =>
      apiFetch<{ insight: RouteInsight }>(
        `/api/routes/${id}/insight${
          departAt ? `?departAt=${encodeURIComponent(departAt)}` : ""
        }`,
      ),
  });
}

// Route export formats. GPX is widely compatible; TCX Course (<CoursePoint>) is
// the most dependable on-device turn-by-turn format for Garmin Edge / Wahoo
// ELEMNT head units.
export type RouteExportFormat = "gpx" | "tcx";

// Fetch an export blob (with cookies, same auth as the rest of the app) and
// trigger a browser download. The server returns 422 for routes without stored
// geometry (e.g. GPX imports).
async function downloadRouteFile(
  endpoint: string,
  name: string,
  format: RouteExportFormat,
) {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    let message = `Kon ${format.toUpperCase()} niet downloaden`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const safeName =
    (name || "sparki-route")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "sparki-route";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// True when this browser can hand a route file straight to another app via the
// native share sheet (Android/iOS). Desktop browsers mostly can't — the button
// should then simply not render (the plain download stays).
export function canShareRouteFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare) return false;
  try {
    const probe = new File(["x"], "probe.gpx", { type: "application/gpx+xml" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

// Fetch the export and open the native share sheet so the athlete can send the
// route with one tap to their navigation app (Garmin Connect, Komoot, Wahoo…).
// The phone's share sheet remembers the preferred target on top.
async function shareRouteFile(
  endpoint: string,
  name: string,
  format: RouteExportFormat,
) {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    let message = `Kon ${format.toUpperCase()} niet ophalen`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const safeName =
    (name || "sparki-route")
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toLowerCase() || "sparki-route";
  // Some share targets (WhatsApp is the known offender) refuse files with an
  // XML-achtig mimetype like application/gpx+xml. A generic document type is
  // accepted everywhere and navigation apps pick the file up by extension, so
  // prefer the specific type but fall back to octet-stream when the browser
  // (or a picky target) rejects it.
  const specificType =
    format === "gpx" ? "application/gpx+xml" : "application/vnd.garmin.tcx+xml";
  let file = new File([blob], `${safeName}.${format}`, { type: specificType });
  if (!navigator.canShare?.({ files: [file] })) {
    file = new File([blob], `${safeName}.${format}`, {
      type: "application/octet-stream",
    });
  }
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error("Delen naar een app wordt hier niet ondersteund");
  }
  try {
    await navigator.share({ files: [file], title: name || "Sparki-route" });
  } catch (err) {
    // The user closing the share sheet is not an error.
    if (err instanceof DOMException && err.name === "AbortError") return;
    // Retry once with a generic document type — this rescues targets that
    // reject the specific XML mimetype (e.g. WhatsApp).
    if (file.type !== "application/octet-stream") {
      const generic = new File([blob], `${safeName}.${format}`, {
        type: "application/octet-stream",
      });
      if (navigator.canShare?.({ files: [generic] })) {
        try {
          await navigator.share({
            files: [generic],
            title: name || "Sparki-route",
          });
          return;
        } catch (retryErr) {
          if (
            retryErr instanceof DOMException &&
            retryErr.name === "AbortError"
          )
            return;
          throw new Error(
            "Delen naar deze app lukte niet. Download het bestand en stuur het los door.",
          );
        }
      }
    }
    throw new Error(
      "Delen naar deze app lukte niet. Download het bestand en stuur het los door.",
    );
  }
}

// Share a saved route file into another app (navigation app) via the native
// share sheet.
export function useShareRoute() {
  return useMutation({
    mutationFn: (route: {
      id: number;
      name: string;
      format: RouteExportFormat;
    }) =>
      shareRouteFile(
        `${API_BASE}/api/routes/${route.id}/${route.format}`,
        route.name,
        route.format,
      ),
  });
}

// Download a saved route as a GPX or TCX file.
export function useDownloadRoute() {
  return useMutation({
    mutationFn: (route: {
      id: number;
      name: string;
      format: RouteExportFormat;
    }) =>
      downloadRouteFile(
        `${API_BASE}/api/routes/${route.id}/${route.format}`,
        route.name,
        route.format,
      ),
  });
}

// Download a not-yet-saved generated proposal as GPX or TCX (server builds it
// from the trusted candidate store).
export function useDownloadCandidate() {
  return useMutation({
    mutationFn: (candidate: {
      candidateId: string;
      name: string;
      format: RouteExportFormat;
    }) =>
      downloadRouteFile(
        `${API_BASE}/api/routes/candidate/${candidate.candidateId}/${candidate.format}`,
        candidate.name,
        candidate.format,
      ),
  });
}

// ── Routebibliotheek (Golf 19) ──────────────────────────────────────────────

export type RouteScope = "mijn" | "favoriet" | "archief" | "wedstrijd";
export type RouteSort = "nieuwste" | "afstand" | "hoogte" | "naam";

// Zoeken/filteren/sorteren in de eigen bibliotheek.
export function useRouteLibrary(q: string, scope: RouteScope, sort: RouteSort) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["routes", "library", q, scope, sort],
    queryFn: () =>
      apiFetch<{ routes: SparkiRoute[] }>(
        `/api/routes?limit=100&scope=${scope}&sort=${sort}${
          q ? `&q=${encodeURIComponent(q)}` : ""
        }`,
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 60_000,
  });
}

// Openbaar gemaakte, echt gereden routes van andere gebruikers — geometrie is
// al privacy-afgeschermd door de server (start/einde weg, privacyzone).
export type DiscoverRoute = {
  id: number;
  name: string;
  surface: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  source: string;
  createdAt: string;
  eigenaarNaam: string;
  geometry: [number, number][] | null;
  privacyNote: string;
};

export function useDiscoverRoutes() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["routes", "ontdek"],
    queryFn: () => apiFetch<{ routes: DiscoverRoute[] }>("/api/routes/ontdek"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 5 * 60_000,
  });
}

export type SharedRouteListItem = {
  id: number;
  name: string;
  surface: string;
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  source: string;
  version: number;
  createdAt: string;
  gedeeld: true;
  gedeeldVia: string;
};

// Routes die MET mij gedeeld zijn (alleen metadata; geometrie pas bij detail,
// privacy-afgeschermd).
export function useSharedRoutes(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: ["routes", "gedeeld"],
    queryFn: () =>
      apiFetch<{ routes: SharedRouteListItem[] }>("/api/routes/gedeeld"),
    enabled: enabled && (isSignedIn === true || DEV_PREVIEW),
    staleTime: 60_000,
  });
}

// Route bijwerken: naam, favoriet, archiveren/herstellen. Inhoudelijke
// wijzigingen (naam) verhogen server-side het versienummer.
export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: number;
      name?: string;
      favorite?: boolean;
      status?: "ready" | "archived";
      visibility?: string;
    }) =>
      apiFetch<{ route: SparkiRoute }>(`/api/routes/${input.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.favorite !== undefined && { favorite: input.favorite }),
          ...(input.status !== undefined && { status: input.status }),
          ...(input.visibility !== undefined && {
            visibility: input.visibility,
          }),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
      void qc.invalidateQueries({ queryKey: ["routes", "library"] });
    },
  });
}

export function useDuplicateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ route: SparkiRoute }>(`/api/routes/${id}/duplicate`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
      void qc.invalidateQueries({ queryKey: ["routes", "library"] });
    },
  });
}

export type RouteShare = {
  id: number;
  routeId: number;
  audience: string;
  targetClerkId: string | null;
  createdAt: string;
};

export function useRouteShares(routeId: number | null) {
  return useQuery({
    queryKey: ["routes", "shares", routeId],
    enabled: routeId != null,
    queryFn: () =>
      apiFetch<{ shares: RouteShare[] }>(`/api/routes/${routeId}/delen`),
  });
}

export function useShareRouteWith() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      routeId: number;
      audience: "coach" | "club" | "team" | "persoon";
      targetClerkId?: string;
    }) =>
      apiFetch<{ share: RouteShare | null }>(
        `/api/routes/${input.routeId}/delen`,
        {
          method: "POST",
          body: JSON.stringify({
            audience: input.audience,
            ...(input.targetClerkId && { targetClerkId: input.targetClerkId }),
          }),
        },
      ),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["routes", "shares", v.routeId] });
    },
  });
}

export function useUnshareRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { routeId: number; shareId: number }) =>
      apiFetch<{ ok: true }>(
        `/api/routes/${input.routeId}/delen/${input.shareId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ["routes", "shares", v.routeId] });
    },
  });
}

// Vergelijking plan ↔ echt gereden activiteit (deterministisch uit echte
// GPS-punten; de server weigert eerlijk met 422 als er geen track is).
export type RouteVergelijk = {
  routeId: number;
  routeVersion: number;
  importId: number;
  dekkingPct: number;
  afwijkingen: { fromIndex: number; toIndex: number; lengthKm: number }[];
  afstand: {
    planKm: number | null;
    geredenKm: number | null;
    verschilKm: number | null;
  };
  hoogte: {
    planM: number | null;
    geredenM: number | null;
    verschilM: number | null;
  };
  meetpunten: {
    totaal: number;
    gemist: { name: string | null; lat: number; lon: number }[];
  };
};

export function useRouteVergelijk() {
  return useMutation({
    mutationFn: (input: { routeId: number; importId: number }) =>
      apiFetch<{ vergelijk: RouteVergelijk }>(
        `/api/routes/${input.routeId}/vergelijk?importId=${input.importId}`,
      ),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/routes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}
