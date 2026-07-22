import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch, API_BASE } from "@/lib/api";

export type RoleVisibilityEntry = {
  level: string;
  ziet: string[];
  zietNiet: string[];
};

export type AccountOverview = {
  profiel: {
    email: string;
    naam: string | null;
    rollen: string[];
    actieveRol: string;
    aangemaaktOp: string;
  };
  koppelingen: Array<{
    provider: string;
    status: string;
    lastSyncAt: string | null;
  }>;
  coachLinks: Array<{ coachClerkId: string; status: string }>;
  ouderLinks: Array<{ parentClerkId: string; status: string }>;
  wieZietWat: {
    coach: RoleVisibilityEntry;
    ouder: RoleVisibilityEntry;
    club: RoleVisibilityEntry;
    vrienden: RoleVisibilityEntry;
  };
  verwijdering: {
    aangevraagdOp: string;
    definitiefOp: string;
    herstelbaar: boolean;
  } | null;
};

export type LegalDoc = {
  kind: "privacy" | "terms";
  version: string;
  title: string;
  bodyMd: string;
  publishedAt: string;
};

const KEY = ["account", "overview"] as const;

export function useAccountOverview(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<AccountOverview>("/api/account/overview"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 60_000,
  });
}

export function useLegalDocument(kind: "privacy" | "terms", enabled = true) {
  return useQuery({
    queryKey: ["legal", kind],
    queryFn: () => apiFetch<LegalDoc>(`/api/legal/${kind}`),
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useAcceptLegal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: "privacy" | "terms") =>
      apiFetch<{ ok: true; version: string }>(`/api/legal/${kind}/accept`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["privacy"] });
      void qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useRequestAccountDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirm: string) =>
      apiFetch<{ ok: true; definitiefOp: string }>("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ confirm }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelAccountDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>("/api/account/delete/cancel", { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useEndSessions() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>("/api/account/sessions/end", { method: "POST" }),
  });
}

/** Haal de volledige data-export op en start een JSON-download. */
export function useExportAccount() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/account/export`, {
        credentials: "include",
      });
      if (!res.ok) {
        let msg = "Export is niet gelukt. Probeer het opnieuw.";
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) msg = body.error;
        } catch {
          // laat de standaardmelding staan
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sparki-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    },
  });
}
