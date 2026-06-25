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
