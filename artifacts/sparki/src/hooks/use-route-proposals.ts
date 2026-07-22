import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

// Routevoorstellen tussen fietsmaatjes: voorstellen, bekijken en beantwoorden.

export type RouteProposalRouteMeta = {
  id: number
  name: string
  surface: string | null
  distanceKm: number | null
  durationSec: number | null
  elevationGainM: number | null
} | null

export type RouteProposal = {
  id: number
  status: "open" | "geaccepteerd" | "afgewezen" | "aangepast"
  note: string | null
  createdAt: string
  respondedAt: string | null
  fromClerkId: string
  toClerkId: string
  fromName: string
  toName: string
  route: RouteProposalRouteMeta
  adjustedRoute: RouteProposalRouteMeta
}

const PROPOSALS_KEY = ["route-proposals"] as const

export function useRouteProposals() {
  return useQuery({
    queryKey: PROPOSALS_KEY,
    queryFn: () =>
      apiFetch<{ ontvangen: RouteProposal[]; verstuurd: RouteProposal[] }>(
        "/api/routes/voorstellen",
      ),
  })
}

export function useProposeRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      routeId,
      toClerkId,
      note,
    }: {
      routeId: number
      toClerkId: string
      note?: string
    }) =>
      apiFetch(`/api/routes/${routeId}/voorstel`, {
        method: "POST",
        body: JSON.stringify({ toClerkId, note }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: PROPOSALS_KEY }),
  })
}

export function useRespondToProposal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      actie,
    }: {
      id: number
      actie: "accepteer" | "wijs_af"
    }) =>
      apiFetch(`/api/routes/voorstellen/${id}/reageer`, {
        method: "POST",
        body: JSON.stringify({ actie }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROPOSALS_KEY })
      // Accepteren kopieert de route naar de eigen bibliotheek.
      void qc.invalidateQueries({ queryKey: queryKeys.routes.all() })
    },
  })
}
