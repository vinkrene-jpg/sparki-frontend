import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

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
