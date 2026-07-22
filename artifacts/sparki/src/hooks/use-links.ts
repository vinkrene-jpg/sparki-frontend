import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type LinkedPerson = {
  clerkId: string;
  displayName: string | null;
  email: string;
  status: "pending" | "accepted";
  createdAt: string;
};

export function useMyLinks(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.links.mine(),
    queryFn: () =>
      apiFetch<{ coaches: LinkedPerson[]; parents: LinkedPerson[] }>(
        "/api/links",
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

// ── Sporter-kant ouderomgeving (Afbouwgolf 12) ───────────────────────────────

import type { ParentAccess, ParentDataCategory, ParentReport } from "./use-parent";

export type ManagedParent = {
  parentClerkId: string;
  displayName: string | null;
  email: string | null;
  status: string;
  relationship: string;
  access: ParentAccess | null;
  raw: Record<string, boolean> | null;
};

export function useParentsManage(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.links.parents(),
    queryFn: () =>
      apiFetch<{
        parents: ManagedParent[];
        categoryLabels: Record<ParentDataCategory, string>;
      }>("/api/links/parents/manage"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 60_000,
  });
}

export function useSetParentPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      parentClerkId,
      permissions,
    }: {
      parentClerkId: string;
      permissions: Record<ParentDataCategory, boolean>;
    }) =>
      apiFetch<{ ok: true }>(`/api/links/parent/${parentClerkId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.links.all() });
    },
  });
}

export function useReconfirmParent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (parentClerkId: string) =>
      apiFetch<{ ok: true; tier: string }>(
        `/api/links/parent/${parentClerkId}/reconfirm`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.links.all() });
    },
  });
}

export function useMyParentReports(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.links.parentReports(),
    queryFn: () =>
      apiFetch<{ reports: ParentReport[] }>("/api/links/parent-reports"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 60_000,
  });
}

export function useSetParentReportStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "gezien" | "afgerond" }) =>
      apiFetch<{ report: ParentReport }>(
        `/api/links/parent-reports/${id}/status`,
        { method: "POST", body: JSON.stringify({ status }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.links.parentReports() });
    },
  });
}

export function useRevokeLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      kind,
      clerkId,
    }: {
      kind: "coach" | "parent";
      clerkId: string;
    }) =>
      apiFetch<{ ok: true; removed: number }>(`/api/links/${kind}/${clerkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.links.mine() });
    },
  });
}
