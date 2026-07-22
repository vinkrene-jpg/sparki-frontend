import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { useMyLinks } from "@/hooks/use-links"
import { useTeamIdentity } from "@/hooks/use-social"
import { useUserProfile } from "@/contexts/UserContext"

// ── Legacy: trainer-koppeling (blijft de fallback wanneer er geen echte
// clubomgeving is — een geaccepteerde coach-link is dan het eerlijke signaal).
export function useClubMembership() {
  const { profile } = useUserProfile()
  const role = profile?.activeRole
  const athlete = role === "athlete" || role === undefined || role === null
  const { data: links, isLoading } = useMyLinks(athlete)
  const { data: teamData } = useTeamIdentity()

  const coaches = (links?.coaches ?? []).filter((c) => c.status === "accepted")
  return {
    isMember: athlete && coaches.length > 0,
    coaches,
    team: teamData?.team ?? null,
    isLoading,
  }
}

// ── Echte clubomgeving ───────────────────────────────────────────────────────

export type ClubRole = "owner" | "admin" | "trainer" | "teammanager" | "parent" | "member"

export type Club = {
  id: number
  name: string
  description: string | null
  location: string | null
  contactEmail: string | null
  website: string | null
  logoUrl: string | null
  primaryColor: string | null
}

export type ClubMembershipRow = {
  membership: { id: number; clubId: number; role: ClubRole; joinedAt: string }
  club: Club | null
}

export type ClubTraining = {
  id: number
  title: string
  trainingDate: string
  startTime: string | null
  location: string | null
  level: string | null
  goal: string | null
  notes: string | null
  durationMin: number | null
  maxParticipants: number | null
  status: string
  counts: { aangemeld: number; afgemeld: number; reserve: number }
  mySignup: { id: number; status: string; attendance: string | null; plannedWorkoutId: number | null } | null
  signups?: { clerkId: string; status: string; attendance: string | null; displayName: string | null }[]
}

export type ClubRaceEvent = {
  id: number
  name: string
  raceDate: string
  location: string | null
  discipline: string | null
  meetPoint: string | null
  meetTime: string | null
  transportInfo: string | null
  materialInfo: string | null
  notes: string | null
  status: string
  resultSummary: string | null
  selections: { clerkId: string; role: string; availability: string | null; displayName: string | null }[]
  mySelection: { role: string; availability: string | null } | null
}

export type ClubMessage = {
  id: number
  scope: string
  teamId: number | null
  groupId: number | null
  parentId: number | null
  authorClerkId: string
  authorName: string | null
  body: string
  allowReplies: boolean
  read: boolean
  createdAt: string
}

export type ClubMemberRow = {
  id: number
  clerkId: string
  role: ClubRole
  joinedAt: string
  endedAt: string | null
  displayName: string | null
  email: string | null
  isYouth?: boolean | null
}

export type ClubDashboard = {
  club: Club
  membership: { id: number; role: ClubRole; clerkId: string }
  teams: { id: number; name: string; managerClerkId: string | null }[]
  groups: { id: number; name: string; level: string | null; trainerClerkId: string | null }[]
  upcomingTrainings: { id: number; title: string; trainingDate: string }[]
  upcomingRaces: { id: number; name: string; raceDate: string }[]
  memberCounts: { members: number; trainers: number }
  subscription?: {
    packageKey: string
    status: string
    trialEndsAt: string | null
    maxMembers: number
    maxTrainers: number
  } | null
  openInvitations?: number
  signals?: string[]
  consents?: { athleteClerkId: string; status: string; grantedByRelation: string }[]
}

export function useMyClubs() {
  return useQuery<ClubMembershipRow[]>({
    queryKey: ["clubs"],
    queryFn: () => apiFetch("/api/clubs"),
  })
}

export function useClubDashboard(clubId: number | null) {
  return useQuery<ClubDashboard>({
    queryKey: ["clubs", clubId],
    queryFn: () => apiFetch(`/api/clubs/${clubId}`),
    enabled: clubId != null,
  })
}

export function useCreateClub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string; location?: string }) =>
      apiFetch("/api/clubs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useClubTrainings(clubId: number | null) {
  return useQuery<ClubTraining[]>({
    queryKey: ["clubs", clubId, "trainings"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/trainings`),
    enabled: clubId != null,
  })
}

export function useClubSignup(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trainingId, status, note }: { trainingId: number; status: "aangemeld" | "afgemeld"; note?: string }) =>
      apiFetch(`/api/clubs/${clubId}/trainings/${trainingId}/signup`, {
        method: "POST",
        body: JSON.stringify({ status, note }),
      }) as Promise<{ signup: { status: string }; conflicts: { id: number; title: string; source: string }[] }>,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "trainings"] }),
  })
}

export function useClubLinkSchedule(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trainingId, mode, replaceWorkoutId }: { trainingId: number; mode?: "toevoegen" | "vervangen"; replaceWorkoutId?: number }) =>
      apiFetch(`/api/clubs/${clubId}/trainings/${trainingId}/link-schedule`, {
        method: "POST",
        body: JSON.stringify({ mode, replaceWorkoutId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clubs", clubId, "trainings"] })
      void qc.invalidateQueries({ queryKey: ["plan"] })
    },
  })
}

export function useClubRaces(clubId: number | null) {
  return useQuery<ClubRaceEvent[]>({
    queryKey: ["clubs", clubId, "races"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/races`),
    enabled: clubId != null,
  })
}

export function useClubAvailability(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, availability, note }: { eventId: number; availability: string; note?: string }) =>
      apiFetch(`/api/clubs/${clubId}/races/${eventId}/availability`, {
        method: "PUT",
        body: JSON.stringify({ availability, note }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "races"] }),
  })
}

export function useClubMessages(clubId: number | null) {
  return useQuery<ClubMessage[]>({
    queryKey: ["clubs", clubId, "messages"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/messages`),
    enabled: clubId != null,
  })
}

export function usePostClubMessage(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { body: string; scope?: string; teamId?: number; groupId?: number; parentId?: number }) =>
      apiFetch(`/api/clubs/${clubId}/messages`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "messages"] }),
  })
}

export function useMarkClubMessageRead(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (messageId: number) =>
      apiFetch(`/api/clubs/${clubId}/messages/${messageId}/read`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "messages"] }),
  })
}

export function useMyClubConsent(clubId: number | null) {
  return useQuery<{ consent: { status: string; grantedByRelation: string } | null; isMinor: boolean }>({
    queryKey: ["clubs", clubId, "consent"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/consents/mine`),
    enabled: clubId != null,
  })
}

export function useSetClubConsent(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { action: "grant" | "revoke"; athleteClerkId?: string }) =>
      apiFetch(`/api/clubs/${clubId}/consents`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clubs", clubId, "consent"] })
      void qc.invalidateQueries({ queryKey: ["clubs", clubId] })
    },
  })
}

// ── Beheer ───────────────────────────────────────────────────────────────────

export function useClubMembers(clubId: number | null, enabled = true) {
  return useQuery<ClubMemberRow[]>({
    queryKey: ["clubs", clubId, "members"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/members`),
    enabled: clubId != null && enabled,
  })
}

export function useSetMemberRole(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: number; role: ClubRole }) =>
      apiFetch(`/api/clubs/${clubId}/members/${memberId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useEndMembership(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, reason }: { memberId: number; reason?: string }) =>
      apiFetch(`/api/clubs/${clubId}/members/${memberId}/end`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useCreateClubTraining(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}/trainings`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useCreateClubRace(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}/races`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useClubSubscription(clubId: number | null, enabled = true) {
  return useQuery<{
    subscription: ClubDashboard["subscription"]
    counts: { members: number; trainers: number }
    packages: Record<string, { label: string; maxMembers: number; maxTrainers: number; pricePerMonthEur: number | null }>
  }>({
    queryKey: ["clubs", clubId, "subscription"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/subscription`),
    enabled: clubId != null && enabled,
  })
}

export function useSetClubPackage(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (packageKey: string) =>
      apiFetch(`/api/clubs/${clubId}/subscription`, {
        method: "PUT",
        body: JSON.stringify({ packageKey }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useCreateClubInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { relationship: string; clubId: number; email?: string }) =>
      apiFetch("/api/invitations", { method: "POST", body: JSON.stringify(body) }) as Promise<{ token: string }>,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invitations"] }),
  })
}
