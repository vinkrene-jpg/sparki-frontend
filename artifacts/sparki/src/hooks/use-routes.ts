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
  elevationGainM: number | null;
  profile: number[] | null;
  climbs: RouteClimb[] | null;
  nav: RouteNavCue[] | null;
  source: string;
  linkedActivityImportId: number | null;
  createdAt: string;
  updatedAt: string;
};

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
