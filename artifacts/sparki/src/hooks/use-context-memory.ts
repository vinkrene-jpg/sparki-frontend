import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ContextMemoryKind =
  | "exam"
  | "race"
  | "injury"
  | "sleep"
  | "camp"
  | "general";

export type ContextMemoryStatus = "scheduled" | "followed_up" | "dismissed";

export type ContextSignal = { label: string; value: string };

export type ContextMemory = {
  id: number;
  kind: ContextMemoryKind;
  statement: string;
  title: string;
  detail: string | null;
  followUpQuestion: string;
  followUpAt: string | null;
  status: ContextMemoryStatus;
  response: string | null;
  enabled: boolean;
  signals: ContextSignal[] | null;
  createdAt: string;
  updatedAt: string;
  followedUpAt: string | null;
};

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
    queryFn: () => apiFetch<{ due: ContextMemory[] }>("/api/memory/follow-ups/due"),
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

export function useDeleteContextMemory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/memory/context/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
