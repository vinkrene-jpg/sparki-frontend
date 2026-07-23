import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// Wedstrijdpunten — kaartcontrole. AI levert alleen voorstellen (status
// "voorgesteld" mét bron + betrouwbaarheid); hier bevestigt/verplaatst/wijst
// de renner zelf af. Alleen bevestigd/aangepast telt als actief.

export type RacePointKind =
  | "start"
  | "neutralisatie_einde"
  | "sprint"
  | "bergprijs"
  | "bevoorrading"
  | "afvalzone"
  | "gevaar"
  | "wegdek"
  | "spoorwegovergang"
  | "laatste_km"
  | "lokale_ronde"
  | "finish"
  | "info"

export type RacePointStatus = "voorgesteld" | "bevestigd" | "aangepast" | "afgewezen"

export type RacePoint = {
  id: number
  raceId: number
  kind: RacePointKind
  pointClass: "info" | "wedstrijd"
  label: string
  description: string | null
  sourceAnalysisId: number | null
  sourceFile: string | null
  sourcePage: number | null
  raceKm: number | null
  lat: number | null
  lng: number | null
  confidence: "high" | "medium" | "low" | null
  status: RacePointStatus
  needsReconfirm: boolean
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export const RACE_POINT_KIND_LABELS: Record<RacePointKind, string> = {
  start: "Officiële start",
  neutralisatie_einde: "Einde neutralisatie",
  sprint: "Tussensprint",
  bergprijs: "Bergprijs",
  bevoorrading: "Bevoorrading",
  afvalzone: "Afvalzone",
  gevaar: "Gevaarlijk punt",
  wegdek: "Slecht wegdek",
  spoorwegovergang: "Spoorwegovergang",
  laatste_km: "Laatste kilometer",
  lokale_ronde: "Lokale ronde",
  finish: "Finish",
  info: "Wedstrijdinfo",
}

export type RacePointsResponse = {
  points: RacePoint[]
  activeCount: number
  localLaps: number | null
}

const keyFor = (raceId: number) => ["race-points", raceId]

export function useRacePoints(raceId: number | null) {
  return useQuery({
    queryKey: keyFor(raceId ?? 0),
    enabled: raceId != null,
    queryFn: () => apiFetch<RacePointsResponse>(`/api/races/${raceId}/points`),
  })
}

export function useAddRacePoint(raceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      kind: RacePointKind
      label?: string
      description?: string
      raceKm?: number
      lat?: number
      lng?: number
    }) =>
      apiFetch<{ point: RacePoint }>(`/api/races/${raceId}/points`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(raceId) }),
  })
}

export function useUpdateRacePoint(raceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ pointId, ...updates }: {
      pointId: number
      kind?: RacePointKind
      label?: string
      description?: string | null
      raceKm?: number | null
      lat?: number
      lng?: number
      status?: RacePointStatus
    }) =>
      apiFetch<{ point: RacePoint }>(`/api/races/${raceId}/points/${pointId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(raceId) }),
  })
}

export function useDeleteRacePoint(raceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (pointId: number) =>
      apiFetch<{ ok: true }>(`/api/races/${raceId}/points/${pointId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(raceId) }),
  })
}

// Route-geometrie voor de kaartcontrole (alleen als de wedstrijd een route
// heeft). Hergebruikt de bestaande route-detailroute — geen nieuw endpoint.
export function useRaceRouteGeometry(routeId: number | null) {
  return useQuery({
    queryKey: ["route-geometry", routeId ?? 0],
    enabled: routeId != null,
    queryFn: () =>
      apiFetch<{ route: { geometry: [number, number][] | null } }>(
        `/api/routes/${routeId}`,
      ),
    select: (d) => d.route.geometry ?? null,
  })
}
