import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ContextMemoryKind =
  | "school"
  | "sport"
  | "work"
  | "family"
  | "illness"
  | "injury"
  | "stress"
  | "sleep"
  | "motivation"
  | "race"
  | "camp"
  | "general";

export type ContextMemoryStatus = "scheduled" | "followed_up" | "dismissed";

export type ContextImportance = "low" | "medium" | "high";

export type EmotionalTone =
  | "neutraal"
  | "gespannen"
  | "vermoeid"
  | "teleurgesteld"
  | "ongemotiveerd"
  | "positief";

export type ContextVisibility = "private" | "shared";

export type ContextSignal = { label: string; value: string };

export type ContextMemory = {
  id: number;
  kind: ContextMemoryKind;
  statement: string;
  title: string;
  detail: string | null;
  followUpQuestion: string;
  followUpAt: string | null;
  followUpDone: boolean;
  status: ContextMemoryStatus;
  response: string | null;
  importance: ContextImportance;
  emotionalTone: EmotionalTone | null;
  visibility: ContextVisibility;
  enabled: boolean;
  signals: ContextSignal[] | null;
  createdAt: string;
  updatedAt: string;
  followedUpAt: string | null;
};

// A due follow-up carries the exact prompt to show (direct question when fresh,
// or a "Je zei laatst dat ..." recall when the athlete returns late).
export type DueFollowUp = ContextMemory & { prompt: string };

type CaptureResult = {
  detected: boolean;
  gated: boolean;
  memory: ContextMemory | null;
};

const previewEnabled = (isSignedIn: boolean | undefined) =>
  isSignedIn === true || DEV_PREVIEW;

export function useContextMemories(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.contextMemory.list(),
    queryFn: () =>
      apiFetch<{ memories: ContextMemory[] }>("/api/memory/context"),
    enabled: previewEnabled(isSignedIn) && enabled,
    staleTime: 60_000,
  });
}

export function useDueFollowUps(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.contextMemory.due(),
    queryFn: () => apiFetch<{ due: DueFollowUp[] }>("/api/memory/follow-ups/due"),
    enabled: previewEnabled(isSignedIn) && enabled,
    staleTime: 30_000,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.contextMemory.all() });
  };
}

export function useCaptureContext() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (statement: string) =>
      apiFetch<CaptureResult>("/api/memory/context", {
        method: "POST",
        body: JSON.stringify({ statement }),
      }),
    onSuccess: invalidate,
  });
}

export function useAnswerFollowUp() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, response }: { id: number; response: string }) =>
      apiFetch<{ memory: ContextMemory }>(
        `/api/memory/follow-ups/${id}/answer`,
        { method: "POST", body: JSON.stringify({ response }) },
      ),
    onSuccess: invalidate,
  });
}

export function useDismissFollowUp() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ memory: ContextMemory }>(
        `/api/memory/follow-ups/${id}/dismiss`,
        { method: "POST" },
      ),
    onSuccess: invalidate,
  });
}

export function useSetContextEnabled() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch<{ memory: ContextMemory }>(`/api/memory/context/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: invalidate,
  });
}

export function useSetContextVisibility() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({
      id,
      visibility,
    }: {
      id: number;
      visibility: ContextVisibility;
    }) =>
      apiFetch<{ memory: ContextMemory }>(`/api/memory/context/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ visibility }),
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteContextMemory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/memory/context/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
