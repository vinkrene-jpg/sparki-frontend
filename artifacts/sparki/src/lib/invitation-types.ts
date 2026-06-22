// Client-side invitation types. Mirrors the API shape (timestamps arrive as ISO
// strings over JSON), so the UI never imports server/Drizzle types directly.

import type { Role } from "@/contexts/UserContext"

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked"

export type InvitationRelationship =
  | "coach_athlete"
  | "parent_athlete"
  | "none"

export interface Invitation {
  id: number
  token: string
  inviterClerkId: string
  createdByRole: string
  targetRole: Role
  relationship: InvitationRelationship
  email: string | null
  status: InvitationStatus
  acceptedByClerkId: string | null
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export interface CreateInvitationInput {
  relationship: InvitationRelationship
  targetRole?: Role
  email?: string | null
  expiresInDays?: number
}

export interface AcceptInvitationResult {
  invitation: Invitation
  roles: Role[]
}

export const STATUS_LABEL: Record<InvitationStatus, string> = {
  pending: "Open",
  accepted: "Geaccepteerd",
  expired: "Verlopen",
  revoked: "Ingetrokken",
}

export const RELATIONSHIP_LABEL: Record<InvitationRelationship, string> = {
  coach_athlete: "Coach → atleet",
  parent_athlete: "Ouder → atleet",
  none: "Rol-uitnodiging",
}
