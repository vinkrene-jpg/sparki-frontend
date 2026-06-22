import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type BugReportStatus = "new" | "triaged" | "fixed" | "rejected";

export type BugReport = {
  id: number;
  clerkId: string;
  reporterName?: string | null;
  userRole: string | null;
  pageUrl: string | null;
  description: string;
  screenshotUrl: string | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
};

export type BugReportInput = {
  description: string;
  userRole?: string | null;
  pageUrl?: string | null;
  screenshotUrl?: string | null;
};

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
