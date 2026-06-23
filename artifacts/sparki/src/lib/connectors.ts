import { apiFetch } from "@/lib/api"

export type ConnectorCategory = "sport" | "health"
export type ConnectorStatus = "connected" | "disconnected" | "error" | "revoked"

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
}

export async function fetchConnectors(): Promise<ConnectorItem[]> {
  const data = await apiFetch<{ connectors: ConnectorItem[] }>("/api/connectors")
  return data.connectors
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
