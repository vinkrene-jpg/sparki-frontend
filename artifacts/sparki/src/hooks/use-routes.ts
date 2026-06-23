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

// [lon, lat] or [lon, lat, elevationMetres].
export type RoutePoint = [number, number] | [number, number, number];

export type SparkiRoute = {
  id: number;
  clerkId: string;
  name: string;
  surface: string;
  status: string;
  visibility: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[] | null;
  climbs: RouteClimb[] | null;
  nav: RouteNavCue[] | null;
  geometry: RoutePoint[] | null;
  rationale: string | null;
  bikeType: string | null;
  trainingType: string | null;
  startName: string | null;
  endName: string | null;
  source: string;
  linkedActivityImportId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type BikeType = "race" | "gravel" | "mtb";
export type TrainingType =
  | "duur"
  | "interval"
  | "herstel"
  | "tempo"
  | "wedstrijd";

export type GenerateRouteInput = {
  mode: "loop" | "ab";
  start: { lat: number; lon: number };
  end?: { lat: number; lon: number };
  bikeType: BikeType;
  trainingType: TrainingType;
  targetDistanceKm?: number;
  linkedWorkoutId?: number;
  seed?: number;
};

// A generated route candidate (not yet persisted).
export type RouteCandidate = {
  name: string;
  surface: string;
  bikeType: BikeType;
  trainingType: TrainingType;
  mode: "loop" | "ab";
  distanceKm: number | null;
  elevationGainM: number | null;
  profile: number[];
  climbs: RouteClimb[];
  geometry: RoutePoint[];
  startName: string | null;
  endName: string | null;
  rationale: string;
  fromWorkout: boolean;
};

export type GeocodeResult = { label: string; lat: number; lon: number };

export function useRoutes() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.routes.list(),
    queryFn: () => apiFetch<{ routes: SparkiRoute[] }>("/api/routes?limit=30"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input:
        | {
            content: string;
            name?: string;
            surface?: string;
            visibility?: string;
          }
        | {
            source: "generated";
            name?: string;
            surface?: string;
            visibility?: string;
            bikeType?: string;
            trainingType?: string;
            rationale?: string | null;
            startName?: string | null;
            endName?: string | null;
            geometry: RoutePoint[];
          },
    ) =>
      apiFetch<{ route: SparkiRoute }>("/api/routes", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() });
    },
  });
}

export function useGenerateRoute() {
  return useMutation({
    mutationFn: (input: GenerateRouteInput) =>
      apiFetch<{ candidate: RouteCandidate }>("/api/routes/generate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useGeocode() {
  return useMutation({
    mutationFn: (input: { q: string; near?: { lat: number; lon: number } }) => {
      const params = new URLSearchParams({ q: input.q });
      if (input.near) {
        params.set("lat", String(input.near.lat));
        params.set("lon", String(input.near.lon));
      }
      return apiFetch<{ results: GeocodeResult[] }>(
        `/api/routes/geocode?${params.toString()}`,
      );
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
