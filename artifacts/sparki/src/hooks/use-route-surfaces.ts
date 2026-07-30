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
  // Aantoonbaar fietsverbod (harde afkeur) vs. mildere access-beperking.
  forbiddenKm: number
  restrictedKm: number
  // Officiële-kaart-controlelaag (BGT in Nederland, GRB in Vlaanderen):
  // hoeveel OSM-onbekende meetpunten de officiële overheidswegenkaart alsnog
  // een verharding kon geven. null = niet geraadpleegd (buiten NL/Vlaanderen,
  // geen onbekend, of bron faalde). source draagt de verplichte bronvermelding.
  bgt?: {
    checkedSamples: number
    resolvedSamples: number
    source: { name: string; license: string; url: string; note: string }
  } | null
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

// Bronvergelijking: de routemotor (GraphHopper-graaf) en dit scherm (actuele
// OSM-tags + BGT) zijn twee eerlijke metingen die kunnen verschillen. De
// server legt ze naast elkaar en legt tegenspraak expliciet uit — er wordt
// nooit stil één bron gekozen.
export type SurfaceSourceComparison = {
  engine: {
    provider: string
    pavedPct: number | null
    knownPct: number | null
    measuredAt: string
  }
  scherm: { verhardPct: number; onverhardPct: number; onbekendPct: number }
  oordeel: "consistent" | "tegenspraak"
  uitleg: string[]
}

export type RouteSurfacesResponse = {
  surfaces: RouteSurfacesAnalysis | null
  suitability: BikeSuitability[] | null
  maxSlopePct: number | null
  vergelijking?: SurfaceSourceComparison | null
  source: { name: string; license: string; url: string; note: string }
  // 202 van de server: het previewbudget verstreek maar de meting loopt nog
  // op de achtergrond (trage kaartbron). Geen fout en geen verzonnen
  // tussenresultaat — de hook pollt automatisch door tot er echt iets is.
  pending?: boolean
}

const STALE_MS = 30 * 60_000

// Doorpollen zolang de server "meting loopt nog" (202/pending) antwoordt:
// elke 5 s opnieuw vragen, met een plafond zodat een écht dode bron niet
// eeuwig blijft draaien. Na het plafond blijft de eerlijke pending-toestand
// staan ("probeer zo opnieuw") — er wordt nooit een tussenresultaat verzonnen.
const PENDING_POLL_MS = 5_000
const PENDING_POLL_MAX = 12

function pendingRefetchInterval(query: {
  state: { data?: RouteSurfacesResponse; dataUpdateCount: number }
}) {
  if (!query.state.data?.pending) return false
  return query.state.dataUpdateCount < PENDING_POLL_MAX ? PENDING_POLL_MS : false
}

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
  // Kandidaat-id van een zojuist gegenereerde route: de server haalt daar de
  // motor-wegdekmeting bij op voor de eerlijke bronvergelijking.
  candidateId?: string | null,
) {
  const g = geometry && geometry.length >= 2 ? geometry : null
  // Robuuste vingerafdruk: lat+lon van ~16 gelijkmatig verdeelde punten plus
  // lengte, afstand en profiel-lengte — een andere vorm geeft altijd een
  // andere key (geen verouderde analyse bij een nieuwe kandidaat).
  let key = "none"
  if (g) {
    const parts: string[] = [String(g.length), String(distanceKm ?? ""), String(profile?.length ?? ""), String(candidateId ?? "")]
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
    // Een pending-antwoord ("meting loopt nog") is nooit vers: bij een
    // her-mount direct opnieuw vragen in plaats van 30 min op 202 blijven.
    staleTime: (q) => (q.state.data?.pending ? 0 : STALE_MS),
    refetchInterval: pendingRefetchInterval,
    retry: 1,
    queryFn: () =>
      apiFetch<RouteSurfacesResponse>("/api/routes/surfaces-preview", {
        method: "POST",
        body: JSON.stringify({
          geometry: g,
          profile: profile ?? undefined,
          distanceKm: distanceKm ?? undefined,
          candidateId: candidateId ?? undefined,
        }),
      }),
  })
}
