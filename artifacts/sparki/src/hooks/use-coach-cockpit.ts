// Coach-cockpit hooks: centrale dashboarddata, signalen + besluiten, planning
// (CRUD op coachtrainingen, herhalen, bulk), Sparki-wijzigingsvoorstellen,
// berichten en coachcontext. Alles praat met /api/coach/* (coach-cockpit.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import type { Readiness } from "@/hooks/use-coach";

const ck = {
  dashboard: () => ["coach", "cockpit", "dashboard"] as const,
  signals: (id: string) => ["coach", "cockpit", id, "signals"] as const,
  workouts: (id: string) => ["coach", "cockpit", id, "workouts"] as const,
  proposals: (id: string) => ["coach", "cockpit", id, "proposals"] as const,
  messages: (id: string) => ["coach", "cockpit", id, "messages"] as const,
  context: (id: string) => ["coach", "cockpit", id, "context"] as const,
  privateNotes: (id: string) => ["coach", "cockpit", id, "private-notes"] as const,
  myMessages: () => ["coach", "cockpit", "my-messages"] as const,
  aboutMe: () => ["coach", "cockpit", "about-me"] as const,
};

export type CoachSignal = {
  key: string;
  category: string;
  priority: 1 | 2 | 3;
  title: string;
  changed: string;
  sources: string[];
  confidence: "hoog" | "middel" | "laag";
  whyHuman: string;
  proposedAction: string;
  action: { action: string; note: string | null; updatedAt: string } | null;
};

export type DashboardAthlete = {
  athleteClerkId: string;
  displayName: string | null;
  sharing: "none" | "summary" | "full";
  // "direct" = geaccepteerde coach-sporterlink (volledige individuele cockpit);
  // "team" = alleen club-/teamtoewijzing (zichtbaarheid, geen schrijfacties).
  relation?: "direct" | "team";
  lastReviewedAt: string | null;
  discipline?: string | null;
  healthStatus?: string | null;
  readiness?: Readiness;
  todayWorkout?: { id: number; title: string; type: string; status: string; source: string } | null;
  lastActivity?: { id: number; title: string | null; sessionDate: string; durationMin: number | null } | null;
  topSignal?: CoachSignal | null;
  openSignals: number;
  unreadMessages?: number;
  priority: number | null;
};

export type CoachWorkout = {
  id: number;
  scheduledDate: string;
  title: string;
  type: string;
  description: string | null;
  targetDurationMin: number | null;
  targetTSS: number | null;
  status: string;
  source: string;
  structure: Record<string, unknown> | null;
};

export type CoachProposal = {
  id: number;
  athleteClerkId: string;
  workoutId: number;
  reason: string;
  changes: Record<string, unknown> | null;
  status: string;
  coachNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type CoachMessage = {
  id: number;
  coachClerkId: string;
  athleteClerkId: string;
  senderClerkId: string;
  body: string;
  subjectType: string;
  subjectId: number | null;
  subjectKey: string | null;
  readAt: string | null;
  createdAt: string;
};

export type CoachContextItem = {
  id: number;
  coachClerkId: string;
  athleteClerkId: string;
  kind: string;
  body: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
};

function useEnabled(extra = true) {
  const { isSignedIn } = useUser();
  return (isSignedIn === true || DEV_PREVIEW) && extra;
}

export function useCoachDashboard() {
  return useQuery({
    queryKey: ck.dashboard(),
    queryFn: () => apiFetch<{ athletes: DashboardAthlete[] }>("/api/coach/dashboard"),
    enabled: useEnabled(),
    staleTime: 60_000,
  });
}

export function useCoachSignals(athleteId: string | null) {
  return useQuery({
    queryKey: ck.signals(athleteId ?? ""),
    queryFn: () =>
      apiFetch<{ signals: CoachSignal[] }>(`/api/coach/athletes/${athleteId}/signals`),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 60_000,
  });
}

export function useSignalAction(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { signalKey: string; action: string; note?: string }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/signals/action`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ck.signals(athleteId ?? "") });
      void qc.invalidateQueries({ queryKey: ck.dashboard() });
    },
  });
}

export function useMarkReviewed(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/coach/athletes/${athleteId}/review`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ck.dashboard() }),
  });
}

export function useCoachWorkouts(athleteId: string | null, from?: string, to?: string) {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return useQuery({
    queryKey: [...ck.workouts(athleteId ?? ""), from ?? "", to ?? ""],
    queryFn: () =>
      apiFetch<{ workouts: CoachWorkout[] }>(
        `/api/coach/athletes/${athleteId}/workouts?${qs.toString()}`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 30_000,
  });
}

// Gestructureerde stap uit de workoutbouwer (585). Vermogensdoelen zijn altijd
// %FTP-bereiken — het device van de sporter rekent met de eigen FTP.
export type BuilderStep = {
  soort: "warmup" | "werk" | "herstel" | "cooldown" | "vrij";
  naam?: string | null;
  duurMin: number;
  ftpLowPct?: number | null;
  ftpHighPct?: number | null;
  rpe?: number | null;
  herhaal?: number | null;
  rustMin?: number | null;
  rustFtpPct?: number | null;
};

export type WorkoutInput = {
  scheduledDate: string;
  title: string;
  type?: string;
  description?: string | null;
  targetDurationMin?: number | null;
  targetTSS?: number | null;
  raceId?: number | null;
  steps?: BuilderStep[];
};

export function useCreateCoachWorkout(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput) =>
      apiFetch(`/api/coach/athletes/${athleteId}/workouts`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.workouts(athleteId ?? "") }),
  });
}

export function useUpdateCoachWorkout(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<WorkoutInput> & { id: number; status?: string }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/workouts/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.workouts(athleteId ?? "") }),
  });
}

export function useRepeatCoachWorkout(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dates }: { id: number; dates: string[] }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/workouts/${id}/repeat`, {
        method: "POST",
        body: JSON.stringify({ dates }),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.workouts(athleteId ?? "") }),
  });
}

export function useBulkCoachWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput & { athleteClerkIds: string[] }) =>
      apiFetch<{ created: string[]; skipped: { athleteClerkId: string; reason: string }[] }>(
        "/api/coach/workouts/bulk",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["coach", "cockpit"] }),
  });
}

export function useCoachProposals(athleteId: string | null) {
  return useQuery({
    queryKey: ck.proposals(athleteId ?? ""),
    queryFn: () =>
      apiFetch<{ proposals: CoachProposal[] }>(
        `/api/coach/athletes/${athleteId}/proposals`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 30_000,
  });
}

export function useProposalDecision(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      proposalId: number;
      action: string;
      note?: string;
      changes?: Record<string, unknown>;
    }) =>
      apiFetch(`/api/coach/proposals/${input.proposalId}/decision`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ck.proposals(athleteId ?? "") });
      void qc.invalidateQueries({ queryKey: ck.workouts(athleteId ?? "") });
      void qc.invalidateQueries({ queryKey: ck.signals(athleteId ?? "") });
    },
  });
}

export function useCoachMessages(athleteId: string | null) {
  return useQuery({
    queryKey: ck.messages(athleteId ?? ""),
    queryFn: () =>
      apiFetch<{ messages: CoachMessage[] }>(
        `/api/coach/athletes/${athleteId}/messages`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 15_000,
  });
}

export function useSendCoachMessage(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      body: string;
      subjectType?: string;
      subjectId?: number;
      subjectKey?: string;
    }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.messages(athleteId ?? "") }),
  });
}

// Sporterkant
export function useMyCoachMessages() {
  return useQuery({
    queryKey: ck.myMessages(),
    queryFn: () =>
      apiFetch<{ messages: CoachMessage[]; coaches: Record<string, string | null> }>(
        "/api/coach/messages",
      ),
    enabled: useEnabled(),
    staleTime: 30_000,
  });
}

export function useReplyToCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { coachClerkId: string; body: string }) =>
      apiFetch("/api/coach/messages/reply", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ck.myMessages() }),
  });
}

export function useCoachContextItems(athleteId: string | null) {
  return useQuery({
    queryKey: ck.context(athleteId ?? ""),
    queryFn: () =>
      apiFetch<{ items: CoachContextItem[] }>(
        `/api/coach/athletes/${athleteId}/context-items`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 30_000,
  });
}

export function useCreateContextItem(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      kind: string;
      body: string;
      startDate?: string | null;
      endDate?: string | null;
    }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/context-items`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.context(athleteId ?? "") }),
  });
}

export function useDeleteContextItem(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      apiFetch(`/api/coach/context-items/${itemId}`, { method: "DELETE" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.context(athleteId ?? "") }),
  });
}

// ── Echte privénotities (WP-01C) — alleen zichtbaar voor de trainer zelf ────

export type CoachPrivateNote = {
  id: number;
  ownerCoachClerkId: string;
  athleteClerkId: string;
  body: string;
  context: string | null;
  createdAt: string;
  updatedAt: string;
};

export function usePrivateNotes(athleteId: string | null) {
  return useQuery({
    queryKey: ck.privateNotes(athleteId ?? ""),
    queryFn: () =>
      apiFetch<{ notes: CoachPrivateNote[] }>(
        `/api/coach/athletes/${athleteId}/private-notes`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 30_000,
  });
}

export function useCreatePrivateNote(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; context?: string | null }) =>
      apiFetch(`/api/coach/athletes/${athleteId}/private-notes`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.privateNotes(athleteId ?? "") }),
  });
}

export function useDeletePrivateNote(athleteId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: number) =>
      apiFetch(`/api/coach/private-notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ck.privateNotes(athleteId ?? "") }),
  });
}

// ── Naleving: gepland vs. werkelijk uitgevoerd ──────────────────────────────

export type ComplianceStatus = "groen" | "geel" | "rood" | "open" | "grijs";

export type ComplianceEntry = {
  date: string;
  status: ComplianceStatus;
  reason: string | null;
  planned: {
    id: number;
    title: string;
    source: string;
    targetDurationMin: number | null;
    targetTSS: number | null;
  } | null;
  executed: {
    sessionId: number;
    title: string | null;
    durationMin: number | null;
    tss: number | null;
    hrLoad: number | null;
  } | null;
  extra: boolean;
};

export type ComplianceSummary = {
  groen: number;
  geel: number;
  rood: number;
  open: number;
  extra: number;
};

export function useCoachCompliance(athleteId: string | null) {
  return useQuery({
    queryKey: ["coach", "cockpit", athleteId ?? "", "compliance"] as const,
    queryFn: () =>
      apiFetch<{ from: string; to: string; entries: ComplianceEntry[]; summary: ComplianceSummary }>(
        `/api/coach/athletes/${athleteId}/compliance`,
      ),
    enabled: useEnabled(Boolean(athleteId)),
    staleTime: 60_000,
  });
}

export type ComplianceOverviewAthlete = {
  athleteClerkId: string;
  displayName: string | null;
  sharing: "none" | "summary" | "full";
  summary: ComplianceSummary | null;
};

export function useCoachComplianceOverview(enabled = true) {
  return useQuery({
    queryKey: ["coach", "cockpit", "compliance-overview"] as const,
    queryFn: () =>
      apiFetch<{ from: string; to: string; athletes: ComplianceOverviewAthlete[] }>(
        "/api/coach/compliance/overview",
      ),
    enabled: useEnabled(enabled),
    staleTime: 60_000,
  });
}

export function useContextAboutMe() {
  return useQuery({
    queryKey: ck.aboutMe(),
    queryFn: () =>
      apiFetch<{ items: CoachContextItem[] }>("/api/coach/context-items/about-me"),
    enabled: useEnabled(),
    staleTime: 60_000,
  });
}
