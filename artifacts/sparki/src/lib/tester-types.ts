// Admin tester-overview types + derivations. Mirrors GET /api/admin/testers.
// One row per invitation; accepted invites carry the joined profile + telemetry
// + feedback counts. Missing values arrive as null and are shown honestly ("—").

import type { InvitationRelationship } from "@/lib/invitation-types"

export interface TesterRow {
  invitationId: number
  inviteEmail: string | null
  relationship: InvitationRelationship
  targetRole: string
  inviteStatus: "pending" | "accepted" | "expired" | "revoked"
  invitedAt: string
  acceptedByClerkId: string | null
  displayName: string | null
  profileEmail: string | null
  roles: string[] | null
  isHeadTester: boolean | null
  headTesterNumber: number | null
  lastSeenAt: string | null
  lastPlatform: string | null
  appVersion: string | null
  testerCompletedAt: string | null
  feedbackTotal: number
  bugs: number
  ideas: number
}

export type TesterStatus =
  | "uitgenodigd"
  | "actief"
  | "klaar"
  | "verlopen"
  | "ingetrokken"

export const TESTER_STATUS_LABEL: Record<TesterStatus, string> = {
  uitgenodigd: "Uitgenodigd",
  actief: "Actief",
  klaar: "Klaar",
  verlopen: "Verlopen",
  ingetrokken: "Ingetrokken",
}

// Status is the tester lifecycle, derived from the real invite state + the
// admin-set "Klaar" marker — not a fabricated field.
export function testerStatus(t: TesterRow): TesterStatus {
  if (t.testerCompletedAt) return "klaar"
  if (t.acceptedByClerkId) return "actief"
  if (t.inviteStatus === "revoked") return "ingetrokken"
  if (t.inviteStatus === "expired") return "verlopen"
  return "uitgenodigd"
}

// Role label in plain Dutch, from the strongest signal available.
export function testerRole(t: TesterRow): string {
  if (t.isHeadTester || t.relationship === "head_tester") return "Hoofdtester"
  const roles = t.roles ?? []
  if (roles.includes("coach") || t.targetRole === "coach") return "Coach"
  if (roles.includes("parent") || t.targetRole === "parent") return "Ouder"
  return "Tester"
}

// Display name, falling back through the honest chain of what's known.
export function testerName(t: TesterRow): string {
  return t.displayName || t.profileEmail || t.inviteEmail || "Onbekende tester"
}

// Zero-padded tester number ("#001") when one exists, else null.
export function testerNumber(t: TesterRow): string | null {
  if (t.headTesterNumber == null) return null
  return `#${String(t.headTesterNumber).padStart(3, "0")}`
}

// ── Test Management Dashboard 2.0 ─────────────────────────────────────────────
// Mirrors GET /api/admin/test-dashboard. Everything is derived from real
// telemetry + existing data; absent values are honest zeroes (UI shows
// "nog niet gemeten"), never fabricated.

export type CoverageStatus = "never" | "viewed" | "active"
export type ReliabilityLevel = "geen" | "laag" | "gemiddeld" | "hoog"
export type TestPhase =
  | "nog-niet-gestart"
  | "onboarding"
  | "verkennend"
  | "actief"
  | "grondig"

export interface ScreenCoverage {
  key: string
  label: string
  views: number
  status: CoverageStatus
}

export interface TesterScores {
  compleetheid: number
  activiteit: number
  feedbackkwaliteit: number
  herhaalbaarheid: number
  testscore: number
  reliability: ReliabilityLevel
  phase: TestPhase
}

export interface TesterUsage {
  sessions: number
  totalSeconds: number
  avgSeconds: number
  activeDays30: number
  featureUses: number
  lastActivityAt: string | null
  hasData: boolean
}

export interface TesterConnector {
  provider: string
  status: string
  available: boolean
  lastSyncAt: string | null
  importedDataTypes: string[]
  permissionRevoked: boolean
  errorStatus: string | null
}

export interface TesterFeedbackBreakdown {
  total: number
  bugs: number
  ideas: number
  others: number
  openCount: number
  fixedCount: number
  avgDescLen: number
}

export interface DashboardTester {
  clerkId: string
  displayName: string | null
  email: string | null
  roles: string[]
  isHeadTester: boolean
  headTesterNumber: number | null
  lastPlatform: string | null
  appVersion: string | null
  testerCompletedAt: string | null
  invitedAt: string | null
  usage: TesterUsage
  coverage: ScreenCoverage[]
  coveragePct: number
  onboarding: {
    coreCompleted: boolean
    fullyComplete: boolean
    completedSteps: number
  } | null
  connectors: TesterConnector[]
  connectedConnectors: number
  feedback: TesterFeedbackBreakdown
  scores: TesterScores
}

export interface CoveragePerScreen {
  key: string
  label: string
  never: number
  viewed: number
  active: number
  openedPct: number
}

export interface DashboardSignal {
  tone: "info" | "warn" | "good"
  message: string
}

export interface DashboardSummary {
  total: number
  activeTesters: number
  notStarted: number
  completedOnboarding: number
  completedTesting: number
  avgTestscore: number
  totalFeedback: number
  openBugs: number
  coveragePerScreen: CoveragePerScreen[]
  signals: DashboardSignal[]
}

export interface TestDashboard {
  summary: DashboardSummary
  testers: DashboardTester[]
}

export const RELIABILITY_LABEL: Record<ReliabilityLevel, string> = {
  geen: "Geen data",
  laag: "Laag",
  gemiddeld: "Gemiddeld",
  hoog: "Hoog",
}

export const PHASE_LABEL: Record<TestPhase, string> = {
  "nog-niet-gestart": "Nog niet gestart",
  onboarding: "Onboarding",
  verkennend: "Verkennend",
  actief: "Actief testen",
  grondig: "Grondige tester",
}

// Human-readable duration from seconds, honest "—" when there's nothing.
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "—"
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `${hours}u ${rem}m` : `${hours}u`
}

// Relative "laatst actief" in plain Dutch, honest "nog niet gemeten" when null.
export function formatLastActivity(iso: string | null): string {
  if (!iso) return "nog niet gemeten"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "nog niet gemeten"
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "zojuist"
  if (mins < 60) return `${mins} min geleden`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  if (days === 1) return "gisteren"
  if (days < 30) return `${days} dagen geleden`
  const months = Math.floor(days / 30)
  return months === 1 ? "1 maand geleden" : `${months} maanden geleden`
}
