import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useUser } from "@clerk/react"
import { DEV_PREVIEW } from "@/lib/dev"
import { apiFetch } from "@/lib/api"
import { STALE, queryKeys } from "@/lib/query-keys"

// Golf 26 — gezondheids- en herstelflow. Eén hookset op /api/health-flow;
// de engine op de server is de enige waarheid (geen dubbele status client-side).

export interface HealthComplaint {
  id: number
  kind: "ziekte" | "blessure" | "pijn"
  bodyLocation: string | null
  severity: "licht" | "matig" | "ernstig"
  startDate: string
  trainingImpact: "geen" | "aangepast" | "niet_trainen"
  status: "actief" | "herstellende" | "hersteld"
  source: string
  professionalInstruction: string | null
  notes: string | null
  resolvedAt: string | null
  resumptionConfirmedAt: string | null
  createdAt: string
}

export interface HealthComplaintUpdate {
  id: number
  complaintId: number
  statusAfter: string | null
  trainingImpactAfter: string | null
  severityAfter: string | null
  note: string | null
  createdAt: string
}

export interface HealthSignal {
  source: string
  title: string
  detail: string
  severity: "info" | "let_op" | "ernstig"
  complaintId?: number
  at: string
}

export interface HealthOverview {
  healthStatus: string
  complaints: (HealthComplaint & { updates: HealthComplaintUpdate[] })[]
  signals: HealthSignal[]
  readiness: { label: string; score: number | null; basis: string[] }
  resumption: {
    active: boolean
    day: number | null
    windowDays: number
    advice: string | null
    loadFactor: number | null
  }
  canResume: boolean
}

export interface ComplaintHistoryEntry {
  complaint: HealthComplaint
  updates: HealthComplaintUpdate[]
  durationDays: number | null
  missedWorkouts: number
  adjustedWorkouts: number
  resumedAt: string | null
}

export interface CheckinContext {
  ask: string[]
  doneToday: boolean
  hasActiveComplaint: boolean
}

export interface SafetyInfo {
  infoText: string
  shareWithContacts: boolean
}

const KEYS = {
  overview: ["health-flow", "overview"] as const,
  history: ["health-flow", "history"] as const,
  checkinContext: ["health-flow", "checkin-context"] as const,
  safetyInfo: ["health-flow", "safety-info"] as const,
}

function useEnabled() {
  const { isSignedIn } = useUser()
  return isSignedIn === true || DEV_PREVIEW
}

export function useHealthOverview() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: KEYS.overview,
    queryFn: () => apiFetch<HealthOverview>("/api/health-flow/overview"),
    enabled,
    staleTime: STALE.session,
  })
}

export function useComplaintHistory(open: boolean) {
  const enabled = useEnabled()
  return useQuery({
    queryKey: KEYS.history,
    queryFn: () => apiFetch<ComplaintHistoryEntry[]>("/api/health-flow/history"),
    enabled: enabled && open,
    staleTime: STALE.session,
  })
}

export function useCheckinContext() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: KEYS.checkinContext,
    queryFn: () => apiFetch<CheckinContext>("/api/health-flow/checkin-context"),
    enabled,
    staleTime: 60_000,
  })
}

export function useSafetyInfo() {
  const enabled = useEnabled()
  return useQuery({
    queryKey: KEYS.safetyInfo,
    queryFn: () => apiFetch<SafetyInfo>("/api/health-flow/safety-info"),
    enabled,
    staleTime: STALE.session,
  })
}

function useInvalidateHealth() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ["health-flow"] })
    void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() })
    void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() })
    void qc.invalidateQueries({ queryKey: queryKeys.athlete.metrics() })
  }
}

export interface NewComplaint {
  kind: string
  bodyLocation?: string
  severity: string
  startDate: string
  trainingImpact: string
  source?: string
  professionalInstruction?: string
  notes?: string
}

export function useCreateComplaint() {
  const invalidate = useInvalidateHealth()
  return useMutation({
    mutationFn: (data: NewComplaint) =>
      apiFetch<{ complaint: HealthComplaint; healthStatus: string }>(
        "/api/health-flow/complaints",
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: invalidate,
  })
}

export function useUpdateComplaint() {
  const invalidate = useInvalidateHealth()
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number
      status?: string
      trainingImpact?: string
      severity?: string
      note?: string
    }) =>
      apiFetch<{ ok: boolean; healthStatus: string }>(
        `/api/health-flow/complaints/${id}/updates`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: invalidate,
  })
}

export function useConfirmResumption() {
  const invalidate = useInvalidateHealth()
  return useMutation({
    mutationFn: () =>
      apiFetch<HealthOverview>("/api/health-flow/resume", { method: "POST" }),
    onSuccess: invalidate,
  })
}

export function useSaveSafetyInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SafetyInfo) =>
      apiFetch<SafetyInfo>("/api/health-flow/safety-info", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.safetyInfo })
    },
  })
}
