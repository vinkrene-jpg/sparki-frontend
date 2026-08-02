// SPARKI_BUILD_01 F7 — lijn 3: zelfstandige trainer ↔ gekoppelde sporter.
//
// Praat met de F7-berichtenlaag op /api/coach-messages/:coachClerkId/
// :athleteClerkId (context "coach_link"). Dezelfde berichten-UI als de
// clubberichten, twee richtingen, bijlagen (bestand/afbeelding/link), gelezen-
// status per ontvanger en ouder-meelezen (<16). Dit is een APARTE laag van de
// oude coach-cockpitberichten (/api/coach/athletes/:id/messages).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import type { MessageAttachment } from "@/hooks/use-club"

export type CoachLinkRole = "coach" | "athlete" | "parent"

export type CoachLinkMessage = {
  id: number
  authorClerkId: string
  body: string
  allowReplies: boolean
  read: boolean
  createdAt: string
  attachments: MessageAttachment[]
}

export type CoachLinkThread = {
  role: CoachLinkRole
  parentReadsAlong: boolean
  messages: CoachLinkMessage[]
}

function coachLinkKey(coachClerkId: string | null, athleteClerkId: string | null) {
  return ["coach-link-messages", coachClerkId ?? "", athleteClerkId ?? ""] as const
}

function useEnabled(extra = true) {
  const { isSignedIn } = useUser()
  return (isSignedIn === true || DEV_PREVIEW) && extra
}

export function useCoachLinkThread(
  coachClerkId: string | null,
  athleteClerkId: string | null,
) {
  return useQuery<CoachLinkThread>({
    queryKey: coachLinkKey(coachClerkId, athleteClerkId),
    queryFn: () =>
      apiFetch(`/api/coach-messages/${coachClerkId}/${athleteClerkId}`),
    enabled: useEnabled(Boolean(coachClerkId && athleteClerkId)),
    staleTime: 15_000,
  })
}

// Bijlage-invoer identiek aan de clubberichten: link of base64-bestand.
export type ComposeAttachment =
  | { kind: "link"; url: string; title: string | null }
  | { kind: "file"; base64: string; name: string }

export function useSendCoachLinkMessage(
  coachClerkId: string | null,
  athleteClerkId: string | null,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { body: string; attachments?: ComposeAttachment[] }) =>
      apiFetch(`/api/coach-messages/${coachClerkId}/${athleteClerkId}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: coachLinkKey(coachClerkId, athleteClerkId),
      }),
  })
}

export function useMarkCoachLinkRead(
  coachClerkId: string | null,
  athleteClerkId: string | null,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: number) =>
      apiFetch(
        `/api/coach-messages/${coachClerkId}/${athleteClerkId}/messages/${messageId}/read`,
        { method: "POST" },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: coachLinkKey(coachClerkId, athleteClerkId),
      }),
  })
}

export function useRevokeCoachLinkAttachment(
  coachClerkId: string | null,
  athleteClerkId: string | null,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (attachmentId: number) =>
      apiFetch(
        `/api/coach-messages/${coachClerkId}/${athleteClerkId}/attachments/${attachmentId}/revoke`,
        { method: "POST" },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({
        queryKey: coachLinkKey(coachClerkId, athleteClerkId),
      }),
  })
}
