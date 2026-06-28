import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ActivityImportStatus = "uploaded" | "parsed" | "failed" | "linked";
export type ActivityImportFileType = "gpx" | "fit" | "tcx" | "csv" | "unknown";

export type GpxSummary = {
  pointCount: number;
  distanceKm: number | null;
  elevationGainM: number | null;
  startTime: string | null;
  endTime: string | null;
  durationSec: number | null;
  trackName: string | null;
};

// Real metrics decoded from a binary FIT activity file (Garmin/Wahoo/Zwift).
// Any metric the file does not contain stays null and is shown as "ontbreekt".
export type FitSummary = {
  format: "fit";
  sport: string | null;
  startTime: string | null;
  durationSec: number | null;
  distanceKm: number | null;
  elevationGainM: number | null;
  avgPower: number | null;
  maxPower: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  calories: number | null;
  recordCount: number;
};

export type ActivityImport = {
  id: number;
  clerkId: string;
  fileName: string;
  fileType: ActivityImportFileType;
  source: string;
  uploadedAt: string;
  status: ActivityImportStatus;
  parsedSummary: GpxSummary | FitSummary | Record<string, unknown> | null;
  errorMessage: string | null;
  linkedTrainingSessionId: number | null;
};

export function useActivityImports() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.activityImports.list(),
    queryFn: () =>
      apiFetch<{ imports: ActivityImport[] }>("/api/activity-imports?limit=30"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 2 * 60_000,
  });
}

export function useUploadActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fileName: string
      content?: string
      contentBase64?: string
    }) =>
      apiFetch<{ import: ActivityImport; parsed: boolean }>(
        "/api/activity-imports",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activityImports.all() });
    },
  });
}

// Link (or unlink) an import to one of the athlete's training sessions.
// Pass sessionId: null to unlink.
export function useLinkActivityImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; sessionId: number | null }) =>
      apiFetch<{ import: ActivityImport }>(
        `/api/activity-imports/${input.id}/link`,
        { method: "PATCH", body: JSON.stringify({ sessionId: input.sessionId }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activityImports.all() });
    },
  });
}

export function useDeleteActivityImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/activity-imports/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.activityImports.all() });
    },
  });
}
