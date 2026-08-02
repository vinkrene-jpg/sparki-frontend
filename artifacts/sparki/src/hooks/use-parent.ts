import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ParentAthlete = {
  athleteClerkId: string;
  displayName: string | null;
  sharing: "none" | "safety_only" | "summary";
  parentConsentStatus: "not_required" | "pending" | "granted" | "revoked";
  healthStatus?: string;
  wellbeing?: {
    metricDate: string;
    sleepHours: string | null;
    sleepQuality: number | null;
    fatigueScore: number | null;
    feelScore: number | null;
  } | null;
  schedule?: { scheduledDate: string; title: string; type: string }[];
};

export function useParentAthletes(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.parent.athletes(),
    queryFn: () =>
      apiFetch<{ athletes: ParentAthlete[] }>("/api/parent/athletes"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 2 * 60_000,
  });
}

// ── Ouderomgeving (Afbouwgolf 12) ────────────────────────────────────────────

export type ParentDataCategory =
  | "planning"
  | "aanwezigheid"
  | "herstel"
  | "gezondheid"
  | "slaap"
  | "locatie"
  | "wedstrijd"
  | "communicatie";

export type ParentAccess = {
  level: "none" | "safety_only" | "summary";
  tier: "u16" | "16_17" | "adult" | "unknown";
  reconfirmRequired: boolean;
  permissions: Record<ParentDataCategory, boolean>;
  parentMayEdit: boolean;
};

export type ParentReport = {
  id: number;
  kind: "ziek" | "blessure" | "afwezig";
  note: string | null;
  status: "open" | "gezien" | "afgerond";
  createdAt: string;
};

export type EmergencyContact = {
  id: number;
  name: string;
  phone: string;
  relation: string | null;
  priority: number;
};

export type ParentOverviewChild = {
  athleteClerkId: string;
  displayName: string | null;
  relationship: string;
  access: ParentAccess;
  healthStatus?: string;
  openReports?: ParentReport[];
  wellbeing?: {
    metricDate: string;
    sleepHours?: string | null;
    sleepQuality?: number | null;
    fatigueScore?: number | null;
    feelScore?: number | null;
  } | null;
  today?: { id: number; title: string; type: string; scheduledDate: string }[];
  races?: {
    id: number;
    name: string;
    raceDate: string;
    parentDecision: string | null;
  }[];
  unreadMessages?: number;
  emergencyContacts: EmergencyContact[];
};

export function useParentOverview(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.parent.overview(),
    queryFn: () =>
      apiFetch<{ children: ParentOverviewChild[] }>("/api/parent/overview"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 60_000,
  });
}

export function useUpdateParentPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      permissions,
    }: {
      athleteClerkId: string;
      permissions: Record<ParentDataCategory, boolean>;
    }) =>
      apiFetch<{ ok: true }>(
        `/api/parent/athletes/${athleteClerkId}/permissions`,
        { method: "PUT", body: JSON.stringify({ permissions }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.all() });
    },
  });
}

export function useCreateParentReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      kind,
      note,
    }: {
      athleteClerkId: string;
      kind: "ziek" | "blessure" | "afwezig";
      note?: string;
    }) =>
      apiFetch<{ report: ParentReport }>(
        `/api/parent/athletes/${athleteClerkId}/reports`,
        { method: "POST", body: JSON.stringify({ kind, note }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.all() });
    },
  });
}

export function useParentConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      subjectType,
      subjectId,
      decision,
    }: {
      athleteClerkId: string;
      subjectType: "race" | "planning" | "club_training";
      subjectId: string;
      decision: "bevestigd" | "afgewezen";
    }) =>
      apiFetch<{ confirmation: unknown }>(
        `/api/parent/athletes/${athleteClerkId}/confirmations`,
        {
          method: "POST",
          body: JSON.stringify({ subjectType, subjectId, decision }),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.all() });
    },
  });
}

export function useAddEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      name,
      phone,
      relation,
    }: {
      athleteClerkId: string;
      name: string;
      phone: string;
      relation?: string;
    }) =>
      apiFetch<{ contact: EmergencyContact }>(
        `/api/parent/athletes/${athleteClerkId}/emergency-contacts`,
        { method: "POST", body: JSON.stringify({ name, phone, relation }) },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.all() });
    },
  });
}

export function useDeleteEmergencyContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      id,
    }: {
      athleteClerkId: string;
      id: number;
    }) =>
      apiFetch<{ ok: true }>(
        `/api/parent/athletes/${athleteClerkId}/emergency-contacts/${id}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.all() });
    },
  });
}

export type ParentMessage = {
  id: number;
  senderClerkId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export function useParentMessages(athleteClerkId: string, enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.parent.messages(athleteClerkId),
    queryFn: () =>
      apiFetch<{ messages: ParentMessage[] }>(
        `/api/parent/athletes/${athleteClerkId}/messages`,
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 30_000,
  });
}

export function useSendParentMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      athleteClerkId,
      body,
    }: {
      athleteClerkId: string;
      body: string;
    }) =>
      apiFetch<{ message: ParentMessage }>(
        `/api/parent/athletes/${athleteClerkId}/messages`,
        { method: "POST", body: JSON.stringify({ body }) },
      ),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({
        queryKey: queryKeys.parent.messages(vars.athleteClerkId),
      });
      void qc.invalidateQueries({ queryKey: queryKeys.parent.overview() });
    },
  });
}

// WP-R1 — gekoppelde trainer(s) van een kind, uitsluitend binnen de bestaande
// toestemmingslaag (categorie "communicatie"); anders { allowed:false }.
export type ParentChildTrainers = {
  allowed: boolean;
  reason?: string;
  trainers: { coachClerkId: string; displayName: string; email: string | null }[];
};

export function useParentTrainers(athleteClerkId: string | null) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: [...queryKeys.parent.all(), "trainers", athleteClerkId],
    queryFn: () =>
      apiFetch<ParentChildTrainers>(
        `/api/parent/athletes/${athleteClerkId}/trainers`,
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && !!athleteClerkId,
    staleTime: 5 * 60_000,
  });
}

/**
 * A parent ends the link to an athlete from their own side. Scoped server-side
 * to the caller's own parent links; refreshes the list so the child disappears.
 */
export function useEndParentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (athleteClerkId: string) =>
      apiFetch<{ ok: true }>(`/api/links/as-parent/${athleteClerkId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.parent.athletes() });
    },
  });
}
