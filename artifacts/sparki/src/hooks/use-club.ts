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

export type ClubRole =
  | "owner"
  | "admin"
  | "hoofdtrainer"
  | "trainer"
  | "assistent"
  | "teammanager"
  | "mechanieker"
  | "vrijwilliger"
  | "alleen_lezen"
  | "parent"
  | "member"

export type Club = {
  id: number
  name: string
  description: string | null
  location: string | null
  contactEmail: string | null
  contactPhone: string | null
  website: string | null
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  status: string
  modules: string[] | null
  joinCode: string | null
}

export type ClubLocation = {
  id: number
  name: string
  address: string | null
  notes: string | null
  routeId: number | null
  active?: boolean | null
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
  materialInfo?: string | null
  safetyInfo?: string | null
  locationId?: number | null
  counts: { aangemeld: number; afgemeld: number; reserve: number; misschien: number }
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
  teams: { id: number; name: string; managerClerkId: string | null; parentTeamId?: number | null; seasonId?: number | null }[]
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

// WP-02 — Hoofdtraineroverzicht: organisatorische feiten per trainer
// (toewijzingen, aantal sporters, planactiviteit) — geen gezondheidsdata.
export type HoofdtrainerOverview = {
  sinds: string
  trainers: Array<{
    clerkId: string
    displayName: string | null
    role: string
    assignments: Array<{ teamId: number | null; team: string | null; groupId: number | null; group: string | null }>
    assignedAthleteCount: number
    trainingsLast30Days: number
  }>
}

export function useHoofdtrainerOverview(clubId: number | null, enabled: boolean) {
  return useQuery<HoofdtrainerOverview>({
    queryKey: ["clubs", clubId, "hoofdtrainer-overview"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/hoofdtrainer/overview`),
    enabled: clubId != null && enabled,
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
    mutationFn: ({ trainingId, status, note }: { trainingId: number; status: "aangemeld" | "afgemeld" | "misschien"; note?: string }) =>
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
  return useQuery<{
    consent: { status: string; grantedByRelation: string } | null
    consents: { scope: string; status: string; grantedByRelation: string }[]
    scopes: string[]
    isMinor: boolean
  }>({
    queryKey: ["clubs", clubId, "consent"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/consents/mine`),
    enabled: clubId != null,
  })
}

export function useSetClubConsent(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { action: "grant" | "revoke"; athleteClerkId?: string; scope?: string }) =>
      apiFetch(`/api/clubs/${clubId}/consents`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clubs", clubId, "consent"] })
      void qc.invalidateQueries({ queryKey: ["clubs", clubId] })
    },
  })
}

// ── Beheer ───────────────────────────────────────────────────────────────────

export function useClubMembers(clubId: number | null, enabled = true, includeHistory = false) {
  return useQuery<ClubMemberRow[]>({
    queryKey: ["clubs", clubId, "members", includeHistory ? "historie" : "actief"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/members${includeHistory ? "?historie=1" : ""}`),
    enabled: clubId != null && enabled,
  })
}

// ── WP-03: seizoenen & teams ─────────────────────────────────────────────────
export type ClubSeasonRow = {
  id: number
  name: string
  startsOn: string | null
  endsOn: string | null
  status: "actief" | "gepland" | "afgesloten"
}

export function useClubSeasons(clubId: number | null, enabled = true) {
  return useQuery<ClubSeasonRow[]>({
    queryKey: ["clubs", clubId, "seasons"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/seasons`),
    enabled: clubId != null && enabled,
  })
}

export function useCreateClubSeason(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; status?: "actief" | "gepland"; startsOn?: string; endsOn?: string }) =>
      apiFetch(`/api/clubs/${clubId}/seasons`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs", clubId, "seasons"] }),
  })
}

export function useSeasonAction(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seasonId, action }: { seasonId: number; action: "close" | "activate" }) =>
      apiFetch(`/api/clubs/${clubId}/seasons/${seasonId}/${action}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs", clubId, "seasons"] }),
  })
}

export function useCreateClubTeam(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; parentTeamId?: number | null; seasonId?: number | null; category?: string }) =>
      apiFetch(`/api/clubs/${clubId}/teams`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
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

export function useJoinClub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch("/api/clubs/join", { method: "POST", body: JSON.stringify({ code }) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useUpdateClub(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useRegenerateJoinCode(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (teamId?: number) =>
      apiFetch(`/api/clubs/${clubId}/join-code`, {
        method: "POST",
        body: JSON.stringify(teamId != null ? { teamId } : {}),
      }) as Promise<{ joinCode: string; teamId?: number }>,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useClubLocations(clubId: number | null) {
  return useQuery<ClubLocation[]>({
    queryKey: ["clubs", clubId, "locations"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/locations`),
    enabled: clubId != null,
  })
}

export function useCreateClubLocation(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; address?: string; notes?: string }) =>
      apiFetch(`/api/clubs/${clubId}/locations`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "locations"] }),
  })
}

export type ClubCalendarItem = {
  kind: "training" | "wedstrijd"
  date: string
  time: string | null
  item: { id: number; title?: string; name?: string; location?: string | null; status?: string }
}

export function useClubCalendar(clubId: number | null) {
  return useQuery<ClubCalendarItem[]>({
    queryKey: ["clubs", clubId, "calendar"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/calendar`),
    enabled: clubId != null,
  })
}

export function useUpdateClubTeam(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, ...body }: { teamId: number } & Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}/teams/${teamId}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useUpdateClubTraining(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ trainingId, ...body }: { trainingId: number } & Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}/trainings/${trainingId}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "trainings"] }),
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
