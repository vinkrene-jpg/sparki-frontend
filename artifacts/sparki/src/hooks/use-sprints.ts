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

export type SprintSeason = {
  seasonYear: number
  totalPoints: number
  sprintCount: number
  bestSingle: number
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
