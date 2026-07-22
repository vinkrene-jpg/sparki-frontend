import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import { queryKeys, STALE } from "@/lib/query-keys"
import type {
  Invitation,
  CreateInvitationInput,
  AcceptInvitationResult,
} from "@/lib/invitation-types"

// Invitations created by the current user (admins see all).
export function useInvitations() {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey: queryKeys.invitations.list(),
    queryFn: () => apiFetch<Invitation[]>("/api/invitations"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  })
}

// A single invitation by token — for the accept screen.
export function useInvitation(token: string | undefined) {
  const { isSignedIn } = useUser()
  return useQuery({
    queryKey: queryKeys.invitations.detail(token ?? ""),
    queryFn: () => apiFetch<Invitation>(`/api/invitations/${token}`),
    enabled: !!token && (isSignedIn === true || DEV_PREVIEW),
    staleTime: STALE.live,
    retry: false,
  })
}

export function useCreateInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvitationInput) =>
      apiFetch<Invitation>("/api/invitations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.invitations.all() })
    },
  })
}

export function useRevokeInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<Invitation>(`/api/invitations/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.invitations.all() })
    },
  })
}

export function useDeclineInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ invitation: Invitation }>(
        `/api/invitations/${token}/decline`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.invitations.all() })
    },
  })
}

export function useAcceptInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<AcceptInvitationResult>(`/api/invitations/${token}/accept`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.invitations.all() })
      // Roles changed → refresh everything role-dependent.
      void qc.invalidateQueries()
    },
  })
}
