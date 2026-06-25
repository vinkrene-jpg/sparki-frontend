import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import type {
  IntelFeedItem,
  IntelInteractionState,
  IntelMeta,
  MythAnswer,
} from "@/lib/intel-types";

export function useIntelMeta() {
  const { isSignedIn } = useUser();
  const enabled = useFeatureFlag("knowledge_base");
  return useQuery({
    queryKey: queryKeys.intel.meta(),
    queryFn: () => apiFetch<IntelMeta>("/api/intel/meta"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: STALE.flags,
  });
}

export function useIntelFeed(opts: {
  kind?: string;
  topic?: string;
  q?: string;
  scope?: "all" | "saved";
  enabled?: boolean;
}) {
  const { isSignedIn } = useUser();
  const flagOn = useFeatureFlag("knowledge_base");
  const kind = opts.kind ?? "";
  const topic = opts.topic ?? "";
  const q = opts.q?.trim() ?? "";
  const scope = opts.scope ?? "all";

  return useQuery({
    queryKey: queryKeys.intel.feed(kind, topic, q, scope),
    queryFn: () => {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (topic) params.set("topic", topic);
      if (q) params.set("q", q);
      if (scope === "saved") params.set("scope", "saved");
      const qs = params.toString();
      return apiFetch<{ items: IntelFeedItem[] }>(
        `/api/intel${qs ? `?${qs}` : ""}`,
      );
    },
    enabled:
      (isSignedIn === true || DEV_PREVIEW) && flagOn && (opts.enabled ?? true),
    staleTime: STALE.session,
  });
}

// Toggle a save / read-later / interesting flag for one card. Optimistic-free:
// we invalidate the whole intel domain so feed + saved scope + detail re-sync.
export function useToggleIntelFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      field: "saved" | "readLater" | "interesting";
      value: boolean;
    }) =>
      apiFetch<{ interaction: IntelInteractionState }>(
        `/api/intel/${vars.id}/flag`,
        {
          method: "POST",
          body: JSON.stringify({ field: vars.field, value: vars.value }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.intel.all() });
    },
  });
}

// Submit a Myth Buster answer; the response reveals whether it was correct
// (judged server-side against the card's real verdict — never on the client).
export function useAnswerMyth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; answer: MythAnswer }) =>
      apiFetch<{ correct: boolean; state: IntelInteractionState }>(
        `/api/intel/${vars.id}/answer`,
        {
          method: "POST",
          body: JSON.stringify({ answer: vars.answer }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.intel.all() });
    },
  });
}
