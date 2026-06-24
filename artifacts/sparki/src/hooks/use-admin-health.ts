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
