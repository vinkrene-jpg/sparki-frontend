import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// Wedstrijdexport-centrum: GPX / Garmin FIT Course / FIT Workout per
// wedstrijd, met validatie vooraf, versiehistorie en eerlijke
// "verouderd"-markering wanneer punten/route/gids na de export wijzigden.

export type RaceExportType = "gpx" | "fit-course" | "fit-workout"

export type RaceExportRow = {
  id: number
  raceId: number
  exportType: RaceExportType
  version: number
  fileName: string
  contentFingerprint: string
  status: "actueel" | "verouderd"
  staleReason: string | null
  validationOk: boolean
  validationWarnings: string[] | null
  roundTripOk: boolean
  roundTripDetail: string | null
  pointCount: number
  trackPointCount: number
  createdAt: string
}

export type RaceExportsResponse = {
  types: Record<RaceExportType, string>
  hasRoute: boolean
  trackPointCount: number
  validation: { ok: boolean; errors: string[]; warnings: string[] } | null
  reconfirmCount: number
  hasWorkoutSource: boolean
  exports: RaceExportRow[]
  deviceNote: string
}

const keyFor = (raceId: number) => ["race-exports", raceId]

export function useRaceExports(raceId: number | null) {
  return useQuery({
    queryKey: keyFor(raceId ?? 0),
    enabled: raceId != null,
    queryFn: () => apiFetch<RaceExportsResponse>(`/api/races/${raceId}/exports`),
  })
}

export function useCreateRaceExport(raceId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (type: RaceExportType) =>
      apiFetch<{ export: RaceExportRow; warnings: string[] }>(
        `/api/races/${raceId}/exports`,
        { method: "POST", body: JSON.stringify({ type }) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(raceId) }),
  })
}

// Bestand ophalen als blob (cookies gaan automatisch mee) en lokaal opslaan.
export async function downloadRaceExport(
  raceId: number,
  exportId: number,
  fileName: string,
): Promise<void> {
  const res = await fetch(`/api/races/${raceId}/exports/${exportId}/download`, {
    credentials: "include",
  })
  if (!res.ok) {
    let msg = "Download mislukt"
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      // laat de standaardmelding staan
    }
    throw new Error(msg)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
