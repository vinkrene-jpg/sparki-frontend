import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type BugReportStatus = "new" | "triaged" | "fixed" | "rejected";
export type BugReportKind = "bug" | "idea" | "other";

export type BugReport = {
  id: number;
  clerkId: string;
  reporterName?: string | null;
  userRole: string | null;
  kind?: BugReportKind;
  pageUrl: string | null;
  description: string;
  screenshotUrl: string | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
};

export type BugReportInput = {
  description: string;
  kind?: BugReportKind;
  userRole?: string | null;
  pageUrl?: string | null;
  screenshotUrl?: string | null;
  screenshotObjectPath?: string | null;
};

// Upload a screenshot via the presigned-URL flow (cookie-authenticated, owner =
// the reporter). Returns the canonical object path to send with the report. The
// bytes go DIRECTLY to storage — never through our API server.
export async function uploadBugScreenshot(file: File): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const { uploadURL, objectPath } = await apiFetch<{
    uploadURL: string;
    objectPath: string;
  }>("/api/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType,
    }),
  });
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) throw new Error("Uploaden van screenshot is mislukt");
  return objectPath;
}

export function useCreateBugReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BugReportInput) =>
      apiFetch<{ report: BugReport }>("/api/bug-reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bugReports.all() });
    },
  });
}

// The caller's own reports, so a tester can see the current status of every
// bug/idea they submitted (with the same Dutch labels as the admin inbox).
export function useMyBugReports(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bugReports.mine(),
    queryFn: () => apiFetch<{ reports: BugReport[] }>("/api/bug-reports/mine"),
    enabled,
    staleTime: 30_000,
  });
}

export function useAdminBugReports(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.bugReports.admin(),
    queryFn: () =>
      apiFetch<{ reports: BugReport[] }>("/api/bug-reports/admin"),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateBugReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; status: BugReportStatus }) =>
      apiFetch<{ report: BugReport }>(`/api/bug-reports/admin/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: input.status }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.bugReports.admin() });
    },
  });
}

export type AdminStatus = Record<string, number>;

export function useAdminWhoami() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.admin.whoami(),
    queryFn: () =>
      apiFetch<{ clerkId: string; isAdmin: boolean }>("/api/admin/whoami"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 5 * 60_000,
  });
}

export function useAdminStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.status(),
    queryFn: () => apiFetch<{ status: AdminStatus }>("/api/admin/status"),
    enabled,
    staleTime: 60_000,
  });
}
