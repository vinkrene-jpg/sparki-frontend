import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// "Bordjes sprinten" — town-sign sprints. Real data only: boards come from the
// route's geometry via reverse geocoding, points are computed server-side.

export type SprintBoard = {
  placeName: string
  lat: number
  lon: number
  km: number
}

export type SprintBoardsResult = {
  boards: SprintBoard[]
  available: boolean
  count: number
}

export type SprintResultRow = {
  id: number
  routeId: number | null
  rideType: "planned" | "free"
  placeName: string
  km: number | null
  speedKmhPeak: number | null
  speedGainKmh: number | null
  avgWatts: number | null
  peakWatts5s: number | null
  basePoints: number
  bonusPoints: number
  totalPoints: number
  status: "scored" | "cancelled"
  occurredAt: string
}

export type SprintBadge = {
  key: string
  label: string
  description: string
  achieved: boolean
  progress: { current: number; target: number } | null
}

export type SprintRankRow = {
  clerkId: string
  name: string
  points: number
  isMe: boolean
}

export type SprintSeason = {
  seasonYear: number
  totalPoints: number
  sprintCount: number
  bestSingle: number
  badges: SprintBadge[]
  ranking: SprintRankRow[]
  myRank: number | null
  recent: SprintResultRow[]
}

export type SprintSubmission = {
  routeId?: number | null
  rideType: "planned" | "free"
  placeName: string
  km?: number | null
  speedKmhPeak?: number | null
  speedGainKmh?: number | null
  avgWatts?: number | null
  peakWatts5s?: number | null
  status?: "scored" | "cancelled"
  // Idempotentiesleutel per sprint-moment: een herhaalde upload van dezelfde
  // sprint maakt op de server nooit een dubbele rij.
  clientKey?: string
}

// Stabiele sleutel voor één sprint-moment, toegekend op het moment van
// detectie. Route + bordje + tijd (afgerond op 10 s) — een retry of dubbele
// tik binnen datzelfde moment levert dezelfde sleutel op.
export function makeSprintClientKey(
  routeId: number | null,
  placeName: string,
  km: number | null,
  now: number = Date.now(),
): string {
  const bucket = Math.round(now / 10_000)
  return `${routeId ?? "free"}:${placeName}:${km ?? "-"}:${bucket}`
}

const keys = {
  boards: (routeId: number) => ["sprints", "boards", routeId] as const,
  season: () => ["sprints", "season"] as const,
}

// Sprint boards for a saved route. Enabled only when a routeId is present.
export function useSprintBoards(routeId: number | null) {
  return useQuery<SprintBoardsResult>({
    queryKey: keys.boards(routeId ?? 0),
    enabled: routeId != null,
    staleTime: 60 * 60 * 1000,
    queryFn: () => apiFetch<SprintBoardsResult>(`/api/sprints/route/${routeId}`),
  })
}

export function useSubmitSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: SprintSubmission) =>
      apiFetch<{ result: SprintResultRow }>("/api/sprints/result", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.season() })
    },
  })
}

export function useSprintSeason() {
  return useQuery<SprintSeason>({
    queryKey: keys.season(),
    staleTime: 5 * 60 * 1000,
    queryFn: () => apiFetch<SprintSeason>("/api/sprints/season"),
  })
}

// Share (or unshare) one of your own sprints to the Samen-overzicht.
export function useShareSprint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, shared }: { id: number; shared: boolean }) =>
      apiFetch<{ result: SprintResultRow }>(`/api/sprints/result/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ shared }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.season() })
    },
  })
}

// Reverse-geocode a live GPS point to a place name for free-ride sprint
// detection. Returns null honestly when the provider can't resolve it.
export function useLookupPlace() {
  return useMutation({
    mutationFn: (point: { lat: number; lon: number }) =>
      apiFetch<{ placeName: string | null }>("/api/sprints/place", {
        method: "POST",
        body: JSON.stringify(point),
      }),
  })
}
