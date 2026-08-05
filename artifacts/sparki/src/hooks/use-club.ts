import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchBlob } from "@/lib/api"
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

// HERSTEL_EN_AANVULLING_01 F2 (HA-06): organisatiecontext voor de schil.
// Sporters tonen hun teamidentiteit (bestaand gedrag); elke andere rol toont
// de club(s) waarvan dit account actief lid is — je moet op elk scherm kunnen
// benoemen in welke organisatie je zit. Eén hook zodat beide schillen
// (CommercialShell + ScreenShell) exact dezelfde context tonen.
export function useShellOrganisatie() {
  const { profile } = useUserProfile()
  const rol = profile?.activeRole ?? "athlete"
  const athlete = rol === "athlete"
  const { data: teamData } = useTeamIdentity()
  const clubsQuery = useMyClubs()
  if (athlete) {
    const team = teamData?.team ?? null
    return team
      ? {
          naam: team.clubName,
          teamNaam: team.teamName ?? null,
          kleur: team.primaryColor ?? null,
          logoUrl: team.logoUrl ?? null,
          extra: 0,
        }
      : null
  }
  const rows = (clubsQuery.data ?? []).filter((r) => r.club != null)
  const eerste = rows[0]?.club
  if (!eerste) return null
  return {
    naam: eerste.name,
    teamNaam: null,
    kleur: eerste.primaryColor ?? null,
    logoUrl: eerste.logoUrl ?? null,
    extra: rows.length - 1,
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
  | "ploegleider"
  | "soigneur"
  | "medical_staff"
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

// F7 — bijlage op een bericht. Een link, óf een bestand/afbeelding dat via het
// beveiligde serve-endpoint (url) gedownload wordt. Een ingetrokken bestand
// (revoked) wordt niet meer aangeboden; het serve-endpoint geeft dan 410.
export type MessageAttachment =
  | { id: number; kind: "link"; url: string; title: string | null }
  | {
      id: number
      kind: "afbeelding" | "bestand"
      fileId: number | null
      name: string | null
      contentType: string | null
      sizeBytes: number | null
      revoked: boolean
      url: string
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
  attachments: MessageAttachment[]
}

export type ClubMemberRow = {
  id: number
  clerkId: string
  role: ClubRole
  joinedAt: string
  endedAt: string | null
  displayName: string | null
  email: string | null
  medicalSpecialty?: string | null
  isYouth?: boolean | null
  // BB-11: afgeleide VOG-status voor clubbeheer — "geldig" | "verlopen" |
  // "ontbreekt"; null = gast (n.v.t.); undefined = geen beheerder (niet gedeeld).
  vogStatus?: "geldig" | "verlopen" | "ontbreekt" | null
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

export function useMyClubs(opts?: { authzFresh?: boolean }) {
  return useQuery<ClubMembershipRow[]>({
    queryKey: ["clubs"],
    queryFn: () => apiFetch("/api/clubs"),
    // Voor autorisatiebeslissingen (rolbezit-poort) mag geen stale cache
    // meetellen: altijd vers ophalen bij mount.
    ...(opts?.authzFresh ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
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
    mutationFn: (body: {
      name: string
      description?: string
      location?: string
      concept?: boolean
      // TEAM_ONBOARDING_01: "TEAM" = zelfstandige teamorganisatie op de
      // bestaande container; weggelaten = CLUB.
      organisationType?: "CLUB" | "TEAM"
    }) => apiFetch("/api/clubs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

// ── CLUB_ONBOARDING_01: van registratie tot actief ──────────────────────────
export type ClubOnboardingState = {
  status: string
  organisationType: "CLUB" | "TEAM"
  missing: string[]
  steps: {
    profiel: boolean
    contact: boolean
    logo: boolean
    seizoen: boolean
    organogram: boolean
    stafplekken: number
    teams: number
    beheerders: number
    trainers: number
    leden: number
  }
  klaarVoorActivatie: boolean
}

export function useClubOnboarding(clubId: number | null, enabled = true) {
  return useQuery<ClubOnboardingState>({
    queryKey: ["clubs", clubId, "onboarding"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/onboarding`),
    enabled: clubId != null && enabled,
  })
}

export function useActivateClub(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch(`/api/clubs/${clubId}/activate`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useSetClubLogo(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { logoUrl: string; contentType: string; size: number }) =>
      apiFetch(`/api/clubs/${clubId}/logo`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useAddOnboardingManager(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { email: string; role: string; medicalSpecialty?: string }) =>
      apiFetch(`/api/clubs/${clubId}/onboarding/managers`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

// ── TEAM_ONBOARDING_01: organogram-kaarten en stafplekken ────────────────────
export type OrganogramTemplate = {
  key: string
  naam: string
  beschrijving: string
  selecties: string[]
  staf: { role: string; aantal: number; medicalSpecialty?: string }[]
}

export function useOrganogramTemplates(enabled = true) {
  return useQuery<{ templates: OrganogramTemplate[] }>({
    queryKey: ["organogram-templates"],
    queryFn: () => apiFetch("/api/clubs/organogram-templates"),
    enabled,
    staleTime: Infinity,
  })
}

export function useApplyOrganogram(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { template: string }) =>
      apiFetch(`/api/clubs/${clubId}/organogram`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

// Addendum: rolgestuurde start — per rol één eerste actie of een eerlijke
// lege toestand, server-side afgeleid uit de werkelijke inrichting.
export type RoleStart = {
  role: string
  rolLabel: string
  organisationType: "CLUB" | "TEAM"
  clubStatus: string
  werkgebied: string
  eersteActie: { label: string; uitleg: string; doel: string } | null
  legeToestand: {
    soort: "nog_niet_ingericht" | "niet_toegewezen" | "geen_toestemming" | "geen_open_acties"
    watOntbreekt: string
    waarom: string
    wie: string
    vervolgstap: string
  } | null
  seizoenen: number
  selecties: number
}

export function useRoleStart(clubId: number | null) {
  return useQuery<RoleStart>({
    queryKey: ["club-role-start", clubId],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/start`),
    enabled: clubId != null,
  })
}

export type StaffSlot = {
  id: number
  clubId: number
  teamId: number | null
  role: string
  medicalSpecialty: string | null
  label: string | null
}

export function useStaffSlots(clubId: number | null, enabled = true) {
  return useQuery<{ slots: StaffSlot[]; bezetting: Record<string, number> }>({
    queryKey: ["clubs", clubId, "staff-slots"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/staff-slots`),
    enabled: clubId != null && enabled,
  })
}

export function useAddStaffSlot(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { role: string; teamId?: number; medicalSpecialty?: string; label?: string }) =>
      apiFetch(`/api/clubs/${clubId}/staff-slots`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "staff-slots"] }),
  })
}

export function useDeleteStaffSlot(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (slotId: number) =>
      apiFetch(`/api/clubs/${clubId}/staff-slots/${slotId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "staff-slots"] }),
  })
}

export type ClubImportRow = {
  id: number
  rowNumber: number
  email: string | null
  name: string | null
  status: string
  message: string | null
}

export function useCreateClubImport(clubId: number | null) {
  return useMutation({
    mutationFn: (body: { fileName?: string; rows: { email: string; name?: string }[] }) =>
      apiFetch(`/api/clubs/${clubId}/import`, { method: "POST", body: JSON.stringify(body) }) as Promise<{
        batch: { id: number; totalRows: number }
        rows: ClubImportRow[]
        klaar: number
      }>,
  })
}

export function useConfirmClubImport(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (batchId: number) =>
      apiFetch(`/api/clubs/${clubId}/import/${batchId}/confirm`, { method: "POST" }) as Promise<{
        toegevoegd: number
        nietVerwerkt: number
      }>,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs"] }),
  })
}

export function useCancelClubImport(clubId: number | null) {
  return useMutation({
    mutationFn: (batchId: number) =>
      apiFetch(`/api/clubs/${clubId}/import/${batchId}/cancel`, { method: "POST" }),
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

// F7 — bijlage-invoer bij het opstellen: een link of een base64-bestand. De
// server blijft de waarheid (type/grootte/inhoud); een weigering komt terug als
// nette 4xx-melding.
export type ComposeAttachment =
  | { kind: "link"; url: string; title: string | null }
  | { kind: "file"; base64: string; name: string }

export function usePostClubMessage(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      body: string
      scope?: string
      teamId?: number
      groupId?: number
      parentId?: number
      attachments?: ComposeAttachment[]
    }) =>
      apiFetch(`/api/clubs/${clubId}/messages`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId, "messages"] }),
  })
}

// F7 — een bijlage (bestand) intrekken. Alleen de afzender of clubbeheer; daarna
// is het bestand nergens meer downloadbaar (410), ook niet via een oude link.
export function useRevokeClubAttachment(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ messageId, attachmentId }: { messageId: number; attachmentId: number }) =>
      apiFetch(
        `/api/clubs/${clubId}/messages/${messageId}/attachments/${attachmentId}/revoke`,
        { method: "POST" },
      ),
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

// WP-03: uitnodigingenoverzicht (statussen + intrekken).
export type InvitationRow = {
  id: number
  token: string
  relationship: string
  clubId: number | null
  email: string | null
  status: "pending" | "accepted" | "declined" | "revoked" | "expired"
  expiresAt: string | null
  createdAt: string
}

export function useClubInvitations(clubId: number | null, enabled = true) {
  return useQuery<InvitationRow[]>({
    queryKey: ["invitations", "club", clubId],
    queryFn: () => apiFetch<InvitationRow[]>(`/api/clubs/${clubId}/invitations`),
    enabled: clubId != null && enabled,
  })
}

export function useRevokeInvitation(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/api/invitations/${id}/revoke`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invitations", "club", clubId] }),
  })
}

export function useSetMemberRole(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, role, medicalSpecialty }: { memberId: number; role: ClubRole; medicalSpecialty?: string | null }) =>
      apiFetch(`/api/clubs/${clubId}/members/${memberId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role, ...(medicalSpecialty !== undefined ? { medicalSpecialty } : {}) }),
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

// CLUB_AFRONDING_01 C1 — herhalende clubtrainingen (reeksen).
export type ClubTrainingSeries = {
  id: number
  title: string
  frequency: string
  startDate: string
  endDate: string
  startTime: string | null
  location: string | null
  status: "active" | "ended" | "cancelled"
}

export function useClubTrainingSeries(clubId: number | null) {
  return useQuery<ClubTrainingSeries[]>({
    queryKey: ["clubs", clubId, "training-series"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/training-series`),
    enabled: clubId != null,
  })
}

export function useCreateClubTrainingSeries(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/clubs/${clubId}/training-series`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["clubs", clubId] }),
  })
}

export function useClubTrainingSeriesAction(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ seriesId, action, body }: { seriesId: number; action: "end" | "cancel" | "skip"; body?: Record<string, unknown> }) =>
      action === "cancel"
        ? apiFetch(`/api/clubs/${clubId}/training-series/${seriesId}`, { method: "DELETE" })
        : apiFetch(`/api/clubs/${clubId}/training-series/${seriesId}/${action}`, {
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
          }),
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

// TEAM_ABONNEMENT_01: Sparki Team-abonnement (centrale facturatie).
export function useTeamSubscription(clubId: number | null, enabled = true) {
  return useQuery<{
    subscription: ClubDashboard["subscription"]
    isTeam: boolean
    counts: { members: number; trainers: number }
    pricing: { monthCents: number; yearCents: number }
    billing: { status: string; interval: string; currentPeriodEnd: string | null } | null
    checkoutAvailable: boolean
  }>({
    queryKey: ["clubs", clubId, "team-subscription"],
    queryFn: () => apiFetch(`/api/clubs/${clubId}/team-subscription`),
    enabled: clubId != null && enabled,
  })
}

export function useStartTeamCheckout(clubId: number | null) {
  return useMutation({
    mutationFn: (interval: "month" | "year") =>
      apiFetch<{ url: string }>(`/api/clubs/${clubId}/team-subscription/checkout`, {
        method: "POST",
        body: JSON.stringify({ interval }),
      }),
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

// ── F8: Clubdocumenten (versies + publicatie + zichtbaarheid) ────────────────
export type ClubDocumentVisibility = "leden_en_ouders" | "trainers_bestuur"
export type ClubDocumentVersionRow = {
  id: number
  versionNumber: number
  status: "concept" | "gepubliceerd"
  mediaType: string
  sizeBytes: number | null
  publishedAt: string | null
  createdAt: string
  isCurrent: boolean
}
export type ClubDocumentRow = {
  id: number
  title: string
  category: string
  visibility: ClubDocumentVisibility
  createdAt: string
  updatedAt: string
  current: {
    id: number
    versionNumber: number
    mediaType: string
    sizeBytes: number | null
    publishedAt: string | null
  } | null
  versions?: ClubDocumentVersionRow[]
}
export type ClubDocumentsResponse = {
  documents: ClubDocumentRow[]
  magBeheren: boolean
  categorieen: string[]
  zichtbaarheden: ClubDocumentVisibility[]
}

const CLUB_DOCS_KEY = (clubId: number | null) => ["clubs", clubId, "documents"]

export function useClubDocuments(clubId: number | null) {
  return useQuery<ClubDocumentsResponse>({
    queryKey: CLUB_DOCS_KEY(clubId),
    queryFn: () => apiFetch(`/api/clubs/${clubId}/documents`),
    enabled: clubId != null,
  })
}

export function useCreateClubDocument(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      title: string
      category: string
      visibility: ClubDocumentVisibility
      base64: string
      originalName: string
      publish: boolean
    }) =>
      apiFetch(`/api/clubs/${clubId}/documents`, {
        method: "POST",
        body: JSON.stringify(body),
      }) as Promise<{ id: number; versionId: number }>,
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLUB_DOCS_KEY(clubId) }),
  })
}

export function useAddClubDocumentVersion(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      base64,
      originalName,
      publish,
    }: {
      documentId: number
      base64: string
      originalName: string
      publish: boolean
    }) =>
      apiFetch(`/api/clubs/${clubId}/documents/${documentId}/versions`, {
        method: "POST",
        body: JSON.stringify({ base64, originalName, publish }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLUB_DOCS_KEY(clubId) }),
  })
}

export function usePublishClubDocumentVersion(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, versionId }: { documentId: number; versionId: number }) =>
      apiFetch(`/api/clubs/${clubId}/documents/${documentId}/versions/${versionId}/publish`, {
        method: "POST",
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLUB_DOCS_KEY(clubId) }),
  })
}

export function useUpdateClubDocument(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      documentId,
      ...body
    }: {
      documentId: number
      title?: string
      category?: string
      visibility?: ClubDocumentVisibility
    }) =>
      apiFetch(`/api/clubs/${clubId}/documents/${documentId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLUB_DOCS_KEY(clubId) }),
  })
}

export function useDeleteClubDocument(clubId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (documentId: number) =>
      apiFetch(`/api/clubs/${clubId}/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: CLUB_DOCS_KEY(clubId) }),
  })
}

// Beveiligde download: het serve-endpoint is de enige poort (rechten +
// zichtbaarheid + intrekking). We halen als blob op (cookies/dev-header gaan
// mee) en bieden hem lokaal aan als download.
export async function downloadClubDocument(
  clubId: number,
  documentId: number,
  fileName: string,
  versionId?: number,
): Promise<void> {
  const q = versionId != null ? `?versionId=${versionId}` : ""
  const blob = await apiFetchBlob(`/api/clubs/${clubId}/documents/${documentId}/download${q}`)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
