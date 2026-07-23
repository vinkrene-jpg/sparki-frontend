import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type HealthStatusColor = "green" | "orange" | "red" | "grey";
export type HealthUrgency = "low" | "medium" | "high" | "critical";

export type HealthCheck = {
  checkKey: string;
  category: string;
  title: string;
  description: string;
  responsibleModule: string;
  statusColor: HealthStatusColor;
  passed: boolean;
  responseTimeMs: number | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  errorMessage: string | null;
  technicalDetails: string | null;
  userImpact: string;
  urgency: HealthUrgency;
  remediation: string | null;
  resolvedAt: string | null;
};

export type HealthAggregates = {
  active_users?: number;
  new_registrations?: number;
  open_bug_reports?: number;
  feedback_messages?: number;
  failed_imports?: number;
  expired_tokens?: number;
};

export type HealthBatch = {
  id: number;
  runMode: string;
  overallStatus: HealthStatusColor;
  totalChecks: number;
  greenCount: number;
  orangeCount: number;
  redCount: number;
  greyCount: number;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
};

export type HealthDashboard = {
  overall: HealthStatusColor;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  checks: HealthCheck[];
  openErrors: HealthCheck[];
  lastBatch: HealthBatch | null;
  aggregates: HealthAggregates;
};

export type HealthCheckRun = {
  id: number;
  checkKey: string;
  batchId: number | null;
  runMode: string;
  statusColor: HealthStatusColor;
  passed: boolean;
  responseTimeMs: number | null;
  errorMessage: string | null;
  technicalDetails: string | null;
  ranAt: string;
};

export function useAdminHealth(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.health(),
    queryFn: () => apiFetch<HealthDashboard>("/api/admin/health"),
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminHealthCheck(key: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.healthCheck(key),
    queryFn: () =>
      apiFetch<{ check: HealthCheck; history: HealthCheckRun[] }>(
        `/api/admin/health/check/${encodeURIComponent(key)}`,
      ),
    enabled,
    staleTime: 30_000,
  });
}

export type AdminFeedback = {
  id: number;
  feedback_type: string;
  note: string | null;
  createdAt: string;
  reporterName: string | null;
};

export type AdminFailedImport = {
  id: number;
  fileName: string;
  fileType: string;
  status: string;
  errorMessage: string | null;
  uploadedAt: string;
  reporterName: string | null;
};

export function useAdminFeedback(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.feedback(),
    queryFn: () =>
      apiFetch<{ feedback: AdminFeedback[] }>("/api/admin/feedback"),
    enabled,
    staleTime: 60_000,
  });
}

export function useAdminFailedImports(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.failedImports(),
    queryFn: () =>
      apiFetch<{ imports: AdminFailedImport[] }>("/api/admin/failed-imports"),
    enabled,
    staleTime: 60_000,
  });
}

export type ScheduledTask = {
  key: string;
  title: string;
  description: string;
  runCommand: string;
  schedule: string;
  traceLabel: string;
  lastRunAt: string | null;
  statusColor: HealthStatusColor;
  message: string;
};

export function useAdminScheduledTasks(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.scheduledTasks(),
    queryFn: () =>
      apiFetch<{ tasks: ScheduledTask[]; missing: number }>(
        "/api/admin/scheduled-tasks",
      ),
    enabled,
    staleTime: 60_000,
  });
}

export type SyncDiagProvider = {
  provider: string;
  totalRuns: number;
  failedRuns: number;
  partialRuns: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
};

export type SyncDiagRun = {
  id: string;
  provider: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  counts: { fetched?: number; created?: number; merged?: number } | null;
  error: string | null;
  userName: string | null;
};

export type SyncDiagWebhook = {
  provider: string;
  status: string;
  count: number;
};

export type SyncDiagFailedWebhook = {
  id: string;
  provider: string;
  eventId: string;
  status: string;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
};

export function useAdminSyncDiagnostics(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.syncDiagnostics(),
    queryFn: () =>
      apiFetch<{
        providers: SyncDiagProvider[];
        recentRuns: SyncDiagRun[];
        webhooks: SyncDiagWebhook[];
        failedWebhooks: SyncDiagFailedWebhook[];
      }>("/api/admin/sync-diagnostics"),
    enabled,
    staleTime: 60_000,
  });
}


export interface AiInsightPurpose {
  purpose: string;
  label: string;
  provider: string;
  model: string;
  promptVersion: string;
  inputCategories: string[];
  consent: string;
  sensitive: boolean;
  minorBlocked: boolean;
  timeoutMs: number;
  maxRetries: number;
}
export interface AiInsightUsage {
  purpose: string;
  totalCalls: number;
  okCalls: number;
  blockedCalls: number;
  failedCalls: number;
  avgLatencyMs: number | null;
  inputTokens: string | null;
  outputTokens: string | null;
  costMicroUsd: string | null;
  redactedCalls: number;
  lastCallAt: string | null;
}
export interface AiInsightProblem {
  id: number;
  purpose: string;
  provider: string;
  model: string;
  status: string;
  errorCode: string | null;
  retries: number;
  latencyMs: number | null;
  createdAt: string;
}

export function useAdminAiInsights(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.aiInsights(),
    queryFn: () =>
      apiFetch<{
        purposes: AiInsightPurpose[];
        usage: AiInsightUsage[];
        statuses: { status: string; count: number }[];
        recentProblems: AiInsightProblem[];
        last24h: { calls: number; costMicroUsd: string | null };
      }>("/api/admin/ai-insights"),
    enabled,
    staleTime: 60_000,
  });
}

export function useAdminHealthBatches(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.healthBatches(),
    queryFn: () =>
      apiFetch<{ batches: HealthBatch[]; releaseChecks: HealthBatch[] }>(
        "/api/admin/health/batches",
      ),
    enabled,
    staleTime: 60_000,
  });
}

// Run the whole engine now ("Controleer nu").
export function useRunHealthChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; batchId: number }>("/api/admin/health/run", {
        method: "POST",
        body: JSON.stringify({ mode: "manual" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.all() });
    },
  });
}

// Re-run a single check ("Opnieuw testen").
export function useRunSingleHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<{ ok: true }>("/api/admin/health/run", {
        method: "POST",
        body: JSON.stringify({ key }),
      }),
    onSuccess: (_data, key) => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.health() });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.healthCheck(key) });
    },
  });
}

// Kwaliteitsdashboard van de feedbacklus op analyses.
export type QualityEngineRow = {
  engine: string;
  engine_version: string;
  total: number;
  onjuist: number;
  nuttig: number;
  opvolging: number;
  opgevolgd: number;
};
export type QualityRuleRow = {
  engine: string;
  rule_key: string;
  total: number;
  onjuist: number;
};
export type QualityIncorrectRow = {
  id: number;
  subjectType: string;
  subjectKey: string;
  actorRole: string;
  reasonCode: string | null;
  reasonText: string | null;
  context: Record<string, unknown> | null;
  updatedAt: string;
};
export type AdminQuality = {
  totals: Record<string, number>;
  byEngine: QualityEngineRow[];
  byRule: QualityRuleRow[];
  recentIncorrect: QualityIncorrectRow[];
};

export function useAdminQuality(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "quality"],
    enabled,
    queryFn: () => apiFetch<AdminQuality>("/api/admin/quality"),
  });
}

// Acknowledge a failure as handled ("Markeer als opgelost").
export function useResolveHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) =>
      apiFetch<{ ok: true }>(
        `/api/admin/health/check/${encodeURIComponent(key)}/resolve`,
        { method: "POST" },
      ),
    onSuccess: (_data, key) => {
      void qc.invalidateQueries({ queryKey: queryKeys.admin.health() });
      void qc.invalidateQueries({ queryKey: queryKeys.admin.healthCheck(key) });
    },
  });
}

// ── Gegevensbroncontrole (alleen admin/testers) ──────────────────────────────
export interface ProvenanceSurface {
  key: string;
  label: string;
  bron: string;
  berekening: string;
  aantalRecords: number | null;
  laatsteRecordId: number | null;
  laatsteUpdate: string | null;
  gebruiker: string;
  herkomst: string;
}

export function useAdminProvenance(clerkId: string) {
  const target = clerkId.trim();
  return useQuery({
    queryKey: [...queryKeys.admin.all(), "provenance", target],
    queryFn: () =>
      apiFetch<{
        gebruiker: { clerkId: string; email: string; naam: string };
        surfaces: ProvenanceSurface[];
      }>(`/api/admin/data-provenance?clerkId=${encodeURIComponent(target)}`),
    enabled: target.length > 0,
    staleTime: 30_000,
  });
}
