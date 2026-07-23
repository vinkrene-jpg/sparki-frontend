import { apiFetch } from "@/lib/api"

export type ConnectorCategory = "sport" | "health"
export type ConnectorStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "revoked"
  // "Koppelen gestart": the athlete went through the consent flow for a platform
  // whose real API isn't wired yet. Their choice is saved, but no data is
  // imported (honest — "API nog niet actief").
  | "pending"

// 4-state readiness model for each platform (computed server-side by the Data
// Hub). Honest about what works today vs. what's prepared for future API access.
export type ReadinessState = "actief" | "beschikbaar" | "testbaar" | "voorbereid"

export interface ConnectorReadiness {
  available: boolean
  prepared: boolean
  testable: boolean
  active: boolean
  state: ReadinessState
}

export const READINESS_LABELS: Record<ReadinessState, string> = {
  actief: "Actief",
  beschikbaar: "Beschikbaar",
  testbaar: "Testbaar",
  voorbereid: "Voorbereid",
}

// Centraal Sparki Connect-statusmodel (server-side afgeleid). Zelfde bron voor
// onboarding, instellingen, web en mobiel.
export type ConnectStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "sync_in_progress"
  | "action_required"
  | "temporarily_unavailable"
  | "permission_revoked"
  | "disconnected"

export interface ConnectState {
  status: ConnectStatus
  connectedAt: string | null
  lastSuccessfulSyncAt: string | null
  lastSyncAttemptAt: string | null
  lastErrorCategory: "auth" | "permission" | "temporary" | "unknown" | null
  permissionState: "granted" | "revoked" | "none"
  tokenAvailable: boolean
  disconnectedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ConnectCapability =
  | "activity_import"
  | "health_data"
  | "workout_export"
  | "route_export"
  | "webhook_sync"
  | "file_import"

export type CapabilityStatus =
  | "available"
  | "prepared_not_active"
  | "awaiting_official_access"
  | "unsupported"

export type CapabilityMap = Record<ConnectCapability, CapabilityStatus>

// Plain-Nederlandse labels voor de centrale status (geen technische termen).
export const CONNECT_STATUS_LABELS: Record<ConnectStatus, string> = {
  not_connected: "Niet gekoppeld",
  connecting: "Koppelen gestart",
  connected: "Gekoppeld",
  sync_in_progress: "Bezig met ophalen",
  action_required: "Actie nodig",
  temporarily_unavailable: "Tijdelijk niet beschikbaar",
  permission_revoked: "Toestemming ingetrokken",
  disconnected: "Verbroken",
}

// Shape returned by GET /api/connectors — registry definition merged with this
// user's real connection row. Drives both the onboarding connect step and the
// Settings management panel (single source of truth, no duplication).
export interface ConnectorItem {
  id: string
  displayName: string
  category: ConnectorCategory
  available: boolean
  authType: string
  provides: string[]
  unavailableReason: string | null
  status: ConnectorStatus
  lastSyncAt: string | null
  importedDataTypes: string[]
  errorStatus: string | null
  permissionRevoked: boolean
  connectedAt: string | null
  readiness: ConnectorReadiness
  connect: ConnectState
  capabilities: CapabilityMap
}

export async function fetchConnectors(): Promise<ConnectorItem[]> {
  const data = await apiFetch<{ connectors: ConnectorItem[] }>("/api/connectors")
  return data.connectors
}

// Start a real per-user OAuth flow. Returns the provider consent URL; the caller
// redirects the browser there. After consent the provider calls our callback,
// which stores the tokens and redirects back to `returnTo` with `?strava=...`.
export async function beginOauthConnect(
  id: string,
  returnTo: string,
): Promise<string> {
  const data = await apiFetch<{ url: string }>(
    `/api/connectors/${id}/authorize?returnTo=${encodeURIComponent(returnTo)}`,
  )
  return data.url
}

// Start a per-user OAuth flow (e.g. Strava). Returns the provider consent URL
// the browser should navigate to. The backend issues a `state` carrying the
// athlete's id so the callback can verify ownership.
export async function authorizeConnector(id: string): Promise<string> {
  const data = await apiFetch<{ url: string }>(
    `/api/connectors/${id}/authorize`,
  )
  return data.url
}

export async function syncConnector(id: string): Promise<ConnectorItem> {
  const data = await apiFetch<{ connector: ConnectorItem }>(
    `/api/connectors/${id}/sync`,
    { method: "POST" },
  )
  return data.connector
}

export async function disconnectConnector(id: string): Promise<ConnectorItem> {
  const data = await apiFetch<{ connector: ConnectorItem }>(
    `/api/connectors/${id}/disconnect`,
    { method: "POST" },
  )
  return data.connector
}

export async function backfillConnector(id: string): Promise<ConnectorItem> {
  const data = await apiFetch<{ connector: ConnectorItem }>(
    `/api/connectors/${id}/backfill`,
    { method: "POST" },
  )
  return data.connector
}

export interface SyncRun {
  id: string
  trigger: string
  status: string
  startedAt: string
  finishedAt: string | null
  counts: { activities?: number; merged?: number; skipped?: number; errors?: number } | null
  importedDataTypes: string[] | null
  error: string | null
}

export async function fetchConnectorRuns(id: string): Promise<SyncRun[]> {
  const data = await apiFetch<{ runs: SyncRun[] }>(`/api/connectors/${id}/runs`)
  return data.runs
}

export const SYNC_TRIGGER_LABELS: Record<string, string> = {
  manual: "Handmatig",
  scheduled: "Automatisch",
  initial: "Eerste import",
  webhook: "Automatisch (nieuw op platform)",
  backfill: "Historische import",
}

export async function revokeConnector(id: string): Promise<ConnectorItem> {
  const data = await apiFetch<{ connector: ConnectorItem }>(
    `/api/connectors/${id}/revoke`,
    { method: "POST" },
  )
  return data.connector
}

// Dutch labels for the data-type taxonomy so imported types render in the user's
// language. Falls back to the raw key for any unmapped type.
export const DATA_TYPE_LABELS: Record<string, string> = {
  profile: "Profiel",
  weight: "Gewicht",
  ftp: "FTP",
  hr_zones: "Hartslagzones",
  max_hr: "Max hartslag",
  resting_hr: "Rusthartslag",
  hrv: "HRV",
  sleep: "Slaap",
  recovery: "Herstel",
  activities: "Activiteiten",
  training_history: "Trainingshistorie",
  training_load: "Trainingsbelasting",
  personal_records: "Persoonlijke records",
  injury_fatigue_risk: "Blessure- en vermoeidheidsrisico",
  steps: "Stappen",
  calories: "Calorieën",
  spo2: "Zuurstofsaturatie",
  temperature: "Lichaamstemperatuur",
  readiness: "Gereedheid",
}

export function dataTypeLabel(key: string): string {
  return DATA_TYPE_LABELS[key] ?? key
}

export function formatLastSync(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}
