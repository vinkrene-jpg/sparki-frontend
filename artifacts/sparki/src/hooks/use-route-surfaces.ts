// Wegtypen & ondergrond: verdeling van de route over 10 categorieën uit echte
// OpenStreetMap-tags + deterministische geschiktheid per fietstype. De server
// verzint nooit een wegtype; niet betrouwbaar vast te stellen = "onbekend".

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

export type SurfaceKind =
  | "asfalt"
  | "verhard_fietspad"
  | "klinkers"
  | "kasseien"
  | "compact_gravel"
  | "los_gravel"
  | "onverhard"
  | "bospad"
  | "singletrack"
  | "onbekend"

export type SurfaceSegment = {
  kind: SurfaceKind
  fromKm: number
  toKm: number
  fromIdx: number
  toIdx: number
}

export type SurfaceBreakdownEntry = {
  kind: SurfaceKind
  km: number
  pct: number
  evidence: string | null
}

export type RouteSurfacesAnalysis = {
  totalKm: number
  breakdown: SurfaceBreakdownEntry[]
  segments: SurfaceSegment[]
  restrictedKm: number
}

export type BikeType = "racefiets" | "gravelbike" | "mountainbike"
export type SuitabilityVerdict =
  | "goed"
  | "gedeeltelijk"
  | "technisch"
  | "afgeraden"
  | "onvoldoende_gegevens"

export type BikeSuitability = {
  bike: BikeType
  verdict: SuitabilityVerdict
  reasons: string[]
}

export type RouteSurfacesResponse = {
  surfaces: RouteSurfacesAnalysis | null
  suitability: BikeSuitability[] | null
  maxSlopePct: number | null
  source: { name: string; license: string; url: string; note: string }
}

const STALE_MS = 30 * 60_000

export function useRouteSurfaces(routeId: number | null) {
  return useQuery({
    queryKey: ["route-surfaces", routeId ?? 0],
    enabled: routeId != null,
    staleTime: STALE_MS,
    retry: 1,
    queryFn: () =>
      apiFetch<RouteSurfacesResponse>(`/api/routes/${routeId}/surfaces`),
  })
}

// Voorproef voor een nog niet opgeslagen route in de routebouwer.
export function useRouteSurfacesPreview(
  geometry: [number, number][] | null | undefined,
  profile?: number[] | null,
  distanceKm?: number | null,
) {
  const g = geometry && geometry.length >= 2 ? geometry : null
  // Robuuste vingerafdruk: lat+lon van ~16 gelijkmatig verdeelde punten plus
  // lengte, afstand en profiel-lengte — een andere vorm geeft altijd een
  // andere key (geen verouderde analyse bij een nieuwe kandidaat).
  let key = "none"
  if (g) {
    const parts: string[] = [String(g.length), String(distanceKm ?? ""), String(profile?.length ?? "")]
    const n = Math.min(16, g.length)
    for (let i = 0; i < n; i++) {
      const p = g[Math.floor((i * (g.length - 1)) / Math.max(1, n - 1))]!
      parts.push(`${p[0].toFixed(5)},${p[1].toFixed(5)}`)
    }
    key = parts.join(":")
  }
  return useQuery({
    queryKey: ["route-surfaces-preview", key],
    enabled: g != null,
    staleTime: STALE_MS,
    retry: 1,
    queryFn: () =>
      apiFetch<RouteSurfacesResponse>("/api/routes/surfaces-preview", {
        method: "POST",
        body: JSON.stringify({
          geometry: g,
          profile: profile ?? undefined,
          distanceKm: distanceKm ?? undefined,
        }),
      }),
  })
}
