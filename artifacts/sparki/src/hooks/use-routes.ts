import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type RouteClimb = {
  name: string;
  lengthKm: number;
  avgGradePct: number;
};

export type RouteNavCue = {
  km: number;
  dir: string;
  note: string;
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
  rationale: string | null;
  source: string;
  linkedActivityImportId: number | null;
  linkedPlannedWorkoutId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Sport = "cycling" | "running" | "walking" | "hiking";
export type BikeType = "racefiets" | "mtb" | "gravel";
export type ElevationPreference = "flat" | "hilly" | "any";

export type GenerateRouteInput = {
  mode: "loop" | "ptp";
  startLat: number;
  startLon: number;
  sport: Sport;
  bikeType?: BikeType;
  elevationPreference?: ElevationPreference;
  trainingType?: string;
  plannedWorkoutId?: number;
  targetDistanceKm?: number;
  endLat?: number;
  endLon?: number;
  destinationText?: string;
  seed?: number;
};

export type RouteCandidate = {
  candidateId: string;
  name: string;
  surface: string;
  sport: Sport;
  bikeType: BikeType | null;
  routingProfile: string;
  trainingType: string;
  mode: "loop" | "ptp";
  distanceKm: number | null;
  durationSec: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: RouteClimb[];
  nav: RouteNavCue[];
  geometry: [number, number][];
  rationale: string;
  startName: string | null;
  endName: string | null;
  plannedWorkoutId: number | null;
  targetDistanceKm: number | null;
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

// Persist a generated candidate into the routes list (source="generated").
export function useSaveGeneratedRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidate: RouteCandidate) =>
      apiFetch<{ route: SparkiRoute }>("/api/routes", {
        method: "POST",
        body: JSON.stringify({
          source: "generated",
          candidateId: candidate.candidateId,
          name: candidate.name,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
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
