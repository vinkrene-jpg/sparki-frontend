import { useQuery } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import { STALE } from "@/lib/query-keys"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import type { ClimbSearchResult, ClimbDetail } from "@/lib/climb-types"

// Search named climbs in a geocoded area. Only fires when the user has actually
// entered a query — an empty query is a no-op, never a fabricated result set.
export function useClimbSearch(q: string, name: string, radiusKm: number) {
  const { isSignedIn } = useUser()
  const enabled = useFeatureFlag("climb_explorer")
  const query = q.trim()
  const nameFilter = name.trim()
  return useQuery({
    queryKey: ["climbs", "search", query, nameFilter, radiusKm],
    queryFn: () => {
      const params = new URLSearchParams({ q: query })
      params.set("radiusKm", String(radiusKm))
      if (nameFilter) params.set("name", nameFilter)
      return apiFetch<ClimbSearchResult>(
        `/api/climbs/search?${params.toString()}`,
      )
    },
    enabled:
      (isSignedIn === true || DEV_PREVIEW) && enabled && query.length >= 2,
    staleTime: STALE.flags,
    retry: false,
  })
}

// Zoek klimmen rond bekende coördinaten (Route maken: rond de startlocatie) —
// geen geocodeerstap; optioneel naamfilter. Vuurt alleen met échte coördinaten.
export function useClimbSearchNearby(
  at: { lat: number; lon: number } | null,
  name: string,
  radiusKm: number,
  active: boolean,
) {
  const { isSignedIn } = useUser()
  const enabled = useFeatureFlag("climb_explorer")
  const nameFilter = name.trim()
  return useQuery({
    queryKey: [
      "climbs",
      "nearby",
      at ? `${at.lat.toFixed(3)},${at.lon.toFixed(3)}` : null,
      nameFilter,
      radiusKm,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        lat: String(at!.lat),
        lon: String(at!.lon),
        radiusKm: String(radiusKm),
      })
      if (nameFilter) params.set("name", nameFilter)
      return apiFetch<ClimbSearchResult>(
        `/api/climbs/search?${params.toString()}`,
      )
    },
    enabled:
      (isSignedIn === true || DEV_PREVIEW) && enabled && active && at != null,
    staleTime: STALE.flags,
    retry: false,
  })
}

export function useClimbDetail(osmId: string | null) {
  const { isSignedIn } = useUser()
  const enabled = useFeatureFlag("climb_explorer")
  return useQuery({
    queryKey: ["climbs", "detail", osmId],
    queryFn: () =>
      apiFetch<ClimbDetail>(
        `/api/climbs/detail?osmId=${encodeURIComponent(osmId!)}`,
      ),
    enabled:
      (isSignedIn === true || DEV_PREVIEW) && enabled && Boolean(osmId),
    staleTime: STALE.flags,
    retry: false,
  })
}
